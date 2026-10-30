import Renderer, { act } from 'react-test-renderer';
import { ScrollView, TextInput } from 'react-native';
import { createTestDemoContainer } from '@app/testing';
import type { Container } from '@app/container';
import { useContainer } from '@app/ContainerProvider';
import * as settings from '@app/usecases/settings';
import { loadShelf } from '@app/usecases/library';
import { useAppNav } from '@features/nav';
import { useAskVM, useHomeVM, useWelcomeVM } from '@features/home/useHomeVM';
import { presentShelf } from '@features/library/presenters';
import { ShelfView } from '@ui/screens/ShelfView';
import { AskShelfView } from '@ui/screens/AskShelfView';
import { AppBar, Screen, SkinProvider, type RichInline } from '@ui/kit';

jest.mock('@app/ContainerProvider', () => ({ useContainer: jest.fn() }));
jest.mock('@features/nav', () => ({ useAppNav: jest.fn() }));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) => {
    require('react').useEffect(effect, [effect]);
  },
}));

let c: Container;
const renderers: Renderer.ReactTestRenderer[] = [];
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
  await act(async () => {
    renderers.splice(0).forEach(r => r.unmount());
  });
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
    renderers.push(Renderer.create(<Probe />));
  });
  return () => vm;
}

it('loads Today from the current library, routes to reading, and persists goal changes', async () => {
  const vm = await mount(useHomeVM);
  expect(vm().state.books).toHaveLength(3);
  expect(vm().state.shelf.continueCard?.bookId).toBe('aima');
  vm().intents.ask();
  expect(nav.open).toHaveBeenLastCalledWith({ name: 'AskShelf' });
  vm().intents.openContinue('read');
  expect(nav.open).toHaveBeenLastCalledWith(
    expect.objectContaining({ name: 'Study', bookId: 'aima', mode: 'read' }),
  );
  await act(async () => {
    vm().intents.goal('30');
  });
  expect(await c.repos.settings.get('learning.goal', 20)).toBe(30);
  expect(vm().state.goal).toBe(30);
});

it('completes onboarding with discovered models, an optional parser token, and saved preferences', async () => {
  const vm = await mount(useWelcomeVM);
  await act(async () => {
    vm().intents.next();
  });
  expect(vm().state.step).toBe(1);
  await act(async () => {
    vm().intents.next();
  });
  expect(vm().state.error).toBeNull();
  expect(vm().state.step).toBe(2);
  expect(vm().state.model).toBeTruthy();
  expect(
    (await settings.readProviders(c)).some(p => p.name === 'Claude 官方'),
  ).toBe(true);
  await act(async () => {
    vm().intents.skip();
  });
  await act(async () => {
    vm().intents.pref('bilingual', false);
    vm().intents.pref('length', '短');
  });
  await act(async () => {
    vm().intents.next();
  });
  expect(await settings.readPrefs(c)).toMatchObject({
    bilingual: false,
    length: '短',
  });
  expect(await c.repos.settings.get('welcome.completed', false)).toBe(true);
  expect(nav.replace).toHaveBeenLastCalledWith({ name: 'Tabs', tab: 'Today' });
  expect(vm().state.step).toBe(3);
});

it('keeps failed model discovery on the AI step and allows setup to be skipped', async () => {
  const vm = await mount(useWelcomeVM);
  await act(async () => {
    vm().intents.next();
  });
  const before = (await settings.readProviders(c)).length;
  jest
    .spyOn(settings, 'fetchServiceModels')
    .mockRejectedValueOnce(new Error('无法读取模型列表'));
  await act(async () => {
    vm().intents.next();
  });
  expect(vm().state).toMatchObject({
    step: 1,
    busy: false,
    error: '无法读取模型列表',
  });
  expect((await settings.readProviders(c)).length).toBe(before);
  await act(async () => {
    vm().intents.skip();
  });
  expect(vm().state.step).toBe(2);
});

it('finishes the welcome skip without leaving an unregistered step', async () => {
  const vm = await mount(useWelcomeVM);
  await act(async () => {
    vm().intents.skip();
  });
  expect(await c.repos.settings.get('welcome.completed', false)).toBe(true);
  expect(nav.replace).toHaveBeenCalledWith({ name: 'Tabs', tab: 'Today' });
});

