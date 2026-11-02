import { openMemoryDb } from '@data/drivers/nodeSqlite';
import { migrate, migrations } from '@data/migrations';
import { createAiTaskCacheRepo } from '@data/repos/aiTaskCache';
import type { Db } from '@data/db';

let db: Db;
const entry = {
  bookId: 'book',
  task: 'translate',
  scope: '1',
  requestKey: 'exact input',
};
beforeEach(async () => {
  db = openMemoryDb();
  await migrate(db, migrations.slice(0, 4));
  await db.run(
    "INSERT INTO book(id,sha256,title,format,size_bytes,cover_color,status,created_at) VALUES ('book','sha','Book','epub',1,'blue','ready','2026-11-02')",
  );
});
afterEach(async () => db.close());

it('upgrades v4 while preserving old translations and enforcing book cleanup for new results', async () => {
  await db.run(
    "INSERT INTO section_translation VALUES ('book','1','source','旧译文','2026-11-02')",
  );
  await migrate(db);
  expect(
    await db.get('SELECT content,request_key FROM section_translation'),
  ).toEqual({ content: '旧译文', request_key: null });
  const cache = createAiTaskCacheRepo(db, () => '2026-11-02');
  expect(await cache.getSection('book', '1', 'new key')).toBeNull();
  await cache.put(entry, '新译文');
  await cache.putSection('book', '1', 'new key', 'source', '整节译文');
  expect(await cache.getSection('book', '1', 'new key')).toBe('整节译文');
  expect(
    await cache.get({ ...entry, requestKey: 'different source' }),
  ).toBeNull();
  expect(await cache.get({ ...entry, task: 'explain' })).toBeNull();
  expect(await cache.get(entry)).toBe('新译文');
  await db.run("DELETE FROM book WHERE id='book'");
  expect(await db.all('SELECT * FROM ai_task_cache')).toEqual([]);
  expect(await db.all('SELECT * FROM section_translation')).toEqual([]);
  expect(await db.all('PRAGMA foreign_key_check')).toEqual([]);
});

it('evicts the least recently read result at 500 entries and replaces a location instead of growing versions', async () => {
  await migrate(db);
  let now = '2026-11-02T00:00:00Z';
  const cache = createAiTaskCacheRepo(db, () => now);
  for (let i = 0; i < 500; i++)
    await cache.put({ ...entry, scope: String(i) }, `answer ${i}`);
  now = '2026-11-02T00:01:00Z';
  expect(await cache.get({ ...entry, scope: '0' })).toBe('answer 0');
  now = '2026-11-02T00:02:00Z';
  await cache.put({ ...entry, scope: '500' }, 'new result');
  expect(await cache.get({ ...entry, scope: '1' })).toBeNull();
  expect(await cache.get({ ...entry, scope: '0' })).toBe('answer 0');
  await cache.put(
    { ...entry, scope: '500', requestKey: 'changed model' },
    'replacement',
  );
  expect(await cache.get({ ...entry, scope: '500' })).toBeNull();
  expect(await db.get('SELECT COUNT(*) AS n FROM ai_task_cache')).toEqual({
    n: 500,
  });
});
