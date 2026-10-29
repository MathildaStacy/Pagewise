import { AccessibilityInfo } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import {
  createAppearanceSettings,
  type AppearanceSettings,
} from '@app/appearance';
import { useContainer } from '@app/ContainerProvider';
import type { Db } from '@data/db';
import { openMemoryDb } from '@data/drivers/nodeSqlite';
import { migrate } from '@data/migrations';
import { createSettingsRepo } from '@data/repos/settings';
import { useAppearanceVM } from '@features/appearance/useAppearanceVM';
import { MeAppearanceView } from '@ui/screens/MeAppearanceView';
import { SkinProvider } from '@ui/kit/SkinProvider';

jest.mock('@app/ContainerProvider', () => ({ useContainer: jest.fn() }));
let db: Db;
let settings: AppearanceSettings;
let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
beforeAll(() => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(false);
  jest
    .spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled')
    .mockResolvedValue(false);
});
beforeEach(async () => {
  db = openMemoryDb();
  await migrate(db);
  settings = await createAppearanceSettings(createSettingsRepo(db), db);
  (useContainer as jest.Mock).mockReturnValue({ appearance: settings });
});
afterEach(async () => {
  await settings.flush();
  if (renderer) await ReactTestRenderer.act(async () => renderer!.unmount());
  renderer = undefined;
  await db.close();
});
afterAll(() => jest.restoreAllMocks());
async function mountVM(back = jest.fn()) {
  let vm!: ReturnType<typeof useAppearanceVM>;
  function Probe() {
    vm = useAppearanceVM(back);
    return null;
  }
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<Probe />);
  });
  return { current: () => vm, back };
}

it('外观意图调用容器控制器并持久化，连续选择保留其它字段', async () => {
  const probe = await mountVM();
  expect(
    probe.current().state.schemeOptions.find(option => option.key === 'system')
      ?.label,
  ).toBe('跟随系统');
  expect(probe.current().state.error).toBeNull();
  await ReactTestRenderer.act(async () => {
    probe.current().intents.setSkin('glass');
    probe.current().intents.setScheme('dark');
    probe.current().intents.setSize('l');
    await settings.flush();
  });
  expect(probe.current().state).toMatchObject({
    skin: 'glass',
    scheme: 'dark',
    readingSize: 'l',
    error: null,
  });
  const saved = createSettingsRepo(db);
  expect(await saved.get('ui.skin', '')).toBe('glass');
  expect(await saved.get('ui.scheme', '')).toBe('dark');
  expect(await saved.get('ui.readingSize', '')).toBe('l');
  const update = jest.spyOn(settings, 'update');
  await ReactTestRenderer.act(async () => {
    probe.current().intents.setSkin('unknown');
    probe.current().intents.setScheme('unknown');
    probe.current().intents.setSize('unknown');
    await settings.flush();
  });
  expect(update).not.toHaveBeenCalled();
  expect(settings.store.getState()).toEqual({
    skin: 'glass',
    scheme: 'dark',
    readingSize: 'l',
    error: null,
  });
  probe.current().intents.back();
  expect(probe.back).toHaveBeenCalledTimes(1);
});

it('保存失败由VM暴露错误文案，展示页以Note显示且保留已保存选项', async () => {
  await settings.update({ scheme: 'light' });
  const probe = await mountVM();
  await db.run(
    "CREATE TRIGGER reject_appearance BEFORE UPDATE ON setting WHEN NEW.key = 'ui.scheme' BEGIN SELECT RAISE(ABORT,'disk full'); END",
  );
  await ReactTestRenderer.act(async () => {
    probe.current().intents.setSkin('glass');
    await settings.flush();
  });
  expect(probe.current().state).toMatchObject({
    skin: 'paper',
    scheme: 'light',
    error: '外观设置没有保存，请重试',
  });
  await ReactTestRenderer.act(async () => {
    renderer!.update(
      <SkinProvider skinId="paper" scheme="light" reduceMotion>
        <MeAppearanceView {...probe.current()} />
      </SkinProvider>,
    );
  });
  expect(JSON.stringify(renderer!.toJSON())).toContain(
    '外观设置没有保存，请重试',
  );
});
