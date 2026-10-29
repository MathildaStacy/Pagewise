import {
  createSqliteAiConfiguration,
  createMemoryAiConfiguration,
} from '@app/aiConfiguration';
import type { Db } from '@data/db';
import { openMemoryDb } from '@data/drivers/nodeSqlite';
import { migrate } from '@data/migrations';
import { createSettingsRepo } from '@data/repos/settings';
import { createUsageRepo } from '@data/repos/usage';
import {
  createAiGateway,
  type GatewayRequest,
  type ResolvedConnection,
} from '@services/ai/gateway';
import type { AiProvider } from '@services/ai/types';

let db: Db;
beforeEach(async () => {
  db = openMemoryDb();
  await migrate(db);
});
afterEach(async () => db.close());
const provider: AiProvider = {
  id: 'provider',
  kind: 'openai',
  name: '示意服务',
  protocol: 'openai',
  baseUrl: 'https://ai.example.com',
  auth: 'bearer',
  cache: 'auto',
  keyTail: 'tail',
  models: [{ id: 'example-model', enabled: true, price: null }],
};
function adapter(database = db) {
  const settings = createSettingsRepo(database);
  const usage = createUsageRepo(database);
  return {
    settings,
    usage,
    configuration: createSqliteAiConfiguration({ settings, usage }),
  };
}

it('SQLite配置缺省为空，按key读取providers和teach/tidy分配，返回值不共享引用', async () => {
  const { settings, configuration } = adapter();
  expect(await configuration.providers()).toEqual([]);
  expect(await configuration.assignment('teach')).toBeUndefined();
  await settings.set('ai.providers', [provider]);
  await settings.set('ai.assign', {
    teach: { providerId: 'provider', model: 'example-model', effort: 'high' },
    tidy: { providerId: 'tidy-provider', model: 'tidy-model' },
  });
  expect(await configuration.providers()).toEqual([provider]);
  expect(await configuration.assignment('teach')).toEqual({
    providerId: 'provider',
    model: 'example-model',
    effort: 'high',
  });
  expect(await configuration.assignment('tidy')).toEqual({
    providerId: 'tidy-provider',
    model: 'tidy-model',
  });
  const loaded = await configuration.providers();
  loaded[0].models[0].enabled = false;
  expect((await configuration.providers())[0].models[0].enabled).toBe(true);
  await settings.set('ai.providers', null);
  await settings.set('ai.assign', null);
  expect(await configuration.providers()).toEqual([]);
  expect(await configuration.assignment('teach')).toBeUndefined();
});

it('首次cacheKey并发调用只生成/保存一次，新适配器读取同一持久化key', async () => {
  const { settings, configuration } = adapter();
  const saved = jest.spyOn(settings, 'set');
  const read = jest.spyOn(settings, 'get');
  const keys = await Promise.all(
    Array.from({ length: 20 }, () => configuration.cacheKey()),
  );
  expect(new Set(keys).size).toBe(1);
  expect(keys[0]).toMatch(/^pagewise-/);
  expect(saved).toHaveBeenCalledTimes(1);
  expect(read).toHaveBeenCalledTimes(1);
  const reopened = adapter();
  expect(await reopened.configuration.cacheKey()).toBe(keys[0]);
  expect(await settings.get('ai.installId', '')).toBe(keys[0]);
});

it('cacheKey保存失败不返回临时key，可在后续调用重试', async () => {
  const { settings, configuration } = adapter();
  const saved = jest
    .spyOn(settings, 'set')
    .mockRejectedValueOnce(new Error('写入失败'));
  await expect(configuration.cacheKey()).rejects.toThrow('写入失败');
  expect(await settings.get('ai.installId', null)).toBeNull();
  const key = await configuration.cacheKey();
  expect(await settings.get('ai.installId', '')).toBe(key);
  expect(saved).toHaveBeenCalledTimes(2);
});

