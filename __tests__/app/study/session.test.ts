import { createTestDemoContainer } from '@app/testing';
import type { Container } from '@app/container';
import { StudySession } from '@app/study/StudySession';
import { getStudySession, disposeContainerSessions } from '@app/study/registry';
import { parseStudyCard } from '@app/study/types';
import { createDemoGateway } from '@app/demo/gateway';
import { createTestClock } from '@app/clock';
import type { AiGateway, GatewayRequest } from '@services/ai/gateway';
import type { ParsedResponse } from '@services/ai/protocol';
import type { Part } from '@services/ai/types';
import { AiError } from '@services/ai/http';
import { rateReviewCard } from '@app/usecases/review';

let c: Container, session: StudySession;
const demo = createDemoGateway({ delayMs: 0 });
const response = (parts: Part[]): ParsedResponse => ({
  parts,
  raw: { protocol: 'chat', model: 'test', items: parts },
  usage: {
    input: 12,
    output: 4,
    cacheRead: 0,
    cacheWrite: 0,
    cacheReported: false,
  },
  stop: parts.some(p => p.t === 'call') ? 'tool' : 'end',
  model: 'test',
});
const text = (value: string) => response([{ t: 'text', text: value }]);
const call = (name: string, args: unknown, id = 'call-1') =>
  response([{ t: 'call', name, args: JSON.stringify(args), id }]);
function scripted(
  responses: (
    | ParsedResponse
    | Error
    | ((req: GatewayRequest) => ParsedResponse)
  )[],
): AiGateway {
  return {
    ...demo,
    stream: jest.fn(async (_purpose, req, handlers) => {
      const value = responses.shift();
      if (value instanceof Error) throw value;
      const result =
        typeof value === 'function' ? value(req) : value ?? text('讲解完成');
      handlers.onText(
        result.parts
          .filter(p => p.t === 'text')
          .map(p => p.text)
          .join(''),
      );
      return result;
    }),
  };
}
async function setup(ai?: AiGateway) {
  c = await createTestDemoContainer(ai ? { ai } : {});
  session = new StudySession(c, 'aima');
  await session.open({ autoStart: false });
}
const state = () => session.store.getState();
const cards = () =>
  state()
    .messages.filter(m => m.kind === 'card')
    .map(m => ({ message: m, card: parseStudyCard(m.content) }));
afterEach(async () => {
  if (session) await session.dispose();
  if (c) await c.close();
});

