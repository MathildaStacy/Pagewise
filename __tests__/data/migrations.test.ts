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
    expect(migrations).toHaveLength(2);
    expect(SCHEMA_VERSION).toBe(2);
    expect(await migrate(db)).toEqual({ from: 0, to: 2 });
    expect(await migrate(db)).toEqual({ from: 2, to: 2 });
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
    await db.run('PRAGMA user_version = 3');
    await expect(migrate(db)).rejects.toThrow(
      '数据库版本 3 比这个 App 支持的版本（2）新',
    );
    expect(await db.get('PRAGMA user_version')).toEqual({ user_version: 3 });
  });

  it('treats an absent user_version result as zero', async () => {
    const spy = jest.spyOn(db, 'get').mockResolvedValueOnce(undefined);
    expect(await migrate(db)).toEqual({ from: 0, to: 2 });
    spy.mockRestore();
  });
});
