import type { Db } from '@data/db';
import { openMemoryDb } from '@data/drivers/nodeSqlite';
import { migrate } from '@data/migrations';
import { createSettingsRepo } from '@data/repos/settings';

let db: Db;
beforeEach(async () => {
  db = openMemoryDb();
  await migrate(db);
});
afterEach(async () => {
  await db.close();
});

test('reads missing settings with caller fallback and replaces an existing setting', async () => {
  const settings = createSettingsRepo(db);
  expect(await settings.get('ui.skin', 'paper')).toBe('paper');
  await settings.set('ui.skin', 'glass');
  await settings.set('ui.skin', 'paper');
  expect(await settings.get('ui.skin', 'glass')).toBe('paper');
  expect(await db.get('SELECT COUNT(*) AS count FROM setting')).toEqual({
    count: 1,
  });
});

test.each([
  false,
  0,
  '',
  null,
  ['paper', 'glass'],
  { scheme: 'dark', readingSize: 'l' },
])(
  'round trips JSON values without treating falsy data as missing: %j',
  async value => {
    const settings = createSettingsRepo(db);
    await settings.set('test.value', value);
    expect(await settings.get('test.value', 'fallback')).toEqual(value);
    const row = await db.get<{ value: string }>(
      'SELECT value FROM setting WHERE key = ?',
      ['test.value'],
    );
    expect(JSON.parse(row!.value)).toEqual({ version: 1, data: value });
  },
);

test('reads legacy JSON and falls back for corrupt and unsupported-version settings', async () => {
  const settings = createSettingsRepo(db);
  await db.run('INSERT INTO setting VALUES (?, ?)', [
    'legacy',
    '{"skin":"paper"}',
  ]);
  await db.run('INSERT INTO setting VALUES (?, ?)', ['corrupt', '{']);
  await db.run('INSERT INTO setting VALUES (?, ?)', [
    'future',
    '{"version":9,"data":"glass"}',
  ]);
  expect(await settings.get('legacy', {})).toEqual({ skin: 'paper' });
  expect(await settings.get('corrupt', 'paper')).toBe('paper');
  expect(await settings.get('future', 'paper')).toBe('paper');
});

test('failed serialization leaves the previous value intact', async () => {
  const settings = createSettingsRepo(db);
  await settings.set('keep', { value: 1 });
  await expect(settings.set('keep', undefined)).rejects.toThrow('undefined');
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  await expect(settings.set('keep', circular)).rejects.toThrow();
  expect(await settings.get('keep', null)).toEqual({ value: 1 });
});
