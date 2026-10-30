import {
  createAiGateway,
  type GatewayDependencies,
  type GatewayRequest,
  type ResolvedConnection,
} from '../../../src/services/ai/gateway';
import { createRecordedFetch } from '../../../src/services/ai/fake';
import { AiError, redact, type FetchLike } from '../../../src/services/ai/http';
import type { AiService } from '../../../src/services/ai/types';
import recorded from '../../../fixtures/ai/t1-teach.json';
import { sse, aStart, aText, aDelta, aEnd } from './helpers/stream';

const service = (id = 'teach-provider', model = 'teach-model'): AiService => ({
  id,
  name: '示意服务',
  protocol: 'anthropic',
  model,
  baseUrl: 'https://ai.example.com',
  effort: 'low',
  cache: 'auto',
  auth: 'bearer',
  price: null,
  keyTail: 'test',
});
const connection = (id?: string, model?: string): ResolvedConnection => ({
  service: service(id, model),
  key: 'example-secret-key',
  cacheKey: 'pagewise-device',
});
const req: GatewayRequest = {
  system: '讲解规则',
  contextBlocks: [{ text: '示意原文', cache: true }],
  tools: [],
  history: [
    {
      id: 1,
      threadId: 1,
      role: 'user',
      parts: [{ t: 'text', text: '讲这一步' }],
      raw: null,
      ui: null,
      compacted: false,
      createdAt: '',
    },
  ],
  bookId: 'book-1',
};
const answer = (text = '示意回答') => ({
  status: 200,
  text: async () =>
    JSON.stringify({
      model: 'returned-model',
      content: [{ type: 'text', text }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 2 },
    }),
});
function deps(fetchImpl: FetchLike): GatewayDependencies {
  return {
    resolve: jest.fn(purpose =>
      connection(purpose + '-provider', purpose + '-model'),
    ),
    resolveProvider: jest.fn((id, model) => connection(id, model)),
    recordUsage: jest.fn(),
    fetchImpl,
    now: () => new Date('2026-10-29T01:02:03.000Z'),
  };
}

test('a heartbeat-only relay completion retries once with SSE and records one result', async () => {
  const fetchImpl = jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>(
    createRecordedFetch([
      { status: 200, chunks: [': keepalive\n\n'] },
      {
        status: 200,
        chunks: [sse(aStart, aText, aDelta('完整结果'), ...aEnd)],
      },
    ]),
  );
  const config = deps(fetchImpl);
  const result = await createAiGateway(config).complete('tidy', req);
  expect(result.parts).toContainEqual({ t: 'text', text: '完整结果' });
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetchImpl.mock.calls[0][1].body).stream).toBeUndefined();
  expect(JSON.parse(fetchImpl.mock.calls[1][1].body).stream).toBe(true);
  expect(config.recordUsage).toHaveBeenCalledTimes(1);
});

test('a relay that also truncates its streaming retry stops with protocol error', async () => {
  const fetchImpl = jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>(
    createRecordedFetch([
      { status: 200, chunks: [': keepalive\n\n'] },
      { status: 200, chunks: [': keepalive\n\n'] },
    ]),
  );
  await expect(
    createAiGateway(deps(fetchImpl)).complete('tidy', req),
  ).rejects.toMatchObject({ code: 'protocol' });
  expect(fetchImpl).toHaveBeenCalledTimes(2);
});

test('complete 根据purpose取模型，强制非流式并记录一次用量，不传原文或密钥给记录器', async () => {
  const fetchImpl = jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>(
    async () => answer(),
  );
  const config = deps(fetchImpl);
  const gateway = createAiGateway(config);
  const result = await gateway.complete('tidy', { ...req, stream: true });
  expect(config.resolve).toHaveBeenCalledWith('tidy');
  const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
  expect(body.model).toBe('tidy-model');
  expect(body.stream).toBeUndefined();
  expect(result.raw.providerId).toBe('tidy-provider');
  expect(config.recordUsage).toHaveBeenCalledTimes(1);
  expect(config.recordUsage).toHaveBeenCalledWith({
    purpose: 'tidy',
    providerId: 'tidy-provider',
    model: 'tidy-model',
    bookId: 'book-1',
    usage: {
      input: 10,
      output: 2,
      cacheRead: 0,
      cacheWrite: 0,
      cacheReported: false,
    },
    at: '2026-10-29T01:02:03.000Z',
  });
  const saved = JSON.stringify((config.recordUsage as jest.Mock).mock.calls);
  expect(saved).not.toContain('example-secret');
  expect(saved).not.toContain('示意原文');
});

