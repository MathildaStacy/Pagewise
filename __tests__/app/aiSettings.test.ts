import { createTestContainer, createTestDemoContainer } from '@app/testing';
import type { Container } from '@app/container';
import {
  assignModel,
  fetchServiceModels,
  readAI,
  readAssignments,
  readProviders,
  readServiceEditor,
  saveService,
  testServiceConnection,
  type ServiceForm,
} from '@app/usecases/settings';
import type { FetchLike } from '@services/ai/http';

let c: Container;
const form = (patch: Partial<ServiceForm> = {}): ServiceForm => ({
  name: '测试服务',
  protocol: 'anthropic',
  baseUrl: 'https://ai.example.test',
  model: 'manual-model',
  key: 'fixture-editor-key-2468',
  auth: 'x-api-key',
  cache: 'auto',
  effort: 'low',
  priceInput: '',
  priceOutput: '',
  priceCacheRead: '',
  priceCacheWrite: '',
  ...patch,
});
const response = (data: unknown, status = 200) => ({
  status,
  text: async () => JSON.stringify(data),
});
const modelPage = (ids: string[]) =>
  response({ data: ids.map(id => ({ id })) });
const reply = () =>
  response({
    model: 'manual-model',
    content: [{ type: 'text', text: '连接成功' }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 10, output_tokens: 2, cache_read_input_tokens: 30 },
  });
const requestMock = (fn: FetchLike) =>
  jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>(fn);
async function saved(patch: Partial<ServiceForm> = {}) {
  const result = await saveService(c, form(patch));
  if (!result.ok) throw new Error('invalid fixture');
  return result.providerId;
}
beforeEach(async () => {
  c = await createTestContainer();
});
afterEach(async () => {
  await c.close();
  jest.restoreAllMocks();
});

it('requires a real Key before networking and can read models before any model is entered', async () => {
  const fetchImpl = requestMock(async () => modelPage(['remote-model']));
  const missing = await fetchServiceModels(
    c,
    form({ model: '', key: '' }),
    undefined,
    { fetchImpl },
  );
  expect(missing).toMatchObject({
    ok: false,
    errors: { key: expect.any(String) },
  });
  expect(fetchImpl).not.toHaveBeenCalled();
  const loaded = await fetchServiceModels(c, form({ model: '' }), undefined, {
    fetchImpl,
  });
  expect(loaded).toMatchObject({
    ok: true,
    demo: false,
    catalog: { models: [{ id: 'remote-model', enabled: false }] },
  });
  expect(await readProviders(c)).toEqual([]);
  expect(await c.secrets.get('ai.key.unsaved')).toBeNull();
  const invalid = await testServiceConnection(
    c,
    form({ model: '' }),
    undefined,
    { fetchImpl },
  );
  expect(invalid).toMatchObject({
    ok: false,
    errors: { model: expect.any(String) },
  });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

it.each([
  ['anthropic', 'x-api-key', 'x-api-key', 'fixture-editor-key-2468'],
  ['anthropic', 'bearer', 'Authorization', 'Bearer fixture-editor-key-2468'],
  ['openai', 'x-api-key', 'Authorization', 'Bearer fixture-editor-key-2468'],
  ['chat', 'x-api-key', 'Authorization', 'Bearer fixture-editor-key-2468'],
] as const)(
  'reads real %s models with %s authentication',
  async (protocol, auth, header, value) => {
    const fetchImpl = requestMock(async () => modelPage(['real-model']));
    await fetchServiceModels(c, form({ protocol, auth }), undefined, {
      fetchImpl,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://ai.example.test/v1/models',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ [header]: value }),
      }),
    );
  },
);

it('fetches every page without changing saved models, then saves only selected models as enabled', async () => {
  const id = await saved();
  const providers = await readProviders(c);
  providers[0].models[0].overrides = { context: 65536 };
  providers[0].models[0].price = {
    input: 1000,
    output: 2000,
    cacheRead: 100,
    cacheWrite: 1250,
  };
  await c.repos.settings.set('ai.providers', providers);
  const editor = await readServiceEditor(c, id);
  const fetchImpl = requestMock(async url =>
    url.includes('after_id=')
      ? modelPage(['remote-b'])
      : response({
          data: [{ id: 'remote-a', name: '远程 A', context_length: 32768 }],
          has_more: true,
          last_id: 'cursor /1',
        }),
  );
  const fetched = await fetchServiceModels(c, editor.form, id, {
    fetchImpl,
    catalog: editor.catalog,
  });
  if (!fetched.ok) throw new Error('fetch should succeed');
  expect(fetchImpl.mock.calls[1][0]).toContain('after_id=cursor%20%2F1');
  expect(await readProviders(c)).toEqual(providers);
  expect(fetched.catalog.models).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: 'manual-model',
        enabled: true,
        overrides: { context: 65536 },
        price: providers[0].models[0].price,
      }),
      expect.objectContaining({
        id: 'remote-a',
        enabled: false,
        overrides: { context: 32768 },
      }),
    ]),
  );
  await saveService(
    c,
    { ...editor.form, model: 'manual-model, remote-b' },
    id,
    fetched.catalog,
  );
  const reopened = await readServiceEditor(c, id);
  expect(reopened.form.model).toBe('manual-model, remote-b');
  expect(reopened.catalog.models.find(m => m.id === 'remote-a')).toMatchObject({
    enabled: false,
    name: '远程 A',
    overrides: { context: 32768 },
  });
  expect(
    reopened.catalog.models.find(m => m.id === 'manual-model')?.price,
  ).toEqual(providers[0].models[0].price);
  expect(reopened.catalog.fetchedAt).toBe(c.clock.now().toISOString());
  await assignModel(c, 'tidy', id, 'remote-b');
  await expect(assignModel(c, 'teach', id, 'remote-a')).rejects.toThrow(
    '请选择可用的模型',
  );
  expect((await readAssignments(c)).tidy).toEqual({
    providerId: id,
    model: 'remote-b',
  });
});

