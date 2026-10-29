import { useEffect, useState } from 'react';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import Renderer, { act } from 'react-test-renderer';
import { Modal, StyleSheet, Text, TextInput } from 'react-native';
import { Sheet, SkinProvider, type SheetProps } from '@ui/kit';

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View, ScrollView } = require('react-native');
  const BottomSheet = React.forwardRef(
    (
      {
        children,
        handleComponent: Header,
        footerComponent: Footer,
        ...props
      }: any,
      ref: any,
    ) => {
      React.useImperativeHandle(ref, () => ({
        close: jest.fn(),
        snapToIndex: jest.fn(),
        expand: jest.fn(),
      }));
      return (
        <View testID="native-sheet" {...props}>
          {Header ? <Header /> : null}
          {children}
          {Footer ? <Footer animatedFooterPosition={{ value: 0 }} /> : null}
        </View>
      );
    },
  );
  BottomSheet.displayName = 'MockSheetWithFixedRegions';
  return {
    __esModule: true,
    default: BottomSheet,
    BottomSheetScrollView: ScrollView,
    BottomSheetFooter: View,
    useBottomSheetInternal: jest.fn(() => null),
  };
});
const renderers: ReactTestRenderer[] = [];
afterEach(async () => {
  await act(async () => renderers.forEach(renderer => renderer.unmount()));
  renderers.length = 0;
  jest
    .requireMock('@gorhom/bottom-sheet')
    .useBottomSheetInternal.mockReturnValue(null);
  jest.restoreAllMocks();
});
function flatten(node: ReactTestInstance) {
  return StyleSheet.flatten(
    typeof node.props.style === 'function'
      ? node.props.style({ pressed: false })
      : node.props.style,
  );
}
function insideBodyScroll(node: ReactTestInstance) {
  let ancestor = node.parent;
  while (ancestor) {
    if (ancestor.props.testID === 'sheet-scroll-body') return true;
    ancestor = ancestor.parent;
  }
  return false;
}
const actions: NonNullable<SheetProps['actions']> = [
  { label: '取消', kind: 'ghost', onPress: jest.fn() },
  { label: '保存', kind: 'primary', onPress: jest.fn() },
];
it.each(['light', 'dark'] as const)(
  'Apple %s pins header and actions around only the scrolling body',
  async scheme => {
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = Renderer.create(
        <SkinProvider skinId="glass" scheme={scheme} reduceMotion>
          <Sheet
            visible
            title="编辑笔记"
            subtitle="补充说明"
            actions={actions}
            onClose={jest.fn()}
          >
            <Text>正文内容</Text>
          </Sheet>
        </SkinProvider>,
      );
      renderers.push(renderer);
    });
    const header = renderer.root.findByProps({ testID: 'sheet-header' }),
      footer = renderer.root.findByProps({ testID: 'sheet-actions' }),
      body = renderer.root.findByProps({ testID: 'sheet-body' });
    expect(insideBodyScroll(header)).toBe(false);
    expect(insideBodyScroll(footer)).toBe(false);
    expect(insideBodyScroll(body)).toBe(true);
    expect(
      flatten(renderer.root.findByProps({ testID: 'sheet-grab' })),
    ).toMatchObject({ width: 36, height: 5, marginTop: 7, borderRadius: 3 });
    const title = renderer.root
      .findAllByType(Text)
      .find(node => node.props.children === '编辑笔记')!;
    expect(flatten(title.parent!)).toMatchObject({
      paddingTop: 10,
      paddingHorizontal: 52,
      paddingBottom: 8,
    });
    expect(flatten(title)).toMatchObject({
      fontSize: 17,
      lineHeight: 22.1,
      fontWeight: '600',
    });
    const close = renderer.root.findAll(
      node =>
        node.props.testID === 'sheet-close' &&
        typeof node.props.onPress === 'function',
    )[0];
    expect(flatten(close)).toMatchObject({
      width: 32,
      height: 32,
      right: 14,
      top: 6,
      borderRadius: 16,
    });
    expect(flatten(body)).toMatchObject({
      paddingTop: 4,
      paddingHorizontal: 18,
      paddingBottom: 6,
    });
    expect(flatten(footer)).toMatchObject({
      paddingTop: 12,
      paddingHorizontal: 16,
      paddingBottom: 18,
      gap: 8,
      flexDirection: 'column',
    });
    expect(footer.findAllByType(Text).map(node => node.props.children)).toEqual(
      ['保存', '取消'],
    );
    const sheet = renderer.root.findByProps({ testID: 'native-sheet' });
    expect(sheet.props).toMatchObject({
      detached: true,
      bottomInset: 8,
      keyboardBehavior: 'interactive',
      keyboardBlurBehavior: 'restore',
      android_keyboardInputMode: 'adjustResize',
    });
    const scroll = renderer.root.findAll(
      node => node.props.testID === 'sheet-scroll-body',
    )[0];
    expect(scroll.props).toMatchObject({
      enableFooterMarginAdjustment: true,
      keyboardShouldPersistTaps: 'handled',
      keyboardDismissMode: 'interactive',
      automaticallyAdjustKeyboardInsets: true,
      showsVerticalScrollIndicator: false,
    });
  },
);
it('Paper keeps its grab, title, body and horizontal actions in the same scrolling content', async () => {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = Renderer.create(
      <SkinProvider skinId="paper" scheme="light" reduceMotion>
        <Sheet
          visible
          title="编辑笔记"
          subtitle="补充说明"
          actions={actions}
          onClose={jest.fn()}
        >
          <Text>正文内容</Text>
        </Sheet>
      </SkinProvider>,
    );
    renderers.push(renderer);
  });
  for (const testID of ['sheet-header', 'sheet-body', 'sheet-actions'])
    expect(insideBodyScroll(renderer.root.findByProps({ testID }))).toBe(true);
  expect(
    flatten(renderer.root.findByProps({ testID: 'sheet-grab' })),
  ).toMatchObject({
    width: 36,
    height: 4,
    marginTop: 8,
    borderRadius: 2,
    backgroundColor: '#DDD',
  });
  expect(
    flatten(renderer.root.findByProps({ testID: 'sheet-body' })),
  ).toMatchObject({ paddingTop: 4, paddingHorizontal: 16, paddingBottom: 8 });
  expect(
    flatten(renderer.root.findByProps({ testID: 'sheet-actions' })),
  ).toMatchObject({
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 8,
    flexDirection: 'row',
  });
  expect(renderer.root.findAllByProps({ testID: 'sheet-close' })).toHaveLength(
    0,
  );
});
function Draft({ mount, unmount }: { mount(): void; unmount(): void }) {
  const [value, setValue] = useState('');
  useEffect(() => {
    mount();
    return unmount;
  }, [mount, unmount]);
  return (
    <TextInput
      testID="kept-sheet-draft"
      value={value}
      onChangeText={setValue}
    />
  );
}
it('changing scroll policy and scheme preserves the body subtree, input draft and open state', async () => {
  const mount = jest.fn(),
    unmount = jest.fn(),
    onClose = jest.fn();
  const tree = (skinId: 'paper' | 'glass', scheme: 'light' | 'dark') => (
    <SkinProvider skinId={skinId} scheme={scheme} reduceMotion>
      <Sheet visible title="保留草稿" actions={actions} onClose={onClose}>
        <Draft mount={mount} unmount={unmount} />
      </Sheet>
    </SkinProvider>
  );
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = Renderer.create(tree('paper', 'light'));
    renderers.push(renderer);
  });
  const input = () => renderer.root.findByProps({ testID: 'kept-sheet-draft' });
  await act(async () => input().props.onChangeText('正文草稿'));
  for (const [skin, scheme] of [
    ['glass', 'light'],
    ['glass', 'dark'],
    ['paper', 'dark'],
    ['paper', 'light'],
  ] as const) {
    await act(async () => renderer.update(tree(skin, scheme)));
    expect(input().props.value).toBe('正文草稿');
    expect(renderer.root.findByType(Modal).props.visible).toBe(true);
  }
  expect(mount).toHaveBeenCalledTimes(1);
  expect(unmount).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
});

