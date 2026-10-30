import Renderer, { act } from 'react-test-renderer';
import { TextInput } from 'react-native';
import { useContainer } from '@app/ContainerProvider';
import type { Container } from '@app/container';
import { createTestDemoContainer } from '@app/testing';
import { useAppNav } from '@features/nav';
import {
  ReviewScreen,
  ReviewSessionScreen,
} from '@features/review/ReviewScreens';
import { Button, Segmented, Sheet, SkinProvider } from '@ui/kit';

jest.mock('@app/ContainerProvider', () => ({ useContainer: jest.fn() }));
jest.mock('@features/nav', () => ({ useAppNav: jest.fn() }));
let c: Container, renderer: Renderer.ReactTestRenderer;
const nav = {
  open: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  enterDemo: jest.fn(),
  exitDemo: jest.fn(),
};
const settle = () => new Promise(resolve => setImmediate(resolve));
beforeEach(async () => {
  c = await createTestDemoContainer();
  jest.mocked(useContainer).mockReturnValue(c);
  jest.mocked(useAppNav).mockReturnValue(nav);
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
  await c.close();
});
async function press(label: string) {
  const button = renderer.root
    .findAllByType(Button)
    .find(item => item.props.children === label || item.props.label === label)!;
  expect(button).toBeDefined();
  expect(button.props.disabled).not.toBe(true);
  await act(async () => {
    button.props.onPress();
    await settle();
  });
}
it.each([
  ['paper', 'light'],
  ['paper', 'dark'],
  ['glass', 'light'],
  ['glass', 'dark'],
] as const)(
  '%s/%s keeps management, editing, suspension and recovery reachable',
  async (skin, scheme) => {
    await act(async () => {
      renderer = Renderer.create(
        <SkinProvider skinId={skin} scheme={scheme} reduceMotion>
          <ReviewScreen />
        </SkinProvider>,
      );
      await settle();
    });
    await press('管理闪卡');
    const card = (await c.repos.cards.list())[0];
    const pause = () =>
      renderer.root
        .findAllByType(Button)
        .find(
          item => item.props.accessibilityLabel === `暂停闪卡：${card.front}`,
        )!;
    await act(async () => {
      pause().props.onPress();
      await settle();
    });
    await act(async () =>
      renderer.root.findByType(Segmented).props.onChange('suspended'),
    );
    const resume = renderer.root
      .findAllByType(Button)
      .find(item => item.props.children === '恢复复习')!;
    expect(resume).toBeDefined();
    const edit = renderer.root
      .findAllByType(Button)
      .find(item => item.props.children === '编辑')!;
    await act(async () => edit.props.onPress());
    expect(
      renderer.root
        .findAllByType(Sheet)
        .find(item => item.props.title === '编辑闪卡')?.props.visible,
    ).toBe(true);
    const answer = renderer.root
      .findAllByType(TextInput)
      .find(item => item.props.accessibilityLabel === '答案')!;
    expect(answer.props.multiline).toBe(true);
    await act(async () => answer.props.onChangeText('在管理中修订的答案'));
    await press('保存修改');
    expect((await c.repos.cards.get(card.id))?.back).toBe('在管理中修订的答案');
    await press('恢复复习');
    expect((await c.repos.cards.get(card.id))?.suspended).toBe(false);
    expect(await c.db.all('SELECT * FROM review_log')).toEqual([]);
  },
);
it('the session exposes editing and an undo action before the first flip and on the finished view', async () => {
  const card = (await c.repos.cards.due(c.clock.today(), 1))[0];
  await act(async () => {
    renderer = Renderer.create(
      <SkinProvider skinId="paper" scheme="light" reduceMotion>
        <ReviewSessionScreen limit={1} />
      </SkinProvider>,
    );
    await settle();
  });
  await press('编辑卡片');
  await press('取消');
  await press('暂停这张卡');
  expect((await c.repos.cards.get(card.id))?.suspended).toBe(true);
  await press('撤回暂停');
  expect((await c.repos.cards.get(card.id))?.suspended).toBe(false);
  expect(await c.db.all('SELECT * FROM review_log')).toEqual([]);
});
