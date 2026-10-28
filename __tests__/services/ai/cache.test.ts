import {
  buildRequest,
  type RequestInput,
} from '../../../src/services/ai/protocol';

const req = (protocol: RequestInput['service']['protocol']): RequestInput => ({
  service: {
    protocol,
    model: 'example-model',
    baseUrl: 'https://ai.example.com',
  },
  system: '规则',
  contextBlocks: [
    { text: '示意地图', cache: true },
    { text: '示意原文', cache: true },
    { text: '临时记录', cache: false },
    { text: '第三个稳定块', cache: true },
    { text: '超出缓存断点上限的块', cache: true },
  ],
  tools: [],
  cache: true,
  effort: 'off',
  cacheKey: 'pagewise-device',
  history: [
    {
      id: 1,
      threadId: 1,
      role: 'user',
      parts: [{ t: 'text', text: '继续讲' }],
      raw: null,
      ui: null,
      compacted: false,
      createdAt: '',
    },
  ],
});

test('Anthropic 的 system + 三个 context 缓存断点，非缓存块和超额块仍保留原位', () => {
  const input = req('anthropic');
  const before = JSON.stringify(input);
  const body = buildRequest(input).body as any;
  expect(body.system).toEqual([
    { type: 'text', text: '规则', cache_control: { type: 'ephemeral' } },
  ]);
  expect(body.cache_control).toBeUndefined();
  expect(body.messages[0].role).toBe('user');
  expect(body.messages[0].content.map((c: any) => c.text)).toEqual([
    ...input.contextBlocks.map(b => b.text),
    '继续讲',
  ]);
  expect(body.messages[0].content.map((c: any) => !!c.cache_control)).toEqual([
    true,
    true,
    false,
    true,
    false,
    false,
  ]);
  expect(JSON.stringify(body).match(/cache_control/g)).toHaveLength(4);
  expect(JSON.stringify(input)).toBe(before);
});

test.each(['anthropic', 'openai', 'chat'] as const)(
  '%s 全局关闭缓存不带断点/缓存key，顺序稳定',
  protocol => {
    const body = buildRequest({ ...req(protocol), cache: false }).body;
    expect(JSON.stringify(body)).not.toContain('cache_control');
    expect(body.prompt_cache_key).toBeUndefined();
    expect(buildRequest({ ...req(protocol), cache: false }).body).toEqual(body);
  },
);

test('Responses 规则放 instructions，上下文按块放首个 input，其他历史紧随其后', () => {
  const body = buildRequest(req('openai')).body as any;
  expect(body.instructions).toBe('规则');
  expect(body.prompt_cache_key).toBe('pagewise-device');
  expect(body.input[0]).toEqual({
    role: 'user',
    content: req('openai').contextBlocks.map(block => ({
      type: 'input_text',
      text: block.text,
    })),
  });
  expect(body.input[1].content).toEqual([
    { type: 'input_text', text: '继续讲' },
  ]);
  expect(JSON.stringify(body)).not.toContain('cache_control');
});

test('Chat 的 system 和首个 user 分开，上下文在对话历史前', () => {
  const body = buildRequest(req('chat')).body as any;
  expect(body.messages[0]).toEqual({ role: 'system', content: '规则' });
  expect(body.messages[1]).toEqual({
    role: 'user',
    content: req('chat')
      .contextBlocks.map(block => block.text)
      .join('\n\n'),
  });
  expect(body.messages[2]).toEqual({ role: 'user', content: '继续讲' });
});

test.each(['anthropic', 'openai', 'chat'] as const)(
  '%s 空上下文可用于连接测试',
  protocol => {
    const body = buildRequest({ ...req(protocol), contextBlocks: [] })
      .body as any;
    const history =
      protocol === 'anthropic'
        ? body.messages
        : protocol === 'openai'
        ? body.input
        : body.messages;
    expect(JSON.stringify(history)).toContain('继续讲');
    expect(JSON.stringify(body)).not.toContain('示意地图');
  },
);
