import { createTestContainer } from '@app/testing';
import { seedDemo } from '@app/demo/seed';
import { createDemoGateway } from '@app/demo/gateway';
import type { Container } from '@app/container';
import {
  applyRefinement,
  disposeRefinements,
  generateRefinement,
  loadRefinement,
  setRefinementImageLoader,
  undoRefinement,
} from '@app/usecases/refinement';
import { loadStudyReader } from '@app/usecases/studyReader';
import { StudySession } from '@app/study/StudySession';
import { executeReadTool } from '@app/study/toolExec';
import type { BlockInsert } from '@core/types';
import type { ParsedResponse } from '@services/ai/protocol';

const sectionId = '3.5.2';
let c: Container, session: StudySession | undefined;
const response = (value: unknown): ParsedResponse => ({
  parts: [{ t: 'text', text: JSON.stringify(value) }],
  raw: { protocol: 'chat', model: 'fixture', items: [] },
  usage: {
    input: 10,
    output: 5,
    cacheRead: 0,
    cacheWrite: 0,
    cacheReported: false,
  },
  stop: 'end',
  model: 'fixture',
});
const empty = () => response({ edits: [], issues: [] });
beforeEach(async () => {
  c = await createTestContainer({ ai: createDemoGateway({ delayMs: 0 }) });
  await seedDemo(c.db, c.clock);
  await c.db.run("DELETE FROM block WHERE book_id='aima'");
});
afterEach(async () => {
  await session?.dispose();
  session = undefined;
  await c.close();
});
async function source(texts: string[], over: Partial<BlockInsert> = {}) {
  await c.repos.blocks.insertMany(
    'aima',
    texts.map((text, i) => ({
      seq: i + 1,
      page: i + 1,
      type: 'text',
      text,
      chars: Array.from(text).length,
      section_id: sectionId,
      x0: 10,
      y0: 20,
      x1: 500,
      y1: 600,
      ...over,
    })),
  );
  await c.db.run(
    "UPDATE section SET block_from=1,block_to=?,page_from=1,page_to=? WHERE book_id='aima' AND id=?",
    [texts.length, texts.length, sectionId],
  );
  await c.repos.sections.setParts('aima', sectionId, [
    { part_no: 0, block_from: 1, block_to: texts.length, name: '本节' },
  ]);
}
const generate = (extra = {}) =>
  generateRefinement(c, 'aima', sectionId, { mode: 'structure', ...extra });

it('keeps suggestions separate, selectively applies/undoes them without changing source, notes or chapter conversations', async () => {
  await source(['wrapped\ntext', '第二\n段']);
  const raw = await c.repos.blocks.bySection('aima', sectionId);
  const notes = await c.db.all('SELECT * FROM highlight');
  const messages = await c.db.all('SELECT * FROM message');
  const conversations = await c.db.all('SELECT * FROM study_conversation');
  jest.spyOn(c.ai, 'complete').mockResolvedValue(empty());
  const run = await generate();
  expect(run).toMatchObject({
    status: 'ready',
    completed: 1,
    input_tokens: 10,
    output_tokens: 5,
  });
  expect((await loadStudyReader(c, 'aima', sectionId)).blocks).toEqual(raw);
  const changed = jest.fn();
  c.events.subscribe('source.refined', changed);
  await applyRefinement(c, run.id, [1]);
  const reader = await loadStudyReader(c, 'aima', sectionId);
  expect(reader.blocks.map(b => b.text)).toEqual(['wrapped text', '第二\n段']);
  expect(reader.originalBlocks).toEqual(raw);
  expect(await c.repos.blocks.get('aima', 1)).toEqual(raw[0]);
  expect(await c.repos.blocks.reading.get('aima', 1)).toMatchObject({
    text: 'wrapped text',
    seq: 1,
    page: 1,
    x0: 10,
  });
  expect(
    (await executeReadTool(c, 'aima', 'load_section', { id: sectionId }))
      .output,
  ).toContain('source="ai_refined">wrapped text');
  await undoRefinement(c, run.id);
  expect(await c.repos.blocks.reading.bySection('aima', sectionId)).toEqual(
    raw,
  );
  expect(changed).toHaveBeenCalledTimes(2);
  expect(await c.db.all('SELECT * FROM highlight')).toEqual(notes);
  expect(await c.db.all('SELECT * FROM message')).toEqual(messages);
  expect(await c.db.all('SELECT * FROM study_conversation')).toEqual(
    conversations,
  );
  await applyRefinement(c, run.id, [2]);
  expect(
    (await c.repos.blocks.reading.range('aima', 1, 2)).map(b => b.text),
  ).toEqual(['wrapped\ntext', '第二段']);
});

