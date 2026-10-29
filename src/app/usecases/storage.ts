import type { Block } from '@core/types';
import { version as appVersion } from '../../../package.json';
import { SCHEMA_VERSION, migrate } from '@data/migrations';
import type { Db } from '@data/db';
import {
  sanitizeSnapshot,
  validateManifest,
  BackupError,
  type BackupManifest,
  type StorageIO,
} from '@services/backup';
import type { Container } from '../container';
import { disposeContainerSessions } from '../study/registry';
import { disposeReaderRuntime } from '../readerRuntime';
import { getParseQueue } from './parseQueue';
export type { StorageIO } from '@services/backup';
export { BackupError } from '@services/backup';
const ports = new WeakMap<Container, StorageIO>();
let serial = 0;
export function configureStorageRuntime(c: Container, io: StorageIO): void {
  ports.set(c, io);
}
export function storageRuntime(c: Container): StorageIO {
  const io = ports.get(c);
  if (!io) throw new BackupError('文件服务尚未就绪，请重新打开应用');
  return io;
}
const safeId = (id: string) => {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new BackupError('书籍标识无效');
  return id;
};
const bookPath = (io: StorageIO, id: string) =>
  `${io.documentDir}/books/${safeId(id)}`;
export async function loadStorage(c: Container) {
  const io = ports.get(c),
    books = await c.repos.books.list();
  return Promise.all(
    books.map(async book => ({
      id: book.id,
      title: book.title,
      sizeBytes: book.size_bytes,
      needsReparse:
        book.tokens_total === 0 &&
        (await c.repos.settings.get<Block[] | null>(
          `reparse.blocks.${book.id}`,
          null,
        )) !== null,
      parsedBytes: io
        ? Math.max(
            0,
            (await io.dirSize(bookPath(io, book.id))) - book.size_bytes,
          )
        : 0,
      available: !!io,
    })),
  );
}
/** Retain the old source text for reparse matching before clearing derived caches. */
export async function clearParseCache(
  c: Container,
  bookId: string,
): Promise<void> {
  const io = storageRuntime(c),
    directory = bookPath(io, bookId);
  await getParseQueue(c).dispose();
  await disposeContainerSessions(c);
  await disposeReaderRuntime(c);
  const blocks = await c.db.all<Block>(
    'SELECT * FROM block WHERE book_id=? ORDER BY seq',
    [bookId],
  );
  const previous = await c.repos.settings.get<Block[]>(
    `reparse.blocks.${bookId}`,
    [],
  );
  const snapshot = [
    ...new Map(
      [...previous, ...blocks].map(block => [block.seq, block]),
    ).values(),
  ];
  await c.db.transaction(async tx => {
    await tx.run(
      'INSERT INTO setting(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      [`reparse.blocks.${bookId}`, JSON.stringify(snapshot)],
    );
    for (const table of ['block', 'book_part', 'section_part', 'lesson_plan'])
      await tx.run(`DELETE FROM ${table} WHERE book_id=?`, [bookId]);
    await tx.run(
      "UPDATE book SET ready_to_page=0,tokens_total=0,status=CASE WHEN status IN ('parsing','importing') THEN 'paused' ELSE status END WHERE id=?",
      [bookId],
    );
  });
  await Promise.all(
    [`${directory}/mineru`, `${directory}/images`, `${io.cacheDir}/pages`].map(
      path => io.remove(path),
    ),
  );
  const book = await c.repos.books.get(bookId);
  if (book) c.events.emit('book.parse', { bookId, status: book.status });
}
export async function preservedReparseBlocks(
  c: Container,
  bookId: string,
): Promise<Block[]> {
  return c.repos.settings.get<Block[]>(`reparse.blocks.${bookId}`, []);
}
export async function exportBackup(
  c: Container,
  includeOriginals = false,
  destination: 'downloads' | 'share' = 'downloads',
): Promise<string> {
  const io = storageRuntime(c),
    name = `pagewise-backup-${c.clock.today()}.zip`,
    working = `${io.cacheDir}/backup-${++serial}`,
    snapshot = `${working}/db.sqlite`,
    archive = `${working}.zip`;
  await io.mkdir(working);
  try {
    await c.appearance.flush();
    await c.db.run('VACUUM INTO ?', [snapshot]);
    const db = await io.openSnapshot(snapshot);
    let manifest: BackupManifest;
    try {
      await sanitizeSnapshot(db);
      const books = await db.all<{
        id: string;
        title: string;
        sha256: string;
        format: 'pdf' | 'epub';
      }>('SELECT id,title,sha256,format FROM book ORDER BY created_at,id');
      manifest = {
        format: 'pagewise-backup',
        version: 1,
        schemaVersion: SCHEMA_VERSION,
        appVersion,
        createdAt: c.clock.now().toISOString(),
        books: books.map(book => ({ ...book, originalIncluded: false })),
      };
      for (const book of manifest.books) {
        const source = `${bookPath(io, book.id)}/source.${book.format}`;
        if (includeOriginals && (await io.exists(source))) {
          const dir = `${working}/books/${book.id}`;
          await io.mkdir(dir);
          await io.copy(source, `${dir}/source.${book.format}`);
          book.originalIncluded = true;
        }
        const images = await db.all<{ seq: number; image_path: string }>(
          'SELECT seq,image_path FROM block WHERE book_id=? AND image_path IS NOT NULL',
          [book.id],
        );
        const assets = new Set<string>();
        const base = `${bookPath(io, book.id)}/`;
        for (const image of images) {
          const path = image.image_path.replace(/^file:\/\//, '');
          const relative = path.startsWith(base)
            ? path.slice(base.length)
            : path;
          if (
            !/^images\/(?:[^/\\]+\/)*[^/\\]+$/.test(relative) ||
            relative.split('/').some(part => part === '.' || part === '..') ||
            !(await io.exists(`${base}${relative}`))
          )
            continue;
          if (!assets.has(relative)) {
            const target = `${working}/books/${book.id}/${relative}`;
            await io.mkdir(target.slice(0, target.lastIndexOf('/')));
            await io.copy(`${base}${relative}`, target);
            assets.add(relative);
          }
          // Absolute EPUB paths belong to this install; persist the portable book-relative path.
          if (relative !== image.image_path)
            await db.run(
              'UPDATE block SET image_path=? WHERE book_id=? AND seq=?',
              [relative, book.id, image.seq],
            );
        }
        if (assets.size) book.imageFiles = [...assets].sort();
      }
      await db.run(
        'INSERT INTO setting(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
        [
          'backup.missingOriginals',
          JSON.stringify(
            manifest.books
              .filter(book => !book.originalIncluded)
              .map(book => ({ id: book.id, sha256: book.sha256 })),
          ),
        ],
      );
      await db.run('VACUUM');
      await db.run('PRAGMA wal_checkpoint(TRUNCATE)');
    } finally {
      await db.close();
    }
    await io.writeText(
      `${working}/manifest.json`,
      JSON.stringify(manifest, null, 2),
    );
    await io.zip(working, archive);
    if (destination === 'share') {
      await io.share(archive, 'application/zip');
      return archive;
    }
    return await io.saveDownloads(archive, name, 'application/zip');
  } finally {
    await io.remove(working);
    if (destination === 'downloads') await io.remove(archive);
  }
}
export async function restoreBackup(
  c: Container,
  path?: string,
): Promise<boolean> {
  const io = storageRuntime(c),
    source = path ?? (await io.pickBackup());
  if (!source) return false;
  const working = `${io.cacheDir}/restore-${++serial}`;
  await io.mkdir(working);
  try {
    await io.unzip(source, working);
    let manifest: BackupManifest;
    try {
      manifest = validateManifest(
        JSON.parse(await io.readText(`${working}/manifest.json`)),
        SCHEMA_VERSION,
      );
    } catch (error) {
      if (error instanceof BackupError) throw error;
      throw new BackupError('备份清单无法读取');
    }
    const snapshot = `${working}/db.sqlite`;
    if (!(await io.exists(snapshot))) throw new BackupError('备份缺少数据库');
    const db = await io.openSnapshot(snapshot);
    try {
      const version = await db.get<{ user_version: number }>(
        'PRAGMA user_version',
      );
      if (version?.user_version !== manifest.schemaVersion)
        throw new BackupError('数据库版本与备份清单不一致');
      const integrity = await db.get<Record<string, string>>(
        'PRAGMA integrity_check',
      );
      if (
        !integrity ||
        !Object.values(integrity).every(value => value === 'ok')
      )
        throw new BackupError('备份数据库损坏');
      const books = await db.all<{ id: string; sha256: string }>(
        'SELECT id,sha256 FROM book',
      );
      if (
        books.length !== manifest.books.length ||
        books.some(
          book =>
            !manifest.books.some(
              item => item.id === book.id && item.sha256 === book.sha256,
            ),
        )
      )
        throw new BackupError('备份书籍清单与数据库不一致');
      for (const book of manifest.books)
        if (
          book.originalIncluded &&
          !(await io.exists(
            `${working}/books/${book.id}/source.${book.format}`,
          ))
        )
          throw new BackupError('备份缺少声明的原文件');
      for (const book of manifest.books)
        for (const image of book.imageFiles ?? [])
          if (!(await io.exists(`${working}/books/${book.id}/${image}`)))
            throw new BackupError('备份缺少声明的图片');
      await sanitizeSnapshot(db);
      await migrate(db as Db);
      await db.run(
        'INSERT INTO setting(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
        [
          'backup.missingOriginals',
          JSON.stringify(
            manifest.books
              .filter(book => !book.originalIncluded)
              .map(book => ({ id: book.id, sha256: book.sha256 })),
          ),
        ],
      );
      await db.run('VACUUM');
      await db.run('PRAGMA wal_checkpoint(TRUNCATE)');
    } finally {
      await db.close();
    }
    const originals: {
      source: string;
      dest: string;
      previous: string | null;
    }[] = [];
    for (const book of manifest.books) {
      const dir = bookPath(io, book.id);
      const files = [
        ...(book.originalIncluded ? [`source.${book.format}`] : []),
        ...(book.imageFiles ?? []),
      ];
      for (const file of files) {
        const dest = `${dir}/${file}`;
        const previous = (await io.exists(dest))
          ? `${working}/previous/${book.id}/${file}`
          : null;
        await io.mkdir(dest.slice(0, dest.lastIndexOf('/')));
        if (previous) {
          await io.mkdir(previous.slice(0, previous.lastIndexOf('/')));
          await io.copy(dest, previous);
        }
        originals.push({
          source: `${working}/books/${book.id}/${file}`,
          dest,
          previous,
        });
      }
    }
    // Stop all sessions and flush notes before replacing the database connection.
    await c.close();
    try {
      for (const file of originals) await io.copy(file.source, file.dest);
      await io.replaceDatabase(snapshot);
    } catch (error) {
      try {
        for (const file of originals) {
          if (file.previous) await io.copy(file.previous, file.dest);
          else await io.remove(file.dest);
        }
      } finally {
        // The device adapter retains the old database if its atomic replacement fails.
        await io.restart();
      }
      throw error;
    }
    await io.restart();
    return true;
  } finally {
    await io.remove(working);
  }
}
