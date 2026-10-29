import { StyleSheet, Text, TextInput } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import { Icon, SkinProvider } from '@ui/kit';
import { MeView, SettingsButton, SettingsField } from '@ui/screens/MeView';
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
      .find(n => n.props.children === '我的')!;
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
