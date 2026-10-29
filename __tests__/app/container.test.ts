import { createMemoryAiConfiguration } from '@app/aiConfiguration';
import { createContainer } from '@app/container';
import { createTestContainer } from '@app/testing';
import { createTestClock } from '@app/clock';
import { openMemoryDb } from '@data/drivers/nodeSqlite';
import { AiError } from '@services/ai/http';
import type { AiProvider } from '@services/ai/types';

const provider: AiProvider = {
  id: 'fixture',
  kind: 'custom',
  name: '示意服务',
  protocol: 'openai',
  baseUrl: 'https://fixture.invalid',
  auth: 'bearer',
  cache: 'auto',
  keyTail: 'only',
  models: [{ id: 'fixture-model', enabled: true, price: null }],
};
const request = {
  system: '示意规则',
  contextBlocks: [],
  tools: [],
  history: [],
};

test('test factory migrates a real isolated SQLite database and closes once', async () => {
  const a = await createTestContainer();
  const b = await createTestContainer();
  try {
    expect(await a.db.get('PRAGMA user_version')).toEqual({ user_version: 1 });
    expect(await a.db.get('PRAGMA foreign_keys')).toEqual({ foreign_keys: 1 });
    await a.db.run('CREATE TABLE fixture (value TEXT)');
    await a.db.run('INSERT INTO fixture VALUES (?)', ['示意内容']);
    await expect(b.db.all('SELECT * FROM fixture')).rejects.toThrow();
    await a.secrets.set('mineru.token', 'private-fixture-token');
    expect(await b.secrets.get('mineru.token')).toBeNull();
    a.log.info('registered ' + (await a.secrets.get('mineru.token')));
    expect(await a.log.export()).not.toContain('private-fixture-token');
  } finally {
    await Promise.all([a.close(), a.close(), b.close()]);
  }
  await expect(a.db.run('SELECT 1')).rejects.toThrow();
});

test('unconfigured containers guide setup without making a request', async () => {
  const c = await createTestContainer();
  try {
    await expect(c.ai.complete('teach', request)).rejects.toMatchObject({
      code: 'bad_request',
    });
  } finally {
    await c.close();
  }
});

test('configured gateway resolves purpose and Keystore key, records usage without secrets', async () => {
  const settings = createMemoryAiConfiguration({
    providers: [provider],
    assignments: { teach: { providerId: 'fixture', model: 'fixture-model' } },
    cacheKey: 'pagewise-fixture',
  });
  const fetchImpl = jest.fn(async () => ({
    status: 200,
    text: async () =>
      JSON.stringify({
        object: 'response',
        model: 'fixture-model',
        output: [
          {
            type: 'message',
            role: 'assistant',
            content: [{ type: 'output_text', text: '示意讲解' }],
          },
        ],
        usage: {
          input_tokens: 12,
          output_tokens: 5,
          input_tokens_details: { cached_tokens: 4 },
        },
      }),
  }));
  const clock = createTestClock('2026-10-29T08:00:00.000Z');
  const c = await createTestContainer(
    { clock },
    { aiConfiguration: settings, fetchImpl },
  );
  try {
    await expect(c.ai.complete('teach', request)).rejects.toMatchObject({
      code: 'auth',
    });
    await c.secrets.set('ai.key.fixture', 'private-fixture-key');
    const result = await c.ai.complete('teach', {
      ...request,
      bookId: 'demo-book',
    });
    expect(result.parts).toEqual([{ t: 'text', text: '示意讲解' }]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(settings.usage()).toMatchObject([
      {
        purpose: 'teach',
        providerId: 'fixture',
        model: 'fixture-model',
        bookId: 'demo-book',
        at: '2026-10-29T08:00:00.000Z',
        usage: { input: 8, cacheRead: 4, output: 5 },
      },
    ]);
    expect(JSON.stringify(settings.usage())).not.toContain(
      'private-fixture-key',
    );
    c.log.error('private-fixture-key');
    expect(await c.log.export()).not.toContain('private-fixture-key');
    await expect(c.ai.complete('tidy', request)).rejects.toMatchObject({
      code: 'bad_request',
    });
    settings.assign('tidy', { providerId: 'missing', model: 'x' });
    await expect(c.ai.complete('tidy', request)).rejects.toMatchObject({
      code: 'not_found',
    });
  } finally {
    await c.close();
  }
});

test('migration failure closes the database before surfacing the failure', async () => {
  const db = openMemoryDb();
  await db.run('PRAGMA user_version = 99');
  await expect(createContainer(db)).rejects.toThrow('数据库版本');
  await expect(db.run('SELECT 1')).rejects.toThrow();
});

test('test factory honors injected services and cannot use live network by default', async () => {
  const settings = createMemoryAiConfiguration({
    providers: [provider],
    assignments: { teach: { providerId: 'fixture', model: 'fixture-model' } },
  });
  const clock = createTestClock();
  const c = await createTestContainer({ clock }, { aiConfiguration: settings });
  try {
    expect(c.clock).toBe(clock);
    await c.secrets.set('ai.key.fixture', 'test-key-only');
    await expect(c.ai.complete('teach', request)).rejects.toBeInstanceOf(
      AiError,
    );
  } finally {
    await c.close();
  }
});

test('memory configuration snapshots are independent and assignments can change', async () => {
  const config = createMemoryAiConfiguration({ providers: [provider] });
  const cacheKey = await config.cacheKey();
  expect(await config.cacheKey()).toBe(cacheKey);
  (await config.providers())[0].models.length = 0;
  expect((await config.providers())[0].models).toHaveLength(1);
  config.setProviders([]);
  expect(await config.providers()).toEqual([]);
  expect(await config.assignment('teach')).toBeUndefined();
});