it('restores the seeded main pointer and registry identity without repeating requests on mount', async () => {
  const ai = scripted([]);
  await setup(ai);
  expect(state().main).toEqual({ sectionId: '3.5.2', part: 0, step: 1 });
  const a = getStudySession(c, 'aima'),
    b = getStudySession(c, 'aima');
  expect(a).toBe(b);
  await a.open({ autoStart: false });
  await a.open();
  await a.open();
  expect(ai.stream).not.toHaveBeenCalled();
  expect((await c.repos.study.get('aima'))?.main_step).toBe(1);
  await disposeContainerSessions(c);
});
it.each(['alt', 'example', 'derive'] as const)(
  '%s keeps the pointer and records the corresponding turn',
  async key => {
    const ai = scripted([text('另一种讲法')]);
    await setup(ai);
    const pointer = state().main;
    await session.act(key);
    expect(state().main).toEqual(pointer);
    expect(
      state()
        .messages.filter(m => m.kind === 'user')
        .at(-1)?.intent,
    ).toBe(key);
    if (key === 'alt')
      expect(state().stuckCandidates).toContain(state().plan!.steps[1].title);
    const request = jest.mocked(ai.stream).mock.calls[0][1];
    const last = request.history.filter(m => m.role === 'user').at(-1)!;
    expect(
      JSON.parse(
        /<turn>(.*?)<\/turn>/.exec(
          last.parts.map(p => (p.t === 'text' ? p.text : '')).join(''),
        )![1],
      ),
    ).toMatchObject({ step: 1, intent: key });
  },
);
it.each(['next', 'skip'] as const)(
  '%s persists step state before teaching the new step',
  async key => {
    const ai = scripted([text('新的一步')]);
    await setup(ai);
    await session.act(key);
    expect(state().main.step).toBe(2);
    expect(state().plan!.steps[1].status).toBe(
      key === 'next' ? 'done' : 'skipped',
    );
    expect((await c.repos.study.get('aima'))?.main_step).toBe(2);
    expect(
      cards().some(x => x.card?.kind === 'stepHeader' && x.card.step === 2),
    ).toBe(true);
    const assistant = state()
      .messages.filter(m => m.kind === 'assistant')
      .at(-1)!;
    expect(assistant.parts).toBeTruthy();
    expect(assistant.raw).toMatchObject({ model: 'test' });
    expect(assistant.allowed_refs).toEqual(state().partBlocks.map(b => b.seq));
  },
);
it('jumps only into todo steps and scrolls to already taught steps', async () => {
  const ai = scripted([text('从这里讲')]);
  await setup(ai);
  await session.jumpStep(0);
  expect(state().scrollToStep).toBe(0);
  expect(state().main.step).toBe(1);
  expect(ai.stream).not.toHaveBeenCalled();
  await session.jumpStep(3);
  expect(state().main.step).toBe(3);
  expect(state().plan!.steps[1].status).toBe('todo');
  expect(state().plan!.steps[3].status).toBe('current');
  expect(ai.stream).toHaveBeenCalledTimes(1);
  await session.jumpStep(3);
  expect(ai.stream).toHaveBeenCalledTimes(1);
});
it('switches reader modes and persists anchor and view, while quoted questions preserve the step', async () => {
  await setup(scripted([text('引用回答')]));
  const initial = state().main;
  const seq = state().plan!.steps[3].block_from;
  session.setQuote(seq);
  await session.setMode('read');
  await session.setMode('listen');
  expect(state().main).toEqual(initial);
  expect(state().pendingQuote).toBe(seq);
  await session.setReaderView('flow');
  session.reportAnchor(seq);
  await session.dispose();
  const saved = await c.repos.study.get('aima');
  expect(saved).toMatchObject({
    mode: 'listen',
    reader_view: 'flow',
    read_anchor: seq,
  });
});
it('opens another section as an independent reader without changing main', async () => {
  await setup();
  const main = state().main;
  await session.open({ mode: 'read', sectionId: '3.4.2', preserveMain: true });
  expect(state().readerSectionId).toBe('3.4.2');
  expect(state().main).toEqual(main);
  expect(state().blocks.every(b => b.section_id === main.sectionId)).toBe(true);
});
it('runs the actual Demo load_section loop, persists a detour, QA and folds it on return', async () => {
  await setup();
  const main = state().main;
  await session.send('A* 和一致代价搜索有什么关系？');
  expect(state().detours.at(-1)?.sectionId).toBe('3.4.2');
  expect(state().main).toEqual(main);
  const answers = state().messages.filter(m => m.kind === 'assistant');
  expect(
    answers
      .at(-1)
      ?.allowed_refs?.some(seq => !state().partBlocks.some(b => b.seq === seq)),
  ).toBe(true);
  const qa = await c.repos.notes.qa.list('aima', '3.4.2');
  expect(qa.at(-1)).toMatchObject({ from_section: '3.5.2' });
  const detourId = state().detours[0].detourId;
  await session.backMain();
  expect(state().detours).toEqual([]);
  expect((await c.repos.detours.get(detourId))?.ended_at).toBeTruthy();
  const fold = cards().find(x => x.card?.kind === 'fold');
  expect(fold?.card).toMatchObject({ kind: 'fold', detourIds: [detourId] });
  expect(
    state()
      .messages.filter(m => m.detour_id === detourId)
      .every(m => !m.in_context),
  ).toBe(true);
  expect(state().main).toEqual(main);
});
it('prevents a third nested detour and lets the AI answer with a tool error', async () => {
  const ai = scripted([
    call('load_section', { id: '3.4.2' }, '1'),
    call('load_section', { id: '3.5.1' }, '2'),
    call('load_section', { id: '3.4.1' }, '3'),
    text('先回主线'),
  ]);
  await setup(ai);
  await session.send('对比这些小节');
  expect(state().detours).toHaveLength(2);
  expect(state().notice).toContain('学习记录');
  expect(
    state()
      .messages.filter(m => m.kind === 'tool')
      .at(-1)?.content,
  ).toContain('第 2 层');
});
it('caps read tools at four and forces a direct no-tools answer', async () => {
  const ai = scripted(
    Array.from({ length: 5 }, (_, i) =>
      call('get_notes', { section_id: '3.5.2' }, String(i)),
    ).concat([text('直接回答')]),
  );
  await setup(ai);
  await session.send('比较学习记录');
  const requests = jest.mocked(ai.stream).mock.calls.map(x => x[1]);
  expect(requests[4].noTools).toBe(true);
  expect(
    state()
      .messages.filter(m => m.kind === 'tool')
      .at(-1)?.content,
  ).toContain('次数已用完');
  expect(state().busy).toBe(false);
});
it('defers quiz execution, scores locally and suggests an unpersisted stuck point after a wrong answer', async () => {
  const ai = scripted([
    call('show_quiz', {
      question: '哪项正确？',
      options: ['甲', '乙', '丙'],
      answer: 0,
      explain: '甲正确',
      final: true,
    }),
    text('换个角度说明'),
  ]);
  await setup(ai);
  await session.act('quiz');
  const quiz = cards().find(x => x.card?.kind === 'quiz')!;
  expect(ai.stream).toHaveBeenCalledTimes(1);
  expect(state().phase).toBe('quiz');
  const before = (await c.repos.notes.stuck.list('aima')).length;
  await session.answerQuiz(quiz.message.id, 1);
  expect(state().phase).toBe('ready');
  expect((await c.repos.notes.stuck.list('aima')).length).toBe(before);
  expect(state().messages.find(m => m.kind === 'tool')?.content).toContain(
    '"correct":false',
  );
  const proposal = cards().find(x => x.card?.kind === 'proposal')!;
  await session.resolveProposal(proposal.message.id, true);
  expect((await c.repos.notes.stuck.list('aima')).length).toBe(before + 1);
  await session.answerQuiz(quiz.message.id, 0);
  expect(ai.stream).toHaveBeenCalledTimes(2);
});
it('accepts or dismisses write proposals without eager changes', async () => {
  const ai = scripted([
    call('mark_stuck', { text: '需要理解一致性' }),
    call('advance_progress', { to: 'next_step', reason: '已掌握' }),
    text('进入下一步'),
  ]);
  await setup(ai);
  const before = (await c.repos.notes.stuck.list('aima')).length;
  await session.send('帮我记下问题');
  expect((await c.repos.notes.stuck.list('aima')).length).toBe(before);
  const proposal = cards().find(x => x.card?.kind === 'proposal')!;
  await session.resolveProposal(proposal.message.id, false);
  expect((await c.repos.notes.stuck.list('aima')).length).toBe(before);
  await session.send('下一步');
  expect(state().main.step).toBe(1);
  const advance = cards()
    .filter(x => x.card?.kind === 'proposal')
    .at(-1)!;
  await session.resolveProposal(advance.message.id, true);
  expect(state().main.step).toBe(2);
});
it('retries with identical request history without duplicating the user question', async () => {
  const ai = scripted([
    new AiError('network', 'offline'),
    text('恢复后的回答'),
  ]);
  await setup(ai);
  await session.send('为什么？');
  expect(state().error).toContain('网络');
  expect(
    state().messages.filter(m => m.kind === 'user' && m.content === '为什么？'),
  ).toHaveLength(1);
  const before = jest.mocked(ai.stream).mock.calls[0][1];
  await session.retry();
  expect(state().error).toBeNull();
  expect(jest.mocked(ai.stream).mock.calls[1][1]).toEqual(before);
  expect(
    state().messages.filter(m => m.kind === 'user' && m.content === '为什么？'),
  ).toHaveLength(1);
});
it('throttles streamed updates and saves the most recent partial text when stopped', async () => {
  let started!: () => void;
  const ready = new Promise<void>(resolve => {
    started = resolve;
  });
  const ai: AiGateway = {
    ...demo,
    stream: jest.fn(async (_purpose, _req, handlers) => {
      handlers.onText('第一段');
      handlers.onText('第一段，最后一个字');
      started();
      return new Promise<ParsedResponse>((_resolve, reject) => {
        handlers.signal.addEventListener(
          'abort',
          () => reject(new AiError('cancelled', '已停止')),
          { once: true },
        );
      });
    }),
  };
  await setup(ai);
  const work = session.send('解释');
  await ready;
  expect(state().streaming?.text).toBe('');
  session.stop();
  await work;
  expect(
    state()
      .messages.filter(m => m.kind === 'assistant')
      .at(-1)?.content,
  ).toBe('第一段，最后一个字\n\n（已停止）');
  expect(state().busy).toBe(false);
  expect(state().error).toBeNull();
});
it('hands the live entry to the saved answer in one update, keeping its list key', async () => {
  const ai = scripted([text('完整的讲解')]);
  await setup(ai);
  const overlaps: string[] = [];
  let entryId: string | undefined;
  const unsubscribe = session.store.subscribe(next => {
    if (next.streaming) entryId = next.streaming.entryId;
    const saved = next.messages.filter(m => m.kind === 'assistant').at(-1);
    if (next.streaming && saved?.content === '完整的讲解')
      overlaps.push(next.streaming.entryId);
  });
  await session.send('解释');
  unsubscribe();
  const saved = state()
    .messages.filter(m => m.kind === 'assistant')
    .at(-1)!;
  expect(overlaps).toEqual([]);
  expect(state().streaming).toBeNull();
  expect(state().streamKeys[saved.id]).toBe(entryId);
});
it('marks invalid citations and supplies a reminder after three affected turns', async () => {
  const ai = scripted([
    text('说明。[[b:99999999]]'),
    text('说明。[[b:99999999]]'),
    text('说明。[[b:99999999]]'),
    text('改正'),
  ]);
  await setup(ai);
  await session.send('一');
  await session.send('二');
  await session.send('三');
  await session.send('四');
  expect(
    state()
      .messages.filter(m => m.kind === 'assistant')
      .slice(-4, -1)
      .every(m => m.unverified === 1),
  ).toBe(true);
  const last = jest.mocked(ai.stream).mock.calls[3][1];
  expect(JSON.stringify(last.history)).toContain('只能引用本轮上下文');
});
it('pins a quoted QA to its actual source and validates refs from current blocks', async () => {
  const ai = scripted([
    req => {
      const ref = /<block id="b(\d+)"/.exec(req.contextBlocks[1].text)![1];
      return text(`答案。[[b:${ref}]]`);
    },
  ]);
  await setup(ai);
  const seq = state().partBlocks[2].seq;
  session.setQuote(seq);
  await session.send('这一段是什么意思？');
  expect(
    (await c.repos.notes.pins.list('aima')).find(pin =>
      pin.message_ids.some(id =>
        state().messages.some(
          message =>
            message.id === id && message.content === '这一段是什么意思？',
        ),
      ),
    )?.block_seq,
  ).toBe(seq);
  expect((await c.repos.notes.qa.list('aima', '3.5.2')).at(-1)?.q).toBe(
    '这一段是什么意思？',
  );
});
it('creates a recap after a day and resolves a review detour before returning', async () => {
  const clock = createTestClock();
  c = await createTestDemoContainer({ clock });
  clock.advance(2 * 86400000);
  session = new StudySession(c, 'aima');
  await session.open();
  expect(cards().some(x => x.card?.kind === 'resume')).toBe(true);
  await session.resume('review');
  expect(state().detours.at(-1)?.reviewStuckId).toBeTruthy();
  const id = state().detours.at(-1)!.reviewStuckId!;
  await session.act('reviewAgain');
  expect(
    (await c.repos.notes.stuck.list('aima')).find(x => x.id === id)
      ?.resolved_at,
  ).toBeNull();
  await session.act('reviewOk');
  expect(
    (await c.repos.notes.stuck.list('aima')).find(x => x.id === id)
      ?.resolved_at,
  ).toBeTruthy();
  expect(state().detours).toEqual([]);
});
it('generates a plan for a new section and reteaches by clearing previous context', async () => {
  await setup();
  await session.open({ sectionId: '3.5.1' });
  expect(state().plan?.steps.length).toBeGreaterThan(0);
  expect(state().messages.some(m => m.kind === 'assistant')).toBe(true);
  const old = state()
    .messages.filter(m => m.kind !== 'card')
    .map(m => m.id);
  await session.act('reteachSection');
  expect(state().main.step).toBe(0);
  expect(
    state()
      .messages.filter(m => old.includes(m.id))
      .every(m => !m.in_context),
  ).toBe(true);
});
it('generates a guide and block explanations without writing the conversation', async () => {
  await setup();
  const before = state().messages.length,
    seq = state().blocks[0].seq;
  expect(await session.explainBlock(seq, 'explain')).toContain(`[[b:${seq}]]`);
  expect(await session.explainBlock(seq, 'translate')).toContain('Demo');
  await c.repos.sections.update('aima', '3.5.2', { guide: null });
  const guide = await session.generateGuide();
  expect(JSON.parse(guide).full).toBeTruthy();
  expect((await c.repos.sections.get('aima', '3.5.2'))?.guide).toBe(guide);
  expect(state().messages).toHaveLength(before);
});
it('saves a section draft atomically with selected notes/cards and advances to the next section', async () => {
  await setup();
  const draft = await session.finishDraft();
  expect(draft?.cards).toHaveLength(3);
  const before = (
    await c.db.all('SELECT id FROM card WHERE book_id=? AND section_id=?', [
      'aima',
      '3.5.2',
    ])
  ).length;
  const next = await session.saveDraft({
    bookId: 'aima',
    sectionId: '3.5.2',
    summary: '已掌握 A*',
    stuck: [],
    cards: draft!.cards.map((card, i) => ({ ...card, checked: i === 0 })),
  });
  expect((await c.repos.sections.get('aima', '3.5.2'))?.status).toBe('done');
  expect(
    (
      await c.db.all('SELECT id FROM card WHERE book_id=? AND section_id=?', [
        'aima',
        '3.5.2',
      ])
    ).length,
  ).toBe(before + 1);
  expect((await c.repos.study.get('aima'))?.main_section).toBe(
    next?.id ?? null,
  );
});