it('streams the prototype answer, opens its citations, saves a note, and continues in Study', async () => {
  jest.useFakeTimers();
  const vm = await mount(useAskVM);
  await act(async () => {
    vm().intents.ask('A* 和 Dijkstra 是什么关系？');
  });
  await act(async () => {
    await jest.runAllTimersAsync();
  });
  expect(vm().state).toMatchObject({ busy: false, done: true, query: '' });
  expect(vm().state.answer).toContain('一致代价搜索就是 Dijkstra');
  expect(vm().state.hits).toHaveLength(4);
  const citations = (nodes: RichInline[]): RichInline[] =>
    nodes.flatMap(node =>
      node.t === 'b' ? citations(node.c) : node.t === 'cite' ? [node] : [],
    );
  const inlineCitations = vm().state.doc.flatMap(block =>
    'c' in block ? citations(block.c) : [],
  );
  expect(inlineCitations).toEqual(
    vm().state.hits.map((hit, i) =>
      expect.objectContaining({
        t: 'cite',
        ref: i + 1,
        verified: true,
        label: `${hit.bookTitle.replace(/[（(].*$/u, '')} · ${hit.page}`,
      }),
    ),
  );
  vm().intents.openHit(0);
  expect(nav.open).toHaveBeenLastCalledWith(
    expect.objectContaining({
      name: 'Reader',
      blockRef: vm().state.hits[0].ref,
    }),
  );
  const hit = vm().state.hits[0];
  const before = await c.repos.notes.qa.list(hit.bookId, hit.sectionId);
  await act(async () => {
    vm().intents.save();
  });
  expect(await c.repos.notes.qa.list(hit.bookId, hit.sectionId)).toHaveLength(
    before.length + 1,
  );
  expect(vm().state.toast).toContain('已保存');
  vm().intents.continue();
  expect(nav.open).toHaveBeenLastCalledWith({
    name: 'Study',
    bookId: hit.bookId,
    mode: 'listen',
    draftQuestion: 'A* 和 Dijkstra 是什么关系？',
  });
});

it('keeps the Ask composer and book scopes above the scrolling answer', async () => {
  const vm = await mount(useAskVM);
  let r!: Renderer.ReactTestRenderer;
  await act(async () => {
    r = Renderer.create(
      <SkinProvider skinId="win11" scheme="light" reduceMotion>
        <AskShelfView
          state={{
            ...vm().state,
            asked: '一个问题',
            answer: '回答',
            done: true,
          }}
          intents={vm().intents}
        />
      </SkinProvider>,
    );
    renderers.push(r);
  });
  const scrolls = r.root.findAllByType(ScrollView);
  const answer = scrolls.find(node => node.props.testID === 'ask-answer')!;
  expect(r.root.findByType(Screen).props.scroll).toBeFalsy();
  expect(answer).toBeDefined();
  expect(answer.findAllByType(TextInput)).toHaveLength(0);
  expect(
    answer.findAllByType(ScrollView).filter(node => node.props.horizontal),
  ).toHaveLength(0);
  expect(r.root.findAllByType(TextInput)).toHaveLength(1);
  expect(scrolls.filter(node => node.props.horizontal)).toHaveLength(1);
  await act(async () => {
    answer.props.onScroll({ nativeEvent: { contentOffset: { y: 600 } } });
  });
  expect(r.root.findByType(AppBar).props.scrollY).toBe(600);
});

it('honors the book scope and stops an in-flight answer', async () => {
  jest.useFakeTimers();
  const vm = await mount(useAskVM);
  await act(async () => {
    vm().intents.scope('slm');
  });
  await act(async () => {
    vm().intents.ask('A* 和 Dijkstra 是什么关系？');
  });
  expect(vm().state.hits).toEqual([]);
  await act(async () => {
    vm().intents.stop();
    await jest.runAllTimersAsync();
  });
  expect(vm().state).toMatchObject({ busy: false, done: false });
  expect(vm().state.answer).not.toContain('一致代价搜索就是 Dijkstra');
});

it('filters the Win11 shelf, toggles layout, and opens the selected book', async () => {
  const state = {
    ...presentShelf(await loadShelf(c), c.clock.now(), true),
    loading: false,
    error: null,
    toast: null,
    overlay: null,
  };
  const intents = {
    refresh: jest.fn(),
    openContinue: jest.fn(),
    openBook: jest.fn(),
    openImport: jest.fn(),
    openSearch: jest.fn(),
    setSearch: jest.fn(),
    closeOverlay: jest.fn(),
    pickRecent: jest.fn(),
    pickOther: jest.fn(),
  };
  let r!: Renderer.ReactTestRenderer;
  await act(async () => {
    r = Renderer.create(
      <SkinProvider skinId="win11" scheme="light" reduceMotion>
        <ShelfView state={state} intents={intents} />
      </SkinProvider>,
    );
    renderers.push(r);
  });
  const buttons = () =>
    r.root.findAll(
      n =>
        typeof n.props.onPress === 'function' &&
        typeof n.props.accessibilityLabel === 'string',
    );
  const press = async (label: string) =>
    act(async () => {
      buttons()
        .find(p => p.props.accessibilityLabel === label)!
        .props.onPress();
    });
  const books = () => [
    ...new Map(
      buttons()
        .filter(p => p.props.accessibilityLabel?.startsWith('打开 '))
        .map(p => [p.props.accessibilityLabel, p]),
    ).values(),
  ];
  expect(books()).toHaveLength(3);
  await press('在学 1');
  expect(books()).toHaveLength(1);
  await press('网格视图');
  expect(buttons().some(p => p.props.accessibilityLabel === '列表视图')).toBe(
    true,
  );
  await press('解析中 1');
  expect(books()).toHaveLength(1);
  const label = books()[0].props.accessibilityLabel;
  await press(label);
  expect(intents.openBook).toHaveBeenCalledWith('slm');
});
