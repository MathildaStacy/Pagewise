import { createTestDemoContainer } from '@app/testing';
import type { Container } from '@app/container';
import { StudySession } from '@app/study/StudySession';
import type { ConversationConfig } from '@services/ai/types';
import type { ParsedResponse } from '@services/ai/protocol';
import { createAiGateway } from '@services/ai/gateway';
import { createRecordedFetch } from '@services/ai/fake';
import { resolvedService } from '@services/ai/models';

let c: Container, session: StudySession;
const sectionId = '3.5.2';
const config: ConversationConfig = {
  providerId: 'demo-claude',
  model: 'claude-haiku-5-5',
  effort: 'low',
  search: false,
};
const response = (answer: string): ParsedResponse => ({
  parts: [{ t: 'text', text: JSON.stringify({ answer }) }],
  raw: { protocol: 'chat', model: 'fixture', items: [] },
  usage: {
    input: 10,
    output: 4,
    cacheRead: 0,
    cacheWrite: 0,
    cacheReported: false,
  },
  stop: 'end',
  model: 'fixture',
});
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(async () => {
  c = await createTestDemoContainer();
  session = new StudySession(c, 'aima');
  await session.open({ autoStart: false });
  await c.db.run(
    "DELETE FROM block WHERE book_id='aima' AND section_id='3.5.2'",
  );
  await c.repos.blocks.insertMany('aima', [
    {
      seq: 1,
      type: 'text',
      text: 'An English paragraph.',
      chars: 21,
      section_id: sectionId,
    },
  ]);
});
afterEach(async () => {
  await session.dispose();
  await c.close();
});

it.each(['translate', 'explain'] as const)(
  'reuses %s across sessions without new usage, secrets or conversation messages',
  async kind => {
    const generate = jest
      .spyOn(c.ai, 'complete')
      .mockResolvedValue(response('完整答案 [[b:1]]'));
    const before = await c.db.all('SELECT * FROM message');
    await session.explainBlock(1, kind);
    await session.dispose();
    session = new StudySession(c, 'aima');
    const credentials = jest
      .spyOn(c.secrets, 'get')
      .mockRejectedValue(new Error('offline'));
    const onText = jest.fn();
    expect(
      await session.explainBlock(1, kind, undefined, undefined, onText),
    ).toBe('完整答案 [[b:1]]');
    expect(onText).toHaveBeenCalledWith('完整答案 [[b:1]]', true);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(credentials).not.toHaveBeenCalled();
    expect(await c.db.all('SELECT * FROM message')).toEqual(before);
    expect(await c.db.all('SELECT * FROM ai_usage')).toEqual([]);
    const events = c.log
      .entries()
      .filter(entry => entry.message === 'AI 本地结果命中');
    expect(events).toHaveLength(1);
    expect(JSON.stringify(events)).not.toMatch(/English|完整答案/);
  },
);

it('records one actual gateway usage row, then serves the result even after the API key is removed', async () => {
  await c.secrets.set('ai.key.demo-claude', 'fixture-key');
  const service = resolvedService(await c.aiConfiguration.providers(), config)!;
  const resolve = async () => ({
    service,
    key: (await c.secrets.get('ai.key.demo-claude')) ?? '',
    cacheKey: 'device',
  });
  const fetch = jest.fn(
    createRecordedFetch([
      {
        status: 200,
        chunks: [
          JSON.stringify({
            model: service.model,
            stop_reason: 'end_turn',
            content: [{ type: 'text', text: '{"answer":"真实协议译文"}' }],
            usage: {
              input_tokens: 12,
              output_tokens: 5,
              cache_read_input_tokens: 4,
              cache_creation_input_tokens: 0,
            },
          }),
        ],
      },
    ]),
  );
  c.ai = createAiGateway({
    resolve,
    resolveProvider: resolve,
    fetchImpl: fetch,
    recordUsage: record => c.aiConfiguration.recordUsage(record),
  });
  expect(await session.explainBlock(1, 'translate', undefined, config)).toBe(
    '真实协议译文',
  );
  const usage = await c.db.all('SELECT * FROM ai_usage');
  expect(usage).toHaveLength(1);
  await c.secrets.remove('ai.key.demo-claude');
  expect(await session.explainBlock(1, 'translate', undefined, config)).toBe(
    '真实协议译文',
  );
  expect(await c.db.all('SELECT * FROM ai_usage')).toEqual(usage);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(
    JSON.stringify(await c.db.all('SELECT * FROM ai_task_cache')),
  ).not.toContain('fixture-key');
});