it('不同数据库安装key、providers和usage互相隔离，内存适配器继续可用', async () => {
  const other = openMemoryDb();
  await migrate(other);
  try {
    const first = adapter();
    const second = adapter(other);
    await first.settings.set('ai.providers', [provider]);
    expect(await first.configuration.cacheKey()).not.toBe(
      await second.configuration.cacheKey(),
    );
    expect(await second.configuration.providers()).toEqual([]);
    const memory = createMemoryAiConfiguration({
      providers: [provider],
      assignments: {
        teach: { providerId: 'provider', model: 'example-model' },
      },
      cacheKey: 'recording',
    });
    expect(await memory.providers()).toEqual([provider]);
    expect(await memory.assignment('teach')).toEqual({
      providerId: 'provider',
      model: 'example-model',
    });
    expect(await memory.cacheKey()).toBe('recording');
  } finally {
    await other.close();
  }
});

it('网关用量映射互斥input/cache_read/cache_write/output，书籍累计不会重复算缓存', async () => {
  const { configuration, usage } = adapter();
  await db.run(
    'INSERT INTO book (id,sha256,title,format,size_bytes,cover_color,status,created_at) VALUES (?,?,?,?,?,?,?,?)',
    [
      'book',
      'sha',
      '示意书',
      'pdf',
      1,
      '#2F5AA8',
      'ready',
      '2026-10-29T00:00:00.000Z',
    ],
  );
  const resolve = async (): Promise<ResolvedConnection> => ({
    service: {
      id: 'provider',
      name: '示意服务',
      protocol: 'openai',
      model: 'example-model',
      baseUrl: 'https://ai.example.com',
      effort: 'off',
      cache: 'auto',
      auth: 'bearer',
      price: null,
      keyTail: 'tail',
    },
    key: 'protocol-test-key',
    cacheKey: await configuration.cacheKey(),
  });
  const gateway = createAiGateway({
    resolve,
    resolveProvider: resolve,
    recordUsage: record => configuration.recordUsage(record),
    now: () => new Date('2026-10-29T08:00:00.000Z'),
    fetchImpl: async () => ({
      status: 200,
      text: async () =>
        JSON.stringify({
          status: 'completed',
          output: [
            {
              type: 'message',
              role: 'assistant',
              content: [{ type: 'output_text', text: '示意讲解。' }],
            },
          ],
          usage: {
            input_tokens: 100,
            input_tokens_details: { cached_tokens: 70 },
            output_tokens: 7,
          },
        }),
    }),
  });
  const request: GatewayRequest = {
    system: '示意讲解规则',
    contextBlocks: [],
    tools: [],
    history: [],
    bookId: 'book',
  };
  await gateway.complete('teach', request);
  expect(
    await db.get(
      'SELECT book_id,provider_id,model,purpose,input,cache_read,cache_write,output,cache_reported,at FROM ai_usage',
    ),
  ).toEqual({
    book_id: 'book',
    provider_id: 'provider',
    model: 'example-model',
    purpose: 'teach',
    input: 30,
    cache_read: 70,
    cache_write: 0,
    output: 7,
    cache_reported: 1,
    at: '2026-10-29T08:00:00.000Z',
  });
  expect(
    await db.get('SELECT tokens_total FROM book WHERE id = ?', ['book']),
  ).toEqual({ tokens_total: 107 });
  expect((await usage.byBook())[0].total).toBe(107);
  await configuration.recordUsage({
    purpose: 'tidy',
    providerId: 'provider',
    model: 'example-model',
    at: '2026-10-29T09:00:00.000Z',
    usage: {
      input: 2,
      cacheRead: 3,
      cacheWrite: 9,
      output: 4,
      cacheReported: false,
    },
  });
  expect(
    await db.get(
      'SELECT book_id,input,cache_read,cache_write,output,cache_reported FROM ai_usage WHERE id = 2',
    ),
  ).toEqual({
    book_id: null,
    input: 2,
    cache_read: 3,
    cache_write: 9,
    output: 4,
    cache_reported: 0,
  });
  expect(JSON.stringify(await db.all('SELECT * FROM setting'))).not.toContain(
    'protocol-test-key',
  );
  expect(JSON.stringify(await db.all('SELECT * FROM ai_usage'))).not.toContain(
    'protocol-test-key',
  );
});