test('stream 回放录制SSE仍经过真实解析，正文增量、usage正确', async () => {
  const config = deps(createRecordedFetch([recorded]));
  const gateway = createAiGateway(config);
  const onText = jest.fn();
  const onProgress = jest.fn();
  const result = await gateway.stream('teach', req, {
    signal: new AbortController().signal,
    onText,
    onProgress,
  });
  expect(onText).toHaveBeenLastCalledWith('示意讲解。');
  expect(result.parts).toEqual([{ t: 'text', text: '示意讲解。' }]);
  expect(result.usage).toMatchObject({ input: 12, cacheRead: 25, output: 4 });
  expect(config.recordUsage).toHaveBeenCalledTimes(1);
});

test('缓存参数不支持时移除并仅重试一次；后续请求记住兼容结果', async () => {
  const calls: any[] = [];
  const config = deps(async (_url, init) => {
    calls.push(JSON.parse(init.body));
    return calls.length === 1
      ? {
          status: 400,
          text: async () =>
            JSON.stringify({
              error: { message: 'Unknown parameter: cache_control' },
            }),
        }
      : answer();
  });
  const gateway = createAiGateway(config);
  await gateway.complete('teach', req);
  await gateway.complete('teach', req);
  expect(calls).toHaveLength(3);
  expect(JSON.stringify(calls[0])).toContain('cache_control');
  expect(JSON.stringify(calls[1])).not.toContain('cache_control');
  expect(JSON.stringify(calls[2])).not.toContain('cache_control');
  expect(config.recordUsage).toHaveBeenCalledTimes(2);
});

test('先缓存再思考的两种兼容降级最多各一次，不再发送disabled thinking字段', async () => {
  const bodies: any[] = [];
  const config = deps(async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    if (bodies.length <= 2)
      return {
        status: 422,
        text: async () =>
          JSON.stringify({
            error: {
              message:
                bodies.length === 1
                  ? 'cache_control unsupported'
                  : 'thinking unsupported',
            },
          }),
      };
    return answer();
  });
  config.resolve = () => ({
    ...connection(),
    service: {
      ...service(),
      capabilities: {
        chat: true,
        tools: true,
        thinking: ['off', 'low'],
        thinkingStyle: 'adaptive',
        known: true,
        search: false,
        vision: null,
        audio: null,
        video: null,
        context: null,
      },
    },
  });
  await createAiGateway(config).complete('teach', req);
  expect(bodies).toHaveLength(3);
  expect(bodies[2].thinking).toBeUndefined();
  expect(bodies[2].output_config).toBeUndefined();
  expect(config.recordUsage).toHaveBeenCalledTimes(1);
});

test('持续兼容错误不会无限重试，401和网络错误不自动重发', async () => {
  for (const status of [400, 401, 500]) {
    const fetchImpl = jest.fn(async () => ({
      status,
      text: async () =>
        JSON.stringify({
          error: { message: 'cache_control unsupported example-secret-key' },
        }),
    }));
    const config = deps(fetchImpl);
    await expect(
      createAiGateway(config).complete('teach', req),
    ).rejects.toBeInstanceOf(AiError);
    expect(fetchImpl).toHaveBeenCalledTimes(status === 400 ? 2 : 1);
    expect(config.recordUsage).not.toHaveBeenCalled();
  }
});

test('已经发布正文后中断，保留交付且不重试、不把失败记成成功用量', async () => {
  const fetchImpl: FetchLike = jest.fn(async (_url, init) => {
    init.onChunk?.(recorded.chunks.slice(0, 3).join(''));
    throw new AiError('bad_request', 'cache_control unsupported', 400, 'cache');
  });
  const config = deps(fetchImpl);
  const onText = jest.fn();
  await expect(
    createAiGateway(config).stream('teach', req, {
      signal: new AbortController().signal,
      onText,
    }),
  ).rejects.toBeInstanceOf(AiError);
  expect(onText).toHaveBeenCalledWith('示意讲解。');
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  expect(config.recordUsage).not.toHaveBeenCalled();
});

