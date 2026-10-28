import { useEffect, useState } from 'react';
import * as ReactNative from 'react-native';
import {
  AccessibilityInfo,
  Modal,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import ReactTestRenderer, {
  act,
  type ReactTestInstance,
} from 'react-test-renderer';
import {
  SkinProvider,
  type SkinProviderProps,
} from '../../src/ui/kit/SkinProvider';
import { useTokens } from '../../src/ui/kit/context';
import { skins } from '../../src/ui/skins';
import * as Kit from '../../src/ui/kit/proxy';
import { makeComponentSamples } from './helpers/props';

const renderers = new Set<ReactTestRenderer.ReactTestRenderer>();
beforeAll(() => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(false);
  jest
    .spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled')
    .mockResolvedValue(false);
});
afterEach(async () => {
  await act(async () => {
    for (const renderer of renderers) renderer.unmount();
  });
  renderers.clear();
});
afterAll(() => jest.restoreAllMocks());
async function mount(children: React.ReactNode, props: SkinProviderProps) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <SkinProvider {...props}>{children}</SkinProvider>,
    );
  });
  renderers.add(renderer);
  return renderer;
}
function flattened(node: ReactTestInstance) {
  const style =
    typeof node.props.style === 'function'
      ? node.props.style({ pressed: false })
      : node.props.style;
  return StyleSheet.flatten(style) ?? {};
}
function StatefulDraft({
  onMount,
  onUnmount,
}: {
  onMount(): void;
  onUnmount(): void;
}) {
  const [draft, setDraft] = useState('');
  const tokens = useTokens();
  useEffect(() => {
    onMount();
    return onUnmount;
  }, [onMount, onUnmount]);
  return (
    <TextInput
      testID="sheet-draft"
      accessibilityLabel="浮层草稿"
      value={draft}
      onChangeText={setDraft}
      style={[tokens.type.body, { color: tokens.color.ink }]}
    />
  );
}

it('打开的 Sheet 切换 paper/light → glass/dark → paper/dark，草稿、可见性和子树身份保留', async () => {
  const onMount = jest.fn();
  const onUnmount = jest.fn();
  const onClose = jest.fn();
  const tree = (skinId: 'paper' | 'glass', scheme: 'light' | 'dark') => (
    <SkinProvider skinId={skinId} scheme={scheme} reduceMotion>
      <Kit.Sheet visible title="有草稿的浮层" onClose={onClose}>
        <StatefulDraft onMount={onMount} onUnmount={onUnmount} />
      </Kit.Sheet>
    </SkinProvider>
  );
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(tree('paper', 'light'));
  });
  renderers.add(renderer);
  const input = () => renderer.root.findByProps({ testID: 'sheet-draft' });
  const color = () => flattened(input()).color;
  expect(color()).toBe(skins.paper.tokens.light.color.ink);
  await act(async () => input().props.onChangeText('切换皮肤后仍保留这段草稿'));
  await act(async () => renderer.update(tree('glass', 'dark')));
  expect(input().props.value).toBe('切换皮肤后仍保留这段草稿');
  expect(color()).toBe(skins.glass.tokens.dark.color.ink);
  expect(renderer.root.findByType(Modal).props.visible).toBe(true);
  await act(async () => renderer.update(tree('paper', 'dark')));
  expect(input().props.value).toBe('切换皮肤后仍保留这段草稿');
  expect(color()).toBe(skins.paper.tokens.dark.color.ink);
  expect(renderer.root.findByType(Modal).props.visible).toBe(true);
  expect(onMount).toHaveBeenCalledTimes(1);
  expect(onUnmount).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
});

it('blurEnabled=false 有稳定填充且不挂载原生 blur', async () => {
  const renderer = await mount(
    <Kit.Glass strength="strong">
      <Text>材质内容</Text>
    </Kit.Glass>,
    { skinId: 'glass', scheme: 'light', blurEnabled: true, reduceMotion: true },
  );
  expect(
    renderer.root.findAllByProps({ testID: 'glass-blur' }).length,
  ).toBeGreaterThan(0);
  await act(async () =>
    renderer.update(
      <SkinProvider
        skinId="glass"
        scheme="light"
        blurEnabled={false}
        reduceMotion
      >
        <Kit.Glass strength="strong">
          <Text>材质内容</Text>
        </Kit.Glass>
      </SkinProvider>,
    ),
  );
  expect(renderer.root.findAllByProps({ testID: 'glass-blur' })).toHaveLength(
    0,
  );
  const surface = renderer.root.findAll(
    node =>
      node.props.accessibilityLabel === '材质容器' &&
      node.props.style !== undefined,
  )[0];
  expect(flattened(surface).backgroundColor).toBe(
    skins.glass.tokens.light.color.glassStrong,
  );
});

it.each(['paper', 'glass'] as const)(
  '%s 的 reduceMotion=true 禁用浮层进出与初始移动动画',
  async skinId => {
    const props = makeComponentSamples().Sheet;
    const renderer = await mount(<Kit.Sheet {...props} />, {
      skinId,
      scheme: 'light',
      reduceMotion: true,
    });
    expect(renderer.root.findByType(Modal).props.animationType).toBe('none');
    expect(
      renderer.root.findAll(node => node.props.animateOnMount === false).length,
    ).toBeGreaterThan(0);
  },
);

