import ReactTestRenderer from 'react-test-renderer';
import { AccessibilityInfo } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { createTestDemoContainer } from '@app/testing';
import type { Container } from '@app/container';
import { ContainerProvider } from '@app/ContainerProvider';
import { disposeContainerSessions, getStudySession } from '@app/study/registry';
import { AppNavProvider, type AppNav } from '@features/nav';
import {
  quickActions,
  presentThread,
  presentOriginalPages,
} from '@features/study/presenters';
import { createReaderRuntime, setReaderRuntime } from '@app/readerRuntime';
import { loadStudyReader } from '@app/usecases/studyReader';
import { FlatList } from 'react-native';
import { PageOrig } from '@ui/kit';
import {
  useStudyVM,
  useReaderVM,
  useSectionDoneVM,
} from '@features/study/useStudyVM';
import {
  studySamples,
  readerSamples,
  sectionDoneSamples,
} from '@features/study/samples';
import type { StudyIntents, SectionDoneIntents } from '@features/study/types';
import { StudyView } from '@ui/screens/StudyView';
import { ReaderView } from '@ui/screens/ReaderView';
import { SectionDoneView } from '@ui/screens/SectionDoneView';
import { SkinProvider } from '@ui/kit';
import { StudyScreen } from '@features/study/StudyScreens';
jest.mock('@react-navigation/native', () => ({
  useIsFocused: jest.fn(() => true),
}));
let c: Container, renderer: ReactTestRenderer.ReactTestRenderer | undefined;
const nav: AppNav = {
  open: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  enterDemo: jest.fn(),
  exitDemo: jest.fn(),
};
beforeAll(() => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(false);
  jest
    .spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled')
    .mockResolvedValue(false);
});
beforeEach(async () => {
  c = await createTestDemoContainer();
  jest.clearAllMocks();
  jest.mocked(useIsFocused).mockReturnValue(true);
});
afterEach(async () => {
  if (renderer) await ReactTestRenderer.act(async () => renderer!.unmount());
  renderer = undefined;
  await disposeContainerSessions(c);
  await c.close();
});
async function mount<T>(hook: () => T) {
  let vm!: T;
  function Probe() {
    vm = hook();
    return null;
  }
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <ContainerProvider value={c}>
        <AppNavProvider value={nav}>
          <Probe />
        </AppNavProvider>
      </ContainerProvider>,
    );
  });
  return () => vm;
}
async function act(action: () => void | Promise<void>) {
  await ReactTestRenderer.act(async () => {
    await action();
  });
}
it('opens the Win11 add menu, uses an existing stuck point, and switches to source reading', async () => {
  const vm = await mount(() => useStudyVM('aima', { autoStart: false }));
  await act(() => vm().intents.openAdd!());
  expect(vm().state.overlay).toMatchObject({
    kind: 'menu',
    title: '添加到问题',
  });
  await act(() => vm().intents.menuSelect('addStuck'));
  expect(vm().state.listen.composer.value).toContain('结合我的卡点');
  await act(() => vm().intents.openAdd!());
  await act(() => vm().intents.menuSelect('addRead'));
  expect(vm().state.mode).toBe('read');
  expect(vm().state.toast).toBe('点一段原文，选「问 AI」');
});
it('calculates exact quick actions at last step, quiz, ready, detour and resume', async () => {
  const session = getStudySession(c, 'aima');
  await session.open({ autoStart: false });
  const raw = session.store.getState();
  const steps = [
    {
      no: 1,
      title: '直觉',
      kind: 'intuition' as const,
      block_from: 1,
      block_to: 1,
      status: 'current' as const,
    },
    {
      no: 2,
      title: '定义',
      kind: 'definition' as const,
      block_from: 2,
      block_to: 2,
      status: 'todo' as const,
    },
  ];
  const base = {
    ...raw,
    phase: 'teaching' as const,
    messages: [],
    plan: {
      book_id: 'aima',
      section_id: raw.main.sectionId,
      part_no: 0,
      steps,
      source: 'fallback' as const,
      created_at: c.clock.now().toISOString(),
    },
    main: { ...raw.main, part: 0, step: 0 },
    blocks: [],
  };
  expect(quickActions(base).map(a => a.key)).toEqual([
    'next',
    'alt',
    'example',
    'skip',
    'quiz',
    'source',
  ]);
  expect(
    quickActions({
      ...base,
      main: { ...base.main, step: 1 },
      parts: [raw.parts[0]],
    }).map(a => a.key),
  ).toEqual(['next', 'alt', 'example', 'derive', 'quiz', 'source']);
  expect(
    quickActions({
      ...base,
      main: { ...base.main, step: 1 },
      parts: [raw.parts[0], raw.parts[0]],
    })[0].key,
  ).toBe('nextPart');
  expect(quickActions({ ...base, phase: 'quiz' }).map(a => a.key)).toEqual([
    'alt',
    'example',
    'source',
  ]);
  expect(quickActions({ ...base, phase: 'ready' }).map(a => a.key)).toEqual([
    'nextSection',
    'reteachSection',
    'source',
  ]);
  expect(
    quickActions({
      ...base,
      detours: [{ sectionId: '3.4.2', detourId: 1 }],
    }).map(a => a.key),
  ).toEqual(['backMain', 'detourSource']);
  expect(
    quickActions({
      ...base,
      detours: [{ sectionId: '3.4.2', detourId: 1, reviewStuckId: 1 }],
    }).map(a => a.key),
  ).toEqual(['reviewOk', 'reviewAgain']);
});
it('keeps busy chips, blocks their actions and permits switching to read', async () => {
  const vm = await mount(() => useStudyVM('aima', { autoStart: false }));
  const session = getStudySession(c, 'aima');
  await act(() => {
    session.store.setState({ busy: true });
  });
  await act(() => vm().intents.quick('next'));
  expect(vm().state.toast).toBe('正在回答…');
  await act(() => vm().intents.setMode('read'));
  expect(vm().state.mode).toBe('read');
  await act(() => {
    session.store.setState({ busy: false });
  });
});
it('reader excludes titles from selection and preserves main when asking about a block', async () => {
  const session = getStudySession(c, 'aima');
  await session.open({ autoStart: false });
  const initial = { ...session.store.getState().main };
  const vm = await mount(() => useReaderVM('aima', '3.4.2'));
  const title = vm().state.read.items.find(
    item => item.kind === 'block' && item.type === 'title',
  );
  const block = vm().state.read.items.find(
    item => item.kind === 'block' && item.type === 'text',
  );
  expect(block?.kind).toBe('block');
  if (title?.kind === 'block') {
    await act(() =>
      vm().intents.pressBlock(title.ref, { x: 10, y: 50, w: 200, h: 40 }),
    );
    expect(vm().state.read.selection).toBeNull();
  }
  if (block?.kind !== 'block') throw new Error('missing source block');
  await act(() =>
    vm().intents.pressBlock(block.ref, { x: 10, y: 50, w: 200, h: 40 }),
  );
  expect(vm().state.read.selection?.items.map(i => i.key)).toEqual([
    'explain',
    'translate',
    'ask',
    'startHere',
    'highlight',
    'note',
  ]);
  await act(() => vm().intents.menuAction('ask'));
  expect(session.store.getState().pendingQuote).toBe(block.seq);
  expect(session.store.getState().main).toEqual(initial);
  expect(nav.replace).toHaveBeenCalledWith({ name: 'Study', bookId: 'aima' });
});
it.each([false, true])(
  'opens a full-text result in its own section and at its block without moving the main lesson (warm session: %s)',
  async warm => {
    const previous = (await c.repos.study.get('aima'))!;
    const section = (await c.repos.sections.get('aima', '3.4.2'))!;
    const target = (await c.repos.blocks.bySection('aima', section.id)).find(
      block => block.type === 'text',
    )!;
    expect(section.id).not.toBe(previous.main_section);
    const session = getStudySession(c, 'aima');
    if (warm) {
      const other = (await c.repos.sections.leaves('aima')).find(
        leaf =>
          leaf.id !== section.id &&
          leaf.id !== previous.main_section &&
          leaf.block_from !== null,
      )!;
      await session.open({
        mode: 'read',
        sectionId: other.id,
        preserveMain: true,
        autoStart: false,
      });
      expect(session.store.getState().readerSectionId).toBe(other.id);
    }
    const vm = await mount(() =>
      useReaderVM('aima', undefined, `b${target.seq}`),
    );
    expect(vm().state.header.title).toBe(
      [section.no, section.title].filter(Boolean).join(' '),
    );
    expect(vm().state.header.subtitle).toMatch(/^p\.[^·]+$/);
    expect(vm().state.read.loading).toBe(false);
    const blocks = vm().state.read.items.filter(item => item.kind === 'block');
    expect(blocks.map(block => block.seq)).toEqual(
      (await c.repos.blocks.bySection('aima', section.id)).map(
        block => block.seq,
      ),
    );
    expect(vm().state.read.scrollTo).toMatchObject({
      ref: `b${target.seq}`,
      flash: true,
    });
    expect(blocks.find(block => block.seq === target.seq)?.marks).toContain(
      'flash',
    );
    expect(session.store.getState().readerSectionId).toBe(section.id);
    expect(session.store.getState().readAnchor).toBe(target.seq);
    expect(session.store.getState().main).toEqual({
      sectionId: previous.main_section,
      part: previous.main_part,
      step: previous.main_step,
    });
    const saved = (await c.repos.study.get('aima'))!;
    expect([saved.main_section, saved.main_part, saved.main_step]).toEqual([
      previous.main_section,
      previous.main_part,
      previous.main_step,
    ]);
  },
);
it('reader explanation stays outside thread, saves a pin, and block note persists', async () => {
  const vm = await mount(() => useReaderVM('aima', '3.5.2'));
  const session = getStudySession(c, 'aima'),
    count = session.store.getState().messages.length;
  const item = vm().state.read.items.find(
    i => i.kind === 'block' && i.type === 'text',
  );
  if (item?.kind !== 'block') throw new Error('missing text');
  await act(() =>
    vm().intents.pressBlock(item.ref, { x: 0, y: 0, w: 200, h: 50 }),
  );
  await act(() => vm().intents.menuAction('explain'));
  expect(vm().state.overlay?.kind).toBe('explain');
  expect(session.store.getState().messages).toHaveLength(count);
  const explanation = vm().state.overlay;
  expect(explanation?.kind === 'explain' && explanation.answer).toBeTruthy();
  await act(() => vm().intents.overlayAction('ok'));
  expect(
    (await c.repos.notes.pins.list('aima', '3.5.2')).some(
      p => p.block_seq === item.seq,
    ),
  ).toBe(true);
  await act(() =>
    vm().intents.pressBlock(item.ref, { x: 0, y: 0, w: 200, h: 50 }),
  );
  await act(() => vm().intents.menuAction('note'));
  await act(() => vm().intents.setNoteText('我自己的理解'));
  await act(() => vm().intents.overlayAction('save'));
  expect(
    (await c.repos.notes.highlights.list('aima')).find(
      h => h.block_seq === item.seq,
    )?.note,
  ).toBe('我自己的理解');
});
it('opening citations displays actual blocks and moves to read with flash', async () => {
  const vm = await mount(() => useStudyVM('aima', { autoStart: false }));
  const session = getStudySession(c, 'aima'),
    seq = session.store.getState().blocks.find(b => b.type === 'text')!.seq;
  await act(() => vm().intents.pressCite(seq));
  expect(vm().state.overlay?.kind).toBe('peek');
  await act(() => vm().intents.overlayAction('openInReader'));
  expect(vm().state.mode).toBe('read');
  expect(vm().state.read.scrollTo?.ref).toBe(`b${seq}`);
});
it('theme changes preserve composer, overlay and the same session', async () => {
  let vm!: ReturnType<typeof useStudyVM>;
  function Probe() {
    vm = useStudyVM('aima', { autoStart: false });
    return <StudyView {...vm} />;
  }
  const tree = (skin: 'paper' | 'glass') => (
    <ContainerProvider value={c}>
      <AppNavProvider value={nav}>
        <SkinProvider skinId={skin} scheme="light" reduceMotion>
          <Probe />
        </SkinProvider>
      </AppNavProvider>
    </ContainerProvider>
  );
  await act(() => {
    renderer = ReactTestRenderer.create(tree('paper'));
  });
  await act(() => vm.intents.setText('关于 f 的问题'));
  await act(() => vm.intents.openContext());
  const session = getStudySession(c, 'aima'),
    count = session.store.getState().messages.length;
  const source = session.store
    .getState()
    .blocks.find(block => block.type === 'text')!;
  await act(() => session.setQuote(source.seq));
  const quote = vm.state.listen.composer.quote!;
  expect(quote.excerpt).toBe(source.text);
  expect(quote.page).toMatch(/^p\./);
  expect(quote.label).toBe(`引用 ${quote.page} · ${source.text.slice(0, 70)}`);
  await act(() => renderer!.update(tree('glass')));
  expect(vm.state.listen.composer.value).toBe('关于 f 的问题');
  expect(vm.state.overlay?.kind).toBe('context');
  expect(vm.state.listen.composer.quote).toEqual(quote);
  expect(getStudySession(c, 'aima')).toBe(session);
  expect(session.store.getState().messages).toHaveLength(count);
});
it('removes hidden study blur without reopening the session or losing the draft', async () => {
  const tree = () => (
    <ContainerProvider value={c}>
      <AppNavProvider value={nav}>
        <SkinProvider skinId="glass" scheme="light" reduceMotion>
          <StudyScreen bookId="aima" autoStart={false} />
        </SkinProvider>
      </AppNavProvider>
    </ContainerProvider>
  );
  const session = getStudySession(c, 'aima');
  const open = jest.spyOn(session, 'open');
  await act(() => {
    renderer = ReactTestRenderer.create(tree());
  });
  const vm = () =>
    renderer!.root.findByType(StudyView).props as ReturnType<typeof useStudyVM>;
  await act(() => vm().intents.setText('保留这条未发送的问题'));
  const main = session.store.getState().main;
  expect(
    renderer!.root.findAllByProps({ testID: 'glass-blur' }).length,
  ).toBeGreaterThan(0);
  jest.mocked(useIsFocused).mockReturnValue(false);
  await act(() => renderer!.update(tree()));
  expect(renderer!.root.findAllByProps({ testID: 'glass-blur' })).toHaveLength(
    0,
  );
  expect(vm().state.listen.composer.value).toBe('保留这条未发送的问题');
  jest.mocked(useIsFocused).mockReturnValue(true);
  await act(() => renderer!.update(tree()));
  expect(
    renderer!.root.findAllByProps({ testID: 'glass-blur' }).length,
  ).toBeGreaterThan(0);
  expect(vm().state.listen.composer.value).toBe('保留这条未发送的问题');
  expect(session.store.getState().main).toEqual(main);
  expect(open).toHaveBeenCalledTimes(1);
});
it('section draft edits and checked choices save once and advance to the next leaf', async () => {
  const session = getStudySession(c, 'aima');
  await session.open({ autoStart: false });
  const draft = await session.finishDraft();
  expect(draft).toBeTruthy();
  const vm = await mount(() =>
    useSectionDoneVM('aima', draft!.sectionId, draft!.id),
  );
  await act(() => vm().intents.setSummary('我改过的摘要'));
  const card = vm().state.cards[0];
  expect(card).toBeTruthy();
  await act(() => vm().intents.openEditCard(card.id));
  await act(() => vm().intents.setEditFront('我的问题'));
  await act(() => vm().intents.saveEditCard());
  expect(vm().state.cards[0].front).toBe('我的问题');
  await act(() => vm().intents.save());
  expect((await c.repos.sections.get('aima', draft!.sectionId))?.summary).toBe(
    '我改过的摘要',
  );
  expect(nav.replace).toHaveBeenCalledWith({
    name: 'Study',
    bookId: 'aima',
    sectionId: draft!.nextSection!.id,
  });
});
it('keeps structural and pending cards visible even though cards are outside model context', async () => {
  const session = getStudySession(c, 'aima');
  await session.open({ autoStart: false });
  const raw = session.store.getState(),
    sample = raw.messages[0];
  const messages = [
    {
      ...sample,
      id: 901,
      kind: 'card' as const,
      in_context: false,
      content: JSON.stringify({
        kind: 'stepHeader',
        step: 2,
        label: '第2步',
        title: '定义',
        pages: 'p.103',
      }),
    },
    {
      ...sample,
      id: 902,
      kind: 'card' as const,
      in_context: false,
      content: JSON.stringify({
        kind: 'quiz',
        question: '测试',
        options: ['A', 'B'],
        answer: 0,
        explain: '说明',
        final: false,
        picked: null,
      }),
    },
    {
      ...sample,
      id: 903,
      kind: 'card' as const,
      in_context: false,
      content: JSON.stringify({
        kind: 'done',
        title: '本节讲完了',
        text: '可以保存',
      }),
    },
  ];
  expect(
    presentThread(
      { ...raw, messages },
      new Map(raw.blocks.map(b => [b.seq, b])),
      new Set(),
    ).map(item => item.kind),
  ).toEqual(['stepHeader', 'quiz', 'done']);
});
it('failed draft generation remains editable, and failed transaction keeps the draft on screen', async () => {
  const session = getStudySession(c, 'aima');
  await session.open({ autoStart: false });
  jest
    .spyOn(c.ai, 'complete')
    .mockRejectedValueOnce(new Error('整理模型暂时不可用'));
  const draft = await session.finishDraft();
  expect(draft?.error).toBeTruthy();
  const vm = await mount(() =>
    useSectionDoneVM('aima', draft!.sectionId, draft!.id),
  );
  await act(() => vm().intents.setSummary('手写的摘要'));
  const transaction = jest
    .spyOn(c.db, 'transaction')
    .mockRejectedValueOnce(new Error('磁盘写入失败'));
  await act(() => vm().intents.save());
  expect(vm().state.error).toBeTruthy();
  expect(vm().state.summary.value).toBe('手写的摘要');
  expect(nav.replace).not.toHaveBeenCalled();
  transaction.mockRestore();
  await act(() => vm().intents.save());
  expect(nav.replace).toHaveBeenCalled();
});
it('historical unknown citations never become page capsules', async () => {
  const session = getStudySession(c, 'aima');
  await session.open({ autoStart: false });
  const raw = session.store.getState();
  const sample = raw.messages.find(m => m.kind === 'assistant')!;
  const thread = presentThread(
    {
      ...raw,
      messages: [
        {
          ...sample,
          id: 999,
          kind: 'assistant',
          in_context: true,
          content: '一句未有来源的解释。[[b:99999]]',
          allowed_refs: [],
        },
      ],
    },
    new Map(raw.blocks.map(b => [b.seq, b])),
    new Set(),
  );
  expect(JSON.stringify(thread)).toContain('unverified');
  expect(JSON.stringify(thread)).not.toContain('p.99999');
});
const noop = () => {};
const intents: StudyIntents = {
  back: noop,
  setMode: noop,
  openMenu: noop,
  menuSelect: noop,
  quick: noop,
  setText: noop,
  send: noop,
  stop: noop,
  clearQuote: noop,
  pressStep: noop,
  openRoadmap: noop,
  openContext: noop,
  pressCite: noop,
  pressFigure: noop,
  pressTable: noop,
  toggleFold: noop,
  toggleHistory: noop,
  answerQuiz: noop,
  resolveProposal: noop,
  resumeAction: noop,
  retry: noop,
  setView: noop,
  toggleGuide: noop,
  pressBlock: noop,
  menuAction: noop,
  reportAnchor: noop,
  pressPin: noop,
  finishReading: noop,
  overlayAction: noop,
  setNoteText: noop,
  closeOverlay: noop,
};
const doneIntents: SectionDoneIntents = {
  back: noop,
  setSummary: noop,
  toggleStuck: noop,
  toggleCard: noop,
  openEditCard: noop,
  setEditFront: noop,
  setEditBack: noop,
  closeEditCard: noop,
  saveEditCard: noop,
  editCard: noop,
  retry: noop,
  save: noop,
};
it.each(['paper', 'glass'] as const)(
  'renders normal, empty, loading, error, and long pages in %s',
  async skin => {
    const views = [
      ...Object.values(studySamples).map(state => (
        <StudyView state={state} intents={intents} />
      )),
      ...Object.values(readerSamples).map(state => (
        <ReaderView state={state} intents={intents} />
      )),
      ...Object.values(sectionDoneSamples).map(state => (
        <SectionDoneView state={state} intents={doneIntents} />
      )),
    ];
    for (const view of views) {
      await act(() => {
        renderer = ReactTestRenderer.create(
          <SkinProvider skinId={skin} scheme="light" reduceMotion>
            {view}
          </SkinProvider>,
        );
      });
      expect(renderer!.toJSON()).toBeTruthy();
      await act(() => renderer!.unmount());
      renderer = undefined;
    }
  },
);

