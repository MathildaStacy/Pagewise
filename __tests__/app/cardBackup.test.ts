import { DatabaseSync } from 'node:sqlite';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { createDb, type Db, type Row } from '@data/db';
import { migrate, migrations, SCHEMA_VERSION } from '@data/migrations';
import { createCardsRepo } from '@data/repos/cards';
import { createTestContainer } from '@app/testing';
import type { Container } from '@app/container';
import {
  configureStorageRuntime,
  exportBackup,
  restoreBackup,
} from '@app/usecases/storage';
import type { BackupManifest, StorageIO } from '@services/backup';

const execute = promisify(execFile);
const at = '2026-10-29T08:00:00.000Z',
  today = '2026-10-29';
let c: Container, folder: string, io: StorageIO, restored: string;
function openDb(file: string): Db {
  const db = new DatabaseSync(file);
  return createDb({
    query: async (sql, params) => {
      const statement = db.prepare(sql);
      return statement.columns().length
        ? { rows: statement.all(...params) as Row[], changes: 0 }
        : { rows: [], changes: Number(statement.run(...params).changes) };
    },
    close: async () => db.close(),
  });
}
async function seed(db: Db) {
  await db.run(
    'INSERT INTO book (id,sha256,title,format,size_bytes,cover_color,status,created_at) VALUES (?,?,?,?,?,?,?,?)',
    ['book', 'sha', '示意书', 'pdf', 1, '#000000', 'ready', at],
  );
  await db.run(
    'INSERT INTO card (id,book_id,section_id,front,back,box,due_on,origin,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
    [41, 'book', 'one', '问题', '答案', 3, today, 'manual', at],
  );
  await db.run(
    'INSERT INTO review_log (card_id,rated,box_from,box_to,at) VALUES (?,?,?,?,?)',
    [41, 'good', 2, 3, at],
  );
}
beforeEach(async () => {
  folder = await mkdtemp(path.join(process.cwd(), '.card-backup-test-'));
  c = await createTestContainer();
  await seed(c.db);
  const cacheDir = path.join(folder, 'cache'),
    documentDir = path.join(folder, 'files');
  await mkdir(cacheDir);
  await mkdir(documentDir);
  restored = path.join(folder, 'restored.sqlite');
  io = {
    cacheDir,
    documentDir,
    mkdir: dir => mkdir(dir, { recursive: true }),
    readText: file => readFile(file, 'utf8'),
    writeText: writeFile,
    copy: copyFile,
    remove: file => rm(file, { recursive: true, force: true }),
    dirSize: async () => 0,
    exists: async file => {
      try {
        await stat(file);
        return true;
      } catch {
        return false;
      }
    },
    zip: async (source, destination) => {
      await execute('/usr/bin/zip', ['-q', '-r', destination, '.'], {
        cwd: source,
      });
    },
    unzip: async (source, destination) => {
      await execute('/usr/bin/unzip', ['-q', source, '-d', destination]);
    },
    pickBackup: async () => null,
    share: async () => {},
    saveDownloads: async (source, name) => {
      const destination = path.join(folder, name);
      await copyFile(source, destination);
      return destination;
    },
    openSnapshot: async file => openDb(file),
    replaceDatabase: async file => copyFile(file, restored),
    restart: async () => {},
  };
  configureStorageRuntime(c, io);
});
afterEach(async () => {
  await c.close();
  await rm(folder, { recursive: true, force: true });
});

it('restores a v1 backup with active cards while retaining the original schedule and review history', async () => {
  const legacy = path.join(folder, 'legacy');
  await mkdir(legacy);
  const db = openDb(path.join(legacy, 'db.sqlite'));
  try {
    await migrate(db, migrations.slice(0, 1));
    await seed(db);
  } finally {
    await db.close();
  }
  const manifest: BackupManifest = {
    format: 'pagewise-backup',
    version: 1,
    schemaVersion: 1,
    appVersion: '0.0.6',
    createdAt: at,
    books: [
      {
        id: 'book',
        title: '示意书',
        sha256: 'sha',
        format: 'pdf',
        originalIncluded: false,
      },
    ],
  };
  await writeFile(path.join(legacy, 'manifest.json'), JSON.stringify(manifest));
  const archive = path.join(folder, 'legacy.zip');
  await io.zip(legacy, archive);
  await expect(restoreBackup(c, archive)).resolves.toBe(true);
  const restoredDb = openDb(restored);
  try {
    const cards = createCardsRepo(restoredDb);
    expect(await restoredDb.get('PRAGMA user_version')).toEqual({
      user_version: SCHEMA_VERSION,
    });
    expect((await cards.due(today))[0]).toMatchObject({
      id: 41,
      suspended: false,
      box: 3,
      due_on: today,
    });
    expect(await restoredDb.all('SELECT * FROM review_log')).toHaveLength(1);
  } finally {
    await restoredDb.close();
  }
});
it('exports and restores suspension and edited content without adding reviews, and can resume the restored card', async () => {
  await c.repos.cards.edit(41, { front: '修订问题', back: '修订答案' });
  await c.repos.cards.setSuspended(41, true);
  const archive = await exportBackup(c);
  await expect(restoreBackup(c, archive)).resolves.toBe(true);
  const restoredDb = openDb(restored);
  try {
    const cards = createCardsRepo(restoredDb);
    expect(await cards.list()).toEqual([
      expect.objectContaining({
        id: 41,
        front: '修订问题',
        back: '修订答案',
        suspended: true,
        box: 3,
        due_on: today,
      }),
    ]);
    expect(await cards.due(today)).toEqual([]);
    expect((await cards.stats(today)).total).toBe(0);
    await cards.setSuspended(41, false);
    expect((await cards.due(today))[0]).toMatchObject({
      id: 41,
      box: 3,
      front: '修订问题',
    });
    expect(await restoredDb.all('SELECT * FROM review_log')).toHaveLength(1);
  } finally {
    await restoredDb.close();
  }
});
