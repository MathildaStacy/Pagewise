import { createTestDemoContainer } from '@app/testing';
import type { Container } from '@app/container';
import { StudySession } from '@app/study/StudySession';
import type { GatewayRequest } from '@services/ai/gateway';
import type { ParsedResponse } from '@services/ai/protocol';
import { streamedTaskAnswer } from '@app/study/prompts';
import type { TranslationProgress } from '@app/study/translation';

let c: Container, session: StudySession;
const inputOf = (req: GatewayRequest) =>
  JSON.parse(
    /<input>\s*([\s\S]*?)\s*<\/input>/.exec(req.contextBlocks.at(-1)!.text)![1],
  );
const response = (answer: string): ParsedResponse => ({
  parts: [{ t: 'text', text: JSON.stringify({ answer }) }],
  raw: { protocol: 'chat', model: 'translation-fixture', items: [] },
  usage: {
    input: 1,
    output: 1,
    cacheRead: 0,
    cacheWrite: 0,
    cacheReported: false,
  },
  stop: 'end',
  model: 'translation-fixture',
});
beforeEach(async () => {
  c = await createTestDemoContainer();
  session = new StudySession(c, 'aima');
  await session.open({ autoStart: false });
  await c.db.run(
    "DELETE FROM block WHERE book_id='aima' AND section_id='3.5.2'",
  );
});
afterEach(async () => {
  await session.dispose();
  await c.close();
});
async function prose(text: string) {
  await c.repos.blocks.insertMany('aima', [
    { seq: 1, type: 'text', text, chars: text.length, section_id: '3.5.2' },
  ]);
}

it('translates every chunk of a long English chapter into Chinese and reuses only complete translations', async () => {
  const source =
    'An English technical paragraph.\n'.repeat(500) + 'The final sentence.';
  await prose(source);
  const complete = jest
    .spyOn(c.ai, 'complete')
    .mockImplementation(async (_purpose, req) =>
      response(
        `中文译文${
          inputOf(req).block.text.endsWith('The final sentence.')
            ? '最后一句'
            : ''
        }`,
      ),
    );
  const before = session.store.getState().messages;
  const translation = await session.translateSection('3.5.2');
  expect(complete.mock.calls.length).toBeGreaterThan(2);
  const inputs = complete.mock.calls.map(([, req]) => inputOf(req));
  expect(inputs.map(input => input.block.text).join('')).toBe(source);
  expect(
    inputs.every(
      input =>
        input.target_language === '简体中文' && input.block.text.length <= 6000,
    ),
  ).toBe(true);
  expect(translation).toContain('最后一句');
  expect(session.store.getState().messages).toEqual(before);
  complete.mockClear();
  expect(await session.translateSection('3.5.2')).toBe(translation);
  expect(complete).not.toHaveBeenCalled();
  await session.translateSection('3.5.2', undefined, undefined, true);
  expect(complete).toHaveBeenCalled();
  complete.mockClear();
  await c.db.run(
    "UPDATE block SET text='A revised source.' WHERE book_id='aima' AND seq=1",
  );
  await session.translateSection('3.5.2');
  expect(inputOf(complete.mock.calls[0][1]).block.text).toBe(
    'A revised source.',
  );
});

it('preserves original code and standalone equations between translated paragraphs', async () => {
  await prose('Before the code.');
  const code = '```cpp\n  int n = 42; // keep indentation\n```';
  await c.repos.blocks.insertMany('aima', [
    {
      seq: 2,
      type: 'code',
      text: code,
      chars: code.length,
      section_id: '3.5.2',
    },
    {
      seq: 3,
      type: 'equation',
      text: '',
      latex: 'E=mc^2',
      chars: 6,
      section_id: '3.5.2',
    },
    // MinerU keeps the delimiters in the text; they are not doubled.
    {
      seq: 4,
      type: 'equation',
      text: '$$ a=b\\tag{1} $$',
      chars: 16,
      section_id: '3.5.2',
    },
    {
      seq: 5,
      type: 'text',
      text: 'After the code.',
      chars: 15,
      section_id: '3.5.2',
    },
  ]);
  const complete = jest
    .spyOn(c.ai, 'complete')
    .mockImplementation(async (_purpose, req) =>
      response(
        inputOf(req).block.text === 'Before the code.'
          ? '代码之前。'
          : '代码之后。',
      ),
    );
  expect(await session.translateSection('3.5.2')).toBe(
    `代码之前。\n\n${code}\n\n$$\nE=mc^2\n$$\n\n$$\na=b\\qquad\\text{(1)}\n$$\n\n代码之后。`,
  );
  expect(complete).toHaveBeenCalledTimes(2);
});

