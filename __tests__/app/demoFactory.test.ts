import { openDeviceDb } from '@data/drivers/opSqlite';
import { createDemoContainer } from '@app/demo';
import { createTestContainer, createTestDemoContainer } from '@app/testing';
import * as seed from '@app/demo/seed';

jest.mock('@data/drivers/opSqlite', () => ({
  openDeviceDb: jest.fn(() =>
    jest.requireActual('@data/drivers/nodeSqlite').openMemoryDb(),
  ),
}));

afterEach(() => jest.restoreAllMocks());

test('native Demo factory opens memory SQLite and never populates the production container', async () => {
  const production = await createTestContainer();
  const demo = await createDemoContainer();
  try {
    expect(openDeviceDb).toHaveBeenCalledWith('pagewise-demo', ':memory:');
    expect(demo.mode).toBe('demo');
    expect(await demo.repos.books.list()).toHaveLength(3);
    expect(await production.repos.books.list()).toEqual([]);
    await production.secrets.set('mineru.token', 'private-production-fixture');
    expect(await demo.secrets.get('mineru.token')).toBeNull();
    await demo.appearance.update({ skin: 'glass' });
    expect(production.appearance.store.getState().skin).toBe('paper');
  } finally {
    await Promise.all([production.close(), demo.close()]);
  }
});

test('Node Demo factory and repeated native factories each get fresh independent data', async () => {
  const one = await createTestDemoContainer();
  const two = await createDemoContainer();
  try {
    await one.repos.notes.userText.set('aima', '3.5.2', '仅属于这次演示');
    expect(await two.repos.notes.userText.get('aima', '3.5.2')).toBeUndefined();
    await one.repos.books.remove('aima');
    expect(await two.repos.books.get('aima')).toBeDefined();
  } finally {
    await Promise.all([one.close(), two.close()]);
  }
});

test('failed Demo seeding closes the owned SQLite connection', async () => {
  const failure = new Error('seed-fixture-failure');
  jest.spyOn(seed, 'seedDemo').mockRejectedValueOnce(failure);
  await expect(createDemoContainer()).rejects.toBe(failure);
  const opened = jest.mocked(openDeviceDb).mock.results.at(-1)!.value;
  await expect(opened.get('SELECT 1')).rejects.toThrow();
});