it('renders imported PDF pages through app IO with simultaneous marks and keeps anchors across orig/flow changes', async () => {
  c.mode = 'test';
  const render = jest.fn(
    async (_path: string, page: number, width: number) => ({
      uri: `file:///cache/p${page}.png`,
      w: width,
      h: width * 1.4,
    }),
  );
  setReaderRuntime(
    c,
    createReaderRuntime({
      sourcePath: async id => `/books/${id}/source.pdf`,
      info: async () => ({
        pageCount: 1136,
        sizes: Array.from({ length: 1136 }, () => ({ w: 600, h: 840 })),
      }),
      render,
      close: async () => {},
    }),
  );
  const vm = await mount(() =>
    useStudyVM('aima', { mode: 'read', autoStart: false }),
  );
  expect(vm().state.read.original?.available).toBe(true);
  const raw = getStudySession(c, 'aima').store.getState();
  const blocks = vm().state.read.items.filter(item => item.kind === 'block');
  const anchor = blocks.find(item => item.type === 'text')!;
  await act(() => vm().intents.reportAnchor(anchor.ref));
  await act(() => vm().intents.setView('orig'));
  expect(vm().state.read.view).toBe('orig');
  expect(vm().state.read.scrollTo?.ref).toBe(anchor.ref);
  const first = vm().state.read.original!.pages[0];
  await act(() => vm().intents.requestPage!(first.page, 2000));
  expect(render.mock.calls[0][2]).toBe(1440);
  expect(vm().state.read.original!.pages[0].image?.uri).toContain('.png');
  expect(
    vm().state.read.original!.pages.filter(p => p.image).length,
  ).toBeLessThanOrEqual(5);
  await act(() => vm().intents.setView('flow'));
  expect(vm().state.read.scrollTo?.ref).toBe(anchor.ref);
  expect((await c.repos.study.get('aima'))?.read_anchor).toBe(anchor.seq);
  const data = await loadStudyReader(c, 'aima', raw.main.sectionId);
  const pageBlocks = presentOriginalPages(
    data.originalBlocks.map(b =>
      b.seq === anchor.seq ? { ...b, x0: 0.1, y0: 0.2, x1: 0.9, y1: 0.3 } : b,
    ),
    data.book,
    data.section,
    raw,
    new Set([anchor.seq]),
    new Map([[anchor.seq, { id: 'p1', label: '一个便签' }]]),
    new Map(),
    [],
    anchor.seq,
    anchor.seq,
  ).flatMap(p => p.blocks);
  expect(pageBlocks.find(b => b.ref === anchor.seq)).toMatchObject({
    marks: expect.arrayContaining(['highlight', 'selected', 'flash']),
    pin: true,
    pinId: 'p1',
  });
});

