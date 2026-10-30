import ReactTestRenderer from 'react-test-renderer';
import { createTestDemoContainer } from '@app/testing';
import type { Container } from '@app/container';
import { ContainerProvider } from '@app/ContainerProvider';
import { loadBookMap, loadSection, loadShelf } from '@app/usecases/library';
import { AppNavProvider, type AppNav } from '@features/nav';
import { ShelfScreen } from '@features/library/LibraryScreens';
import { pageRange, presentShelf } from '@features/library/presenters';
import type { ShelfState } from '@features/library/types';
import { ShelfView } from '@ui/screens/ShelfView';
import { useIsFocused } from '@react-navigation/native';

jest.mock('@react-navigation/native', () => ({ useIsFocused: jest.fn() }));
jest.mock('@ui/screens/ShelfView', () => ({ ShelfView: jest.fn(() => null) }));

let c: Container;
let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
const nav: AppNav = {
  open: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  enterDemo: jest.fn(),
  exitDemo: jest.fn(),
};
beforeEach(async () => {
  c = await createTestDemoContainer();
  jest.clearAllMocks();
  jest.mocked(useIsFocused).mockReturnValue(true);
});
afterEach(async () => {
  if (renderer) await ReactTestRenderer.act(async () => renderer!.unmount());
  renderer = undefined;
  await c.close();
});

async function ask(sectionId: string, content: string) {
  return c.repos.messages.append({
    book_id: 'aima',
    section_id: sectionId,
    part_no: 0,
    step_no: 1,
    kind: 'user',
    intent: 'ask',
    content,
    parts: null,
    raw: null,
    allowed_refs: null,
    detour_id: null,
    quote_seq: null,
    usage: null,
    created_at: c.clock.now().toISOString(),
  });
}

it('shows the latest current-section question, unresolved stuck point and next step immediately from local records', async () => {
  await c.db.run('DELETE FROM stuck WHERE book_id=?', ['aima']);
  await c.db.run('DELETE FROM message WHERE book_id=?', ['aima']);
  await ask('3.5.2', '较早的问题');
  await ask('3.5.2', '最新的当前问题');
  await ask('3.4.2', '另一节较新的问题');
  for (const [section, text, created] of [
    ['3.5.2', '当前旧卡点', '2026-01-01T00:00:00Z'],
    ['3.5.2', '当前最新卡点', '2026-01-02T00:00:00Z'],
    ['3.4.2', '全书另一节卡点', '2026-01-03T00:00:00Z'],
  ])
    await c.repos.notes.stuck.add({
      book_id: 'aima',
      section_id: section,
      text,
      created_at: created,
      source: 'user',
      card_id: null,
      resolved_at: null,
    });
  const resolved = await c.repos.notes.stuck.add({
    book_id: 'aima',
    section_id: '3.5.2',
    text: '已解决的卡点',
    created_at: '2026-01-04T00:00:00Z',
    source: 'user',
    card_id: null,
    resolved_at: c.clock.now().toISOString(),
  });
  expect(resolved.resolved_at).toBeTruthy();
  await c.repos.study.patch('aima', {
    last_active_at: c.clock.now().toISOString(),
    mode: 'read',
  });
  const ai = jest.spyOn(c.ai, 'complete');
  const records = await loadShelf(c);
  const current = records.find(value => value.book.id === 'aima')!;
  const recap = presentShelf(records, c.clock.now(), false).continueCard?.recap;
  expect(recap).toContain('上次问：最新的当前问题');
  expect(recap).toContain('卡点：当前最新卡点');
  expect(recap).toContain(`接着学：${current.plan!.steps[1].title}`);
  expect(recap).not.toMatch(/较早|另一节|当前旧|已解决/);
  expect(ai).not.toHaveBeenCalled();
});

it('shows a next goal without a stuck point and keeps long questions compact', async () => {
  await c.db.run('DELETE FROM stuck WHERE book_id=?', ['aima']);
  await c.db.run('DELETE FROM message WHERE book_id=?', ['aima']);
  let records = await loadShelf(c);
  expect(
    presentShelf(records, c.clock.now(), false).continueCard?.recap,
  ).toContain('接着学：');
  await ask('3.5.2', `长问题 ${'为什么'.repeat(90)}\n重复内容`);
  records = await loadShelf(c);
  const recap =
    presentShelf(records, c.clock.now(), false).continueCard?.recap ?? '';
  expect(recap).toContain('…');
  expect(recap.split('\n')).toHaveLength(2);
  expect(recap.length).toBeLessThan(140);
});

it('clears only proven legacy typography flags in map and section views while preserving stored evidence', async () => {
  const flags = [{ kind: 'level', detail: { recognized: 2, outline: 3 } }];
  await c.repos.sections.update('aima', '3.5.2', {
    no: null,
    level: 3,
    source: 'auto',
    flag: 'level',
    flag_detail: flags,
  });
  expect(
    (await loadBookMap(c, 'aima')).sections.find(value => value.id === '3.5.2')
      ?.flag,
  ).toBeNull();
  expect((await loadSection(c, 'aima', '3.5.2')).section.flag).toBeNull();
  expect((await c.repos.sections.get('aima', '3.5.2'))?.flag_detail).toEqual(
    flags,
  );
  await c.repos.sections.update('aima', '3.5.2', { no: '3.5.2' });
  expect((await loadSection(c, 'aima', '3.5.2')).section.flag).toBe('level');
});

it('keeps a section range in physical PDF coordinates when it crosses unlabeled front matter', () => {
  expect(pageRange({ page_from: 1, page_to: 41 }, { page_offset: 41 })).toBe(
    'PDF 第 1–41 页',
  );
  expect(pageRange({ page_from: 40, page_to: 43 }, { page_offset: 41 })).toBe(
    'PDF 第 40–43 页',
  );
  expect(pageRange({ page_from: 42, page_to: 44 }, { page_offset: 41 })).toBe(
    'p.1–3',
  );
});

it('refreshes the local continuation card when returning to the shelf without a navigation dependency in the VM', async () => {
  await c.db.run('DELETE FROM message WHERE book_id=?', ['aima']);
  const view = () => (
    <ContainerProvider value={c}>
      <AppNavProvider value={nav}>
        <ShelfScreen />
      </AppNavProvider>
    </ContainerProvider>
  );
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(view());
  });
  const lastState = () =>
    jest.mocked(ShelfView).mock.calls.at(-1)![0].state as ShelfState;
  const loads = jest.spyOn(c.repos.books, 'list');
  jest.mocked(useIsFocused).mockReturnValue(false);
  await ReactTestRenderer.act(async () => {
    renderer!.update(view());
  });
  await ask('3.5.2', '离开书架后刚问的问题');
  expect(lastState().continueCard?.recap).not.toContain('离开书架后刚问的问题');
  jest.mocked(useIsFocused).mockReturnValue(true);
  await ReactTestRenderer.act(async () => {
    renderer!.update(view());
  });
  expect(lastState().continueCard?.recap).toContain('离开书架后刚问的问题');
  expect(loads).toHaveBeenCalledTimes(1);
});