it('registers ordinary TextInput focus with the sheet keyboard state while preserving input handlers', async () => {
  let state: { target?: number } = {};
  const context = {
    textInputNodesRef: { current: new Set<number>() },
    animatedKeyboardState: {
      get: () => state,
      set: (update: (current: typeof state) => typeof state) => {
        state = update(state);
      },
    },
  };
  jest
    .requireMock('@gorhom/bottom-sheet')
    .useBottomSheetInternal.mockReturnValue(context);
  jest
    .spyOn(TextInput.State, 'currentlyFocusedInput')
    .mockReturnValue(undefined);
  const onFocus = jest.fn(),
    onClose = jest.fn();
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = Renderer.create(
      <SkinProvider skinId="glass" scheme="light" reduceMotion>
        <Sheet visible title="编辑" onClose={onClose}>
          <TextInput testID="ordinary-input" onFocus={onFocus} />
        </Sheet>
      </SkinProvider>,
    );
    renderers.push(renderer);
  });
  const content = renderer.root.findAll(
    node =>
      node.props.testID === 'sheet-content' &&
      typeof node.props.onFocusCapture === 'function',
  )[0];
  await act(async () =>
    content.props.onFocusCapture({ nativeEvent: { target: 101 } }),
  );
  expect(state.target).toBe(101);
  expect(context.textInputNodesRef.current.has(101)).toBe(true);
  expect(
    renderer.root.findByProps({ testID: 'ordinary-input' }).props.onFocus,
  ).toBe(onFocus);
  await act(async () => {
    content.props.onFocusCapture({ nativeEvent: { target: 102 } });
    content.props.onBlurCapture({ nativeEvent: { target: 101 } });
  });
  expect(state.target).toBe(102);
  await act(async () =>
    content.props.onBlurCapture({ nativeEvent: { target: 102 } }),
  );
  expect(state.target).toBeUndefined();
  expect(
    flatten(renderer.root.findByProps({ testID: 'sheet-bottom-space' })),
  ).toMatchObject({ height: 16 });
  const close = renderer.root.findAll(
    node =>
      node.props.testID === 'sheet-close' &&
      typeof node.props.onPress === 'function',
  )[0];
  await act(async () => close.props.onPress());
  expect(onClose).toHaveBeenCalledTimes(1);
  await act(async () => renderer.unmount());
  expect(context.textInputNodesRef.current.size).toBe(0);
});
