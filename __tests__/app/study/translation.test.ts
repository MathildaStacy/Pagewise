import { createTestDemoContainer } from '@app/testing';
import type { Container } from '@app/container';
import { StudySession } from '@app/study/StudySession';
import type { GatewayRequest } from '@services/ai/gateway';
import type { ParsedResponse } from '@services/ai/protocol';
import { streamedTaskAnswer } from '@app/study/prompts';

let c: Container, session: StudySession;
const inputOf = (req: GatewayRequest) =>
  JSON.parse(/<input>\s*([\s\S]*?)\s*<\/input>/.exec(req.system)![1]);
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
    {
      seq: 4,
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
    `代码之前。\n\n${code}\n\n$$\nE=mc^2\n$$\n\n代码之后。`,
  );
  expect(complete).toHaveBeenCalledTimes(2);
});

it.each(['cancel', 'error', 'truncated'] as const)(
  'does not cache partial output on %s',
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
        return response('部分译文');
      });
    await expect(
      session.translateSection('3.5.2', ctl.signal),
    ).rejects.toThrow();
    expect(await c.db.all('SELECT * FROM section_translation')).toEqual([]);
    complete.mockImplementation(async () => response('重试完整译文'));
    const translated = await session.translateSection('3.5.2');
    expect(translated).not.toContain('部分译文');
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
  expect(onText).toHaveBeenCalledWith('中文\n译文完成');
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
