import ReactTestRenderer from 'react-test-renderer';
import { appearanceStore, setAppearance } from '@app/appearance';
import { useAppearanceVM } from '@features/appearance/useAppearanceVM';

beforeEach(() =>
  setAppearance({ skin: 'paper', scheme: 'system', readingSize: 'm' }),
);
afterEach(() =>
  setAppearance({ skin: 'paper', scheme: 'system', readingSize: 'm' }),
);

test('appearance intents update the shared setting and preserve other choices', async () => {
  const back = jest.fn();
  let vm!: ReturnType<typeof useAppearanceVM>;
  function Probe() {
    vm = useAppearanceVM(back);
    return null;
  }
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<Probe />);
  });
  expect(
    vm.state.schemeOptions.find(option => option.key === 'system')?.label,
  ).toBe('跟随系统');
  await ReactTestRenderer.act(async () => {
    vm.intents.setSkin('glass');
    vm.intents.setScheme('dark');
    vm.intents.setSize('l');
  });
  expect(vm.state).toMatchObject({
    skin: 'glass',
    scheme: 'dark',
    readingSize: 'l',
  });
  expect(appearanceStore.getState()).toEqual({
    skin: 'glass',
    scheme: 'dark',
    readingSize: 'l',
  });
  await ReactTestRenderer.act(async () => {
    vm.intents.setSkin('unknown');
    vm.intents.setScheme('unknown');
    vm.intents.setSize('unknown');
  });
  expect(appearanceStore.getState()).toEqual({
    skin: 'glass',
    scheme: 'dark',
    readingSize: 'l',
  });
  vm.intents.back();
  expect(back).toHaveBeenCalledTimes(1);
  await ReactTestRenderer.act(async () => renderer.unmount());
});
