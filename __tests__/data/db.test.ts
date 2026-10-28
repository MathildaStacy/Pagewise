import { createDb, type Driver } from '@data/db';
import { openMemoryDb } from '@data/drivers/nodeSqlite';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('Db with real SQLite', () => {
  const open = async () => {
    const db = openMemoryDb();
    await db.run('CREATE TABLE item (id INTEGER PRIMARY KEY, value TEXT)');
    return db;
  };

  it('binds values, returns typed rows and affected counts', async () => {
    const db = await open();
    try {
      expect(
        await db.run('INSERT INTO item (value) VALUES (?)', ['书']),
      ).toEqual({
        changes: 1,
      });
      expect(
        await db.get<{ id: number; value: string }>('SELECT * FROM item'),
      ).toEqual({
        id: 1,
        value: '书',
      });
      expect(await db.all('SELECT * FROM item WHERE id = ?', [1])).toEqual([
        { id: 1, value: '书' },
      ]);
      expect(
        await db.get('SELECT * FROM item WHERE id = ?', [9]),
      ).toBeUndefined();
    } finally {
      await db.close();
    }
  });

  it('commits nested transactions into the same transaction', async () => {
    const db = await open();
    try {
      const result = await db.transaction(async tx => {
        await tx.run('INSERT INTO item VALUES (1, ?)', ['甲']);
        await tx.transaction(async inner => {
          expect(inner).toBe(tx);
          await inner.run('INSERT INTO item VALUES (2, ?)', ['乙']);
          // A nested transaction does not own the underlying connection.
          await inner.close();
        });
        return tx.all('SELECT value FROM item ORDER BY id');
      });
      expect(result).toEqual([{ value: '甲' }, { value: '乙' }]);
      expect(await db.all('SELECT id FROM item ORDER BY id')).toEqual([
        { id: 1 },
        { id: 2 },
      ]);
    } finally {
      await db.close();
    }
  });

  it('rolls back all nested writes and releases the lock after a failure', async () => {
    const db = await open();
    try {
      await expect(
        db.transaction(async tx => {
          await tx.run('INSERT INTO item VALUES (1, ?)', ['甲']);
          await tx.transaction(async inner => {
            await inner.run('INSERT INTO item VALUES (2, ?)', ['乙']);
            throw new Error('rollback');
          });
        }),
      ).rejects.toThrow('rollback');
      expect(await db.all('SELECT * FROM item')).toEqual([]);
      await db.transaction(async tx => {
        await tx.run('INSERT INTO item VALUES (3, NULL)');
      });
      expect(await db.get('SELECT * FROM item')).toEqual({
        id: 3,
        value: null,
      });
    } finally {
      await db.close();
    }
  });

  it('serializes independent statements and transactions behind the active transaction', async () => {
    const db = await open();
    const entered = deferred();
    const resume = deferred();
    const order: string[] = [];
    try {
      const first = db.transaction(async tx => {
        await tx.run('INSERT INTO item VALUES (1, ?)', ['甲']);
        entered.resolve();
        await resume.promise;
        order.push('first');
      });
      await entered.promise;
      const outside = db
        .run('INSERT INTO item VALUES (2, ?)', ['乙'])
        .then(() => {
          order.push('outside');
        });
      const second = db.transaction(async tx => {
        expect(await tx.all('SELECT id FROM item ORDER BY id')).toEqual([
          { id: 1 },
          { id: 2 },
        ]);
        order.push('second');
      });
      await Promise.resolve();
      expect(order).toEqual([]);
      resume.resolve();
      await Promise.all([first, outside, second]);
      expect(order).toEqual(['first', 'outside', 'second']);
    } finally {
      resume.resolve();
      await db.close();
    }
  });

  it('releases the statement lock after SQLite rejects invalid SQL', async () => {
    const db = await open();
    try {
      await expect(db.run('INSERT INTO missing VALUES (1)')).rejects.toThrow();
      await db.run('INSERT INTO item VALUES (1, ?)', ['继续']);
      expect(await db.get('SELECT value FROM item')).toEqual({ value: '继续' });
    } finally {
      await db.close();
    }
  });
});

describe('Db driver ownership', () => {
  const driver = (): Driver => ({
    query: jest.fn(async () => ({ rows: [], changes: 0 })),
    close: jest.fn(async () => {}),
  });

  it('delegates close to the driver', async () => {
    const raw = driver();
    await createDb(raw).close();
    expect(raw.close).toHaveBeenCalledTimes(1);
  });

  it('releases the transaction lock when BEGIN fails', async () => {
    const raw = driver();
    const query = jest.mocked(raw.query);
    query.mockRejectedValueOnce(new Error('begin failed'));
    const db = createDb(raw);
    await expect(db.transaction(async () => 1)).rejects.toThrow('begin failed');
    await expect(db.run('SELECT 1')).resolves.toEqual({ changes: 0 });
    expect(query.mock.calls.map(([sql]) => sql)).toEqual([
      'BEGIN IMMEDIATE',
      'SELECT 1',
    ]);
  });

  it('rolls back if COMMIT fails', async () => {
    const raw = driver();
    const query = jest.mocked(raw.query);
    query.mockImplementation(async sql => {
      if (sql === 'COMMIT') {
        throw new Error('commit failed');
      }
      return { rows: [], changes: 0 };
    });
    const db = createDb(raw);
    await expect(db.transaction(async () => 1)).rejects.toThrow(
      'commit failed',
    );
    expect(query.mock.calls.map(([sql]) => sql)).toEqual([
      'BEGIN IMMEDIATE',
      'COMMIT',
      'ROLLBACK',
    ]);
    await expect(db.run('SELECT 1')).resolves.toEqual({ changes: 0 });
  });
});
