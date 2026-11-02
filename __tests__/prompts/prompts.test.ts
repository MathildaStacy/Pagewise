import {
  buildTeachPrompt,
  buildTaskPrompt,
  buildTaskContext,
  parseTaskJson,
  type StudyTask,
} from '@app/study/prompts';
import { defaultPrefs } from '@app/usecases/settings';
import { createDemoGateway } from '@app/demo/gateway';
import { demoRefBySourceId } from '@app/demo/seed';
import type { GatewayRequest } from '@services/ai/gateway';
import type { StoredMessage } from '@services/ai/types';
import type { LessonBlock } from '@core/lesson';
import { buildRequest } from '@services/ai/protocol';

const req = (
  system: string,
  history: StoredMessage[] = [],
): GatewayRequest => ({ system, contextBlocks: [], tools: [], history });
const message = (text: string): StoredMessage => ({
  id: 1,
  threadId: 1,
  role: 'user',
  parts: [{ t: 'text', text }],
  raw: null,
  ui: null,
  compacted: false,
  createdAt: '2026-10-29T00:00:00Z',
});
const textOf = (parts: { t: string; text?: string }[]) =>
  parts
    .filter(p => p.t === 'text')
    .map(p => p.text)
    .join('');

test('teach prompt preserves citation, step, tool and preference contracts', () => {
  expect(buildTeachPrompt(defaultPrefs)).toMatchSnapshot();
  const alternate = buildTeachPrompt({
    ...defaultPrefs,
    intuitionFirst: false,
    askEachStep: false,
    bilingual: false,
    length: '短',
    extra: '多用数据库例子',
  });
  expect(alternate).toContain('先讲定义和公式 → 再讲直觉');
  expect(alternate).toContain('半屏以内');
  expect(alternate).toContain('多用数据库例子');
  expect(alternate).not.toContain('最后用 [[check]]');
  expect(alternate).not.toContain('术语第一次出现');
});
const tasks: StudyTask[] = [
  'plan',
  'recap',
  'sectionDraft',
  'detourTitle',
  'pinTitle',
  'explain',
  'translate',
  'guide',
  'partSummary',
  'compact',
  'resume',
  'sectionDone',
  'qaSummary',
];
test('non-dialogue calls keep stable rules and book map before changing source in every protocol', () => {
  const map = [{ id: 'one', title: 'Terminology' }];
  const first = buildTaskContext('translate', {
    map,
    block: { text: 'First source.' },
    target_language: '简体中文',
  });
  const next = buildTaskContext('translate', {
    target_language: '简体中文',
    block: { text: 'Different source.' },
    map,
  });
  expect(next.system).toBe(first.system);
  expect(first.system).not.toContain('First source');
  expect(next.contextBlocks[0]).toEqual(first.contextBlocks[0]);
  expect(first.contextBlocks[0].text).toContain('Terminology');
  expect(first.contextBlocks[1].text).toContain('First source.');
  expect(first.contextBlocks[1].text).not.toContain('Terminology');
  for (const protocol of ['anthropic', 'openai', 'chat'] as const) {
    const body = buildRequest({
      ...first,
      service: { protocol, model: 'fixture', baseUrl: 'https://example.com' },
      cache: true,
      cacheKey: 'device',
      effort: 'off',
      tools: [],
      history: [message('生成译文')],
    }).body as any;
    if (protocol === 'anthropic') {
      expect(body.system[0].cache_control).toEqual({ type: 'ephemeral' });
      expect(
        body.messages[0].content.map((b: any) => !!b.cache_control),
      ).toEqual([true, false, false]);
    }
    if (protocol === 'openai') expect(body.prompt_cache_key).toBe('device');
    const serialized = JSON.stringify(body);
    expect(serialized.indexOf('Terminology')).toBeLessThan(
      serialized.indexOf('First source'),
    );
  }
});
test('block citation and plan constraints stay dynamic without changing the system prefix', () => {
  const first = buildTaskContext('explain', {
    block: { seq: 1, text: 'first' },
  });
  const second = buildTaskContext('explain', {
    block: { seq: 2, text: 'second' },
  });
  expect(first.system).toBe(second.system);
  expect(first.contextBlocks.at(-1)?.text).toContain('[[b:1]]');
  expect(second.contextBlocks.at(-1)?.text).toContain('[[b:2]]');
  const plan = buildTaskContext('plan', {
    blocks: [{ seq: 17, type: 'text', text: 'source', chars: 6 }],
  });
  expect(plan.contextBlocks[0].text).toContain('第一步from=17，最后一步to=17');
  expect(plan.system).not.toContain('from=17');
});
test.each(tasks)(
  '%s split runtime prompt retains the Demo response contract',
  async task => {
    const context = buildTaskContext(task, {
      block: { seq: 1, text: 'Source' },
      blocks: [{ seq: 1, type: 'text', text: 'Source', chars: 6 }],
    });
    const result = await createDemoGateway({ delayMs: 0 }).complete('tidy', {
      ...context,
      tools: [],
      history: [message('输出 JSON')],
    });
    expect(parseTaskJson(textOf(result.parts))).toEqual(expect.any(Object));
  },
);
test.each(tasks)('%s prompt has parseable demo task response', async task => {
  const blocks = [
    { seq: demoRefBySourceId.b2, text: 'f(n)=g(n)+h(n)' },
    { seq: demoRefBySourceId.b5, text: 'h不高估真实代价' },
  ];
  const prompt = buildTaskPrompt(task, { blocks, block: blocks[0] });
  expect(prompt).toMatchSnapshot();
  const result = await createDemoGateway({ delayMs: 0 }).complete(
    'tidy',
    req(prompt),
  );
  expect(parseTaskJson(textOf(result.parts))).toEqual(expect.any(Object));
});
test('JSON parser tolerates one model fence but rejects prose and broken JSON', () => {
  expect(parseTaskJson('```json\n{"summary":"ok"}\n```')).toEqual({
    summary: 'ok',
  });
  expect(() => parseTaskJson('Here is {"summary":"ok"}')).toThrow();
  expect(() => parseTaskJson('{broken}')).toThrow();
});
test('plan prompt states indivisible groups and the actual maximum step count', () => {
  const block = (seq: number, type: LessonBlock['type']): LessonBlock => ({
    seq,
    type,
    text: '示意',
    chars: 2,
  });
  const blocks = [
    block(103001, 'text'),
    block(103002, 'equation'),
    block(103005, 'text'),
    block(104001, 'text'),
    block(104003, 'image'),
    block(104005, 'text'),
  ];
  const prompt = buildTaskPrompt('plan', { blocks: [...blocks].reverse() });
  expect(prompt).toContain(
    '[{"group":1,"from":103001,"to":103005},{"group":2,"from":104001,"to":104005}]',
  );
  expect(prompt).toContain('steps数量必须为2–2，最多2步');
  expect(prompt).toContain('合法分割点（下一步的from）仅限：[104001]');
  expect(prompt).toContain('第一步from=103001，最后一步to=104005');
  const single = buildTaskPrompt('plan', { blocks: blocks.slice(0, 3) });
  expect(single).toContain('steps数量必须为1–1，最多1步');
  expect(single).toContain('只有一个组时必须只输出一步');
});
test('explain prompt uses the production single-block contract and exact citation', () => {
  const prompt = buildTaskPrompt('explain', {
    seq: 103005,
    block: { seq: 103005, text: '示意原文' },
    map: [{ id: '3.5.2', title: 'A*搜索' }],
  });
  expect(prompt).toContain('本次answer必须包含这个精确字符串：[[b:103005]]');
  expect(prompt).toContain('map 只提供术语背景，不是可引用的原文');
  expect(prompt).not.toContain('"blocks":');
});
test('Demo emits partial text and cancels without publishing further chunks', async () => {
  const controller = new AbortController();
  const chunks: string[] = [];
  await expect(
    createDemoGateway({ delayMs: 1 }).stream(
      'teach',
      req('', [message('<turn>{"intent":"next","step":1}</turn>')]),
      {
        signal: controller.signal,
        onText: text => {
          chunks.push(text);
          if (chunks.length === 2) controller.abort();
        },
      },
    ),
  ).rejects.toMatchObject({ code: 'cancelled' });
  expect(chunks).toHaveLength(2);
  expect(chunks[1]).toHaveLength(8);
});
test('Demo loads requested section, then answers from the tool continuation', async () => {
  const gateway = createDemoGateway({ delayMs: 0 });
  const question = message(
    '这跟前面的一致代价搜索有什么关系？\n<turn>{"intent":"ask","step":0}</turn>',
  );
  const call = await gateway.complete('teach', req('', [question]));
  expect(call.parts).toEqual([
    {
      t: 'call',
      id: 'demo-load_section',
      name: 'load_section',
      args: '{"id":"3.4.2"}',
    },
  ]);
  const result = await gateway.complete(
    'teach',
    req('', [
      question,
      { ...question, id: 2, role: 'assistant', parts: call.parts },
      {
        ...question,
        id: 3,
        role: 'tool',
        parts: [
          {
            t: 'result',
            id: 'demo-load_section',
            name: 'load_section',
            output: '<block>...</block>',
          },
        ],
      },
    ]),
  );
  expect(textOf(result.parts)).toContain('当 h(n) 恒等于 0');
  expect(textOf(result.parts)).not.toMatch(/\[\[b:b\d/);
});
test('Demo quiz returns actual show_quiz arguments with final flag', async () => {
  const result = await createDemoGateway().complete(
    'teach',
    req('', [message('<turn>{"intent":"quiz","final":true}</turn>')]),
  );
  const call = result.parts[0];
  expect(call.t).toBe('call');
  if (call.t === 'call')
    expect(JSON.parse(call.args)).toMatchObject({
      options: expect.any(Array),
      answer: 0,
      final: true,
    });
});
