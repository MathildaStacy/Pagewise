import ReactTestRenderer from 'react-test-renderer';
import { createTestDemoContainer } from '@app/testing';
import type { Container } from '@app/container';
import { ContainerProvider } from '@app/ContainerProvider';
import { getStudySession } from '@app/study/registry';
import { StudySession } from '@app/study/StudySession';
import { finishSection } from '@app/study/finishSection';
import { startSection } from '@app/usecases/library';
import { patchPrefs } from '@app/usecases/settings';
import { searchShelf } from '@app/usecases/home';
import { loadNoteDetail, loadNotes, saveUserNote } from '@app/usecases/notes';
import {
  saveStudyBlockNote,
  toggleStudyHighlight,
} from '@app/usecases/studyReader';
import { presentNoteDetail } from '@features/notes/presenters';
import { AppNavProvider, type AppNav } from '@features/nav';
import { useStudyVM } from '@features/study/useStudyVM';

jest.mock('@react-navigation/native', () => ({
  useIsFocused: jest.fn(() => true),
  useFocusEffect: (effect: () => void) =>
    require('react').useEffect(effect, [effect]),
}));

let c: Container;
let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
beforeEach(async () => {
  c = await createTestDemoContainer();
});
afterEach(async () => {
  if (renderer) await ReactTestRenderer.act(async () => renderer!.unmount());
  renderer = undefined;
  jest.useRealTimers();
  await c.close();
});

it('relearning a completed section should preserve its completed status', async () => {
  await c.repos.sections.update('aima', '3.4.2', { status: 'done' });
  await startSection(c, 'aima', '3.4.2');
  expect((await c.repos.sections.get('aima', '3.4.2'))?.status).toBe('done');
});

it('finishing an earlier section should not demote a completed following section', async () => {
  const next = (await c.repos.sections.nextLeaf('aima', '3.4.2'))!;
  await c.repos.sections.update('aima', next.id, { status: 'done' });
  await finishSection(c, {
    bookId: 'aima',
    sectionId: '3.4.2',
    summary: '复习小结',
    stuck: [],
    cards: [],
  });
  expect((await c.repos.sections.get('aima', next.id))?.status).toBe('done');
});

it('search should find an English phrase with spaces', async () => {
  await c.repos.blocks.insertMany('aima', [
    {
      seq: 99999,
      type: 'text',
      text: 'Uniform cost search expands the least cost node.',
      chars: 47,
    },
  ]);
  expect(await c.repos.blocks.search('aima', 'Uniform')).toHaveLength(1);
  expect(await c.repos.blocks.search('aima', 'Uniform cost')).toHaveLength(1);
});

it('cross-book sources should use the same printed page labels as the reader', async () => {
  await c.repos.books.update('aima', { page_offset: 20 });
  await c.repos.blocks.insertMany('aima', [
    { seq: 99998, type: 'text', text: 'OffsetProbe', chars: 11, page: 120 },
  ]);
  const hits = await searchShelf(c, 'OffsetProbe', 'aima');
  expect(hits[0].page).toBe('p.100');
});

it('a transient note write failure should not permanently poison all note reads', async () => {
  const set = jest
    .spyOn(c.repos.notes.userText, 'set')
    .mockRejectedValueOnce(new Error('temporary disk failure'));
  await expect(saveUserNote(c, 'aima', '3.5.2', '我的笔记')).rejects.toThrow(
    'temporary disk failure',
  );
  set.mockRestore();
  await expect(loadNotes(c)).resolves.toBeDefined();
});

it('reopening a book should pick up changed teaching preferences', async () => {
  const session = getStudySession(c, 'aima');
  await session.open({ autoStart: false, mode: 'read' });
  await patchPrefs(c, { recap: false, extra: '多用 Python 类比' });
  await session.open({ sectionId: '3.5.2', autoStart: false });
  expect(session.store.getState().prefs).toMatchObject({
    recap: false,
    extra: '多用 Python 类比',
  });
});

