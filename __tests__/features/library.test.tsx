import ReactTestRenderer from 'react-test-renderer';
import { AccessibilityInfo } from 'react-native';
import { createTestDemoContainer } from '@app/testing';
import type { Container } from '@app/container';
import { ContainerProvider } from '@app/ContainerProvider';
import {
  confirmMapFlag,
  createDemoImportDraft,
  loadShelf,
  splitMapSection,
} from '@app/usecases/library';
import { AppNavProvider, type AppNav } from '@features/nav';
import {
  useBookMapVM,
  useImportSettingsVM,
  useParseProgressVM,
  useShelfVM,
} from '@features/library/useLibraryVM';
import {
  parsePart,
  presentShelf,
  shelfStatus,
} from '@features/library/presenters';
import {
  shelfSamples,
  mapSamples,
  parseSamples,
  importSamples,
} from '@features/library/samples';
import { ShelfView } from '@ui/screens/ShelfView';
import { BookMapView } from '@ui/screens/BookMapView';
import { ParseProgressView } from '@ui/screens/ParseProgressView';
import { ImportSettingsView } from '@ui/screens/ImportSettingsView';
import { SkinProvider } from '@ui/kit';

let c: Container;
let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
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
});
afterEach(async () => {
  if (renderer) await ReactTestRenderer.act(async () => renderer!.unmount());
  renderer = undefined;
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
async function act(action: () => void) {
  await ReactTestRenderer.act(async () => {
    action();
  });
}

it('presents ready, studying, parsing and paused states using actual library records', async () => {
  const records = await loadShelf(c);
  const aima = records.find(r => r.book.id === 'aima')!;
  expect(shelfStatus(aima).text).toContain('在学 3.5.2');
  expect(shelfStatus(records.find(r => r.book.id === 'slm')!).text).toContain(
    '解析中 · 解析',
  );
  expect(shelfStatus(records.find(r => r.book.id === 'ddia')!).text).toBe(
    'EPUB · 本地解析 · 已就绪 · 未开始',
  );
  expect(
    shelfStatus({
      ...aima,
      book: { ...aima.book, status: 'paused' },
      parts: [
        {
          ...records.find(r => r.book.id === 'slm')!.parts[0],
          error_code: 'A0211',
        },
      ],
    }),
  ).toEqual({ tone: 'bad', text: '解析暂停：Token 已过期' });
  const presented = presentShelf(records, c.clock.now(), true);
  expect(presented.continueCard?.stepLabel).toBe('第 2/4 步');
  expect(presented.continueCard?.recap).toContain('上次 3 天前');
});
it('shelf searches by author and routes parsing books and regular books correctly', async () => {
  const current = await mount(useShelfVM);
  expect(current().state.books).toHaveLength(3);
  await act(() => current().intents.openSearch());
  await act(() => current().intents.setSearch('李航'));
  expect(current().state.overlay).toMatchObject({
    kind: 'search',
    results: [{ id: 'slm' }],
  });
  await act(() => current().intents.openBook('slm'));
  expect(nav.open).toHaveBeenCalledWith({
    name: 'ParseProgress',
    bookId: 'slm',
  });
  await act(() => current().intents.openBook('aima'));
  expect(nav.open).toHaveBeenCalledWith({ name: 'BookMap', bookId: 'aima' });
  await act(() => current().intents.openContinue());
  expect(nav.open).toHaveBeenCalledWith({ name: 'Study', bookId: 'aima' });
  await act(() => current().intents.openImport());
  expect(current().state.overlay).toMatchObject({
    kind: 'import',
    recent: expect.any(Array),
  });
  await act(() => current().intents.pickRecent('aima'));
  expect(nav.open).toHaveBeenCalledWith({
    name: 'ImportSettings',
    draftId: 'demo-import-aima',
  });
});
it('map section sheet, literal search and start confirmation preserve prior progress', async () => {
  const current = await mount(() => useBookMapVM('aima'));
  expect(current().state.chapters).toHaveLength(3);
  expect(current().state.chapters[2].expanded).toBe(true);
  await act(() => current().intents.openSection('3.5.2'));
  expect(current().state.overlay).toMatchObject({
    kind: 'section',
    title: '3.5.2 A*搜索',
    facts: expect.arrayContaining([{ k: '状态', v: '在学 · 第 2/4 步' }]),
  });
  await act(() => current().intents.sectionAction('notes'));
  expect(nav.open).toHaveBeenCalledWith({
    name: 'NoteDetail',
    bookId: 'aima',
    sectionId: '3.5.2',
  });
  await act(() => current().intents.openSearch());
  await act(() => current().intents.setQuery('启发'));
  expect(current().state.overlay).toMatchObject({
    kind: 'search',
    busy: false,
  });
  const overlay = current().state.overlay;
  if (overlay?.kind !== 'search') throw new Error('expected search');
  expect(overlay.results.length).toBeGreaterThan(0);
  await act(() => current().intents.openResult(overlay.results[0].ref));
  expect(nav.open).toHaveBeenCalledWith({
    name: 'Reader',
    bookId: 'aima',
    blockRef: overlay.results[0].ref,
  });
  await act(() => current().intents.openSection('3.5.3'));
  await act(() => current().intents.sectionAction('start'));
  expect(current().state.overlay?.kind).toBe('changeMain');
  expect((await c.repos.study.get('aima'))?.main_section).toBe('3.5.2');
  await act(() => current().intents.confirmStart());
  expect((await c.repos.study.get('aima'))?.main_section).toBe('3.5.3');
  expect((await c.repos.sections.get('aima', '3.5.2'))?.status).toBe(
    'learning',
  );
  expect(nav.open).toHaveBeenCalledWith({
    name: 'Study',
    bookId: 'aima',
    sectionId: '3.5.3',
  });
});
it('map flags save manual confirmation and refuse a split without a second source heading', async () => {
  await c.repos.sections.update('aima', '3.5.4', { flag: 'merged' });
  const current = await mount(() => useBookMapVM('aima'));
  await act(() => current().intents.openSection('3.5.4'));
  expect(current().state.overlay?.kind).toBe('flag');
  await expect(splitMapSection(c, 'aima', '3.5.4')).rejects.toThrow(
    '没有第二个标题',
  );
  expect((await c.repos.sections.get('aima', '3.5.4'))?.flag).toBe('merged');
  await act(() => current().intents.confirmFlag());
  expect(await c.repos.sections.get('aima', '3.5.4')).toMatchObject({
    flag: null,
    source: 'manual',
  });
  await confirmMapFlag(c, 'aima', '3.5.4');
});
it('splits only at an existing source heading while keeping block references and notes intact', async () => {
  const section = (await c.repos.sections.get('aima', '3.5.2'))!;
  const blocks = await c.repos.blocks.bySection('aima', section.id);
  const before = blocks.map(b => b.seq);
  await c.repos.notes.userText.set('aima', section.id, '保留的笔记');
  await c.db.run("UPDATE block SET type='title' WHERE book_id=? AND seq=?", [
    'aima',
    blocks[6].seq,
  ]);
  await splitMapSection(c, 'aima', section.id);
  const after = await c.repos.blocks.range(
    'aima',
    section.block_from!,
    section.block_to!,
  );
  expect(after.map(b => b.seq)).toEqual(before);
  expect(after.slice(6).every(b => b.section_id === '3.5.2-split')).toBe(true);
  expect(await c.repos.sections.get('aima', '3.5.2')).toMatchObject({
    source: 'manual',
    block_to: blocks[5].seq,
  });
  expect(await c.repos.sections.get('aima', '3.5.2-split')).toMatchObject({
    source: 'manual',
    block_from: blocks[6].seq,
  });
  expect(
    (await c.repos.notes.userText.get('aima', section.id))?.user_text,
  ).toBe('保留的笔记');
  expect(await c.repos.plans.get('aima', section.id, 0)).toBeUndefined();
});
it('parse progress and import options use real persisted metadata without starting a fake upload', async () => {
  let current = await mount(() => useParseProgressVM('slm'));
  expect(current().state.parts).toHaveLength(3);
  expect(current().state.parts[0].statusText).toBe('解析 61%');
  await act(() => current().intents.goUpdateToken());
  expect(nav.open).toHaveBeenCalledWith({ name: 'MeMineru' });
  const part = (await c.repos.parts.list('slm'))[0];
  expect(parsePart({ ...part, stage: 'done' }).progress).toBe(1);
  await ReactTestRenderer.act(async () => renderer!.unmount());
  renderer = undefined;
  const draftId = await createDemoImportDraft(c, 'aima');
  const imported = await mount(() => useImportSettingsVM(draftId));
  expect(imported().state.parts).toContain('p.1001–1136');
  await act(() => imported().intents.setModel('pipeline'));
  expect(imported().state.modelHint).toContain('速度更快');
  await act(() => imported().intents.setPriorityFrom('0'));
  await act(() => imported().intents.start());
  expect(imported().state.error).toContain('大于 0');
  await act(() => imported().intents.setPriorityFrom('1'));
  await act(() => imported().intents.start());
  expect(imported().state.overlay).toBe(true);
  await act(() => imported().intents.confirm());
  expect(nav.replace).toHaveBeenCalledWith({ name: 'BookMap', bookId: 'aima' });
  expect(await c.repos.books.list()).toHaveLength(3);
});
it.each(['paper', 'glass'] as const)(
  'renders library sample states with %s tokens',
  async skin => {
    const views = [
      ...Object.values(shelfSamples).map(state => (
        <ShelfView
          state={state}
          intents={{
            refresh: () => {},
            openBook: () => {},
            openContinue: () => {},
            openImport: () => {},
            openSearch: () => {},
            setSearch: () => {},
            closeOverlay: () => {},
            pickRecent: () => {},
            pickOther: () => {},
          }}
        />
      )),
      ...Object.values(mapSamples).map(state => (
        <BookMapView
          state={state}
          intents={{
            back: () => {},
            refresh: () => {},
            toggle: () => {},
            openSection: () => {},
            sectionAction: () => {},
            confirmFlag: () => {},
            rejectFlag: () => {},
            confirmStart: () => {},
            openSearch: () => {},
            setQuery: () => {},
            openResult: () => {},
            closeOverlay: () => {},
          }}
        />
      )),
      ...Object.values(parseSamples).map(state => (
        <ParseProgressView
          state={state}
          intents={{
            back: () => {},
            refresh: () => {},
            retryPart: () => {},
            goUpdateToken: () => {},
            openMap: () => {},
          }}
        />
      )),
      ...Object.values(importSamples).map(state => (
        <ImportSettingsView
          state={state}
          intents={{
            back: () => {},
            setModel: () => {},
            setOcr: () => {},
            setPriorityFrom: () => {},
            start: () => {},
            confirm: () => {},
            closeOverlay: () => {},
          }}
        />
      )),
    ];
    for (const view of views) {
      await ReactTestRenderer.act(async () => {
        renderer = ReactTestRenderer.create(
          <SkinProvider skinId={skin} scheme="light" reduceMotion>
            {view}
          </SkinProvider>,
        );
      });
      expect(renderer!.toJSON()).toBeTruthy();
      await ReactTestRenderer.act(async () => renderer!.unmount());
      renderer = undefined;
    }
  },
);
