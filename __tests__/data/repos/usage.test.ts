import type { AiUsageInsert } from '@core/types';
import type { Db } from '@data/db';
import { openMemoryDb } from '@data/drivers/nodeSqlite';
import { migrate } from '@data/migrations';
import { createUsageRepo } from '@data/repos/usage';

let db: Db;
beforeEach(async () => {
  db = openMemoryDb();
  await migrate(db);
});
afterEach(async () => {
  await db.close();
});
const usage = (patch: Partial<AiUsageInsert> = {}): AiUsageInsert => ({
  book_id: null,
  provider_id: 'p1',
  model: 'm1',
  purpose: 'teach',
  input: 10,
  cache_read: 7,
  cache_write: 3,
  output: 5,
  cache_reported: true,
  at: '2026-10-29T00:00:00.000Z',
  ...patch,
});
async function book(id: string, tokens_total = 0) {
  await db.run(
    "INSERT INTO book (id,sha256,title,format,size_bytes,cover_color,status,tokens_total,created_at) VALUES (?,?,?,'pdf',0,'#123','ready',?,?)",
    [id, id, '示意书籍', tokens_total, '2026-10-29T00:00:00.000Z'],
  );
}

test('adds a complete usage record and increments book tokens atomically from mutually exclusive normalized counters', async () => {
  await book('b1', 100);
  const repo = createUsageRepo(db);
  const inserted = await repo.add(usage({ book_id: 'b1' }));
  expect(inserted).toEqual({
    ...usage({ book_id: 'b1' }),
    id: expect.any(Number),
  });
  expect(
    await db.get('SELECT tokens_total FROM book WHERE id = ?', ['b1']),
  ).toEqual({ tokens_total: 125 });
  expect(
    await db.get('SELECT cache_reported FROM ai_usage WHERE id = ?', [
      inserted.id,
    ]),
  ).toEqual({ cache_reported: 1 });
});

test('fully cached requests retain zero uncached input and count cache reads/writes once', async () => {
  await book('b1');
  const repo = createUsageRepo(db);
  const entry = usage({
    book_id: 'b1',
    input: 0,
    cache_read: 20,
    cache_write: 4,
    output: 2,
  });
  const inserted = await repo.add(entry);
  expect(inserted.input).toBe(0);
  expect(
    await db.get('SELECT tokens_total FROM book WHERE id = ?', ['b1']),
  ).toEqual({ tokens_total: 26 });
  expect(await repo.byBook()).toEqual([
    {
      book_id: 'b1',
      input: 0,
      output: 2,
      cache_read: 20,
      cache_write: 4,
      total: 26,
      count: 1,
    },
  ]);
});

test('allows global usage without a book and preserves false cache reporting', async () => {
  await book('b1', 20);
  const repo = createUsageRepo(db);
  const row = await repo.add(
    usage({ book_id: undefined, cache_reported: false }),
  );
  expect(row.book_id).toBeNull();
  expect(row.cache_reported).toBe(false);
  expect(
    await db.get('SELECT tokens_total FROM book WHERE id = ?', ['b1']),
  ).toEqual({ tokens_total: 20 });
});

test('concurrent adds receive distinct IDs and do not lose increments', async () => {
  await book('b1');
  const repo = createUsageRepo(db);
  const rows = await Promise.all(
    Array.from({ length: 20 }, () =>
      repo.add(
        usage({
          book_id: 'b1',
          input: 1,
          output: 1,
          cache_read: 0,
          cache_write: 0,
        }),
      ),
    ),
  );
  expect(new Set(rows.map(row => row.id)).size).toBe(20);
  expect(
    await db.get('SELECT tokens_total FROM book WHERE id = ?', ['b1']),
  ).toEqual({ tokens_total: 40 });
});