test('已取消请求和缺失Key不联网；生成中取消传递signal并停止', async () => {
  const fetchImpl = jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>(
    async () => answer(),
  );
  const config = deps(fetchImpl);
  const gateway = createAiGateway(config);
  const ctl = new AbortController();
  ctl.abort();
  await expect(
    gateway.complete('teach', req, { signal: ctl.signal }),
  ).rejects.toMatchObject({ code: 'cancelled' });
  expect(fetchImpl).not.toHaveBeenCalled();
  config.resolve = () => ({ ...connection(), key: '' });
  await expect(gateway.complete('teach', req)).rejects.toMatchObject({
    code: 'auth',
  });
  expect(fetchImpl).not.toHaveBeenCalled();
  const active = new AbortController();
  const cancelling = deps(async (_url, init) => {
    init.signal!.addEventListener('abort', () => {});
    active.abort();
    if (init.signal?.aborted) throw new Error('aborted');
    return answer();
  });
  await expect(
    createAiGateway(cancelling).complete('teach', req, {
      signal: active.signal,
    }),
  ).rejects.toMatchObject({ code: 'cancelled' });
});

test('用量记录失败不能触发重新生成', async () => {
  const fetchImpl = jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>(
    async () => answer(),
  );
  const config = deps(fetchImpl);
  config.recordUsage = () => {
    throw new AiError('bad_request', 'cache_control unsupported', 400, 'cache');
  };
  await expect(createAiGateway(config).complete('teach', req)).rejects.toThrow(
    'unsupported',
  );
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

test('连接测试使用指定provider/model并记录测试用量', async () => {
  const config = deps(async () => answer('连接成功'));
  const result = await createAiGateway(config).test('p', 'm');
  expect(config.resolveProvider).toHaveBeenCalledWith('p', 'm');
  expect(result).toMatchObject({
    ok: true,
    model: 'returned-model',
    usage: { input: 10, output: 2 },
  });
  expect(config.recordUsage).toHaveBeenCalledWith(
    expect.objectContaining({ purpose: 'test', providerId: 'p', model: 'm' }),
  );
});

test('连接测试支持取消，已取消时不发请求、不记录用量', async () => {
  const fetchImpl = jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>(
    async () => answer(),
  );
  const config = deps(fetchImpl);
  const controller = new AbortController();
  controller.abort();
  await expect(
    createAiGateway(config).test('p', 'm', { signal: controller.signal }),
  ).rejects.toMatchObject({ code: 'cancelled' });
  expect(fetchImpl).not.toHaveBeenCalled();
  expect(config.recordUsage).not.toHaveBeenCalled();
});

test('录制响应不能超用或错配；错误HTTP不交付SSE正文', async () => {
  const replay = createRecordedFetch([
    { ...recorded, url: 'https://ai.example.com/v1/messages' },
  ]);
  await expect(
    replay('https://wrong.example.com', {
      method: 'POST',
      headers: {},
      body: '',
    }),
  ).rejects.toThrow('不匹配');
  await expect(
    replay('https://ai.example.com/v1/messages', {
      method: 'POST',
      headers: {},
      body: '',
    }),
  ).rejects.toThrow('没有更多');
  const onChunk = jest.fn();
  await createRecordedFetch([{ status: 401, chunks: ['not streamed'] }])('x', {
    method: 'POST',
    headers: {},
    body: '',
    onChunk,
  });
  expect(onChunk).not.toHaveBeenCalled();
});

test('HTTP错误脱敏覆盖短Key、Authorization、通用sk和MinerU前缀', () => {
  const text = redact(
    'Key=abc Authorization: Bearer token123 x-api-key: header123 sk-proj-sensitive mnr_sensitive',
    'abc',
  );
  for (const secret of [
    'abc',
    'token123',
    'header123',
    'sk-proj-sensitive',
    'mnr_sensitive',
  ])
    expect(text).not.toContain(secret);
});