it('continues directly from a resume card without changing the current step', async () => {
  await setup();
  const main = state().main;
  await session.resume('go');
  expect(state().main).toEqual(main);
  expect(
    state()
      .messages.filter(m => m.kind === 'user')
      .at(-1)?.intent,
  ).toBe('resume');
});
it('rebases the main pointer to the active detour and persists its learning status', async () => {
  await setup();
  await session.send('A* 和一致代价搜索有什么关系？');
  await session.backMain(true);
  expect(state().main.sectionId).toBe('3.4.2');
  expect(state().detours).toEqual([]);
  expect((await c.repos.study.get('aima'))?.main_section).toBe('3.4.2');
  expect((await c.repos.sections.get('aima', '3.4.2'))?.status).toBe(
    'learning',
  );
});
it('finishes the final step with a final quiz, or a done card when the preference disables it', async () => {
  await setup();
  await session.jumpStep(state().plan!.steps.length - 1);
  await session.act('next');
  const quiz = cards()
    .filter(item => item.card?.kind === 'quiz')
    .at(-1)!;
  expect(quiz.card).toMatchObject({ final: true, picked: null });
  await session.answerQuiz(quiz.message.id, 0);
  expect(state().phase).toBe('ready');
  expect(cards().some(item => item.card?.kind === 'done')).toBe(true);
  session.store.setState({ prefs: { ...state().prefs, quizAtEnd: false } });
  await session.act('next');
  expect(state().phase).toBe('ready');
});
it('summarizes a completed part, persists the next part and generates its plan', async () => {
  await setup();
  const blocks = state().blocks,
    mid = Math.floor(blocks.length / 2);
  await session.dispose();
  await c.repos.sections.setParts('aima', '3.5.2', [
    {
      part_no: 0,
      block_from: blocks[0].seq,
      block_to: blocks[mid - 1].seq,
      name: '上段',
    },
    {
      part_no: 1,
      block_from: blocks[mid].seq,
      block_to: blocks.at(-1)!.seq,
      name: '下段',
    },
  ]);
  await c.db.run('DELETE FROM lesson_plan WHERE book_id=? AND section_id=?', [
    'aima',
    '3.5.2',
  ]);
  await c.repos.study.patch('aima', { main_part: 0, main_step: 0 });
  session = new StudySession(c, 'aima');
  await session.open({ autoStart: false });
  await session.act('nextPart');
  expect(state().main).toMatchObject({ part: 1, step: 0 });
  expect(state().partBlocks[0].seq).toBe(blocks[mid].seq);
  expect(state().plan).toBeTruthy();
  expect(cards().some(item => item.card?.kind === 'partSummary')).toBe(true);
  expect((await c.repos.study.get('aima'))?.main_part).toBe(1);
});
it('uses a validated fallback plan for malformed model JSON and exposes network failure for retry', async () => {
  const ai = {
    ...demo,
    complete: jest.fn(async (...args: Parameters<AiGateway['complete']>) =>
      args[1].system.includes('name="plan"')
        ? text('malformed JSON')
        : demo.complete(...args),
    ),
  };
  await setup(ai);
  await session.open({ sectionId: '3.5.1' });
  expect(state().plan?.source).toBe('fallback');
  expect(state().error).toBeNull();
});
it('makes a manual draft available when the organizing model fails and lets it be saved', async () => {
  const ai = {
    ...demo,
    complete: jest.fn(async (...args: Parameters<AiGateway['complete']>) => {
      if (args[1].system.includes('sectionDraft'))
        throw new AiError('network', 'offline');
      return demo.complete(...args);
    }),
  };
  await setup(ai);
  const draft = await session.finishDraft();
  expect(draft).toMatchObject({
    summary: '',
    cards: [],
    error: expect.any(String),
  });
  await session.saveDraft({
    bookId: 'aima',
    sectionId: draft!.sectionId,
    summary: '手动小结',
    stuck: draft!.stuck,
    cards: [],
  });
  expect((await c.repos.sections.get('aima', '3.5.2'))?.summary).toBe(
    '手动小结',
  );
});
it('compresses old dialogue before teaching and keeps the current question exactly once', async () => {
  await setup();
  await c.repos.messages.append({
    book_id: 'aima',
    section_id: '3.5.2',
    part_no: 0,
    step_no: 1,
    kind: 'assistant',
    content: '旧'.repeat(26000),
    created_at: c.clock.now().toISOString(),
  });
  await session.dispose();
  session = new StudySession(c, 'aima');
  await session.open({ autoStart: false });
  await session.send('新的问题');
  expect(state().error).toBeNull();
  expect(
    state().messages.find(message => message.content.length === 26000)
      ?.in_context,
  ).toBe(false);
  expect(cards().some(item => item.card?.kind === 'partSummary')).toBe(true);
  expect(
    state().messages.filter(
      message => message.kind === 'user' && message.content === '新的问题',
    ),
  ).toHaveLength(1);
  expect(
    state().context.reduce((sum, layer) => sum + layer.tokens, 0),
  ).toBeLessThan(24000);
});
it('keeps unresolved UI tool calls paired and blocks unrelated prompts until the user responds', async () => {
  const ai = scripted([
    call('show_quiz', {
      question: '选择',
      options: ['甲', '乙', '丙'],
      answer: 0,
    }),
    text('反馈'),
  ]);
  await setup(ai);
  await session.act('quiz');
  await session.send('先讲别的');
  await session.act('next');
  expect(ai.stream).toHaveBeenCalledTimes(1);
  const quiz = cards()
    .filter(item => item.card?.kind === 'quiz')
    .at(-1)!;
  await session.answerQuiz(quiz.message.id, 0);
  expect(ai.stream).toHaveBeenCalledTimes(2);
});