it('checkpoints completed batches and resumes only the remaining batches using the saved model', async () => {
  await source(['a'.repeat(3500), 'b'.repeat(3500), 'c'.repeat(3500)]);
  const ctl = new AbortController();
  const complete = jest.spyOn(c.ai, 'complete').mockResolvedValue(empty());
  const paused = await generate({
    signal: ctl.signal,
    onProgress: (run: { completed: number }) => {
      if (run.completed === 1) ctl.abort();
    },
  });
  expect(paused).toMatchObject({ status: 'paused', completed: 1 });
  expect(complete).toHaveBeenCalledTimes(1);
  complete.mockClear();
  const ready = await generate({
    resume: true,
    config: {
      providerId: 'different',
      model: 'other',
      effort: 'off',
      search: true,
    },
  });
  expect(ready).toMatchObject({
    id: paused.id,
    status: 'ready',
    completed: 3,
    input_tokens: 30,
  });
  expect(complete).toHaveBeenCalledTimes(2);
  expect(
    complete.mock.calls.map(
      ([, req]) => JSON.parse(req.contextBlocks[0].text).targets[0].seq,
    ),
  ).toEqual([2, 3]);
  expect(
    complete.mock.calls.every(
      ([, req]) =>
        req.config?.model === paused.config?.model &&
        req.config?.search === false &&
        req.noTools &&
        !req.tools.length,
    ),
  ).toBe(true);
});

it('keeps an existing applied run effective while new suggestions are generated and replaces it only upon adoption', async () => {
  await source(['a\nb']);
  jest.spyOn(c.ai, 'complete').mockResolvedValue(empty());
  const first = await generate();
  await applyRefinement(c, first.id, [1]);
  const draft = await generate();
  expect((await c.repos.refinements.latest('aima', sectionId))?.id).toBe(
    draft.id,
  );
  expect((await c.repos.refinements.applied('aima', sectionId))?.id).toBe(
    first.id,
  );
  expect((await c.repos.blocks.reading.get('aima', 1))?.text).toBe('a b');
  await expect(applyRefinement(c, draft.id, [99])).rejects.toThrow('有效');
  await applyRefinement(c, draft.id, [1]);
  expect((await c.repos.refinements.get(first.id))?.status).toBe('undone');
});

it('marks changed sources stale and rejects adoption even when source text matches but geometry changed', async () => {
  await source(['a\nb']);
  jest.spyOn(c.ai, 'complete').mockResolvedValue(empty());
  const run = await generate();
  await c.db.run("UPDATE block SET x0=11 WHERE book_id='aima'");
  await expect(applyRefinement(c, run.id, [1])).rejects.toThrow('原文已变化');
  expect((await loadRefinement(c, 'aima', sectionId))?.status).toBe('stale');
  await expect(generate({ resume: true })).rejects.toThrow('原文或模式');
});

it('does not commit an in-flight response after reparsing, even if the new source has identical text', async () => {
  await source(['a\nb']);
  jest.spyOn(c.ai, 'complete').mockImplementation(async () => {
    await c.repos.refinements.invalidate(
      'aima',
      c.clock.now().toISOString(),
      1,
      1,
    );
    return empty();
  });
  await expect(generate()).rejects.toThrow('原文已变化');
  expect((await c.repos.refinements.latest('aima', sectionId))?.status).toBe(
    'stale',
  );
});

