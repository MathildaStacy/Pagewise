import TestRenderer, { act } from 'react-test-renderer';
import { AccessibilityInfo, TextInput } from 'react-native';
import type { Container } from '@app/container';
import { createTestDemoContainer } from '@app/testing';
import { useContainer } from '@app/ContainerProvider';
import { useAppNav } from '@features/nav';
import * as searches from '@app/usecases/noteSearch';
import { useNoteSearch } from '@features/notes/useNoteSearch';
import { useNoteDetailVM, useNotesVM } from '@features/notes/useNotesVM';
import { noteDetailSamples, notesSamples } from '@features/notes/samples';
import { NotesView } from '@ui/screens/NotesView';
import { NoteDetailView } from '@ui/screens/NoteDetailView';
import { SkinProvider } from '@ui/kit';

jest.mock('@app/ContainerProvider', () => ({ useContainer: jest.fn() }));
jest.mock('@features/nav', () => ({ useAppNav: jest.fn() }));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => {
    const React = require('react');
    React.useEffect(callback, [callback]);
  },
}));
let c: Container, renderer: TestRenderer.ReactTestRenderer | undefined;
const nav = {
  open: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  enterDemo: jest.fn(),
  exitDemo: jest.fn(),
};
beforeEach(async () => {
  c = await createTestDemoContainer();
  jest.mocked(useContainer).mockReturnValue(c);
  jest.mocked(useAppNav).mockReturnValue(nav);
  jest.clearAllMocks();
});
afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = undefined;
  jest.useRealTimers();
  jest.restoreAllMocks();
  await c.close();
});
async function mount<T>(hook: () => T) {
  let vm!: T;
  function Probe() {
    vm = hook();
    return null;
  }
  await act(async () => {
    renderer = TestRenderer.create(<Probe />);
    await new Promise(resolve => setImmediate(resolve));
  });
  return () => vm;
}
function result(text: string): searches.NoteSearchData {
  return {
    hasMore: false,
    hits: [
      {
        book_id: 'aima',
        book_title: '人工智能',
        section_id: '3.5.2',
        section_no: '3.5.2',
        section_title: 'A*搜索',
        kind: 'qa',
        item_id: 1,
        excerpt: text,
      },
    ],
  };
}

it('debounces searches and ignores an older result after the query changes or clears', async () => {
  const pending: ((value: searches.NoteSearchData) => void)[] = [];
  const search = jest
    .spyOn(searches, 'searchNotes')
    .mockImplementation(() => new Promise(resolve => pending.push(resolve)));
  const current = await mount(() => useNoteSearch(c));
  jest.useFakeTimers();
  await act(async () => {
    current().setQuery('旧问题');
  });
  await act(async () => {
    jest.advanceTimersByTime(299);
  });
  expect(search).not.toHaveBeenCalled();
  await act(async () => {
    jest.advanceTimersByTime(1);
  });
  expect(search).toHaveBeenCalledTimes(1);
  await act(async () => {
    current().setQuery('新问题');
  });
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  await act(async () => {
    pending[1](result('最新命中'));
  });
  expect(current().state.results[0].excerpt).toBe('最新命中');
  await act(async () => {
    pending[0](result('过时命中'));
  });
  expect(current().state.results[0].excerpt).toBe('最新命中');
  await act(async () => {
    current().setQuery('待取消');
  });
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  await act(async () => {
    current().setQuery('');
    pending[2](result('不应显示'));
  });
  expect(current().state).toMatchObject({
    query: '',
    busy: false,
    results: [],
  });
});

it('opens the matching book and section without changing the notes overview', async () => {
  jest
    .spyOn(searches, 'searchNotes')
    .mockResolvedValue(result('A* 的学习记录'));
  const current = await mount(useNotesVM);
  const overview = current().state.books;
  jest.useFakeTimers();
  await act(async () => {
    current().intents.setSearchQuery!('A*');
  });
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  expect(current().state.books).toBe(overview);
  const hit = current().state.search!.results.find(
    item => item.sectionId === '3.5.2',
  )!;
  expect(hit).toBeDefined();
  current().intents.openSearchResult!(hit.id);
  expect(nav.open).toHaveBeenLastCalledWith({
    name: 'NoteDetail',
    bookId: 'aima',
    sectionId: '3.5.2',
  });
});