it.each(['cancel', 'error', 'truncated'] as const)(
  'resumes completed chunks without caching the failed chunk on %s',
  async failure => {
    await prose('English text '.repeat(1200));
    const ctl = new AbortController();
    let calls = 0;
    const complete = jest
      .spyOn(c.ai, 'complete')
      .mockImplementation(async () => {
        if (++calls === 2) {
          if (failure === 'cancel') ctl.abort();
          else if (failure === 'truncated')
            return { ...response('被截断的译文'), stop: 'max_tokens' };
          else throw new Error('translation unavailable');
        }
        return response('已完成分片');
      });
    await expect(
      session.translateSection('3.5.2', ctl.signal),
    ).rejects.toThrow();
    expect(await c.db.all('SELECT * FROM section_translation')).toEqual([]);
    complete.mockImplementation(async () => response('重试完整译文'));
    complete.mockClear();
    const translated = await session.translateSection('3.5.2');
    expect(translated).toContain('已完成分片');
    expect(translated).toContain('重试完整译文');
    expect(translated).not.toContain('被截断');
    expect(complete).toHaveBeenCalledTimes(2);
    expect(await c.db.get('SELECT content FROM section_translation')).toEqual({
      content: translated,
    });
  },
);

it('keeps a complete cached translation when regeneration fails, and replaces it only after a successful retry', async () => {
  await prose('An English paragraph. '.repeat(600));
  const complete = jest
    .spyOn(c.ai, 'complete')
    .mockImplementation(async () => response('已完成的旧译文'));
  const original = await session.translateSection('3.5.2');
  complete
    .mockResolvedValueOnce(response('尚未完成的新译文'))
    .mockRejectedValueOnce(new Error('translation offline'));
  await expect(
    session.translateSection('3.5.2', undefined, undefined, true),
  ).rejects.toThrow('translation offline');
  complete.mockClear();
  expect(await session.translateSection('3.5.2')).toBe(original);
  expect(complete).not.toHaveBeenCalled();
  complete.mockImplementation(async () => response('重试完成的新译文'));
  const replacement = await session.translateSection(
    '3.5.2',
    undefined,
    undefined,
    true,
  );
  expect(replacement).not.toBe(original);
  expect(await session.translateSection('3.5.2')).toBe(replacement);
});

it('resumes a failed regeneration using only the newly completed chunks and keeps the old full result until done', async () => {
  await prose('English paragraph. '.repeat(700));
  const complete = jest
    .spyOn(c.ai, 'complete')
    .mockResolvedValue(response('旧译文'));
  const old = await session.translateSection('3.5.2');
  complete
    .mockResolvedValueOnce(response('本次完成分片'))
    .mockRejectedValueOnce(new Error('offline'));
  await expect(
    session.translateSection('3.5.2', undefined, undefined, true),
  ).rejects.toThrow('offline');
  expect(await session.translateSection('3.5.2')).toBe(old);
  complete.mockClear();
  complete.mockResolvedValue(response('本次续做分片'));
  const resumed = await session.translateSection(
    '3.5.2',
    undefined,
    undefined,
    'resume',
  );
  expect(resumed).toContain('本次完成分片');
  expect(resumed).toContain('本次续做分片');
  expect(resumed).not.toContain('旧译文');
  expect(complete).toHaveBeenCalledTimes(2);
  expect(await session.translateSection('3.5.2')).toBe(resumed);
});

