import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import {
  AppBar,
  Icon,
  Screen,
  Segmented,
  SkinProvider,
  useTokens,
} from '@ui/kit';
import {
  MeView,
  SettingsButton,
  SettingsField,
  SettingsSegmented,
} from '@ui/screens/MeView';
import { MePrefsView } from '@ui/screens/MePrefsView';
import { MeAppearanceView } from '@ui/screens/MeAppearanceView';
import { AboutView } from '@ui/screens/AboutView';
import {
  aboutSamples,
  meSamples,
  prefsSamples,
} from '@features/settings/samples';
import type { AppearanceState } from '@features/appearance/types';

let renderer: Renderer.ReactTestRenderer;
const contains = (
  parent: Renderer.ReactTestInstance,
  child: Renderer.ReactTestInstance,
) => {
  let node = child.parent;
  while (node) {
    if (node === parent) return true;
    node = node.parent;
  }
  return false;
};
const opacity = (node: Renderer.ReactTestInstance) => {
  const value = StyleSheet.flatten(node.props.style).opacity;
  return typeof value === 'object' ? value.__getValue() : value;
};
afterEach(async () => {
  await act(async () => renderer?.unmount());
});
const appearance: AppearanceState = {
  error: null,
  skin: 'paper',
  scheme: 'system',
  readingSize: 'm',
  skinOptions: [
    { key: 'paper', label: '纸感' },
    { key: 'glass', label: '苹果风' },
  ],
  schemeOptions: [
    { key: 'system', label: '跟随系统' },
    { key: 'light', label: '浅色' },
    { key: 'dark', label: '深色' },
  ],
  sizeOptions: [
    { key: 's', label: '小' },
    { key: 'm', label: '中' },
    { key: 'l', label: '大' },
  ],
};
function ReadingTokens() {
  const t = useTokens();
  return (
    <>
      <Text testID="ai-reading-sample" style={t.type.aiBody}>
        讲解示例
      </Text>
      <Text testID="book-reading-sample" style={t.type.bookBody}>
        原书示例
      </Text>
      <Text testID="interface-sample" style={t.type.body}>
        界面文字
      </Text>
    </>
  );
}

it.each([
  ['glass', 's', 1, 15, 15, 1.65, 1.85, 17],
  ['glass', 'm', 1, 17, 17, 1.65, 1.85, 17],
  ['glass', 'l', 1, 19, 19.5, 1.65, 1.85, 17],
  ['glass', 'l', 1.3, 19, 19.5, 1.65, 1.85, 17],
  ['paper', 's', 1, 14.72, 15.18, 1.78, 1.9, 14],
  ['paper', 'm', 1, 16, 16.5, 1.78, 1.9, 14],
  ['paper', 'l', 1, 18, 18.5625, 1.78, 1.9, 14],
] as const)(
  '%s size %s with scale %s follows its reading sizes and preserves interface type',
  async (skin, size, scale, ai, book, aiLine, bookLine, body) => {
    await act(async () => {
      renderer = Renderer.create(
        <SkinProvider
          skinId={skin}
          scheme="light"
          readingSize={size}
          fontScale={scale}
          reduceMotion
        >
          <ReadingTokens />
        </SkinProvider>,
      );
    });
    const sample = (testID: string) =>
      StyleSheet.flatten(renderer.root.findByProps({ testID }).props.style);
    expect(sample('ai-reading-sample').fontSize).toBeCloseTo(ai * scale);
    expect(sample('ai-reading-sample').lineHeight).toBeCloseTo(
      ai * scale * aiLine,
    );
    expect(sample('book-reading-sample').fontSize).toBeCloseTo(book * scale);
    expect(sample('book-reading-sample').lineHeight).toBeCloseTo(
      book * scale * bookLine,
    );
    expect(sample('interface-sample').fontSize).toBeCloseTo(body * scale);
  },
);

it('Apple settings use the shared sliding segmented control and preserve the setting callback', async () => {
  const change = jest.fn();
  await act(async () => {
    renderer = Renderer.create(
      <SkinProvider skinId="glass" scheme="light" reduceMotion>
        <SettingsSegmented
          value="m"
          options={appearance.sizeOptions}
          onChange={change}
          label="正文字号"
        />
      </SkinProvider>,
    );
  });
  expect(renderer.root.findByType(Segmented).props.value).toBe('m');
  const selected = renderer.root.findAll(
    n =>
      n.props.accessibilityRole === 'radio' &&
      n.props.accessibilityLabel === '中' &&
      typeof n.props.onPress === 'function',
  )[0];
  expect(selected.props.accessibilityState.checked).toBe(true);
  const large = renderer.root.findAll(
    n =>
      n.props.accessibilityRole === 'radio' &&
      n.props.accessibilityLabel === '大' &&
      typeof n.props.onPress === 'function',
  )[0];
  await act(async () => large.props.onPress());
  expect(change).toHaveBeenCalledTimes(1);
  expect(change).toHaveBeenCalledWith('l');
});

