import TestRenderer, { act } from 'react-test-renderer';
import { AccessibilityInfo } from 'react-native';
import { configureStorageRuntime } from '@app/usecases/storage';
import type { StorageIO } from '@app/usecases/storage';
import { createTestDemoContainer } from '@app/testing';
import type { Container } from '@app/container';
import { useContainer } from '@app/ContainerProvider';
import { useAppNav } from '@features/nav';
import {
  useNotesVM,
  useNotesBookVM,
  useNoteDetailVM,
} from '@features/notes/useNotesVM';
import { loadBookNotes, loadNoteDetail } from '@app/usecases/notes';
import {
  presentNotesBook,
  presentNoteDetail,
} from '@features/notes/presenters';
import { NotesView } from '@ui/screens/NotesView';
import { NotesBookView } from '@ui/screens/NotesBookView';
import { NoteDetailView } from '@ui/screens/NoteDetailView';
import { ReviewView } from '@ui/screens/ReviewView';
import { ReviewSessionView } from '@ui/screens/ReviewSessionView';
import { SkinProvider } from '@ui/kit';
import {
  notesSamples,
  notesBookSamples,
  noteDetailSamples,
} from '@features/notes/samples';
import { reviewSamples, reviewSessionSamples } from '@features/review/samples';

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
  jest.mocked(useContainer).mockReturnValue(c);
  jest.mocked(useAppNav).mockReturnValue(nav);
  jest.clearAllMocks();
});
afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = undefined;
  await c.close();
});
afterAll(() => jest.restoreAllMocks());
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