it.each(['block', 'section'] as const)(
  'invalidates %s results for model, effort, endpoint, protocol, source and map changes',
  async scope => {
    const generate = jest
      .spyOn(c.ai, 'complete')
      .mockResolvedValue(response('译文'));
    const run = (cfg = config) =>
      scope === 'block'
        ? session.explainBlock(1, 'translate', undefined, cfg)
        : session.translateSection(sectionId, undefined, cfg);
    await run();
    await run();
    expect(generate).toHaveBeenCalledTimes(1);
    const changed = {
      ...config,
      model: 'claude-sonnet-5-5',
      effort: 'high' as const,
    };
    await run(changed);
    expect(generate).toHaveBeenCalledTimes(2);
    await run({ ...changed, effort: 'low' });
    expect(generate).toHaveBeenCalledTimes(3);
    const providers = await c.aiConfiguration.providers();
    providers[0].baseUrl = 'https://another-provider.example/v1';
    await c.repos.settings.set('ai.providers', providers);
    await run({ ...changed, effort: 'low' });
    expect(generate).toHaveBeenCalledTimes(4);
    providers[0].protocol = 'chat';
    await c.repos.settings.set('ai.providers', providers);
    await run({ ...changed, effort: 'low' });
    expect(generate).toHaveBeenCalledTimes(5);
    await c.db.run(
      "UPDATE block SET text='Changed English.' WHERE book_id='aima' AND seq=1",
    );
    await run({ ...changed, effort: 'low' });
    expect(generate).toHaveBeenCalledTimes(6);
    await c.repos.sections.update('aima', sectionId, {
      title: 'Changed terminology',
    });
    await run({ ...changed, effort: 'low' });
    expect(generate).toHaveBeenCalledTimes(7);
  },
);

it('uses default model assignments in cache identity but ignores names, prices and rotated keys', async () => {
  const generate = jest
    .spyOn(c.ai, 'complete')
    .mockResolvedValue(response('译文'));
  await session.translateSection(sectionId);
  const providers = await c.aiConfiguration.providers();
  providers[0].name = 'New display name';
  providers[0].cache = 'off';
  providers[0].keyTail = 'new!';
  providers[0].models[1].price = {
    input: 1,
    output: 2,
    cacheRead: 1,
    cacheWrite: 1,
  };
  await c.repos.settings.set('ai.providers', providers);
  await session.translateSection(sectionId);
  expect(generate).toHaveBeenCalledTimes(1);
  await c.repos.settings.set('ai.assign', {
    tidy: { ...config, model: 'claude-sonnet-5-5' },
  });
  await session.translateSection(sectionId);
  expect(generate).toHaveBeenCalledTimes(2);
});

it('bypasses persistent results for live search and does not overwrite the offline result', async () => {
  const generate = jest
    .spyOn(c.ai, 'complete')
    .mockResolvedValue(response('固定译文'));
  await session.translateSection(sectionId, undefined, config);
  generate.mockResolvedValue(response('搜索答案'));
  await session.translateSection(sectionId, undefined, {
    ...config,
    search: true,
  });
  await session.translateSection(sectionId, undefined, {
    ...config,
    search: true,
  });
  expect(generate).toHaveBeenCalledTimes(3);
  expect(await session.translateSection(sectionId, undefined, config)).toBe(
    '固定译文',
  );
  expect(generate).toHaveBeenCalledTimes(3);
});

it.each(['error', 'cancel', 'truncated', 'refusal', 'empty', 'json'] as const)(
  'preserves the previous block result when refresh ends with %s',
  async failure => {
    const generate = jest
      .spyOn(c.ai, 'complete')
      .mockResolvedValue(response('完整旧译文'));
    await session.explainBlock(1, 'translate');
    const ctl = new AbortController();
    generate.mockImplementationOnce(async () => {
      if (failure === 'error') throw new Error('offline');
      if (failure === 'cancel') ctl.abort();
      if (failure === 'truncated')
        return { ...response('半截'), stop: 'max_tokens' };
      if (failure === 'refusal')
        return { ...response('拒答'), stop: 'refusal' };
      if (failure === 'empty') return response('  ');
      if (failure === 'json')
        return { ...response(''), parts: [{ t: 'text', text: '{broken' }] };
      return response('应丢弃的译文');
    });
    await expect(
      session.explainBlock(
        1,
        'translate',
        ctl.signal,
        undefined,
        undefined,
        true,
      ),
    ).rejects.toThrow();
    expect(await session.explainBlock(1, 'translate')).toBe('完整旧译文');
    expect(generate).toHaveBeenCalledTimes(2);
    generate.mockResolvedValue(response('完整新译文'));
    expect(
      await session.explainBlock(
        1,
        'translate',
        undefined,
        undefined,
        undefined,
        true,
      ),
    ).toBe('完整新译文');
    expect(await session.explainBlock(1, 'translate')).toBe('完整新译文');
    expect(generate).toHaveBeenCalledTimes(3);
  },
);

it('displays unverified explanations through the existing UI contract without caching them', async () => {
  const generate = jest
    .spyOn(c.ai, 'complete')
    .mockResolvedValue(response('错误引用 [[b:99]]'));
  expect(await session.explainBlock(1, 'explain')).toContain('[[b:99]]');
  await session.explainBlock(1, 'explain');
  expect(generate).toHaveBeenCalledTimes(2);
  expect(await c.db.all('SELECT * FROM ai_task_cache')).toEqual([]);
});

