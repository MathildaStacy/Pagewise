import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Platform,
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

it.each(['light', 'dark'] as const)(
  'Android %s uses the translucent fill for surfaces and scrolled headers',
  async scheme => {
    const platform = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      const renderer = await mount(
        <>
          <Kit.Glass strength="strong">
            <Text>材质内容</Text>
          </Kit.Glass>
          <Kit.AppBar title="标题" variant="root" scrollY={80} />
        </>,
        { skinId: 'glass', scheme, blurEnabled: true, reduceMotion: true },
      );
      for (const testID of ['glass-blur', 'glass-appbar-blur']) {
        expect(renderer.root.findAllByProps({ testID })).toHaveLength(0);
      }
      const surface = renderer.root.findAll(
        node =>
          node.props.accessibilityLabel === '材质容器' &&
          node.props.style !== undefined,
      )[0];
      expect(flattened(surface).backgroundColor).toBe(
        skins.glass.tokens[scheme].color.glassStrong,
      );
      const header = renderer.root.findAllByProps({
        testID: 'glass-appbar-material',
      })[0];
      expect(flattened(header).overflow).toBe('hidden');
    } finally {
      platform.restore();
    }
  },
);

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

it.each(['paper', 'glass'] as const)(
  '%s keeps prototype button geometry with enlarged touch bounds',
  async skinId => {
    const onPress = jest.fn();
    const renderer = await mount(
      <>
        <Kit.Button label="主操作" onPress={onPress} />
        <Kit.Button label="小操作" size="sm" onPress={onPress} />
        <Kit.ModeSwitch value="listen" onChange={onPress} />
      </>,
      { skinId, scheme: 'light', reduceMotion: true },
    );
    for (const [label, height] of [
      ['主操作', skinId === 'paper' ? 42 : 50],
      ['小操作', skinId === 'paper' ? 30 : 34],
    ] as const) {
      const control = renderer.root.findAll(
        n =>
          n.props.accessibilityRole === 'button' &&
          n.props.accessibilityLabel === label &&
          n.props.style,
      )[0];
      expect(flattened(control).minHeight).toBe(height);
      const inset =
        typeof control.props.hitSlop === 'number' ? control.props.hitSlop : 0;
      expect(height + inset * 2).toBeGreaterThanOrEqual(48);
    }
    const expected = skinId === 'paper' ? ['伴读', '原文'] : ['读书', '听讲'];
    for (const label of expected)
      expect(
        renderer.root.findAll(
          n =>
            n.props.accessibilityRole === 'radio' &&
            n.props.accessibilityLabel === label,
        ).length,
      ).toBeGreaterThan(0);
  },
);

it.each([1, 2])(
  'glass mode supports %s font scale and preserves mode action',
  async fontScale => {
    const change = jest.fn();
    const renderer = await mount(
      <Kit.ModeSwitch value="listen" onChange={change} />,
      { skinId: 'glass', scheme: 'light', fontScale, reduceMotion: true },
    );
    const mode = renderer.root.findByProps({ testID: 'glass-mode-switch' });
    expect(flattened(mode).width).toBeGreaterThanOrEqual(96);
    const read = mode.findAll(
      n =>
        n.props.accessibilityRole === 'radio' &&
        n.props.accessibilityLabel === '读书' &&
        typeof n.props.onPress === 'function',
    )[0];
    await act(async () => read.props.onPress());
    expect(change).toHaveBeenCalledWith('read');
    expect(read.findAllByType(Text)[0].props.allowFontScaling).not.toBe(false);
  },
);
