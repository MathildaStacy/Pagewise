import { openMemoryDb } from '@data/drivers/nodeSqlite';
import { migrate, migrations, SCHEMA_VERSION } from '@data/migrations';
import type { Db } from '@data/db';

describe('SQLite schema migration', () => {
  let db: Db;
  beforeEach(() => {
    db = openMemoryDb();
  });
  afterEach(async () => db.close());

  it('installs T3 schema, keeps foreign keys enabled, and migration idempotent', async () => {
    expect(migrations).toHaveLength(4);
    expect(SCHEMA_VERSION).toBe(4);
    expect(await migrate(db)).toEqual({ from: 0, to: 4 });
    expect(await migrate(db)).toEqual({ from: 4, to: 4 });
    expect(await db.get('PRAGMA foreign_keys')).toEqual({ foreign_keys: 1 });
    expect(
      await db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='book'",
      ),
    ).toEqual({ name: 'book' });
  });

  it('runs migration steps in order and commits their version atomically', async () => {
    const steps = [
      ['CREATE TABLE item (id INTEGER PRIMARY KEY, value TEXT)'],
      [
        "INSERT INTO item VALUES (1, '甲')",
        'ALTER TABLE item ADD COLUMN ord INTEGER DEFAULT 1',
      ],
    ];
    expect(await migrate(db, steps)).toEqual({ from: 0, to: 2 });
    expect(await db.get('PRAGMA user_version')).toEqual({ user_version: 2 });
    expect(await db.get('SELECT * FROM item')).toEqual({
      id: 1,
      value: '甲',
      ord: 1,
    });
    expect(await migrate(db, steps)).toEqual({ from: 2, to: 2 });
    expect(await db.all('SELECT * FROM item')).toHaveLength(1);
  });

  it('resumes from the previously committed schema version', async () => {
    const first = ['CREATE TABLE item (id INTEGER PRIMARY KEY)'];
    await migrate(db, [first]);
    expect(await migrate(db, [first, ['INSERT INTO item VALUES (1)']])).toEqual(
      { from: 1, to: 2 },
    );
    expect(await db.all('SELECT * FROM item')).toEqual([{ id: 1 }]);
  });

  it('rolls back a failed step without changing its prior data or version', async () => {
    const first = ['CREATE TABLE item (id INTEGER PRIMARY KEY)'];
    await migrate(db, [first]);
    await expect(
      migrate(db, [
        first,
        ['INSERT INTO item VALUES (1)', 'INSERT INTO missing VALUES (2)'],
      ]),
    ).rejects.toThrow();
    expect(await db.get('PRAGMA user_version')).toEqual({ user_version: 1 });
    expect(await db.all('SELECT * FROM item')).toEqual([]);
    expect(await migrate(db, [first, ['INSERT INTO item VALUES (3)']])).toEqual(
      { from: 1, to: 2 },
    );
  });

  it('rejects a newer database without downgrading it', async () => {
    await db.run('PRAGMA user_version = 5');
    await expect(migrate(db)).rejects.toThrow(
      '数据库版本 5 比这个 App 支持的版本（4）新',
    );
    expect(await db.get('PRAGMA user_version')).toEqual({ user_version: 5 });
  });

  it('treats an absent user_version result as zero', async () => {
    const spy = jest.spyOn(db, 'get').mockResolvedValueOnce(undefined);
    expect(await migrate(db)).toEqual({ from: 0, to: 4 });
    spy.mockRestore();
  });

  it.each([1, 2])(
    'upgrades v%s messages into independent chapter conversations without losing content',
    async version => {
      await migrate(db, migrations.slice(0, version));
      for (const id of ['one', 'two']) {
        await db.run(
          "INSERT INTO book(id,sha256,title,format,size_bytes,cover_color,status,created_at) VALUES (?,?,?,'epub',1,'blue','ready','2026-10-29')",
          [id, id, id],
        );
      }
      for (const [book, chapter, content] of [
        ['one', '1', 'first'],
        ['one', '1', 'answer'],
        ['one', '2', 'second'],
        ['two', '1', 'another book'],
      ]) {
        await db.run(
          "INSERT INTO message(book_id,section_id,kind,content,created_at) VALUES (?,?,'user',?,'2026-10-29')",
          [book, chapter, content],
        );
      }
      await migrate(db);
      const rows = await db.all<{
        content: string;
        conversation_id: number;
        book_id: string;
        section_id: string;
      }>(
        'SELECT content,conversation_id,book_id,section_id FROM message ORDER BY id',
      );
      expect(rows.map(row => row.content)).toEqual([
        'first',
        'answer',
        'second',
        'another book',
      ]);
      expect(rows[0].conversation_id).toBe(rows[1].conversation_id);
      expect(new Set(rows.map(row => row.conversation_id)).size).toBe(3);
      expect(await db.all('SELECT id FROM study_conversation')).toHaveLength(3);
      await db.run("DELETE FROM book WHERE id='one'");
      expect(await db.all('SELECT content FROM message')).toEqual([
        { content: 'another book' },
      ]);
      expect(await db.all('SELECT book_id FROM study_conversation')).toEqual([
        { book_id: 'two' },
      ]);
      expect(await db.all('PRAGMA foreign_key_check')).toEqual([]);
    },
  );
});
