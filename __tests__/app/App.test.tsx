import ReactTestRenderer, { act } from 'react-test-renderer';
import App from '../../src/App';
import { createTestContainer, createTestDemoContainer } from '@app/testing';
import { TabBar, AppBar } from '@ui/kit';

jest.mock('@app/dev/nativeSmoke', () => ({ runNativePdfSmoke: jest.fn() }));
jest.mock('@app/dev/acceptanceSetup', () => ({
  loadAcceptanceCredentials: jest.fn(),
}));
jest.mock('@app/dev/realStudySmoke', () => ({
  runRealStudySmoke: jest.fn(),
}));

jest.mock('@data/drivers/opSqlite', () => ({
  openDeviceDb: jest.fn(() =>
    jest.requireActual('@data/drivers/nodeSqlite').openMemoryDb(),
  ),
}));

const settle = () => new Promise(resolve => setTimeout(resolve, 100));
it('starts at an empty real shelf, opens settings, enters an isolated Demo library and returns', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  const device = await createTestContainer();
  const bootstrap = () => Promise.resolve(device);
  try {
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <App bootstrap={bootstrap} demoBootstrap={createTestDemoContainer} />,
      );
      await settle();
    });
    expect(JSON.stringify(renderer.toJSON())).toContain('导入第一本书');
    await act(async () => {
      renderer.root.findByType(TabBar).props.onSelect('Me');
      await settle();
    });
    const press = async (label: string) => {
      const node = renderer.root.findAll(
        n =>
          (n.props.accessibilityLabel === label ||
            n.props.title === label ||
            n.props.label === label) &&
          typeof n.props.onPress === 'function',
      )[0];
      expect(node).toBeDefined();
      await act(async () => {
        node.props.onPress();
        await settle();
      });
    };
    await press('外观');
    expect(JSON.stringify(renderer.toJSON())).toContain('皮肤');
    await act(async () => {
      renderer.root.findAllByType(AppBar).at(-1)!.props.onBack();
      await settle();
    });
    await press('关于 Pagewise');
    await act(async () => {
      renderer.root
        .findAll(
          n =>
            n.props.accessibilityLabel === '版本号，长按打开开发工具' &&
            typeof n.props.onLongPress === 'function',
        )[0]
        .props.onLongPress();
      await settle();
    });
    await press('体验演示书库');
    expect(JSON.stringify(renderer.toJSON())).toContain('3.5.2 A*搜索');
    expect(await device.repos.books.list()).toEqual([]);
    await act(async () => {
      renderer.root.findByType(TabBar).props.onSelect('Me');
      await settle();
    });
    await press('关于 Pagewise');
    await press('退出演示');
    expect(JSON.stringify(renderer.toJSON())).toContain('导入第一本书');
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    await device.close();
  }
});
