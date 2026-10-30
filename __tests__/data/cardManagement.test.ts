import { openMemoryDb } from '@data/drivers/nodeSqlite';
import { migrate, migrations } from '@data/migrations';
import { createCardsRepo } from '@data/repos/cards';
import type { Db } from '@data/db';

let db: Db;
const today = '2026-10-29';
const at = `${today}T08:00:00.000Z`;
beforeEach(() => {
  db = openMemoryDb();
});
afterEach(async () => db.close());
async function seedBook() {
  await db.run(
    'INSERT INTO book (id,sha256,title,format,size_bytes,cover_color,status,created_at) VALUES (?,?,?,?,?,?,?,?)',
    ['book', 'sha', '示意书', 'pdf', 1, '#000000', 'ready', at],
  );
}
const input = {
  book_id: 'book',
  section_id: 'one',
  front: '问题',
  back: '答案',
  due_on: today,
  origin: 'manual' as const,
  created_at: at,
};
it('upgrades a v1 database or backup with default-active cards and preserves its schedule and history', async () => {
  await migrate(db, migrations.slice(0, 1));
  await seedBook();
  await db.run(
    'INSERT INTO card (id,book_id,section_id,front,back,box,due_on,origin,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
    [41, 'book', 'one', '旧问题', '旧答案', 3, today, 'manual', at],
  );
  await db.run(
    'INSERT INTO review_log (card_id,rated,box_from,box_to,at) VALUES (?,?,?,?,?)',
    [41, 'good', 2, 3, at],
  );
  await expect(migrate(db)).resolves.toEqual({ from: 1, to: 2 });
  const cards = createCardsRepo(db);
  expect(await cards.get(41)).toMatchObject({
    suspended: false,
    box: 3,
    due_on: today,
  });
  expect(await cards.due(today)).toHaveLength(1);
  await cards.setSuspended(41, true);
  expect((await cards.list())[0]).toMatchObject({ id: 41, suspended: true });
  expect(await cards.due(today)).toEqual([]);
  await migrate(db);
  expect((await cards.get(41))?.suspended).toBe(true);
  await cards.setSuspended(41, false);
  expect((await cards.due(today))[0]).toMatchObject({
    id: 41,
    box: 3,
    due_on: today,
  });
  expect(await db.all('SELECT * FROM review_log')).toHaveLength(1);
});
it('keeps all cards findable while edits and suspension leave history and learning state intact', async () => {
  await migrate(db);
  await seedBook();
  const cards = createCardsRepo(db, () => at);
  const [first, paused, future] = await cards.addMany([
    input,
    { ...input, front: '已暂停问题', suspended: true },
    { ...input, front: '以后复习', due_on: '2026-11-01' },
  ]);
  expect(first.suspended).toBe(false);
  expect(paused.suspended).toBe(true);
  await cards.rate(first.id, 'good', 2, today);
  const logs = await db.all('SELECT * FROM review_log');
  const changed = await cards.edit(first.id, {
    front: '修订问题',
    back: '修订答案',
  });
  expect(changed).toMatchObject({ box: 2, due_on: today, created_at: at });
  await cards.setSuspended(first.id, true);
  expect(await cards.stats(today)).toEqual({
    total: 1,
    due: 0,
    boxes: [1, 0, 0, 0, 0],
  });
  expect((await cards.list()).map(card => card.id)).toEqual([
    future.id,
    paused.id,
    first.id,
  ]);
  await expect(cards.rate(first.id, 'again', 1, today)).rejects.toThrow(
    '已暂停',
  );
  expect(await db.all('SELECT * FROM review_log')).toEqual(logs);
  await cards.setSuspended(first.id, false);
  expect(await cards.due(today)).toEqual([{ ...changed, suspended: false }]);
  expect(await db.all('SELECT * FROM review_log')).toEqual(logs);
});
