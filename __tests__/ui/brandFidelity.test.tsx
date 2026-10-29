import fs from 'node:fs';
import path from 'node:path';
import { useEffect, useState } from 'react';
import { TextInput, StyleSheet, View } from 'react-native';
import { Rect, Stop } from 'react-native-svg';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { skins } from '@ui/skins';
import { parseColor } from '@ui/kit/color';
import {
  Gradient,
  ProgressRing,
  Screen,
  Sheet,
  SkinProvider,
  useTokens,
  type SkinId,
} from '@ui/kit';

it('preserves translucent SVG stops and paints a capsule with circular ends', async () => {
  let r!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    r = ReactTestRenderer.create(
      <Gradient
        colors={['rgba(255,255,255,.2)', '#00000000']}
        spots={[
          { x: 1, y: 0, rx: 0.7, ry: 0.9, color: 'rgba(124,92,255,.55)' },
        ]}
        style={StyleSheet.create({ pill: { borderRadius: 999 } }).pill}
      />,
    );
  });
  try {
    await act(async () => {
      r.root.findByType(View).props.onLayout({
        nativeEvent: { layout: { width: 300, height: 52 } },
      });
    });
    expect(r.root.findAllByType(Stop).map(stop => stop.props)).toEqual([
      expect.objectContaining({
        stopColor: 'rgb(255,255,255)',
        stopOpacity: 0.2,
      }),
      expect.objectContaining({ stopColor: 'rgb(0,0,0)', stopOpacity: 0 }),
      expect.objectContaining({
        stopColor: 'rgb(124,92,255)',
        stopOpacity: 0.55,
      }),
      expect.objectContaining({ stopColor: 'rgb(124,92,255)', stopOpacity: 0 }),
    ]);
    expect(r.root.findAllByType(Rect).map(rect => rect.props.rx)).toEqual([
      26, 26,
    ]);
    await act(async () => {
      r.update(
        <ProgressRing
          value={0.5}
          color="#0067C0"
          track="#EEEEEE"
          colors={['rgba(43,123,255,.28)', '#7C5CFF']}
        />,
      );
    });
    expect(r.root.findAllByType(Stop)[0].props).toMatchObject({
      stopColor: 'rgb(43,123,255)',
      stopOpacity: 0.28,
    });
  } finally {
    await act(async () => r.unmount());
  }
});

const ids = ['meta', 'google', 'win11'] as const;
for (const id of ids) {
  const css = fs.readFileSync(
    path.join(__dirname, `../../docs/design/prototype-${id}/base.css`),
    'utf8',
  );
  for (const scheme of ['light', 'dark'] as const) {
    it(`${id}/${scheme} keeps the committed prototype palette`, () => {
      const rule = (
        scheme === 'light'
          ? /:root\s*\{([^}]+)\}/
          : /\[data-theme=dark\]\s*\{([^}]+)\}/
      ).exec(css)![1];
      const light = /:root\s*\{([^}]+)\}/.exec(css)![1];
      const values = Object.fromEntries(
        [...(light + rule).matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map(
          ([, key, value]) => [key, value.trim()],
        ),
      );
      const resolve = (value: string): string =>
        value.startsWith('var(') ? resolve(values[value.slice(6, -1)]) : value;
      const tokens = skins[id].tokens[scheme];
      const mapping =
        id === 'win11'
          ? {
              accent: 'accent',
              detour: 'detour',
              ink: 'ink',
              ink2: 'ink2',
              paper: 'paper',
              bad: 'bad',
            }
          : {
              accent: 'tint',
              detour: 'indigo',
              ink: 'label',
              ink2: 'label2',
              paper: 'page',
              bad: 'red',
            };
      for (const [token, variable] of Object.entries(mapping))
        expect(
          parseColor(tokens.color[token as keyof typeof tokens.color]),
        ).toEqual(parseColor(resolve(values[variable])));
      expect(tokens.brand?.kind).toBe(id);
    });
  }
}

it('switches all five skins without remounting an open sheet or losing its draft', async () => {
  const mounted = jest.fn(),
    unmounted = jest.fn();
  function Draft() {
    const [value, setValue] = useState('未发出的问题');
    const t = useTokens();
    useEffect(() => {
      mounted();
      return unmounted;
    }, []);
    return (
      <TextInput
        accessibilityLabel="草稿"
        value={value}
        onChangeText={setValue}
        style={StyleSheet.create({ input: { color: t.color.ink } }).input}
      />
    );
  }
  const tree = (skin: SkinId) => (
    <SkinProvider skinId={skin} scheme="dark" reduceMotion>
      <Screen>
        <Sheet visible title="提问" onClose={jest.fn()}>
          <Draft />
        </Sheet>
      </Screen>
    </SkinProvider>
  );
  let r!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    r = ReactTestRenderer.create(tree('paper'));
  });
  try {
    for (const skin of ['glass', ...ids, 'paper'] as const) {
      await act(async () => r.update(tree(skin)));
      expect(r.root.findByType(TextInput).props.value).toBe('未发出的问题');
    }
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(unmounted).not.toHaveBeenCalled();
  } finally {
    await act(async () => r.unmount());
  }
});
