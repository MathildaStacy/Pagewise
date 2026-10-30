import {
  createContext,
  type ComponentProps,
  type PropsWithChildren,
} from 'react';
import Renderer, { act } from 'react-test-renderer';
import type { AppNav } from '@features/nav';
import { RootNavigator } from '@ui/navigation/RootNavigator';

type RootOwner = {
  ready: boolean;
  nav?: AppNav;
  handle: {
    isReady: jest.Mock<boolean, []>;
    dispatch: jest.Mock;
    canGoBack: jest.Mock<boolean, []>;
    goBack: jest.Mock;
  };
};
const mockOwnerContext = createContext<RootOwner | null>(null);

jest.mock('@react-navigation/native', () => {
  const React = require('react') as typeof import('react');
  const actual = jest.requireActual('@react-navigation/native');
  // Keep the real ref factory and hook; only replace the native container.
  const NavigationContainer = React.forwardRef<
    RootOwner['handle'],
    PropsWithChildren<{ onReady?: () => void }>
  >(({ children, onReady }, ref) => {
    const owner = React.useContext(mockOwnerContext)!;
    const emittedReady = React.useRef(false);
    // Match NavigationContainer's ref binding and unconditional cleanup.
    React.useImperativeHandle(ref, () => owner.handle);
    React.useEffect(() => {
      if (owner.ready && !emittedReady.current) {
        emittedReady.current = true;
        onReady?.();
      }
    }, [owner.ready, onReady]);
    return children;
  });
  NavigationContainer.displayName = 'TestNavigationContainer';
  return { ...actual, NavigationContainer };
});
jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: () => null,
    Screen: () => null,
  }),
}));
jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: () => null,
    Screen: () => null,
  }),
}));
jest.mock('@features/nav', () => {
  const React = require('react') as typeof import('react');
  const actual = jest.requireActual('@features/nav');
  return {
    ...actual,
    AppNavProvider: ({
      value,
      children,
    }: PropsWithChildren<{ value: AppNav }>) => {
      React.useContext(mockOwnerContext)!.nav = value;
      return React.createElement(actual.AppNavProvider, { value }, children);
    },
  };
});
jest.mock('@ui/kit', () => ({
  useSkin: () => ({
    skin: { navigationTheme: () => ({}) },
    tokens: { color: { bg: '#fff' } },
  }),
}));
jest.mock('@features/library/LibraryScreens', () => ({}));
jest.mock('@features/review/ReviewScreens', () => ({}));
jest.mock('@features/notes/NotesScreens', () => ({}));
jest.mock('@features/settings/SettingsScreens', () => ({}));
jest.mock('@features/study/StudyScreens', () => ({}));
jest.mock('@features/appearance/AppearanceScreen', () => ({}));
jest.mock('@features/gallery/GalleryScreen', () => ({}));
jest.mock('@features/review/useReviewBadge', () => ({}));
jest.mock('@features/home/HomeScreens', () => ({ Win11SetupGate: () => null }));

type NavigatorProps = Partial<ComponentProps<typeof RootNavigator>>;
const no = () => {};
const renderers = new Set<Renderer.ReactTestRenderer>();
function createOwner(ready = true): RootOwner {
  const owner: RootOwner = {
    ready,
    handle: {
      isReady: jest.fn(),
      dispatch: jest.fn(),
      canGoBack: jest.fn(() => true),
      goBack: jest.fn(),
    },
  };
  owner.handle.isReady.mockImplementation(() => owner.ready);
  return owner;
}
function tree(owner: RootOwner, props: NavigatorProps = {}) {
  return (
    <mockOwnerContext.Provider value={owner}>
      <RootNavigator
        enterDemo={no}
        exitDemo={no}
        fontScale={1}
        onScale={no}
        {...props}
      />
    </mockOwnerContext.Provider>
  );
}
async function mount(owner: RootOwner) {
  let renderer!: Renderer.ReactTestRenderer;
  await act(async () => {
    renderer = Renderer.create(tree(owner));
  });
  renderers.add(renderer);
  return renderer;
}
async function unmount(renderer: Renderer.ReactTestRenderer) {
  await act(async () => renderer.unmount());
  renderers.delete(renderer);
}
afterEach(async () => {
  await act(async () => {
    renderers.forEach(renderer => renderer.unmount());
  });
  renderers.clear();
});

