import { open } from '@op-engineering/op-sqlite';
import { openMemoryDb } from '@data/drivers/nodeSqlite';
import { openDeviceDb } from '@data/drivers/opSqlite';

jest.mock('@op-engineering/op-sqlite', () => ({ open: jest.fn() }));

describe('Node SQLite driver', () => {
  it('initializes connection pragmas and reads write-returning rows', async () => {
    const db = openMemoryDb();
    try {
      expect(await db.get('PRAGMA foreign_keys')).toEqual({ foreign_keys: 1 });
      // SQLite memory databases cannot use WAL; the same initialization is executed.
      expect(await db.get('PRAGMA journal_mode')).toEqual({
        journal_mode: 'memory',
      });
      expect(await db.get('PRAGMA synchronous')).toEqual({ synchronous: 1 });
      await db.run('CREATE TABLE item (id INTEGER PRIMARY KEY, value TEXT)');
      expect(await db.all('PRAGMA table_info(item)')).toHaveLength(2);
      expect(
        await db.get('INSERT INTO item (value) VALUES (?) RETURNING id', [
          '甲',
        ]),
      ).toEqual({ id: 1 });
      expect(
        await db.all(
          'WITH values_cte AS (SELECT 2 AS n) SELECT * FROM values_cte',
        ),
      ).toEqual([{ n: 2 }]);
      await db.run('CREATE TABLE child (parent INTEGER REFERENCES item(id))');
      await expect(db.run('INSERT INTO child VALUES (9)')).rejects.toThrow();
    } finally {
      await db.close();
    }
    await expect(db.get('SELECT 1')).rejects.toThrow();
  });
});

describe('op-sqlite device adapter', () => {
  const mockOpen = jest.mocked(open);
  const connection = () => ({
    executeSync: jest.fn(() => ({})),
    execute: jest.fn(async () => ({ rows: [{ id: 3 }], rowsAffected: 2 })),
    close: jest.fn(),
  });

  afterEach(() => jest.clearAllMocks());

  it('opens pagewise.db, initializes pragmas before use, and maps results', async () => {
    const raw = connection();
    mockOpen.mockReturnValue(raw as unknown as ReturnType<typeof open>);
    const db = openDeviceDb();
    expect(mockOpen).toHaveBeenCalledWith({ name: 'pagewise.db' });
    expect(raw.executeSync.mock.calls).toEqual([
      ['PRAGMA foreign_keys = ON'],
      ['PRAGMA journal_mode = WAL'],
      ['PRAGMA synchronous = NORMAL'],
    ]);
    expect(await db.all('SELECT id FROM item WHERE id = ?', [3])).toEqual([
      { id: 3 },
    ]);
    expect(raw.execute).toHaveBeenCalledWith(
      'SELECT id FROM item WHERE id = ?',
      [3],
    );
    expect(await db.run('UPDATE item SET id = 3')).toEqual({ changes: 2 });
    await db.close();
    expect(raw.close).toHaveBeenCalledTimes(1);
  });

  it('accepts an explicit database name and missing result fields', async () => {
    const raw = connection();
    raw.execute.mockResolvedValue(
      {} as Awaited<ReturnType<typeof raw.execute>>,
    );
    mockOpen.mockReturnValue(raw as unknown as ReturnType<typeof open>);
    const db = openDeviceDb('test.db');
    expect(mockOpen).toHaveBeenCalledWith({ name: 'test.db' });
    expect(await db.all('SELECT 1')).toEqual([]);
    expect(await db.run('DELETE FROM item')).toEqual({ changes: 0 });
    await db.close();
  });

  it('closes a connection if pragma initialization fails', () => {
    const raw = connection();
    raw.executeSync.mockImplementationOnce(() => {
      throw new Error('pragma failed');
    });
    mockOpen.mockReturnValue(raw as unknown as ReturnType<typeof open>);
    expect(() => openDeviceDb()).toThrow('pragma failed');
    expect(raw.close).toHaveBeenCalledTimes(1);
    expect(raw.execute).not.toHaveBeenCalled();
  });
});