test('failed book counter update rolls back the usage row and original total', async () => {
  await book('b1', 30);
  await db.run(
    "CREATE TRIGGER reject_counter BEFORE UPDATE OF tokens_total ON book BEGIN SELECT RAISE(ABORT, 'counter failed'); END",
  );
  await expect(
    createUsageRepo(db).add(usage({ book_id: 'b1' })),
  ).rejects.toThrow('counter failed');
  expect(await db.get('SELECT COUNT(*) AS count FROM ai_usage')).toEqual({
    count: 0,
  });
  expect(
    await db.get('SELECT tokens_total FROM book WHERE id = ?', ['b1']),
  ).toEqual({ tokens_total: 30 });
});

test('groups per-book inputs, outputs, cache counters, totals and request counts including global requests', async () => {
  await book('b1');
  await book('b2');
  const repo = createUsageRepo(db);
  expect(await repo.byBook()).toEqual([]);
  await repo.add(usage({ book_id: 'b1' }));
  await repo.add(
    usage({
      book_id: 'b1',
      input: 20,
      output: 3,
      cache_read: 0,
      cache_write: 0,
    }),
  );
  await repo.add(
    usage({
      book_id: 'b2',
      input: 7,
      output: 2,
      cache_read: 1,
      cache_write: 0,
    }),
  );
  await repo.add(usage({ input: 4, output: 6, cache_read: 0, cache_write: 0 }));
  expect(await repo.byBook()).toEqual([
    {
      book_id: null,
      input: 4,
      output: 6,
      cache_read: 0,
      cache_write: 0,
      total: 10,
      count: 1,
    },
    {
      book_id: 'b1',
      input: 30,
      output: 8,
      cache_read: 7,
      cache_write: 3,
      total: 48,
      count: 2,
    },
    {
      book_id: 'b2',
      input: 7,
      output: 2,
      cache_read: 1,
      cache_write: 0,
      total: 10,
      count: 1,
    },
  ]);
  await db.run('DELETE FROM book WHERE id = ?', ['b1']);
  expect((await repo.byBook()).find(row => row.book_id === 'b1')!.count).toBe(
    2,
  );
});

test('monthly grouping separates purpose/provider/model and uses inclusive UTC start/exclusive next month', async () => {
  const repo = createUsageRepo(db);
  await repo.add(usage({ at: '2026-09-30T23:59:59.999Z' }));
  await repo.add(usage({ at: '2026-10-01T00:00:00.000Z' }));
  await repo.add(usage({ at: '2026-10-31T23:59:59.999Z', input: 20 }));
  await repo.add(
    usage({ purpose: 'tidy', provider_id: 'p2', model: 'm2', input: 5 }),
  );
  await repo.add(usage({ at: '2026-11-01T00:00:00.000Z' }));
  const result = await repo.month('202610');
  expect(result.month).toBe('2026-10');
  expect(result.groups).toEqual([
    {
      purpose: 'teach',
      provider_id: 'p1',
      model: 'm1',
      input: 30,
      output: 10,
      cache_read: 14,
      cache_write: 6,
      total: 60,
      count: 2,
    },
    {
      purpose: 'tidy',
      provider_id: 'p2',
      model: 'm2',
      input: 5,
      output: 5,
      cache_read: 7,
      cache_write: 3,
      total: 20,
      count: 1,
    },
  ]);
  expect(result.totals).toEqual({
    input: 35,
    output: 15,
    cache_read: 21,
    cache_write: 9,
    total: 80,
    count: 3,
  });
  expect(await repo.month('2026-10')).toEqual(result);
});

test('December rolls into January and empty months return numeric zero totals', async () => {
  const repo = createUsageRepo(db);
  await repo.add(usage({ at: '2026-12-31T23:59:59.999Z' }));
  await repo.add(usage({ at: '2027-01-01T00:00:00.000Z' }));
  expect((await repo.month('202612')).totals.count).toBe(1);
  expect(await repo.month('202611')).toEqual({
    month: '2026-11',
    groups: [],
    totals: {
      input: 0,
      output: 0,
      cache_read: 0,
      cache_write: 0,
      total: 0,
      count: 0,
    },
  });
});

test.each(['202613', '2026-00', '26-10', '2026-10-01'])(
  'rejects invalid month: %s',
  async value => {
    await expect(createUsageRepo(db).month(value)).rejects.toThrow('月份');
  },
);
