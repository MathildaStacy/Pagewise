import type { Db } from '@data/db';
import { openMemoryDb } from '@data/drivers/nodeSqlite';
import { migrate } from '@data/migrations';
import { createMathRepo } from '@data/repos/math';

let db: Db;
beforeEach(async () => {
  db = openMemoryDb();
  await migrate(db);
});
afterEach(async () => {
  await db.close();
});
const formula = (key: string) => ({
  key,
  svg: '<svg>示意公式</svg>',
  width: 24.5,
  height: 12.25,
  baseline: 9.5,
});

test('puts, reads and replaces a formula while preserving exact render dimensions', async () => {
  const now = () => '2026-10-29T00:00:00.000Z';
  const math = createMathRepo(db, now);
  expect(await math.get('missing')).toBeNull();
  const created = await math.put(formula('a'));
  expect(created).toEqual({ ...formula('a'), used_at: now() });
  expect(await math.get('a')).toEqual(created);
  const updated = await math.put({
    ...formula('a'),
    svg: '<svg>更新</svg>',
    width: 40,
    used_at: '2026-10-30T00:00:00.000Z',
  });
  expect(await math.get('a')).toEqual(updated);
  expect(await db.get('SELECT COUNT(*) AS count FROM math_cache')).toEqual({
    count: 1,
  });
});

test('get does not implicitly touch; touch uses the injected instant and ignores missing keys', async () => {
  let instant = '2026-10-29T00:00:00.000Z';
  const math = createMathRepo(db, () => instant);
  await math.put(formula('a'));
  instant = '2026-10-30T00:00:00.000Z';
  expect((await math.get('a'))!.used_at).toBe('2026-10-29T00:00:00.000Z');
  await math.touch('a');
  expect((await math.get('a'))!.used_at).toBe(instant);
  await math.touch('missing');
  expect(await math.get('missing')).toBeNull();
});

test('LRU pruning keeps touched entries and breaks equal-time ties deterministically', async () => {
  let instant = '2026-10-29T00:00:00.000Z';
  const math = createMathRepo(db, () => instant);
  await math.put({ ...formula('a'), used_at: '2026-10-26T00:00:00.000Z' });
  await math.put({ ...formula('b'), used_at: '2026-10-27T00:00:00.000Z' });
  await math.put({ ...formula('c'), used_at: '2026-10-28T00:00:00.000Z' });
  await math.touch('a');
  expect(await math.prune(2)).toBe(1);
  expect(await math.get('b')).toBeNull();
  expect(await math.get('a')).not.toBeNull();
  expect(await math.get('c')).not.toBeNull();
  instant = '2026-10-31T00:00:00.000Z';
  await math.put(formula('c'));
  await math.put(formula('b'));
  await math.put(formula('a'));
  expect(await math.prune(2)).toBe(1);
  expect(await math.get('a')).not.toBeNull();
  expect(await math.get('b')).not.toBeNull();
  expect(await math.get('c')).toBeNull();
});

test('prune defaults to 5000, accepts zero, and rejects invalid caps without deletion', async () => {
  const math = createMathRepo(db);
  const before = Date.now();
  const created = await math.put(formula('a'));
  expect(Date.parse(created.used_at)).toBeGreaterThanOrEqual(before);
  expect(await math.prune()).toBe(0);
  for (const limit of [-1, 0.5, Number.NaN]) {
    await expect(math.prune(limit)).rejects.toThrow('非负整数');
  }
  expect(await math.get('a')).not.toBeNull();
  expect(await math.prune(0)).toBe(1);
  expect(await math.get('a')).toBeNull();
});