it('keeps the original provider and key when a later model page fails', async () => {
  const id = await saved();
  const original = await readProviders(c);
  const editor = await readServiceEditor(c, id);
  const fetchImpl = requestMock(async url =>
    url.includes('after_id=')
      ? response({ error: { message: 'provider unavailable' } }, 503)
      : response({
          data: [{ id: 'partial-model' }],
          has_more: true,
          last_id: 'partial-model',
        }),
  );
  await expect(
    fetchServiceModels(c, editor.form, id, { fetchImpl }),
  ).rejects.toMatchObject({ code: 'server' });
  expect(await readProviders(c)).toEqual(original);
  expect(await c.secrets.get('ai.key.' + id)).toBe(form().key);
  expect(await c.db.all('SELECT * FROM ai_usage')).toEqual([]);
});

it('tests unsaved fields with their supplied key, records real usage and leaves saved credentials untouched', async () => {
  const id = await saved();
  const editor = await readServiceEditor(c, id);
  const fetchImpl = requestMock(async () => reply());
  const result = await testServiceConnection(
    c,
    {
      ...editor.form,
      key: 'fixture-replacement-9999',
      baseUrl: 'https://new.example.test',
    },
    id,
    { fetchImpl },
  );
  expect(result).toMatchObject({
    ok: true,
    demo: false,
    usage: { input: 10, cacheRead: 30, output: 2, cacheReported: true },
  });
  expect(fetchImpl.mock.calls[0][0]).toBe(
    'https://new.example.test/v1/messages',
  );
  expect(fetchImpl.mock.calls[0][1].headers['x-api-key']).toBe(
    'fixture-replacement-9999',
  );
  expect(await c.secrets.get('ai.key.' + id)).toBe(form().key);
  expect((await readProviders(c))[0].baseUrl).toBe(form().baseUrl);
  const usage = await c.db.all('SELECT * FROM ai_usage');
  expect(usage).toEqual([
    expect.objectContaining({
      purpose: 'test',
      provider_id: id,
      input: 10,
      cache_read: 30,
      output: 2,
    }),
  ]);
  expect(JSON.stringify(await c.db.all('SELECT * FROM setting'))).not.toContain(
    'fixture-',
  );
  expect(JSON.stringify(usage)).not.toContain('fixture-');
  const savedKeyFetch = requestMock(async () => reply());
  await testServiceConnection(c, editor.form, id, { fetchImpl: savedKeyFetch });
  expect(savedKeyFetch.mock.calls[0][1].headers['x-api-key']).toBe(form().key);
});