it('switching skins keeps a scrolling settings draft mounted and preserves its scroll state', async () => {
  const mounted = jest.fn();
  const unmounted = jest.fn();
  function Draft() {
    const [value, setValue] = useState('');
    useEffect(() => {
      mounted();
      return unmounted;
    }, []);
    return <SettingsField label="名称" value={value} onChange={setValue} />;
  }
  const tree = (skin: 'paper' | 'glass', scheme: 'light' | 'dark') => (
    <SkinProvider skinId={skin} scheme={scheme} reduceMotion>
      <Screen scroll>
        <AppBar title="编辑服务" variant="push" onBack={jest.fn()} />
        <Draft />
      </Screen>
    </SkinProvider>
  );
  await act(async () => {
    renderer = Renderer.create(tree('paper', 'light'));
  });
  await act(async () => {
    renderer.root
      .findByType(TextInput)
      .props.onChangeText('保留输入的服务名称');
    renderer.root.findByType(ScrollView).props.onScroll({
      nativeEvent: { contentOffset: { y: 63 } },
    });
  });
  for (const [skin, scheme] of [
    ['glass', 'dark'],
    ['paper', 'dark'],
  ] as const) {
    await act(async () => renderer.update(tree(skin, scheme)));
    expect(renderer.root.findByType(TextInput).props.value).toBe(
      '保留输入的服务名称',
    );
    expect(renderer.root.findByType(AppBar).props.scrollY).toBe(63);
    expect(
      renderer.root.findAllByProps({ testID: 'glass-appbar-large-title' }),
    ).toHaveLength(0);
    const scroll = renderer.root.findByType(ScrollView);
    expect(
      StyleSheet.flatten(scroll.props.contentContainerStyle).paddingTop,
    ).toBe(skin === 'glass' ? 44 : undefined);
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(unmounted).not.toHaveBeenCalled();
  }
});

it.each(['paper', 'glass'] as const)(
  '%s preserves the prototype title, setting icons and compact visible buttons',
  async skin => {
    await act(async () => {
      renderer = Renderer.create(
        <SkinProvider skinId={skin} scheme="light" reduceMotion>
          <MeView
            state={meSamples.normal}
            intents={{ open: jest.fn(), refresh: jest.fn() }}
          />
          <SettingsButton label="普通操作" onPress={jest.fn()} />
          <SettingsButton small label="更新 Token" onPress={jest.fn()} />
          <SettingsField label="名称" value="" onChange={jest.fn()} />
        </SkinProvider>,
      );
    });
    const title = renderer.root
      .findAllByType(Text)
      .find(
        n =>
          n.props.children === '我的' &&
          StyleSheet.flatten(n.props.style).fontSize ===
            (skin === 'glass' ? 34 : 20),
      )!;
    expect(StyleSheet.flatten(title.props.style)).toMatchObject({
      fontSize: skin === 'glass' ? 34 : 20,
      fontWeight: skin === 'glass' ? '700' : '600',
    });
    const names = renderer.root
      .findAllByType(Icon)
      .map(n => n.props.name)
      .filter(name =>
        [
          'settingsDoc',
          'cpu',
          'sliders',
          'appearance',
          'drive',
          'info',
        ].includes(name),
      );
    expect(names).toEqual(
      skin === 'glass'
        ? ['settingsDoc', 'cpu', 'sliders', 'appearance', 'drive', 'info']
        : [],
    );
    for (const [label, height] of [
      ['普通操作', skin === 'glass' ? 50 : 42],
      ['更新 Token', skin === 'glass' ? 34 : 30],
    ] as const) {
      const button = renderer.root.findAll(
        n =>
          n.props.accessibilityRole === 'button' &&
          n.props.accessibilityLabel === label &&
          typeof n.props.onPress === 'function',
      )[0];
      const style = StyleSheet.flatten(
        typeof button.props.style === 'function'
          ? button.props.style({ pressed: false })
          : button.props.style,
      );
      expect(style.minHeight).toBe(height);
      expect(height + button.props.hitSlop * 2).toBeGreaterThanOrEqual(48);
    }
    const input = renderer.root.findByType(TextInput);
    expect(StyleSheet.flatten(input.props.style)).toMatchObject(
      skin === 'glass'
        ? { borderWidth: 0, paddingHorizontal: 0 }
        : {
            borderWidth: 1,
            borderColor: '#DFDDD8',
            borderRadius: 8,
            paddingHorizontal: 10,
          },
    );
  },
);