it('prevents concurrent runs and aborts active work before disposing the container', async () => {
  await source(['a\nb']);
  let started!: () => void;
  const waiting = new Promise<void>(resolve => {
    started = resolve;
  });
  jest.spyOn(c.ai, 'complete').mockImplementation(
    (_purpose, _req, opts) =>
      new Promise((_resolve, reject) => {
        opts!.signal!.addEventListener(
          'abort',
          () => reject(new Error('cancelled')),
          { once: true },
        );
        started();
      }),
  );
  const job = generate();
  await waiting;
  await expect(generate()).rejects.toThrow('正在精修');
  await disposeRefinements(c);
  expect((await job).status).toBe('paused');
});

it.each(['bad-json', 'truncated', 'network'] as const)(
  'persists recoverable failure on %s without accepting partial output',
  async failure => {
    await source(['a\nb']);
    const complete = jest
      .spyOn(c.ai, 'complete')
      .mockImplementation(async () => {
        if (failure === 'network') throw new Error('offline');
        return failure === 'truncated'
          ? { ...empty(), stop: 'max_tokens' }
          : { ...empty(), parts: [{ t: 'text', text: '{"edits":[' }] };
      });
    await expect(generate()).rejects.toThrow();
    const failed = await loadRefinement(c, 'aima', sectionId);
    expect(failed).toMatchObject({ status: 'failed', completed: 0 });
    expect((await c.repos.blocks.reading.get('aima', 1))?.text).toBe('a\nb');
    complete.mockResolvedValue(empty());
    expect((await generate({ resume: true })).status).toBe('ready');
    await c.repos.refinements.status(
      failed!.id,
      'running',
      c.clock.now().toISOString(),
    );
    expect((await loadRefinement(c, 'aima', sectionId))?.status).toBe('paused');
  },
);

it('sends only target PDF pages as transient images and supports equation corrections with empty text', async () => {
  await source(['', '', ''], { type: 'equation', latex: 'x=O' });
  const loader = jest.fn(async (_book, pages: number[]) =>
    pages.map(page => ({
      data: `page${page}`,
      mime: 'image/png' as const,
      label: `page ${page}`,
    })),
  );
  setRefinementImageLoader(c, loader);
  const complete = jest
    .spyOn(c.ai, 'complete')
    .mockImplementation(async (_purpose, req) =>
      response({
        edits: JSON.parse(req.contextBlocks[0].text).targets.map(
          (b: { seq: number }) => ({
            seq: b.seq,
            text: '',
            latex: 'x=0',
            reason: '对照原页',
          }),
        ),
        issues: [],
      }),
    );
  const run = await generate({ mode: 'vision' });
  expect(loader.mock.calls.map(call => call[1])).toEqual([[1, 2], [3]]);
  expect(
    complete.mock.calls.every(
      ([, req]) => req.images?.length && req.history.length === 0,
    ),
  ).toBe(true);
  await applyRefinement(c, run.id, [1]);
  expect((await c.repos.blocks.reading.get('aima', 1))?.latex).toBe('x=0');
  expect(JSON.stringify(await c.repos.refinements.get(run.id))).not.toContain(
    'page1',
  );
});

