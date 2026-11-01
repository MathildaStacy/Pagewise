import Renderer, { act } from 'react-test-renderer';
import { createTestContainer } from '@app/testing';
import type { Container } from '@app/container';
import { ContainerProvider } from '@app/ContainerProvider';
import { AppNavProvider, type AppNav } from '@features/nav';
import { SetupGate } from '@features/home/HomeScreens';
import { useMeVM } from '@features/settings/useSettingsVM';
import {
  useShelfVM,
  useImportSettingsVM,
} from '@features/library/useLibraryVM';
import { ShelfView } from '@ui/screens/ShelfView';
import { SkinProvider, Button } from '@ui/kit';
import { AiError } from '@services/ai/http';
import { toAppError } from '@app/errors';

let c: Container;
let renderer: Renderer.ReactTestRenderer | undefined;
const nav: AppNav = {
  open: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  enterDemo: jest.fn(),
  exitDemo: jest.fn(),
};
beforeEach(async () => {
  c = await createTestContainer();
  jest.clearAllMocks();
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
  await c.close();
});
async function mount<T>(
  hook: () => T,
  skin: 'paper' | 'glass' | 'meta' | 'google' | 'win11' = 'paper',
) {
  let vm!: T;
  function Probe() {
    vm = hook();
    return null;
  }
  await act(async () => {
    renderer = Renderer.create(
      <ContainerProvider value={c}>
        <AppNavProvider value={nav}>
          <SkinProvider skinId={skin} scheme="light" reduceMotion>
            <Probe />
          </SkinProvider>
        </AppNavProvider>
      </ContainerProvider>,
    );
  });
  return () => vm;
}
it.each(['paper', 'glass', 'meta', 'google', 'win11'] as const)(
  '%s exposes setup, stats and shelf questions',
  async skin => {
    await c.appearance.update({ skin });
    const vm = await mount(() => {
      const me = useMeVM(),
        shelf = useShelfVM();
      return { me, shelf };
    }, skin);
    const keys = vm()
      .me.state.groups.flat()
      .map(row => row.key);
    expect(keys).toEqual(expect.arrayContaining(['LearningStats', 'Welcome']));
    vm().me.intents.open('LearningStats');
    expect(nav.open).toHaveBeenLastCalledWith({ name: 'LearningStats' });
    vm().me.intents.open('Welcome');
    expect(nav.open).toHaveBeenLastCalledWith({ name: 'Welcome' });
    await act(async () => {
      renderer!.update(
        <SkinProvider skinId={skin} scheme="light" reduceMotion>
          <ShelfView {...vm().shelf} />
        </SkinProvider>,
      );
    });
    const ask = renderer!.root
      .findAllByType(Button)
      .find(button => button.props.children === '问书架');
    expect(ask).toBeDefined();
    await act(async () => ask!.props.onPress());
    expect(nav.open).toHaveBeenLastCalledWith({ name: 'AskShelf' });
  },
);
it('opens onboarding once for a new paper library, without reopening on navigation changes', async () => {
  const screen = () => (
    <ContainerProvider value={c}>
      <AppNavProvider value={{ ...nav }}>
        <SetupGate ready />
      </AppNavProvider>
    </ContainerProvider>
  );
  await act(async () => {
    renderer = Renderer.create(screen());
  });
  expect(nav.open).toHaveBeenCalledWith({ name: 'Welcome' });
  await act(async () => {
    renderer!.update(screen());
  });
  expect(nav.open).toHaveBeenCalledTimes(1);
});
it('does not auto-open completed onboarding', async () => {
  await c.repos.settings.set('welcome.completed', true);
  await act(async () => {
    renderer = Renderer.create(
      <ContainerProvider value={c}>
        <AppNavProvider value={nav}>
          <SetupGate ready />
        </AppNavProvider>
      </ContainerProvider>,
    );
  });
  expect(nav.open).not.toHaveBeenCalled();
});
it.each(['pdf', 'epub'])(
  '%s import handles missing Token before confirmation and preserves the draft',
  async format => {
    await c.repos.drafts.insert({
      id: 'import',
      file_path: '/book.' + format,
      info: { format, title: 'Book', pages: 2, size_bytes: 1234 },
      created_at: c.clock.now().toISOString(),
    });
    const vm = await mount(() => useImportSettingsVM('import'));
    expect(vm().state.needsToken).toBe(format === 'pdf');
    if (format === 'pdf') {
      await act(async () => {
        vm().intents.setPriorityFrom('2');
      });
      await act(async () => {
        vm().intents.start();
      });
      expect(nav.open).toHaveBeenLastCalledWith({ name: 'MeMineru' });
      expect(vm().state.overlay).toBe(false);
      expect(await c.repos.drafts.get('import')).not.toBeNull();
      await c.secrets.set('mineru.token', 'local-test-token');
      await act(async () => {
        vm().intents.refreshToken();
      });
      expect(vm().state.needsToken).toBe(false);
      expect(vm().state.priorityFrom).toBe('2');
      await act(async () => {
        vm().intents.start();
      });
      expect(vm().state.overlay).toBe(true);
    }
  },
);
it('distinguishes local setup from a rejected key and offers the AI settings route', async () => {
  const result = await c.ai
    .complete('teach', {
      system: '',
      contextBlocks: [],
      history: [],
      tools: [],
    })
    .catch(error => error);
  expect(result).toBeInstanceOf(AiError);
  expect(toAppError(result)).toMatchObject({
    code: 'ai.not_configured',
    settings: 'MeAI',
  });
  expect(toAppError(new AiError('missing_key', 'missing')).message).toContain(
    '还没填写',
  );
  expect(toAppError(new AiError('auth', '401')).message).toContain(
    '无效或已过期',
  );
});