it.each([
  ['paper', 'light'],
  ['paper', 'dark'],
  ['glass', 'light'],
  ['glass', 'dark'],
] as const)(
  '%s %s keeps Me navigation fixed while the Apple large title scrolls with content',
  async (skin, scheme) => {
    await act(async () => {
      renderer = Renderer.create(
        <SkinProvider skinId={skin} scheme={scheme} reduceMotion>
          <MeView
            state={meSamples.normal}
            intents={{ open: jest.fn(), refresh: jest.fn() }}
          />
        </SkinProvider>,
      );
    });
    const scroll = renderer.root.findByType(ScrollView);
    const titles = renderer.root
      .findAllByType(Text)
      .filter(node => node.props.children === '我的');
    const navigation = renderer.root.findByProps({
      testID: 'screen-navigation',
    });
    expect(contains(scroll, navigation)).toBe(false);
    if (skin === 'glass') {
      const compact = titles.find(
        node => StyleSheet.flatten(node.props.style).fontSize === 17,
      )!;
      const large = titles.find(
        node => StyleSheet.flatten(node.props.style).fontSize === 34,
      )!;
      expect(contains(scroll, compact)).toBe(false);
      expect(contains(navigation, compact)).toBe(true);
      expect(contains(scroll, large)).toBe(true);
      expect(opacity(compact.parent!)).toBe(0);
      expect(StyleSheet.flatten(navigation.props.style)).toMatchObject({
        position: 'absolute',
        top: 0,
        zIndex: 10,
      });
      expect(
        StyleSheet.flatten(scroll.props.contentContainerStyle),
      ).toMatchObject({
        paddingTop: 44,
        paddingBottom: 110,
      });
      await act(async () =>
        navigation.props.onLayout({ nativeEvent: { layout: { height: 52 } } }),
      );
      expect(
        StyleSheet.flatten(scroll.props.contentContainerStyle).paddingTop,
      ).toBe(52);
      await act(async () =>
        scroll.props.onScroll({ nativeEvent: { contentOffset: { y: 36 } } }),
      );
      expect(opacity(compact.parent!)).toBe(0);
      await act(async () =>
        scroll.props.onScroll({ nativeEvent: { contentOffset: { y: 37 } } }),
      );
      expect(opacity(compact.parent!)).toBe(1);
      await act(async () =>
        scroll.props.onScroll({ nativeEvent: { contentOffset: { y: 80 } } }),
      );
      expect(opacity(compact.parent!)).toBe(1);
      expect(StyleSheet.flatten(large.props.style)).toMatchObject({
        fontSize: 34,
        lineHeight: 41,
        paddingBottom: 12,
      });
      let ancestor = large.parent;
      while (ancestor && ancestor !== scroll) {
        if (ancestor.props.style) {
          expect(StyleSheet.flatten(ancestor.props.style).height).not.toBe(0);
        }
        ancestor = ancestor.parent;
      }
    } else {
      expect(titles).toHaveLength(1);
      expect(contains(scroll, titles[0])).toBe(false);
      expect(
        StyleSheet.flatten(navigation.props.style)?.position,
      ).toBeUndefined();
      expect(
        StyleSheet.flatten(scroll.props.contentContainerStyle).paddingTop,
      ).toBeUndefined();
      expect(StyleSheet.flatten(titles[0].props.style)).toMatchObject({
        fontSize: 20,
        fontWeight: '600',
      });
    }
  },
);

it.each(['paper', 'glass'] as const)(
  '%s keeps the original preference order and renders appearance choices in both schemes',
  async skin => {
    for (const scheme of ['light', 'dark'] as const) {
      await act(async () => {
        renderer = Renderer.create(
          <SkinProvider skinId={skin} scheme={scheme} reduceMotion>
            <MePrefsView
              state={prefsSamples.normal}
              intents={{ back: jest.fn(), set: jest.fn(), refresh: jest.fn() }}
            />
            <MeAppearanceView
              state={appearance}
              intents={{
                back: jest.fn(),
                setSkin: jest.fn(),
                setScheme: jest.fn(),
                setSize: jest.fn(),
              }}
            />
          </SkinProvider>,
        );
      });
      const output = JSON.stringify(renderer.toJSON());
      const positions = [
        '先讲直觉，再讲公式',
        '每段讲解长度',
        '每段结尾提一个问题',
        '一节讲完做小测',
        '术语中英对照',
        '续学回顾',
      ].map(label => output.indexOf(label));
      expect(positions.every(position => position >= 0)).toBe(true);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
      expect(output).toContain('毛玻璃 · 圆角');
      await act(async () => renderer.unmount());
    }
  },
);

it.each(['paper', 'glass'] as const)(
  '%s offers an exit from demo in release mode',
  async skin => {
    const demo = jest.fn();
    await act(async () => {
      renderer = Renderer.create(
        <SkinProvider skinId={skin} scheme="light" reduceMotion>
          <AboutView
            state={{ ...aboutSamples.demo, development: false }}
            intents={{
              back: jest.fn(),
              demo,
              gallery: jest.fn(),
              exportLogs: jest.fn(),
            }}
          />
        </SkinProvider>,
      );
    });
    const button = renderer.root.findAll(
      n =>
        n.props.accessibilityRole === 'button' &&
        n.props.accessibilityLabel === '退出演示' &&
        typeof n.props.onPress === 'function',
    )[0];
    await act(async () => button.props.onPress());
    expect(demo).toHaveBeenCalledTimes(1);
  },
);