it('invalidates cached translations on adoption/undo and refreshes subsequent chat without deleting conversations', async () => {
  await source(['English\ntext']);
  session = new StudySession(c, 'aima');
  await session.open({ autoStart: false });
  const originalComplete = c.ai.complete;
  const complete = jest
    .spyOn(c.ai, 'complete')
    .mockImplementation(async (purpose, req, opts) => {
      if (req.system.includes('<task name="translate">')) {
        const input = JSON.parse(
          /<input>\s*([\s\S]*?)\s*<\/input>/.exec(req.system)![1],
        );
        return response({
          answer: input.block.text.includes('\n') ? '原文译文' : '精修译文',
        });
      }
      if (req.system.startsWith('你是文档校对员')) return empty();
      return originalComplete(purpose, req, opts);
    });
  expect(await session.translateSection(sectionId)).toBe('原文译文');
  const run = await generate();
  const messages = await c.db.all('SELECT * FROM message');
  const conversations = await c.db.all('SELECT * FROM study_conversation');
  await applyRefinement(c, run.id, [1]);
  expect(await session.translateSection(sectionId)).toBe('精修译文');
  expect(await c.db.all('SELECT * FROM message')).toEqual(messages);
  expect(await c.db.all('SELECT * FROM study_conversation')).toEqual(
    conversations,
  );
  const stream = jest.spyOn(c.ai, 'stream');
  await session.send('请解释当前原文');
  expect(stream).toHaveBeenCalled();
  expect(
    stream.mock.calls[0][1].contextBlocks.map(b => b.text).join('\n'),
  ).toContain('source="ai_refined">English text');
  await undoRefinement(c, run.id);
  expect(await session.translateSection(sectionId)).toBe('原文译文');
  expect(complete).toHaveBeenCalled();
});

it('keeps source-page review unavailable for a backup whose original PDF was omitted', async () => {
  await source(['text']);
  await c.repos.settings.set('backup.missingOriginals', [
    { id: 'aima', sha256: 'fixture' },
  ]);
  const loader = jest.fn();
  setRefinementImageLoader(c, loader);
  await expect(generate({ mode: 'vision' })).rejects.toThrow('重新导入原 PDF');
  expect(loader).not.toHaveBeenCalled();
});

it.each([false, true])(
  'refreshes previously loaded detour source after adoption or undo without rewriting tool history (initially applied: %s)',
  async initiallyApplied => {
    await source(['Main source']);
    const other = '3.4.2';
    await c.repos.blocks.insertMany('aima', [
      {
        seq: 2,
        page: 2,
        type: 'text',
        text: 'Adjacent\nsource',
        chars: 15,
        section_id: other,
      },
    ]);
    await c.db.run(
      "UPDATE section SET block_from=2,block_to=2 WHERE book_id='aima' AND id=?",
      [other],
    );
    await c.repos.sections.setParts('aima', other, [
      { part_no: 0, block_from: 2, block_to: 2, name: '本节' },
    ]);
    const originalComplete = c.ai.complete;
    jest
      .spyOn(c.ai, 'complete')
      .mockImplementation((purpose, req, opts) =>
        req.system.startsWith('你是文档校对员')
          ? Promise.resolve(empty())
          : originalComplete(purpose, req, opts),
      );
    const run = await generateRefinement(c, 'aima', other, {
      mode: 'structure',
    });
    if (initiallyApplied) await applyRefinement(c, run.id, [2]);
    const stream = jest.spyOn(c.ai, 'stream').mockResolvedValue(response('回答'));
    session = new StudySession(c, 'aima');
    await session.open({ autoStart: false });
    session.setQuote(2);
    await session.send('这段是什么意思？');
    const recorded = session.store
      .getState()
      .messages.filter(message => message.kind === 'tool');
    expect(JSON.stringify(recorded)).toContain('load_section');
    if (initiallyApplied) await undoRefinement(c, run.id);
    else await applyRefinement(c, run.id, [2]);
    await session.send('再解释当前版本');
    const request = stream.mock.calls.at(-1)![1];
    expect(request.contextBlocks.map(block => block.text).join('\n')).toContain(
      initiallyApplied ? '>Adjacent\nsource</block>' : '>Adjacent source</block>',
    );
    expect(request.system).toContain('以 current_source 为准');
    const after = await c.repos.messages.thread('aima', sectionId);
    for (const old of recorded)
      expect(after.find(message => message.id === old.id)).toEqual(old);
  },
);