it('renders native page cards and routes PDF marks/pins to the existing block menu and notes', async () => {
  const pressed = jest.fn(),
    pinned = jest.fn(),
    requestPage = jest.fn(),
    reportAnchor = jest.fn();
  const read = {
    ...readerSamples.normal.read,
    view: 'orig' as const,
    original: {
      available: true,
      loading: false,
      pages: [
        {
          page: 103,
          label: 'p.103',
          size: { w: 600, h: 800 },
          image: { uri: 'file:///cache/103.png', w: 600, h: 800 },
          blocks: [
            {
              ref: 3,
              x0: 0.1,
              y0: 0.2,
              x1: 0.9,
              y1: 0.3,
              marks: ['now' as const, 'highlight' as const],
              pin: true,
              pinId: 'pin-1',
            },
          ],
        },
      ],
    },
  };
  await act(() => {
    renderer = ReactTestRenderer.create(
      <SkinProvider skinId="paper" scheme="light" reduceMotion>
        <ReaderView
          state={{ ...readerSamples.normal, read }}
          intents={{
            ...intents,
            requestPage,
            reportAnchor,
            pressBlock: pressed,
            pressPin: pinned,
          }}
        />
      </SkinProvider>,
    );
  });
  expect(requestPage).toHaveBeenCalled();
  const page = renderer!.root.findByType(PageOrig);
  await act(() => page.props.onBlock(3, { x: 10, y: 20, w: 200, h: 40 }));
  expect(pressed).toHaveBeenCalledWith('b3', { x: 10, y: 20, w: 200, h: 40 });
  await act(() => page.props.onPin(3));
  expect(pinned).toHaveBeenCalledWith('pin-1');
  const list = renderer!.root.findByType(FlatList);
  await act(() =>
    list.props.onScroll({
      nativeEvent: {
        contentOffset: { y: 0 },
        layoutMeasurement: { height: 350 },
      },
    }),
  );
  expect(reportAnchor).toHaveBeenCalledWith('b3');
});

it('keeps Demo and EPUB original mode guidance explicit', async () => {
  const vm = await mount(() => useStudyVM('aima', { autoStart: false }));
  expect(vm().state.read.original?.available).toBe(false);
  await act(() => vm().intents.setView('orig'));
  expect(vm().state.toast).toContain('Demo');
  expect(vm().state.read.view).toBe('flow');
});
