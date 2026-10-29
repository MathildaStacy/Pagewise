import {
  buildContext,
  formatBlocks,
  formatBookMap,
  type ContextInput,
  type ContextMessage,
} from '@core/context';
import type { Section } from '@core/types';
import {
  countCharacters,
  countCjkCharacters,
  escapeXml,
  estimateTokens,
  stableStringify,
  truncateText,
} from '@core/text';
import type { RequestInput } from '@services/ai/protocol';

function section(
  id: string,
  parent_id: string | null,
  level: 1 | 2 | 3,
  ord: number,
  patch: Partial<Section> = {},
): Section {
  return {
    book_id: 'aima',
    id,
    parent_id,
    level,
    ord,
    no: id,
    title: id,
    is_leaf: level === 3,
    block_from: null,
    block_to: null,
    page_from: 1,
    page_to: 2,
    chars: 0,
    parts: 1,
    status: 'new',
    summary: null,
    guide: null,
    source: 'auto',
    flag: null,
    flag_detail: null,
    merged_into: null,
    ...patch,
  };
}
function message(
  id: number,
  text: string,
  role: 'user' | 'assistant' = 'user',
): ContextMessage {
  return {
    id,
    threadId: 1,
    role,
    parts: [{ t: 'text', text }],
    raw: null,
    ui: null,
    compacted: false,
    createdAt: '2026-10-29T00:00:00.000Z',
  };
}
function fixture(patch: Partial<ContextInput> = {}): ContextInput {
  return {
    system: '你是伴读老师。',
    sections: [
      section('ch3', null, 1, 0),
      section('3.5', 'ch3', 2, 1),
      section('3.5.2', '3.5', 3, 2, { title: 'A*搜索' }),
    ],
    currentSectionId: '3.5.2',
    currentBlocks: [
      { seq: 103000, page: 103, type: 'text', text: '当前段落' },
      {
        seq: 103001,
        page: 103,
        type: 'equation',
        text: '公式',
        latex: 'f(n)=g(n)+h(n)',
      },
    ],
    studyRecord: {
      progress: { section: '3.5.2', step: 1 },
      stuck: [{ sectionId: '3.4.2', text: '最优性' }],
      recentQuestions: ['为什么'],
    },
    conversation: [{ id: 'recent', messages: [message(1, '讲下一步')] }],
    turn: { intent: 'next', step: 1 },
    ...patch,
  };
}
it('estimates code points using CJK + other/3.5 and keeps JSON and XML serialization stable', () => {
  expect(estimateTokens('中文abc')).toBe(3);
  expect(estimateTokens('')).toBe(0);
  expect(estimateTokens('日本語한국어𠀀')).toBe(7);
  expect(countCjkCharacters('A中文あア한𠀀🙂')).toBe(6);
  expect(countCharacters('a𠀀🙂')).toBe(3);
  expect(truncateText('汉字𠀀🙂', 3)).toBe('汉字𠀀…');
  expect(truncateText('abc', 3)).toBe('abc');
  expect(truncateText('abc', -1, '')).toBe('');
  expect(escapeXml('<a x="q">&\'')).toBe(
    '&lt;a x=&quot;q&quot;&gt;&amp;&apos;',
  );
  expect(stableStringify({ b: 2, a: { d: true, c: [null, '汉', 1] } })).toBe(
    '{"a":{"c":[null,"汉",1],"d":true},"b":2}',
  );
});
it('assembles six layers in order with stable cached prefix bytes and appends turn only to history', () => {
  const input = fixture({
    preferences: { length: '中', intuitionFirst: true },
  });
  const original = JSON.stringify(input),
    result = buildContext(input);
  const gateway: Pick<RequestInput, 'system' | 'contextBlocks' | 'history'> =
    result;
  expect(gateway.history).toBe(result.history);
  expect(result.estimate.map(layer => [layer.layer, layer.cached])).toEqual([
    [1, true],
    [2, true],
    [3, true],
    [4, false],
    [5, false],
    [6, false],
  ]);
  expect(result.contextBlocks.map(block => block.cache)).toEqual([true, true]);
  expect(result.contextBlocks[1].text).toContain(
    '<block id="b103001" page="103" type="equation">f(n)=g(n)+h(n)</block>',
  );
  expect(result.history[0].parts).toEqual([
    { t: 'text', text: expect.stringContaining('<study_record>') },
  ]);
  expect(result.history.at(-1)?.parts.at(-1)).toEqual({
    t: 'text',
    text: '<turn>{"intent":"next","step":1}</turn>',
  });
  const next = buildContext({
    ...input,
    studyRecord: { progress: { step: 2 }, recentQuestions: ['新的问题'] },
    turn: { intent: 'ask', question: '为什么' },
  });
  expect(next.system).toBe(result.system);
  expect(next.contextBlocks).toEqual(result.contextBlocks);
  expect(JSON.stringify(buildContext(input))).toBe(JSON.stringify(result));
  expect(JSON.stringify(input)).toBe(original);
  expect(result.totalTokens).toBe(
    result.estimate.reduce((sum, layer) => sum + layer.tokens, 0),
  );
  expect(result.overBudget).toBe(false);
});
it('formats PDFs, EPUB locations, image descriptions and learned map summaries without sending image bytes', () => {
  expect(
    formatBlocks(
      [
        { seq: 2, type: 'image', text: '图的说明', loc: '第1章 & 2' },
        { seq: 1, type: 'text', page: 12, text: '<block>原文 & "引号"' },
      ],
      2,
    ),
  ).toBe(
    '<block id="b1" page="10" type="text">&lt;block&gt;原文 &amp; &quot;引号&quot;</block>\n<block id="b2" loc="第1章 &amp; 2" type="image">图的说明</block>',
  );
  expect(
    formatBlocks([{ seq: 3, type: 'equation', text: 'no latex' }]),
  ).toContain('no latex');
  expect(formatBlocks([{ seq: 4, type: 'text', text: 'no location' }])).toBe(
    '<block id="b4" type="text">no location</block>',
  );
  const sections = [
    section('ch1', null, 1, 0),
    section('1.1', 'ch1', 2, 1),
    section('1.1.1', '1.1', 3, 2, { status: 'done', summary: '已学摘要' }),
    section('ch2', null, 1, 3, { page_from: null, page_to: null }),
    section('2.1', 'ch2', 2, 4, { page_from: 8, page_to: 8 }),
    section('2.1.1', '2.1', 3, 5),
  ];
  const map = formatBookMap(sections, '2.1.1', 3, 1);
  expect(map).not.toContain('1.1.1 1.1.1');
  expect(map).toContain('2.1.1 2.1.1');
  expect(map).toContain('<summary section="1.1.1">已学摘要</summary>');
  expect(map).toContain('2.1 2.1 p.7 [new]');
  expect(map).toContain('ch2 ch2 [new]');
  expect(formatBookMap(sections, 'unknown', 3)).not.toContain('2.1.1 2.1.1');
  expect(formatBookMap([section('bad', 'missing', 3, 0)], 'bad', 0)).toContain(
    'bad bad',
  );
  expect(
    formatBookMap([section('a', 'b', 3, 0), section('b', 'a', 3, 1)], 'a', 0),
  ).toContain('a a');
});
it('preserves raw assistant output and tool call IDs and keeps only the last ten questions', () => {
  const call: ContextMessage = {
    ...message(2, '', 'assistant'),
    raw: {
      protocol: 'anthropic',
      model: 'test',
      items: [{ type: 'tool_use', id: 'call1' }],
    },
    parts: [
      { t: 'call', id: 'call1', name: 'load_section', args: '{"id":"3.4.2"}' },
    ],
  };
  const tool: ContextMessage = {
    ...message(3, ''),
    role: 'tool',
    parts: [{ t: 'result', id: 'call1', name: 'load_section', output: '原文' }],
  };
  const output = buildContext(
    fixture({
      loaded: [{ id: 'tool1', sectionId: '3.4.2', messages: [call, tool] }],
      conversation: [],
      studyRecord: {
        progress: null,
        recentQuestions: Array.from({ length: 12 }, (_, i) => `q${i}`),
      },
    }),
  );
  expect(output.history.slice(1, 3)).toEqual([call, tool]);
  expect(output.history[1].raw).toBe(call.raw);
  const record = output.history[0].parts[0];
  expect(record.t === 'text' && record.text).not.toContain(
    '<question>q1</question>',
  );
  expect(record.t === 'text' && record.text).toContain(
    '<question>q2</question>',
  );
  expect(output.history.at(-1)?.role).toBe('user');
  expect(output.history.at(-1)?.id).toBe(-2);
});
it('compresses older dialogue first and then the oldest detour source, without changing the three cached layers', () => {
  const load = (id: number) => ({
    id: `load${id}`,
    sectionId: `3.${id}`,
    detour: true,
    summary: '这节摘要',
    messages: [
      {
        ...message(id, ''),
        role: 'tool' as const,
        parts: [
          {
            t: 'result' as const,
            id: `call${id}`,
            name: 'load_section',
            output: '原'.repeat(1200),
          },
        ],
      },
    ],
  });
  const input = fixture({
    budget: 500,
    loaded: [load(20), load(21)],
    conversation: [
      {
        id: 'old',
        earlier: true,
        summary: '之前问答的结论',
        messages: [
          message(10, '旧'.repeat(1200)),
          message(11, '旧回答'.repeat(400), 'assistant'),
        ],
      },
      { id: 'recent', messages: [message(12, '当前问题')] },
    ],
  });
  const original = JSON.stringify(input),
    baseline = buildContext({ ...input, budget: 10000 }),
    output = buildContext(input);
  expect(output.compressions.map(item => [item.layer, item.id])).toEqual([
    [6, 'old'],
    [5, 'load20'],
    [5, 'load21'],
  ]);
  expect(output.compressions[0].messageIds).toEqual([10, 11]);
  expect(output.overBudget).toBe(false);
  expect(output.contextBlocks).toEqual(baseline.contextBlocks);
  expect(output.system).toBe(baseline.system);
  expect(output.history.find(m => m.id === 20)?.parts).toEqual([
    {
      t: 'result',
      id: 'call20',
      name: 'load_section',
      output: '<section_summary section="3.20">这节摘要</section_summary>',
    },
  ]);
  expect(output.history.find(m => m.id === 12)?.parts[0]).toEqual({
    t: 'text',
    text: '当前问题',
  });
  expect(JSON.stringify(input)).toBe(original);
});
it('does not compress at the budget boundary and retains irreducible input with explicit diagnostics', () => {
  const input = fixture();
  const baseline = buildContext(input);
  expect(
    buildContext({ ...input, budget: baseline.totalTokens }).compressions,
  ).toEqual([]);
  const output = buildContext(
    fixture({
      budget: 1,
      loaded: [
        {
          id: 'missing-load',
          sectionId: '3.4.2',
          detour: true,
          messages: [message(4, '原文')],
        },
        {
          id: 'search',
          sectionId: '3.4.3',
          messages: [message(5, '搜索结果')],
        },
      ],
      conversation: [
        {
          id: 'missing-turn',
          earlier: true,
          messages: [message(6, '之前问答')],
        },
        { id: 'current', messages: [message(7, '当前问答')] },
      ],
    }),
  );
  expect(output.overBudget).toBe(true);
  expect(output.needsSummary).toEqual([
    { layer: 6, id: 'missing-turn', reason: 'missing' },
    { layer: 5, id: 'missing-load', reason: 'missing' },
  ]);
  expect(output.history.some(m => m.id === 7)).toBe(true);
  const larger = buildContext(
    fixture({
      budget: 1,
      loaded: [
        {
          id: 'load',
          sectionId: '1',
          detour: true,
          summary: '长'.repeat(100),
          messages: [message(1, '短')],
        },
      ],
      conversation: [
        {
          id: 'turn',
          earlier: true,
          summary: '长'.repeat(100),
          messages: [message(2, '短')],
        },
      ],
    }),
  );
  expect(larger.needsSummary).toEqual([
    { layer: 6, id: 'turn', reason: 'not-shorter' },
    { layer: 5, id: 'load', reason: 'not-shorter' },
  ]);
  expect(
    buildContext(fixture({ budget: 0, conversation: [] })).overBudget,
  ).toBe(true);
});
it('keeps previous-part and collapsed-detour summaries without needing budget pressure', () => {
  const output = buildContext(
    fixture({
      conversation: [
        {
          id: 'past-part',
          kind: 'part-summary',
          sectionId: '3.5.1',
          summary: '上一段结论',
          messages: [message(3, '旧原话')],
        },
        {
          id: 'detour',
          kind: 'detour-summary',
          sectionId: '3.4.2',
          summary: '这次岔路已解决',
          messages: [],
        },
        { id: 'last', messages: [message(4, '模型回答', 'assistant')] },
      ],
    }),
  );
  const text = JSON.stringify(output.history);
  expect(text).toContain('part_summary');
  expect(text).toContain('detour_summary');
  expect(text).not.toContain('旧原话');
  expect(output.history.at(-1)?.id).toBe(-2);
});
it('keeps original turns visible when a previous-part summary has not been generated', () => {
  const output = buildContext(
    fixture({
      conversation: [
        {
          id: 'pending-summary',
          kind: 'part-summary',
          messages: [message(6, '尚未整理的旧轮次')],
        },
      ],
    }),
  );
  expect(output.history.find(item => item.id === 6)?.parts[0]).toEqual({
    t: 'text',
    text: '尚未整理的旧轮次',
  });
  expect(output.needsSummary).toEqual([
    { layer: 6, id: 'pending-summary', reason: 'missing' },
  ]);
});
it('has a stable exact fixture for empty content and a current operation', () => {
  const output = buildContext({
    system: '规则',
    sections: [],
    currentSectionId: '',
    currentBlocks: [],
    studyRecord: { progress: null },
    turn: { intent: 'next' },
  });
  expect({
    system: output.system,
    contextBlocks: output.contextBlocks,
    history: output.history,
  }).toMatchInlineSnapshot(`
    {
      "contextBlocks": [
        {
          "cache": true,
          "text": "<book_map>

    </book_map>
    <learned_summaries>

    </learned_summaries>",
        },
        {
          "cache": true,
          "text": "<current_source>

    </current_source>",
        },
      ],
      "history": [
        {
          "compacted": false,
          "createdAt": "",
          "id": -1,
          "parts": [
            {
              "t": "text",
              "text": "<study_record>
    <progress>null</progress>

    <recent_questions>

    </recent_questions>
    </study_record>",
            },
          ],
          "raw": null,
          "role": "user",
          "threadId": 0,
          "ui": null,
        },
        {
          "compacted": false,
          "createdAt": "",
          "id": -2,
          "parts": [
            {
              "t": "text",
              "text": "<turn>{"intent":"next"}</turn>",
            },
          ],
          "raw": null,
          "role": "user",
          "threadId": 0,
          "ui": null,
        },
      ],
      "system": "规则",
    }
  `);
});