it('keeps business navigation on its own root while another root is mounted', async () => {
  const a = createOwner(),
    b = createOwner();
  await mount(a);
  await mount(b);

  a.nav!.open({ name: 'BookMap', bookId: 'book-a' });
  b.nav!.open({ name: 'MeAppearance' });
  a.nav!.replace({ name: 'ParseProgress', bookId: 'book-a' });
  a.nav!.back();
  b.nav!.back();

  expect(a.handle.dispatch.mock.calls.map(([action]) => action)).toMatchObject([
    {
      type: 'NAVIGATE',
      payload: { name: 'BookMap', params: { bookId: 'book-a' } },
    },
    {
      type: 'REPLACE',
      payload: { name: 'ParseProgress', params: { bookId: 'book-a' } },
    },
  ]);
  expect(b.handle.dispatch.mock.calls.map(([action]) => action)).toMatchObject([
    { type: 'NAVIGATE', payload: { name: 'MeAppearance' } },
  ]);
  expect(a.handle.goBack).toHaveBeenCalledTimes(1);
  expect(b.handle.goBack).toHaveBeenCalledTimes(1);
});

it('does not let a not-ready or unmounting sibling disable the active root', async () => {
  const a = createOwner(),
    b = createOwner(false);
  const rootA = await mount(a),
    rootB = await mount(b);

  a.nav!.open({ name: 'MeAppearance' });
  b.nav!.open({ name: 'MeAppearance' });
  expect(a.handle.dispatch).toHaveBeenCalledTimes(1);
  expect(b.handle.dispatch).not.toHaveBeenCalled();

  b.ready = true;
  await act(async () => rootB.update(tree(b)));
  b.nav!.open({ name: 'BookMap', bookId: 'book-b' });
  expect(b.handle.dispatch).toHaveBeenCalledTimes(1);

  await unmount(rootA);
  b.nav!.open({ name: 'MeAppearance' });
  expect(b.handle.dispatch).toHaveBeenCalledTimes(2);
  expect(b.handle.dispatch).toHaveBeenLastCalledWith(
    expect.objectContaining({
      type: 'NAVIGATE',
      payload: expect.objectContaining({ name: 'MeAppearance' }),
    }),
  );
});

it('keeps rerenders and incoming imports attached to their originating root', async () => {
  const a = createOwner(),
    b = createOwner();
  const rootA = await mount(a),
    rootB = await mount(b);
  const originalNavA = a.nav!;
  const importA: NavigatorProps['incomingImport'] = {
    token: 1,
    selection: { kind: 'draft', draftId: 'draft-a' },
  };
  const importB: NavigatorProps['incomingImport'] = {
    token: 1,
    selection: { kind: 'duplicate', bookId: 'book-b' },
  };

  await act(async () =>
    rootA.update(tree(a, { fontScale: 1.25, incomingImport: importA })),
  );
  b.nav!.open({ name: 'MeAppearance' });
  expect(b.handle.dispatch).toHaveBeenCalledTimes(1);
  await act(async () =>
    rootB.update(tree(b, { fontScale: 1.5, incomingImport: importB })),
  );
  originalNavA.open({ name: 'BookMap', bookId: 'book-a' });
  await act(async () =>
    rootA.update(tree(a, { fontScale: 1.75, incomingImport: importA })),
  );

  expect(a.handle.dispatch.mock.calls.map(([action]) => action)).toMatchObject([
    {
      type: 'NAVIGATE',
      payload: { name: 'ImportSettings', params: { draftId: 'draft-a' } },
    },
    {
      type: 'NAVIGATE',
      payload: { name: 'BookMap', params: { bookId: 'book-a' } },
    },
  ]);
  expect(b.handle.dispatch.mock.calls.map(([action]) => action)).toMatchObject([
    { type: 'NAVIGATE', payload: { name: 'MeAppearance' } },
    {
      type: 'NAVIGATE',
      payload: { name: 'BookMap', params: { bookId: 'book-b' } },
    },
  ]);
});
