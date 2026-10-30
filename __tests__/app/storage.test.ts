import { DatabaseSync } from 'node:sqlite';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  copyFile,
  rm,
  stat,
  readdir,
} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createDb, type Db, type Row } from '@data/db';
import { createTestDemoContainer } from '@app/testing';
import type { Container } from '@app/container';
import {
  configureStorageRuntime,
  clearParseCache,
  preservedReparseBlocks,
  exportBackup,
  restoreBackup,
  loadStorage,
} from '@app/usecases/storage';
import { SCHEMA_VERSION } from '@data/migrations';
import type { StorageIO } from '@services/backup';
import {
  chooseBackupPreview,
  discardBackupPreview,
  readLastBackup,
} from '@app/usecases/backupOverview';
const execute = promisify(execFile);
let c: Container, folder: string, io: StorageIO, replaced: string;
function openDb(file: string): Db {
  const db = new DatabaseSync(file);
  return createDb({
    query: async (sql, params) => {
      const statement = db.prepare(sql);
      if (statement.columns().length)
        return { rows: statement.all(...params) as Row[], changes: 0 };
      return { rows: [], changes: Number(statement.run(...params).changes) };
    },
    close: async () => {
      db.close();
    },
  });
}
async function size(file: string): Promise<number> {
  try {
    const info = await stat(file);
    if (!info.isDirectory()) return info.size;
    return (
      await Promise.all(
        (await readdir(file)).map(child => size(path.join(file, child))),
      )
    ).reduce((sum, value) => sum + value, 0);
  } catch {
    return 0;
  }
}
beforeEach(async () => {
  folder = await mkdtemp(path.join(os.tmpdir(), 'pagewise-storage-'));
  c = await createTestDemoContainer();
  const cacheDir = path.join(folder, 'cache'),
    documentDir = path.join(folder, 'files');
  await mkdir(cacheDir, { recursive: true });
  await mkdir(documentDir, { recursive: true });
  replaced = path.join(folder, 'restored.sqlite');
  io = {
    cacheDir,
    documentDir,
    mkdir: dir => mkdir(dir, { recursive: true }),
    readText: file => readFile(file, 'utf8'),
    writeText: writeFile,
    copy: copyFile,
    remove: file => rm(file, { recursive: true, force: true }),
    dirSize: size,
    exists: async file => {
      try {
        await stat(file);
        return true;
      } catch {
        return false;
      }
    },
    zip: async (source, dest) => {
      await execute('/usr/bin/zip', ['-q', '-r', dest, '.'], { cwd: source });
    },
    unzip: async (source, dest) => {
      await execute('/usr/bin/unzip', ['-q', '-o', source, '-d', dest]);
    },
    pickBackup: jest.fn(async () => null),
    share: jest.fn(async () => {}),
    saveDownloads: jest.fn(async (source, name) => {
      const out = path.join(folder, name);
      await copyFile(source, out);
      return out;
    }),
    openSnapshot: async file => openDb(file),
    replaceDatabase: jest.fn(async file => {
      await copyFile(file, replaced);
    }),
    restart: jest.fn(async () => {}),
  };
  configureStorageRuntime(c, io);
});
afterEach(async () => {
  await c.close();
  await rm(folder, { recursive: true, force: true });
});
it('clears only derived database/files and retains every kind of learning record plus source text for reparse matching', async () => {
  const tables = [
    'section',
    'message',
    'qa',
    'stuck',
    'card',
    'highlight',
    'pin',
    'section_note',
  ];
  const before = Object.fromEntries(
    await Promise.all(
      tables.map(async table => [
        table,
        await c.db.all(`SELECT * FROM ${table} WHERE book_id=?`, ['aima']),
      ]),
    ),
  );
  const bookDir = path.join(io.documentDir, 'books/aima');
  for (const dir of ['images', 'mineru']) {
    await mkdir(path.join(bookDir, dir), { recursive: true });
    await writeFile(path.join(bookDir, dir, 'cache'), 'derived');
  }
  await writeFile(path.join(bookDir, 'source.pdf'), 'original');
  await clearParseCache(c, 'aima');
  for (const table of ['block', 'book_part', 'section_part', 'lesson_plan'])
    expect(
      await c.db.all(`SELECT * FROM ${table} WHERE book_id=?`, ['aima']),
    ).toEqual([]);
  for (const table of tables)
    expect(
      await c.db.all(`SELECT * FROM ${table} WHERE book_id=?`, ['aima']),
    ).toEqual(before[table]);
  expect((await preservedReparseBlocks(c, 'aima')).length).toBeGreaterThan(0);
  expect(await readFile(path.join(bookDir, 'source.pdf'), 'utf8')).toBe(
    'original',
  );
  expect(await io.exists(path.join(bookDir, 'images'))).toBe(false);
  expect(
    (await loadStorage(c)).find(book => book.id === 'aima')?.needsReparse,
  ).toBe(true);
  const snapshot = await preservedReparseBlocks(c, 'aima');
  await clearParseCache(c, 'aima');
  expect(await preservedReparseBlocks(c, 'aima')).toEqual(snapshot);
});
it('exports a real SQLite/manifest ZIP and removes credential settings, including deleted bytes, while keeping the live settings untouched', async () => {
  const secret = 'sk-private-test-secret-12345678901234567890';
  await c.repos.settings.set('ai.key.leak', secret);
  await c.repos.settings.set('nested', {
    apiKey: secret,
    theme: 'paper',
    nested: { token: 'mnr_private-secret-1234567890', keyTail: '1234' },
  });
  const out = await exportBackup(c);
  expect(path.basename(out)).toBe('pagewise-backup-2026-10-29.zip');
  const extracted = path.join(folder, 'extracted');
  await mkdir(extracted);
  await io.unzip(out, extracted);
  const manifest = JSON.parse(
    await io.readText(path.join(extracted, 'manifest.json')),
  );
  expect(manifest).toMatchObject({
    format: 'pagewise-backup',
    schemaVersion: SCHEMA_VERSION,
  });
  expect(
    manifest.books.every(
      (book: { originalIncluded: boolean }) => !book.originalIncluded,
    ),
  ).toBe(true);
  const db = await io.openSnapshot(path.join(extracted, 'db.sqlite'));
  expect(
    await db.get('SELECT value FROM setting WHERE key=?', ['ai.key.leak']),
  ).toBeUndefined();
  expect(
    JSON.parse(
      (await db.get<{ value: string }>(
        'SELECT value FROM setting WHERE key=?',
        ['nested'],
      ))!.value,
    ),
  ).toEqual({ version: 1, data: { theme: 'paper', nested: { keyTail: '' } } });
  expect((await db.all('SELECT * FROM message')).length).toBeGreaterThan(0);
  await db.close();
  expect(
    (await readFile(path.join(extracted, 'db.sqlite'))).includes(
      Buffer.from(secret),
    ),
  ).toBe(false);
  expect(await c.repos.settings.get('ai.key.leak', '')).toBe(secret);
});
it('includes opted-in original files, validates and restores the SQLite snapshot, then restarts', async () => {
  const original = path.join(io.documentDir, 'books/aima/source.pdf');
  await mkdir(path.dirname(original), { recursive: true });
  await writeFile(original, 'synthetic source');
  const archive = await exportBackup(c, true);
  expect(await restoreBackup(c, archive)).toBe(true);
  expect(io.replaceDatabase).toHaveBeenCalledTimes(1);
  expect(io.restart).toHaveBeenCalledTimes(1);
  expect(await readFile(original, 'utf8')).toBe('synthetic source');
  const db = await io.openSnapshot(replaced);
  expect((await db.all('SELECT * FROM qa')).length).toBeGreaterThan(0);
  const missing = JSON.parse(
    (await db.get<{ value: string }>('SELECT value FROM setting WHERE key=?', [
      'backup.missingOriginals',
    ]))!.value,
  );
  expect(missing.some((book: { id: string }) => book.id === 'aima')).toBe(
    false,
  );
  expect(missing.length).toBeGreaterThan(0);
  await db.close();
});
it('backs up parsed image assets with portable paths and restores them after the book directory is removed', async () => {
  const image = path.join(io.documentDir, 'books/aima/images/figure.png');
  await mkdir(path.dirname(image), { recursive: true });
  await writeFile(image, 'synthetic image');
  const block = (await c.repos.blocks.bySection('aima', '3.5.2'))[0];
  await c.db.run('UPDATE block SET image_path=? WHERE book_id=? AND seq=?', [
    image,
    'aima',
    block.seq,
  ]);
  const archive = await exportBackup(c, true);
  await rm(path.join(io.documentDir, 'books'), {
    recursive: true,
    force: true,
  });
  expect(await restoreBackup(c, archive)).toBe(true);
  expect(await readFile(image, 'utf8')).toBe('synthetic image');
  const db = await io.openSnapshot(replaced);
  expect(
    (
      await db.get<{ image_path: string }>(
        'SELECT image_path FROM block WHERE book_id=? AND seq=?',
        ['aima', block.seq],
      )
    )?.image_path,
  ).toBe('images/figure.png');
  await db.close();
});
it('rolls back overwritten image assets if database replacement fails', async () => {
  const image = path.join(io.documentDir, 'books/aima/images/figure.png');
  await mkdir(path.dirname(image), { recursive: true });
  await writeFile(image, 'backup image');
  const block = (await c.repos.blocks.bySection('aima', '3.5.2'))[0];
  await c.db.run('UPDATE block SET image_path=? WHERE book_id=? AND seq=?', [
    'images/figure.png',
    'aima',
    block.seq,
  ]);
  const archive = await exportBackup(c);
  await writeFile(image, 'current image');
  jest.mocked(io.replaceDatabase).mockRejectedValueOnce(new Error('disk full'));
  await expect(restoreBackup(c, archive)).rejects.toThrow('disk full');
  expect(await readFile(image, 'utf8')).toBe('current image');
});
it('rejects invalid backup versions before closing or replacing the current database', async () => {
  const archive = await exportBackup(c),
    bad = path.join(folder, 'bad');
  await mkdir(bad);
  await io.unzip(archive, bad);
  const manifest = JSON.parse(
    await io.readText(path.join(bad, 'manifest.json')),
  );
  manifest.schemaVersion = SCHEMA_VERSION + 1;
  await io.writeText(path.join(bad, 'manifest.json'), JSON.stringify(manifest));
  const tampered = path.join(folder, 'bad.zip');
  await io.zip(bad, tampered);
  await expect(restoreBackup(c, tampered)).rejects.toThrow('版本');
  expect(io.replaceDatabase).not.toHaveBeenCalled();
  expect((await c.repos.books.list()).length).toBeGreaterThan(0);
});
it('restores the previous original file and reopens the retained database when device replacement fails', async () => {
  const original = path.join(io.documentDir, 'books/aima/source.pdf');
  await mkdir(path.dirname(original), { recursive: true });
  await writeFile(original, 'source stored in the backup');
  const archive = await exportBackup(c, true);
  await writeFile(original, 'current source before restore');
  jest.mocked(io.replaceDatabase).mockRejectedValueOnce(new Error('disk full'));
  await expect(restoreBackup(c, archive)).rejects.toThrow('disk full');
  expect(await readFile(original, 'utf8')).toBe(
    'current source before restore',
  );
  expect(io.restart).toHaveBeenCalledTimes(1);
});
it('treats file picker cancellation as a no-op and reports book storage through injected files', async () => {
  expect(await restoreBackup(c)).toBe(false);
  expect(io.replaceDatabase).not.toHaveBeenCalled();
  const books = await loadStorage(c);
  expect(books.length).toBeGreaterThan(0);
  expect(books.every(book => book.available && book.parsedBytes >= 0)).toBe(
    true,
  );
});
it('previews the selected backup before replacing data and records only successful exports', async () => {
  expect(await readLastBackup(c)).toBeNull();
  const archive = await exportBackup(c);
  const exported = await readLastBackup(c);
  expect(exported).toEqual({
    createdAt: c.clock.now().toISOString(),
    books: 3,
    originals: 0,
  });
  jest.mocked(io.pickBackup).mockResolvedValueOnce(archive);
  const preview = await chooseBackupPreview(c);
  expect(preview?.path).not.toBe(archive);
  expect(preview?.manifest.books).toHaveLength(3);
  expect(io.replaceDatabase).not.toHaveBeenCalled();
  expect((await c.repos.books.list()).length).toBe(3);
  if (!preview) throw new Error('preview missing');
  const originalBytes = await readFile(archive);
  await writeFile(archive, 'later picker selection');
  expect(await readFile(preview.path)).toEqual(originalBytes);
  await discardBackupPreview(c, preview);
  expect(
    (await readdir(io.cacheDir)).filter(name =>
      name.startsWith('backup-preview'),
    ),
  ).toEqual([]);
  jest.mocked(io.saveDownloads).mockRejectedValueOnce(new Error('disk full'));
  await expect(exportBackup(c, true)).rejects.toThrow('disk full');
  expect(await readLastBackup(c)).toEqual(exported);
  expect(await chooseBackupPreview(c)).toBeNull();
});