for (const skinId of ['paper', 'glass'] as const) {
  it(`${skinId} 2倍字号保留字体缩放和完整标签，按钮/行/快捷chip至少48dp`, async () => {
    const samples = makeComponentSamples();
    const longLabel = '这是放大到两倍后仍需要完整显示的按钮文字';
    const renderer = await mount(
      <>
        <Kit.AppBar {...samples.AppBar} />
        <Kit.Button {...samples.Button} label={longLabel} size="block" />
        <Kit.QuickActions
          items={[{ key: 'long', label: longLabel, kind: 'primary' }]}
          onPress={jest.fn()}
        />
        <Kit.Row {...samples.Row} title={longLabel} />
        <Kit.CheckRow {...samples.CheckRow} />
        <Kit.Composer {...samples.Composer} />
        <Kit.ModeSwitch {...samples.ModeSwitch} />
        <Kit.Segmented {...samples.Segmented} />
        <Kit.StepProgress {...samples.StepProgress} />
        <Kit.CiteChip {...samples.CiteChip} />
        <Kit.TabBar {...samples.TabBar} />
      </>,
      { skinId, scheme: 'light', fontScale: 2, reduceMotion: true },
    );
    const texts = renderer.root.findAllByType(Text);
    for (const text of texts) {
      expect(text.props.allowFontScaling).not.toBe(false);
      expect(text.props.numberOfLines ?? 0).toBe(0);
      expect(
        text.props.maxFontSizeMultiplier === undefined ||
          text.props.maxFontSizeMultiplier >= 2,
      ).toBe(true);
    }
    const longTexts = texts.filter(text => text.props.children === longLabel);
    expect(longTexts.length).toBeGreaterThanOrEqual(2);
    expect(
      longTexts.some(
        text =>
          flattened(text).fontSize ===
          skins[skinId].tokens.light.type.label.fontSize * 2,
      ),
    ).toBe(true);
    const controls = renderer.root.findAll(
      node =>
        ['button', 'radio', 'link', 'checkbox', 'tab'].includes(
          node.props.accessibilityRole,
        ) &&
        node.props.style !== undefined &&
        typeof node.props.onPress === 'function',
    );
    expect(controls.length).toBeGreaterThan(10);
    for (const control of controls) {
      const style = flattened(control);
      expect({
        label: control.props.accessibilityLabel,
        minHeight: style.minHeight,
      }).toEqual({ label: expect.any(String), minHeight: expect.any(Number) });
      expect(style.minHeight).toBeGreaterThanOrEqual(48);
      expect(style.height).toBeUndefined();
    }
  });
}

it.each([
  { previewScale: 1, systemScale: 1 },
  { previewScale: 2, systemScale: 1 },
  { previewScale: 1, systemScale: 2 },
])(
  'glass push顶栏给完整模式标签留宽，预览$previewScale倍/系统$systemScale倍时可整体换行',
  async ({ previewScale, systemScale }) => {
    const dimensions = jest
      .spyOn(ReactNative, 'useWindowDimensions')
      .mockReturnValue({
        width: 320,
        height: 800,
        scale: 1,
        fontScale: systemScale,
      });
    try {
      const onChange = jest.fn();
      const renderer = await mount(
        <Kit.AppBar
          variant="push"
          title="3.5.2 A*搜索"
          subtitle="人工智能：现代方法"
          backLabel="地图"
          onBack={jest.fn()}
          right={<Kit.ModeSwitch value="listen" onChange={onChange} />}
        />,
        {
          skinId: 'glass',
          scheme: 'dark',
          fontScale: previewScale,
          reduceMotion: true,
        },
      );
      const mode = renderer.root.findByProps({ testID: 'glass-mode-switch' });
      const group = mode.find(
        node => node.props.accessibilityRole === 'radiogroup',
      );
      const trackPadding = flattened(group).padding as number;
      const allocatedOptionWidth =
        ((flattened(mode).minWidth as number) - trackPadding * 2) / 2;
      for (const label of ['读书', '听讲']) {
        const button = mode.findAll(
          node =>
            node.props.accessibilityRole === 'radio' &&
            node.props.accessibilityLabel === label &&
            node.props.style !== undefined,
        )[0];
        const text = button
          .findAllByType(Text)
          .find(node => node.props.children === label)!;
        const labelWidth =
          (flattened(text).fontSize as number) *
          systemScale *
          Array.from(label).length;
        const usableWidth =
          allocatedOptionWidth -
          (flattened(button).paddingHorizontal as number) * 2;
        expect(usableWidth).toBeGreaterThanOrEqual(labelWidth);
        expect(text.props.numberOfLines).toBeUndefined();
      }
      const content = flattened(
        renderer.root.findByProps({ testID: 'glass-appbar-content' }),
      );
      const actions = flattened(
        renderer.root.findByProps({ testID: 'glass-appbar-actions' }),
      );
      expect(content.flexWrap).toBe('wrap');
      expect(actions).toMatchObject({
        flexShrink: 0,
        marginLeft: 'auto',
        maxWidth: '100%',
      });
      const read = mode.findAll(
        node =>
          node.props.accessibilityRole === 'radio' &&
          node.props.accessibilityLabel === '读书' &&
          typeof node.props.onPress === 'function',
      )[0];
      await act(async () => read.props.onPress());
      expect(onChange).toHaveBeenCalledWith('read');
    } finally {
      dimensions.mockRestore();
    }
  },
);