it('publishes decoded Chinese before the streaming request finishes and replays the complete cache without a request', async () => {
  await prose('A technical paragraph.');
  let finish!: () => void;
  const pending = new Promise<void>(resolve => {
    finish = resolve;
  });
  let started!: () => void;
  const ready = new Promise<void>(resolve => {
    started = resolve;
  });
  const onText = jest.fn();
  const stream = jest
    .spyOn(c.ai, 'stream')
    .mockImplementation(async (_purpose, _req, handlers) => {
      handlers.onText('{"answer":"中文\\n译文');
      started();
      await pending;
      return response('中文\n译文完成');
    });
  const work = session.translateSection(
    '3.5.2',
    undefined,
    undefined,
    false,
    onText,
  );
  try {
    await ready;
    await new Promise(resolve => setTimeout(resolve, 70));
    expect(onText).toHaveBeenLastCalledWith('中文\n译文');
    expect(await c.db.all('SELECT * FROM section_translation')).toEqual([]);
  } finally {
    finish();
  }
  expect(await work).toBe('中文\n译文完成');
  expect(onText).toHaveBeenLastCalledWith('中文\n译文完成');
  stream.mockClear();
  onText.mockClear();
  expect(
    await session.translateSection(
      '3.5.2',
      undefined,
      undefined,
      false,
      onText,
    ),
  ).toBe('中文\n译文完成');
  expect(stream).not.toHaveBeenCalled();
  expect(onText).toHaveBeenCalledWith('中文\n译文完成', true);
});

it.each(['cancel', 'error', 'truncated'] as const)(
  'does not cache a streamed translation on %s',
  async failure => {
    await prose('An English sentence. '.repeat(700));
    const controller = new AbortController();
    const stream = jest.spyOn(c.ai, 'stream');
    stream.mockImplementation(async (_purpose, _req, handlers) => {
      handlers.onText('{"answer":"部分译文');
      if (failure === 'cancel') controller.abort();
      if (failure === 'error') throw new Error('stream interrupted');
      return {
        ...response('部分译文'),
        stop: failure === 'truncated' ? 'max_tokens' : 'end',
      };
    });
    await expect(
      session.translateSection(
        '3.5.2',
        controller.signal,
        undefined,
        false,
        jest.fn(),
      ),
    ).rejects.toThrow();
    expect(await c.db.all('SELECT * FROM section_translation')).toEqual([]);
  },
);

it('decodes every partial JSON boundary without leaking escapes or half a Unicode character', () => {
  const answer = '首行\n"术语"、\\路径\t😀';
  const json = JSON.stringify({ answer }).replace('😀', '\\ud83d\\ude00');
  let previous = '';
  for (let end = 0; end <= json.length; end++) {
    const text = streamedTaskAnswer(json.slice(0, end));
    expect(answer.startsWith(text)).toBe(true);
    expect(text.startsWith(previous)).toBe(true);
    expect(text).not.toMatch(/[\uD800-\uDBFF]$/);
    previous = text;
  }
  expect(previous).toBe(answer);
});

it('keeps source-owned alignment when a model changes paragraph count, preserves formulas and replays the paired cache', async () => {
  await prose('First paragraph.');
  await c.repos.blocks.insertMany('aima', [
    {
      seq: 2,
      type: 'equation',
      text: '$$x=2$$',
      chars: 7,
      section_id: '3.5.2',
    },
    {
      seq: 3,
      type: 'title',
      level: 3,
      text: 'A heading',
      chars: 9,
      section_id: '3.5.2',
    },
    {
      seq: 4,
      type: 'text',
      text: 'Last paragraph.',
      chars: 15,
      section_id: '3.5.2',
    },
  ]);
  const stream = jest
    .spyOn(c.ai, 'stream')
    .mockImplementation(async (_purpose, req, handlers) => {
      const seq = inputOf(req).block.seq;
      handlers.onText(JSON.stringify({ answer: `译文${seq}` }));
      return response(seq === 1 ? '第一段。\n\n模型另起一段。' : `译文${seq}`);
    });
  const onPassages = jest.fn<void, [TranslationProgress[], boolean?]>();
  const result = await session.translateSection(
    '3.5.2',
    undefined,
    undefined,
    false,
    undefined,
    onPassages,
  );
  expect(stream).toHaveBeenCalledTimes(3);
  // Later passages see the previous source and translation as reference; the input stays last.
  const references = stream.mock.calls.map(call =>
    call[1].contextBlocks.map(block => block.text).join('\n'),
  );
  expect(references[0]).toContain('本段所在小节');
  expect(references[0]).not.toContain('上一段原文');
  expect(references[1]).toContain('上一段原文：First paragraph.');
  expect(references[1]).toContain('上一段译文：第一段。');
  expect(stream.mock.calls[1][1].contextBlocks.at(-1)!.text).toMatch(
    /^<input>/,
  );
  const parts = onPassages.mock.calls.at(-1)![0];
  expect(parts.map(part => part.block.seq)).toEqual([1, 2, 3, 4]);
  expect(parts[0]).toMatchObject({
    source: 'First paragraph.',
    answer: '第一段。\n\n模型另起一段。',
    complete: true,
  });
  expect(parts[1]).toMatchObject({ translate: false, source: '$$\nx=2\n$$' });
  expect(parts[2].block).toMatchObject({ type: 'title', level: 3 });
  expect(parts[3].answer).toBe('译文4');
  stream.mockClear();
  onPassages.mockClear();
  expect(
    await session.translateSection(
      '3.5.2',
      undefined,
      undefined,
      false,
      undefined,
      onPassages,
    ),
  ).toBe(result);
  expect(stream).not.toHaveBeenCalled();
  expect(onPassages).toHaveBeenLastCalledWith(parts, true);
});