it('groups chapter notes and presents answers, highlights and the current source section', async () => {
  const book = presentNotesBook(await loadBookNotes(c, 'aima'));
  expect(
    book.chapters.some(ch => ch.sections.some(s => s.id === '3.4.2')),
  ).toBe(true);
  const detail = presentNoteDetail(
    await loadNoteDetail(c, 'aima', '3.5.2'),
    '3.5.2',
  );
  expect(detail.title).toBe('3.5.2 A*搜索');
  expect(detail.canOpenSource).toBe(true);
  expect(detail.pins.length).toBeGreaterThan(0);
  const current = await mount(useNotesVM);
  expect(current().state.books.find(b => b.id === 'aima')?.meta).toMatch(
    /节有笔记/,
  );
  current().intents.openBook('aima');
  expect(nav.open).toHaveBeenLastCalledWith({
    name: 'NotesBook',
    bookId: 'aima',
  });
});
it('opens note detail, persists export controls and exports the selected format', async () => {
  const current = await mount(() => useNotesBookVM('aima'));
  current().intents.openSection('3.5.2');
  expect(nav.open).toHaveBeenLastCalledWith({
    name: 'NoteDetail',
    bookId: 'aima',
    sectionId: '3.5.2',
  });
  await act(async () => {
    current().intents.openExport();
    await new Promise(resolve => setImmediate(resolve));
  });
  expect(current().state.overlay?.format).toBe('md');
  await act(async () => {
    current().intents.setFormat('anki');
    await new Promise(resolve => setImmediate(resolve));
  });
  await act(async () => {
    current().intents.setStrip(false);
    await new Promise(resolve => setImmediate(resolve));
  });
  expect(await c.repos.settings.get('export', {})).toEqual({
    format: 'anki',
    strip: false,
  });
  const saveDownloads = jest.fn(async () => '/downloads/cards.csv');
  configureStorageRuntime(c, {
    cacheDir: '/cache',
    mkdir: jest.fn(async () => {}),
    writeText: jest.fn(async () => {}),
    remove: jest.fn(async () => {}),
    saveDownloads,
  } as unknown as StorageIO);
  await act(async () => {
    current().intents.exportNow();
    await new Promise(resolve => setImmediate(resolve));
  });
  expect(current().state.notice).toContain('已保存到下载');
  expect(saveDownloads).toHaveBeenCalledWith(
    expect.any(String),
    expect.stringContaining('闪卡.csv'),
    'text/csv',
  );
});
it('flushes the newest note before unmount and immediately reloads it on reentry', async () => {
  let current = await mount(() => useNoteDetailVM('aima', '3.5.2'));
  await act(async () => {
    current().intents.setUserText('第一版');
    current().intents.setUserText('最新的自己的理解');
  });
  expect(current().state.saveStatus).toBe('待保存');
  await act(async () => renderer!.unmount());
  renderer = undefined;
  current = await mount(() => useNoteDetailVM('aima', '3.5.2'));
  expect(current().state.userText).toBe('最新的自己的理解');
  expect((await c.repos.notes.userText.get('aima', '3.5.2'))?.user_text).toBe(
    '最新的自己的理解',
  );
  current().intents.openSource();
  expect(nav.open).toHaveBeenLastCalledWith({
    name: 'Reader',
    bookId: 'aima',
    sectionId: '3.5.2',
  });
});
it('saves after the debounce and does not navigate away on a failed explicit back-save', async () => {
  const current = await mount(() => useNoteDetailVM('aima', '3.5.2'));
  await act(async () => {
    current().intents.setUserText('800ms 防抖后的笔记');
    await new Promise(resolve => setTimeout(resolve, 850));
  });
  expect(current().state.saveStatus).toBe('已保存');
  await c.db.run(
    "CREATE TRIGGER fail_note BEFORE UPDATE ON section_note BEGIN SELECT RAISE(ABORT,'fixture full'); END",
  );
  await act(async () => {
    current().intents.setUserText('未能保存的新笔记');
    current().intents.back();
    await new Promise(resolve => setImmediate(resolve));
  });
  expect(nav.back).not.toHaveBeenCalled();
  expect(current().state.saveStatus).toBe('保存失败');
  await c.db.run('DROP TRIGGER fail_note');
  await act(async () => {
    current().intents.back();
    await new Promise(resolve => setImmediate(resolve));
  });
  expect(nav.back).toHaveBeenCalledTimes(1);
});
it.each(['paper', 'glass'] as const)(
  'renders all note and review sample states with %s tokens',
  async skin => {
    const no = () => {};
    for (const state of Object.values(notesSamples)) {
      await act(async () => {
        renderer = TestRenderer.create(
          <SkinProvider skinId={skin} scheme="light" reduceMotion>
            <NotesView state={state} intents={{ openBook: no, retry: no }} />
          </SkinProvider>,
        );
      });
      expect(renderer!.toJSON()).toBeTruthy();
      await act(async () => renderer!.unmount());
    }
    for (const state of Object.values(notesBookSamples)) {
      await act(async () => {
        renderer = TestRenderer.create(
          <SkinProvider skinId={skin} scheme="light" reduceMotion>
            <NotesBookView
              state={state}
              intents={{
                back: no,
                openSection: no,
                openExport: no,
                setFormat: no,
                setStrip: no,
                closeOverlay: no,
                exportNow: no,
                retry: no,
              }}
            />
          </SkinProvider>,
        );
      });
      expect(renderer!.toJSON()).toBeTruthy();
      await act(async () => renderer!.unmount());
    }
    for (const state of Object.values(noteDetailSamples)) {
      await act(async () => {
        renderer = TestRenderer.create(
          <SkinProvider skinId={skin} scheme="light" reduceMotion>
            <NoteDetailView
              state={state}
              intents={{
                back: no,
                openSource: no,
                openHighlight: no,
                setUserText: no,
                retry: no,
              }}
            />
          </SkinProvider>,
        );
      });
      expect(renderer!.toJSON()).toBeTruthy();
      await act(async () => renderer!.unmount());
    }
    for (const state of Object.values(reviewSamples)) {
      await act(async () => {
        renderer = TestRenderer.create(
          <SkinProvider skinId={skin} scheme="light" reduceMotion>
            <ReviewView
              state={state}
              intents={{ start: no, reteach: no, markResolved: no, retry: no }}
            />
          </SkinProvider>,
        );
      });
      expect(renderer!.toJSON()).toBeTruthy();
      await act(async () => renderer!.unmount());
    }
    for (const state of Object.values(reviewSessionSamples)) {
      await act(async () => {
        renderer = TestRenderer.create(
          <SkinProvider skinId={skin} scheme="light" reduceMotion>
            <ReviewSessionView
              state={state}
              intents={{
                flip: no,
                rate: no,
                openSource: no,
                askAi: no,
                done: no,
                retry: no,
                back: no,
              }}
            />
          </SkinProvider>,
        );
      });
      expect(renderer!.toJSON()).toBeTruthy();
      await act(async () => renderer!.unmount());
    }
    renderer = undefined;
  },
);