it('shares a streaming request and only cancels the caller that leaves', async () => {
  const started = deferred(),
    finish = deferred();
  let sharedSignal!: AbortSignal;
  const generate = jest
    .spyOn(c.ai, 'stream')
    .mockImplementation(async (_p, _r, h) => {
      sharedSignal = h.signal;
      h.onText('{"answer":"流式译文');
      started.resolve();
      await finish.promise;
      return response('完整流式译文');
    });
  const first = new AbortController(),
    second = new AbortController();
  const progress = jest.fn();
  const workA = session.explainBlock(
    1,
    'translate',
    first.signal,
    config,
    jest.fn(),
  );
  const errorA = workA.catch(error => error);
  await started.promise;
  const workB = session.explainBlock(
    1,
    'translate',
    second.signal,
    config,
    progress,
  );
  // Wait for the second caller to receive a shared progress update.
  await new Promise(resolve => setTimeout(resolve, 70));
  first.abort();
  expect(sharedSignal.aborted).toBe(false);
  finish.resolve();
  expect(await errorA).toMatchObject({ message: '已停止' });
  expect(await workB).toBe('完整流式译文');
  expect(progress).toHaveBeenCalledWith('流式译文');
  expect(generate).toHaveBeenCalledTimes(1);
});

it('cancels the shared request after every caller leaves and accepts a fresh retry', async () => {
  const started = deferred(),
    finish = deferred();
  let sharedSignal!: AbortSignal;
  const generate = jest
    .spyOn(c.ai, 'complete')
    .mockImplementationOnce(async (_p, _r, h) => {
      sharedSignal = h!.signal!;
      started.resolve();
      await finish.promise;
      return response('迟到答案');
    });
  const ctl = new AbortController();
  const work = session.explainBlock(1, 'translate', ctl.signal);
  const rejection = work.catch(error => error);
  await started.promise;
  ctl.abort();
  expect(sharedSignal.aborted).toBe(true);
  expect(await rejection).toMatchObject({ message: '已停止' });
  generate.mockResolvedValue(response('重试答案'));
  expect(await session.explainBlock(1, 'translate')).toBe('重试答案');
  finish.resolve();
  await session.dispose();
  session = new StudySession(c, 'aima');
  expect(await session.explainBlock(1, 'translate')).toBe('重试答案');
  expect(generate).toHaveBeenCalledTimes(2);
});

it('keeps the newest refresh when an older request finishes later', async () => {
  const started = deferred(),
    finish = deferred();
  const generate = jest
    .spyOn(c.ai, 'complete')
    .mockImplementationOnce(async () => {
      started.resolve();
      await finish.promise;
      return response('旧请求');
    });
  const old = session.explainBlock(1, 'translate');
  await started.promise;
  generate.mockResolvedValue(response('新请求'));
  expect(
    await session.explainBlock(
      1,
      'translate',
      undefined,
      undefined,
      undefined,
      true,
    ),
  ).toBe('新请求');
  finish.resolve();
  expect(await old).toBe('旧请求');
  expect(await session.explainBlock(1, 'translate')).toBe('新请求');
});

it('coalesces identical whole-section requests and preserves content across a new session', async () => {
  const started = deferred(),
    finish = deferred();
  const generate = jest.spyOn(c.ai, 'complete').mockImplementation(async () => {
    started.resolve();
    await finish.promise;
    return response('整节译文');
  });
  const first = session.translateSection(sectionId);
  const second = session.translateSection(sectionId);
  await started.promise;
  finish.resolve();
  expect(await Promise.all([first, second])).toEqual(['整节译文', '整节译文']);
  expect(generate).toHaveBeenCalledTimes(1);
  await session.dispose();
  session = new StudySession(c, 'aima');
  expect(await session.translateSection(sectionId)).toBe('整节译文');
  expect(generate).toHaveBeenCalledTimes(1);
});

it('does not trust legacy section results without model and prompt identity', async () => {
  await c.db.run(
    'INSERT INTO section_translation(book_id,section_id,source_text,content,updated_at) VALUES (?,?,?,?,?)',
    ['aima', sectionId, 'An English paragraph.', '旧版译文', '2026-11-02'],
  );
  const generate = jest
    .spyOn(c.ai, 'complete')
    .mockRejectedValueOnce(new Error('offline'));
  await expect(session.translateSection(sectionId)).rejects.toThrow('offline');
  expect(await c.db.get('SELECT content FROM section_translation')).toEqual({
    content: '旧版译文',
  });
  generate.mockResolvedValue(response('带身份的译文'));
  expect(await session.translateSection(sectionId)).toBe('带身份的译文');
  expect(await session.translateSection(sectionId)).toBe('带身份的译文');
  expect(generate).toHaveBeenCalledTimes(2);
});