it('keeps QA links, opens full rich conversation and follows citations to their exact source', async () => {
  const block = (await c.repos.blocks.bySection('aima', '3.5.2'))[0];
  const user = await c.repos.messages.append({
    book_id: 'aima',
    section_id: '3.5.2',
    kind: 'user',
    content: '解释一下这个公式',
    created_at: c.clock.now().toISOString(),
  });
  const answer = await c.repos.messages.append({
    book_id: 'aima',
    section_id: '3.5.2',
    kind: 'assistant',
    content: `$$f(n)=g(n)+h(n)$$\n\n完整解释 [[b:${block.seq}]]`,
    allowed_refs: [block.seq],
    created_at: c.clock.now().toISOString(),
  });
  const qa = await c.repos.notes.qa.add({
    book_id: 'aima',
    section_id: '3.5.2',
    q: '公式里的两项',
    a: '短结论',
    message_ids: [user.id, answer.id],
    created_at: c.clock.now().toISOString(),
  });
  const current = await mount(() => useNoteDetailVM('aima', '3.5.2'));
  expect(
    current().state.qa.find(item => item.id === String(qa.id))?.messageIds,
  ).toEqual([user.id, answer.id]);
  await act(async () => {
    current().intents.openConversation!(String(qa.id));
    await new Promise(resolve => setImmediate(resolve));
  });
  const conversation = current().state.conversation!;
  expect(conversation.loading).toBe(false);
  expect(conversation.messages).toHaveLength(2);
  expect(conversation.messages[1].doc).toContainEqual({
    t: 'math',
    tex: 'f(n)=g(n)+h(n)',
  });
  expect(JSON.stringify(conversation.messages[1].doc)).toContain(
    '"verified":true',
  );
  await act(async () => {
    current().intents.openConversationSource!(block.seq);
  });
  expect(nav.open).toHaveBeenLastCalledWith({
    name: 'Reader',
    bookId: 'aima',
    sectionId: block.section_id,
    blockRef: `b${block.seq}`,
  });
  expect(current().state.conversation).toBeNull();
});

it.each(['paper', 'glass'] as const)(
  'renders search and conversation affordances with %s tokens',
  async skin => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(true);
    jest
      .spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled')
      .mockResolvedValue(true);
    const setSearchQuery = jest.fn(),
      openSearchResult = jest.fn(),
      openConversation = jest.fn();
    await act(async () => {
      renderer = TestRenderer.create(
        <SkinProvider skinId={skin} scheme="light" reduceMotion>
          <NotesView
            state={{
              ...notesSamples.normal,
              search: {
                query: '启发',
                busy: false,
                hasMore: false,
                results: [
                  {
                    id: 'hit',
                    bookId: 'aima',
                    sectionId: '3.5.2',
                    kind: '问答',
                    where: '人工智能 · 3.5.2 A*',
                    excerpt: '启发函数为什么不能高估？',
                  },
                ],
              },
            }}
            intents={{
              openBook: jest.fn(),
              retry: jest.fn(),
              setSearchQuery,
              openSearchResult,
            }}
          />
        </SkinProvider>,
      );
    });
    renderer!.root.findByType(TextInput).props.onChangeText('一致性');
    expect(setSearchQuery).toHaveBeenCalledWith('一致性');
    const hit = renderer!.root.findAll(
      node =>
        node.props.accessibilityRole === 'button' &&
        node.props.accessibilityLabel ===
          '问答，人工智能 · 3.5.2 A*，启发函数为什么不能高估？',
    )[0];
    hit.props.onPress();
    expect(openSearchResult).toHaveBeenCalledWith('hit');
    await act(async () => renderer!.unmount());
    await act(async () => {
      renderer = TestRenderer.create(
        <SkinProvider skinId={skin} scheme="dark" reduceMotion>
          <NoteDetailView
            state={{
              ...noteDetailSamples.normal,
              qa: [{ id: 'qa', q: '为什么？', a: '摘要', messageIds: [1, 2] }],
              conversation: {
                title: '为什么？',
                loading: false,
                messages: [
                  {
                    id: '2',
                    role: 'assistant',
                    detour: false,
                    doc: [{ t: 'math', tex: 'f(n)=g(n)+h(n)' }],
                  },
                ],
              },
            }}
            intents={{
              back: jest.fn(),
              openSource: jest.fn(),
              openHighlight: jest.fn(),
              setUserText: jest.fn(),
              retry: jest.fn(),
              openConversation,
            }}
          />
        </SkinProvider>,
      );
    });
    const button = renderer!.root.findAll(
      node =>
        node.props.children === '完整问答' &&
        typeof node.props.onPress === 'function',
    )[0];
    button.props.onPress();
    expect(openConversation).toHaveBeenCalledWith('qa');
    expect(renderer!.toJSON()).toBeTruthy();
  },
);
