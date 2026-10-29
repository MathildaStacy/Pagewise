import type { ImportDraftInsert } from '@core/types';
import type { Db } from '@data/db';
import { openMemoryDb } from '@data/drivers/nodeSqlite';
import { migrate } from '@data/migrations';
import { createDraftsRepo } from '@data/repos/drafts';

let db: Db;
beforeEach(async () => {
  db = openMemoryDb();
  await migrate(db);
});
afterEach(async () => {
  await db.close();
});
const draft = (
  id: string,
  created_at = '2026-10-29T00:00:00.000Z',
): ImportDraftInsert => ({
  id,
  file_path: `/private/books/${id}.pdf`,
  info: { title: '示意书籍', pages: 200, has_outline: true },
  created_at,
});

test('inserts and reads complete domain records with decoded info', async () => {
  const drafts = createDraftsRepo(db);
  expect(await drafts.get('missing')).toBeNull();
  const input = draft('a');
  const inserted = await drafts.insert(input);
  expect(inserted).toEqual(input);
  expect(await drafts.get('a')).toEqual(input);
  expect(inserted).not.toHaveProperty('info_json');
  const row = await db.get<{ info_json: string }>(
    'SELECT info_json FROM import_draft WHERE id = ?',
    ['a'],
  );
  expect(JSON.parse(row!.info_json)).toEqual({ version: 1, data: input.info });
});

test('lists newest drafts first and removes only the selected draft', async () => {
  const drafts = createDraftsRepo(db);
  expect(await drafts.list()).toEqual([]);
  await drafts.insert(draft('z', '2026-10-28T00:00:00.000Z'));
  await drafts.insert(draft('b'));
  await drafts.insert(draft('a'));
  expect((await drafts.list()).map(row => row.id)).toEqual(['a', 'b', 'z']);
  await drafts.remove('b');
  await drafts.remove('missing');
  expect(await drafts.get('b')).toBeNull();
  expect((await drafts.list()).map(row => row.id)).toEqual(['a', 'z']);
});

test('duplicate IDs fail without replacing the original file metadata', async () => {
  const drafts = createDraftsRepo(db);
  const original = draft('a');
  await drafts.insert(original);
  await expect(
    drafts.insert({ ...original, file_path: '/changed.pdf' }),
  ).rejects.toThrow();
  expect(await drafts.get('a')).toEqual(original);
});

test('nullable JSON remains explicit and legacy/corrupt/future info uses version fallback', async () => {
  const drafts = createDraftsRepo(db);
  expect(await drafts.insert({ ...draft('null'), info: null })).toEqual({
    ...draft('null'),
    info: null,
  });
  for (const [id, info] of [
    ['legacy', '{"pages":20}'],
    ['corrupt', '{'],
    ['future', '{"version":2,"data":{"pages":30}}'],
  ]) {
    await db.run('INSERT INTO import_draft VALUES (?, ?, ?, ?)', [
      id,
      '/source.pdf',
      info,
      '2026-10-29T00:00:00.000Z',
    ]);
  }
  expect((await drafts.get('legacy'))!.info).toEqual({ pages: 20 });
  expect((await drafts.get('corrupt'))!.info).toBeNull();
  expect((await drafts.get('future'))!.info).toBeNull();
  expect(
    (await drafts.list()).find(row => row.id === 'future')!.info,
  ).toBeNull();
});
