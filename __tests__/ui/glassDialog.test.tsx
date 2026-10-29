import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import Renderer, { act } from 'react-test-renderer';
import { Modal, StyleSheet, Text } from 'react-native';
import { Dialog, SkinProvider } from '@ui/kit';

const renderers: ReactTestRenderer[] = [];
afterEach(async () => {
  await act(async () => {
    renderers.forEach(renderer => renderer.unmount());
  });
  renderers.length = 0;
});
function style(node: ReactTestInstance, pressed = false) {
  return StyleSheet.flatten(
    typeof node.props.style === 'function'
      ? node.props.style({ pressed })
      : node.props.style,
  );
}
function buttons(renderer: ReactTestRenderer, label: string) {
  return renderer.root.findAll(
    n =>
      n.props.accessibilityRole === 'button' &&
      n.props.accessibilityLabel === label &&
      typeof n.props.onPress === 'function',
  );
}
it.each(['light', 'dark'] as const)(
  'matches the Apple alert layout and destructive confirmation in %s mode',
  async scheme => {
    const confirm = jest.fn(),
      cancel = jest.fn();
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = Renderer.create(
        <SkinProvider skinId="glass" scheme={scheme} reduceMotion>
          <Dialog
            visible
            title="删除这个服务？"
            body="保存的 API Key 和模型分配也会移除。"
            confirm="删除服务"
            cancel="取消"
            danger
            onConfirm={confirm}
            onCancel={cancel}
          />
        </SkinProvider>,
      );
      renderers.push(renderer);
    });
    expect(
      style(renderer.root.findByProps({ testID: 'glass-dialog-card' })),
    ).toMatchObject({ maxWidth: 300, width: '100%', borderRadius: 28 });
    const title = renderer.root
      .findAllByType(Text)
      .find(n => n.props.children === '删除这个服务？')!;
    expect(style(title)).toMatchObject({
      fontSize: 17,
      lineHeight: 22.1,
      fontWeight: '600',
      paddingTop: 20,
      paddingHorizontal: 18,
      paddingBottom: 2,
    });
    const body = renderer.root
      .findAllByType(Text)
      .find(n => n.props.children === '保存的 API Key 和模型分配也会移除。')!;
    expect(style(body)).toMatchObject({
      fontSize: 13,
      lineHeight: 20.150000000000002,
      paddingTop: 6,
      paddingHorizontal: 18,
      paddingBottom: 18,
    });
    const deletion = buttons(renderer, '删除服务')[0],
      cancellation = buttons(renderer, '取消')[0];
    expect(style(deletion)).toMatchObject({
      minHeight: 46,
      borderLeftWidth: 0.5,
    });
    expect(style(cancellation)).toMatchObject({ minHeight: 46 });
    const deletionText = deletion.findByType(Text);
    expect(style(deletionText)).toMatchObject({
      color: scheme === 'light' ? '#FF3B30' : '#FF453A',
      fontWeight: '600',
    });
    expect(
      style(renderer.root.findByProps({ testID: 'glass-dialog-actions' })),
    ).toMatchObject({ borderTopWidth: 0.5, flexDirection: 'row' });
    await act(async () => {
      deletion.props.onPress();
      cancellation.props.onPress();
      buttons(renderer, '关闭对话框')[0].props.onPress();
    });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(renderer.root.findByType(Modal).props.onRequestClose).toBe(cancel);
  },
);
it('supports a single action, hides immediately with reduced motion and reopens the same dialog', async () => {
  const props = {
    title: '已保存',
    body: '服务设置已保存在本机。',
    confirm: '好',
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
  };
  const tree = (visible: boolean) => (
    <SkinProvider skinId="glass" scheme="light" reduceMotion>
      <Dialog visible={visible} {...props} />
    </SkinProvider>
  );
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = Renderer.create(tree(true));
    renderers.push(renderer);
  });
  expect(style(buttons(renderer, '好')[0]).borderLeftWidth).toBeUndefined();
  await act(async () => renderer.update(tree(false)));
  expect(renderer.root.findByType(Modal).props.visible).toBe(false);
  await act(async () => renderer.update(tree(true)));
  expect(renderer.root.findByType(Modal).props.visible).toBe(true);
  expect(style(buttons(renderer, '好')[0]).minHeight).toBe(46);
});