it('resumes an interrupted paired translation without losing earlier alignment or caching incomplete results', async () => {
  await prose('First.');
  await c.repos.blocks.insertMany('aima', [
    { seq: 2, type: 'text', text: 'Second.', chars: 7, section_id: '3.5.2' },
  ]);
  const stream = jest
    .spyOn(c.ai, 'stream')
    .mockResolvedValueOnce(response('第一段。'))
    .mockRejectedValueOnce(new Error('offline'));
  const progress = jest.fn();
  await expect(
    session.translateSection(
      '3.5.2',
      undefined,
      undefined,
      false,
      undefined,
      progress,
    ),
  ).rejects.toThrow('offline');
  expect(progress.mock.calls.at(-1)![0]).toEqual([
    expect.objectContaining({ id: '1:0', answer: '第一段。', complete: true }),
    expect.objectContaining({ id: '2:0', answer: null, complete: false }),
  ]);
  expect(
    await c.db.get('SELECT content FROM ai_task_cache WHERE scope=?', [
      JSON.stringify(['bilingualSection', '3.5.2']),
    ]),
  ).toBeUndefined();
  stream.mockClear();
  stream.mockResolvedValue(response('第二段。'));
  await session.translateSection(
    '3.5.2',
    undefined,
    undefined,
    'resume',
    undefined,
    progress,
  );
  expect(stream).toHaveBeenCalledTimes(1);
  expect(
    progress.mock.calls
      .at(-1)![0]
      .map((part: TranslationProgress) => part.answer),
  ).toEqual(['第一段。', '第二段。']);
});

it('rejects a translated table that loses merged cells and retries it without caching the invalid layout', async () => {
  const html =
    '<table><tr><th rowspan="2">Model</th><th>Score</th></tr><tr><td>0.9</td></tr></table>';
  await c.repos.blocks.insertMany('aima', [
    { seq: 1, type: 'table', text: '', html, chars: 12, section_id: '3.5.2' },
  ]);
  const stream = jest
    .spyOn(c.ai, 'stream')
    .mockResolvedValueOnce(
      response(
        '<table><tr><td>模型</td><td>分数</td></tr><tr><td>0.9</td></tr></table>',
      ),
    );
  const progress = jest.fn();
  await expect(
    session.translateSection(
      '3.5.2',
      undefined,
      undefined,
      false,
      undefined,
      progress,
    ),
  ).rejects.toThrow('译文表格的行列与原文不一致');
  expect(
    await c.db.all('SELECT content FROM ai_task_cache WHERE scope IN (?, ?)', [
      JSON.stringify(['bilingualSection', '3.5.2']),
      JSON.stringify(['bilingual', '3.5.2', '1:0']),
    ]),
  ).toEqual([]);
  const translated = html.replace('Model', '模型').replace('Score', '分数');
  stream.mockResolvedValueOnce(response(translated));
  await session.translateSection(
    '3.5.2',
    undefined,
    undefined,
    'resume',
    undefined,
    progress,
  );
  expect(stream).toHaveBeenCalledTimes(2);
  expect(progress.mock.calls.at(-1)![0][0]).toMatchObject({
    answer: translated,
    complete: true,
  });
});