it('loads a quoted block from another section before answering and keeps later detour refs verified', async () => {
  let ref = 0;
  const ai = scripted([
    () => text(`原文在这里。[[b:${ref}]]`),
    () => text(`仍然可以核对。[[b:${ref}]]`),
  ]);
  await setup(ai);
  const source = await c.repos.blocks.bySection('aima', '3.4.2');
  ref = source[0].seq;
  session.setQuote(ref);
  await session.send('这段是什么？');
  expect(state().detours.at(-1)?.sectionId).toBe('3.4.2');
  let answer = state()
    .messages.filter(message => message.kind === 'assistant')
    .at(-1)!;
  expect(answer.allowed_refs).toContain(ref);
  expect(answer.unverified).toBe(0);
  await session.send('再解释一下');
  answer = state()
    .messages.filter(message => message.kind === 'assistant')
    .at(-1)!;
  expect(answer.allowed_refs).toContain(ref);
  expect(answer.unverified).toBe(0);
});
it('reviews a forgotten card with its original source and resolves the new stuck item only after understood', async () => {
  let ref = 0;
  const ai = scripted([
    () => text(`按原文重新讲解。[[b:${ref}]]`),
    () => text(`换一种解释。[[b:${ref}]]`),
  ]);
  await setup(ai);
  const pointer = state().main;
  const source = await c.repos.blocks.bySection('aima', '3.4.2');
  ref = source[0].seq;
  const [card] = await c.repos.cards.addMany([
    {
      book_id: 'aima',
      section_id: '3.4.2',
      front: '怎样选择一致代价搜索的扩展节点？',
      back: '选择路径代价最小的节点。',
      due_on: c.clock.today(),
      origin: 'manual',
      created_at: c.clock.now().toISOString(),
    },
  ]);
  await rateReviewCard(c, card, 'again');
  const stuck = (await c.repos.notes.stuck.list('aima')).find(
    item => item.card_id === card.id,
  )!;
  expect(stuck).toMatchObject({ source: 'card', resolved_at: null });
  await session.open({ stuckId: stuck.id });
  expect(state().main).toEqual(pointer);
  expect(state().detours.at(-1)).toMatchObject({
    sectionId: '3.4.2',
    reviewStuckId: stuck.id,
  });
  const request = jest.mocked(ai.stream).mock.calls[0][1];
  expect(JSON.stringify(request.history)).toContain(source[0].text);
  expect(
    state()
      .messages.filter(item => item.kind === 'assistant')
      .at(-1),
  ).toMatchObject({ unverified: 0 });
  expect(
    state()
      .messages.filter(item => item.kind === 'assistant')
      .at(-1)?.allowed_refs,
  ).toContain(ref);
  await session.act('reviewAgain');
  expect(
    (await c.repos.notes.stuck.list('aima')).find(x => x.id === stuck.id)
      ?.resolved_at,
  ).toBeNull();
  await session.act('reviewOk');
  expect(
    (await c.repos.notes.stuck.list('aima')).find(x => x.id === stuck.id)
      ?.resolved_at,
  ).toBeTruthy();
  expect(state().detours).toEqual([]);
  expect(state().main).toEqual(pointer);
});
it('opens a review-card question in its own section with source while preserving the main pointer', async () => {
  const ai = scripted([text('这张卡来自所选小节。')]);
  await setup(ai);
  const pointer = state().main;
  const source = await c.repos.blocks.bySection('aima', '3.4.2');
  await session.open({
    sectionId: '3.4.2',
    question: '关于这张卡：一致代价搜索是什么？',
  });
  expect(state().main).toEqual(pointer);
  expect(state().detours.at(-1)?.sectionId).toBe('3.4.2');
  const request = jest.mocked(ai.stream).mock.calls[0][1];
  expect(JSON.stringify(request.history)).toContain(source[0].text);
  expect(
    (await c.repos.notes.qa.list('aima', '3.4.2')).at(-1)?.from_section,
  ).toBe('3.5.2');
});
it('retries a failed context summary without appending the same question again', async () => {
  let failed = false;
  const ai = {
    ...demo,
    complete: jest.fn(async (...args: Parameters<AiGateway['complete']>) => {
      if (args[1].system.includes('name="compact"') && !failed) {
        failed = true;
        throw new AiError('network', 'offline');
      }
      return demo.complete(...args);
    }),
  };
  await setup(ai);
  await c.repos.messages.append({
    book_id: 'aima',
    section_id: '3.5.2',
    part_no: 0,
    step_no: 1,
    kind: 'assistant',
    content: '旧'.repeat(26000),
    created_at: c.clock.now().toISOString(),
  });
  await session.dispose();
  session = new StudySession(c, 'aima');
  await session.open({ autoStart: false });
  await session.send('需要重试的问题');
  expect(state().error).toBeTruthy();
  await session.retry();
  expect(state().error).toBeNull();
  expect(
    state().messages.filter(message => message.content === '需要重试的问题'),
  ).toHaveLength(1);
});