it.each(['models', 'test'] as const)(
  'redacts auth failures from %s without recording successful usage',
  async kind => {
    const fetchImpl = requestMock(async () =>
      response({ error: { message: 'invalid ' + form().key } }, 401),
    );
    const call = kind === 'models' ? fetchServiceModels : testServiceConnection;
    try {
      await call(c, form(), undefined, { fetchImpl });
      throw new Error('expected rejection');
    } catch (error) {
      expect(error).toMatchObject({ code: 'auth' });
      expect(String(error)).not.toContain(form().key);
    }
    expect(await c.db.all('SELECT * FROM ai_usage')).toEqual([]);
    c.log.error('provider echoed ' + form().key);
    expect(await c.log.export()).not.toContain(form().key);
  },
);

it('cancels connection testing through the same gateway signal without persisting usage', async () => {
  const ctl = new AbortController();
  let started!: () => void;
  const ready = new Promise<void>(resolve => {
    started = resolve;
  });
  const fetchImpl = requestMock(
    async (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(new Error('stopped')),
        );
        started();
      }),
  );
  const pending = testServiceConnection(c, form(), undefined, {
    fetchImpl,
    signal: ctl.signal,
  });
  await ready;
  ctl.abort();
  await expect(pending).rejects.toMatchObject({ code: 'cancelled' });
  expect(await c.db.all('SELECT * FROM ai_usage')).toEqual([]);
});

it('restores the previous key if saving the provider transaction fails', async () => {
  const id = await saved();
  const editor = await readServiceEditor(c, id);
  jest.spyOn(c.db, 'transaction').mockRejectedValueOnce(new Error('disk full'));
  await expect(
    saveService(c, { ...editor.form, key: 'fixture-new-key-5555' }, id),
  ).rejects.toThrow('disk full');
  expect(await c.secrets.get('ai.key.' + id)).toBe(form().key);
  expect((await readProviders(c))[0].keyTail).toBe('2468');
});

it('keeps Demo requests scripted, explicitly marks Demo results and never touches the network', async () => {
  await c.close();
  c = await createTestDemoContainer();
  await saved();
  const provider = (await readProviders(c))[0];
  const editor = await readServiceEditor(c, provider.id);
  const fetchImpl = requestMock(async () => {
    throw new Error('Demo must not fetch');
  });
  const before = await c.db.all('SELECT * FROM ai_usage');
  expect(
    await fetchServiceModels(c, editor.form, provider.id, { fetchImpl }),
  ).toMatchObject({ ok: true, demo: true });
  expect(
    await testServiceConnection(c, editor.form, provider.id, { fetchImpl }),
  ).toMatchObject({ ok: true, demo: true });
  expect(fetchImpl).not.toHaveBeenCalled();
  expect(await c.db.all('SELECT * FROM ai_usage')).toEqual(before);
  expect((await readAI(c)).demo).toBe(true);
});

it('calculates cache hit rate only from reported requests, keeping the real monthly total', async () => {
  const add = (
    reported: boolean,
    input: number,
    read: number,
    at = c.clock.now().toISOString(),
  ) =>
    c.repos.usage.add({
      book_id: null,
      provider_id: 'p',
      model: 'm',
      purpose: 'teach',
      input,
      cache_read: read,
      cache_write: 0,
      output: 5,
      cache_reported: reported,
      at,
    });
  await add(false, 100, 0);
  let data = await readAI(c);
  expect(data.usage[0]).toMatchObject({
    cacheHit: null,
    cacheReports: 0,
    total: 105,
  });
  await add(true, 10, 30);
  data = await readAI(c);
  expect(data.usage[0]).toMatchObject({
    cacheHit: 0.75,
    cacheReports: 1,
    count: 2,
    total: 150,
  });
  await add(true, 0, 0, '2026-09-01T00:00:00.000Z');
  expect((await readAI(c)).month.totals.total).toBe(150);
});

it('rejects missing providers and invalid secondary model names without altering keys or config', async () => {
  const fetchImpl = requestMock(async () => modelPage([]));
  await expect(
    fetchServiceModels(c, form(), 'missing', { fetchImpl }),
  ).rejects.toThrow('服务不存在');
  const result = await saveService(c, form({ model: 'good-model, bad model' }));
  expect(result).toMatchObject({
    ok: false,
    errors: { model: expect.any(String) },
  });
  expect(await readProviders(c)).toEqual([]);
  expect(fetchImpl).not.toHaveBeenCalled();
});