it('removing a highlight should preserve its separately entered block note', async () => {
  const block = (await c.repos.blocks.bySection('aima', '3.5.2')).find(
    b => b.type === 'text',
  )!;
  await saveStudyBlockNote(c, 'aima', '3.5.2', block.seq, '这段推导需要复看');
  await toggleStudyHighlight(c, 'aima', block.seq);
  expect(
    (await c.repos.notes.highlights.list('aima')).find(
      h => h.block_seq === block.seq,
    )?.note,
  ).toBe('这段推导需要复看');
  const annotation = (await c.repos.notes.highlights.list('aima')).find(
    h => h.block_seq === block.seq,
  )!;
  expect(annotation.color).toBe('none');
  const detail = presentNoteDetail(
    await loadNoteDetail(c, 'aima', '3.5.2'),
    '3.5.2',
  );
  expect(detail.highlights.find(h => h.ref === `b${block.seq}`)).toMatchObject({
    note: '这段推导需要复看',
    highlighted: false,
  });
  await toggleStudyHighlight(c, 'aima', block.seq);
  expect(
    (await c.repos.notes.highlights.list('aima')).find(
      h => h.block_seq === block.seq,
    ),
  ).toMatchObject({ color: 'yellow', note: '这段推导需要复看' });
});

it('leaving the reader immediately after scrolling should retain the new anchor', async () => {
  jest.useFakeTimers();
  const nav: AppNav = {
    open: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    enterDemo: jest.fn(),
    exitDemo: jest.fn(),
  };
  let vm!: ReturnType<typeof useStudyVM>;
  function Probe() {
    vm = useStudyVM('aima', { mode: 'read', autoStart: false });
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
  const session = getStudySession(c, 'aima');
  const target = session.store.getState().blocks.at(-1)!.seq;
  expect(session.store.getState().readAnchor).not.toBe(target);
  await ReactTestRenderer.act(async () => {
    vm.intents.reportAnchor(`b${target}`);
  });
  await ReactTestRenderer.act(async () => {
    renderer!.unmount();
  });
  renderer = undefined;
  await session.flushAnchor();
  expect((await c.repos.study.get('aima'))?.read_anchor).toBe(target);
});

it('reopening a long conversation should leave older saved messages reachable', async () => {
  const session = getStudySession(c, 'aima');
  await session.open({ mode: 'listen', autoStart: false });
  const current = session.store.getState();
  const conversationId = current.conversation!.id;
  for (let i = 0; i < 205; i++) {
    await c.repos.messages.append({
      book_id: 'aima',
      section_id: current.main.sectionId,
      conversation_id: conversationId,
      kind: 'user',
      content: `history-audit-${i}`,
      created_at: c.clock.now().toISOString(),
    });
  }
  const stored = await c.repos.messages.thread('aima', current.main.sectionId, {
    conversation_id: conversationId,
    limit: 1000,
  });
  expect(
    stored.filter(message => message.content.startsWith('history-audit-')),
  ).toHaveLength(205);
  const reopened = new StudySession(c, 'aima');
  try {
    await reopened.open({ conversationId, mode: 'listen', autoStart: false });
    expect(reopened.store.getState().hasOlderMessages).toBe(true);
    await reopened.loadOlderMessages();
    expect(
      reopened.store.getState().messages.map(message => message.content),
    ).toContain('history-audit-0');
  } finally {
    await reopened.dispose();
  }
});

it('ignores an older-history result after switching conversations in the same section', async () => {
  const session = getStudySession(c, 'aima');
  await session.open({ mode: 'listen', autoStart: false });
  const original = session.store.getState().conversation!;
  const sibling = await c.repos.conversations.create(
    'aima',
    original.section_id,
  );
  const siblingMessage = await c.repos.messages.append({
    book_id: 'aima',
    section_id: original.section_id,
    conversation_id: sibling.id,
    kind: 'user',
    content: 'other conversation only',
    created_at: c.clock.now().toISOString(),
  });
  const old = await c.repos.messages.append({
    book_id: 'aima',
    section_id: original.section_id,
    conversation_id: original.id,
    kind: 'user',
    content: 'old conversation only',
    created_at: c.clock.now().toISOString(),
  });
  session.store.setState({ messages: [old], hasOlderMessages: true });
  let deliver!: (value: (typeof old)[]) => void;
  const thread = c.repos.messages.thread.bind(c.repos.messages);
  const spy = jest
    .spyOn(c.repos.messages, 'thread')
    .mockImplementation((book, section, options) =>
      options?.before_id
        ? new Promise(resolve => {
            deliver = resolve;
          })
        : thread(book, section, options),
    );
  const loading = session.loadOlderMessages();
  expect(spy).toHaveBeenCalledWith(
    'aima',
    original.section_id,
    expect.objectContaining({ conversation_id: original.id }),
  );
  await session.selectConversation(sibling.id);
  deliver([old]);
  await loading;
  expect(session.store.getState().messages.map(m => m.id)).toContain(
    siblingMessage.id,
  );
  expect(session.store.getState().messages.map(m => m.id)).not.toContain(
    old.id,
  );
  expect(session.store.getState().loadingHistory).toBe(false);
  spy.mockRestore();
});
