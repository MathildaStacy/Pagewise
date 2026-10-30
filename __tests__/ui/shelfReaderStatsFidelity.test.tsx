import type { ReactNode } from 'react';
import Renderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { PixelRatio, StyleSheet, Text, View } from 'react-native';
import {
  Cover,
  Gradient,
  Icon,
  PinChip,
  SkinProvider,
  type SkinId,
} from '@ui/kit';
import { skins } from '@ui/skins';
import { ShelfView } from '@ui/screens/ShelfView';
import { LearningStatsView } from '@ui/screens/LearningStatsView';
import { shelfSamples } from '@features/library/samples';
import type { ShelfIntents, ShelfState } from '@features/library/types';
import type { HomeIntents, HomeState } from '@features/home/types';

const no = () => {};
const shelfIntents: ShelfIntents = {
  refresh: no,
  openContinue: no,
  openBook: no,
  openImport: no,
  openSearch: no,
  setSearch: no,
  closeOverlay: no,
  pickRecent: no,
  pickOther: no,
};
const homeIntents: HomeIntents = {
  refresh: no,
  ask: no,
  me: no,
  review: no,
  stats: no,
  shelf: no,
  openBook: no,
  openContinue: no,
  openStuck: no,
  setup: no,
  goal: no,
  reminder: no,
};
let renderer: Renderer.ReactTestRenderer;
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  jest.restoreAllMocks();
});
async function render(
  skin: SkinId,
  scheme: 'light' | 'dark',
  children: ReactNode,
) {
  await act(async () => {
    renderer = Renderer.create(
      <SkinProvider skinId={skin} scheme={scheme} reduceMotion>
        {children}
      </SkinProvider>,
    );
  });
  return renderer.root;
}
const style = (node: ReactTestInstance) =>
  StyleSheet.flatten(
    typeof node.props.style === 'function'
      ? node.props.style({ pressed: false })
      : node.props.style,
  );
const buttons = (root: ReactTestInstance) => [
  ...new Map(
    root
      .findAll(
        node =>
          node.props.accessibilityRole === 'button' &&
          typeof node.props.onPress === 'function',
      )
      .map(node => [node.props.accessibilityLabel, node]),
  ).values(),
];

it('fits all three Win11 shelf tracks inside the measured container at fractional pixel densities', async () => {
  const scale = 2.75;
  jest.spyOn(PixelRatio, 'get').mockReturnValue(scale);
  const state: ShelfState = {
    ...shelfSamples.normal,
    books: Array.from({ length: 3 }, (_, i) => ({
      ...shelfSamples.normal.books[0],
      id: `book-${i}`,
      title: `测试书 ${i + 1}`,
    })),
  };
  const root = await render(
    'win11',
    'light',
    <ShelfView state={state} intents={shelfIntents} />,
  );
  await act(async () => {
    buttons(root)
      .find(node => node.props.accessibilityLabel === '网格视图')!
      .props.onPress();
  });
  const grid = root.findByProps({ testID: 'shelf-grid' });
  expect(style(grid)).toMatchObject({ gap: 12, paddingHorizontal: 16 });
  for (const width of [426.75, 358.4]) {
    await act(async () => {
      grid.props.onLayout({
        nativeEvent: { layout: { x: 0, y: 0, width, height: 300 } },
      });
    });
    const cards = buttons(root).filter(node =>
      node.props.accessibilityLabel?.startsWith('打开 测试书'),
    );
    expect(cards).toHaveLength(3);
    const widths = cards.map(card => style(card).width as number);
    expect(widths.every(value => value === widths[0])).toBe(true);
    expect(widths.reduce((sum, value) => sum + value, 56)).toBeLessThanOrEqual(
      width,
    );
    expect((width - 56) / 3 - widths[0]).toBeLessThan(1 / scale);
    expect(root.findAllByType(Cover).map(cover => cover.props.width)).toEqual(
      widths,
    );
  }
});

it.each(['light', 'dark'] as const)(
  'keeps the Meta pin bubble gray with its yellow circular icon in %s',
  async scheme => {
    const onPress = jest.fn();
    const root = await render(
      'meta',
      scheme,
      <PinChip label="A* 的启发函数" onPress={onPress} />,
    );
    const target = buttons(root)[0];
    expect(style(target)).toMatchObject({
      minHeight: 48,
      minWidth: 48,
      paddingBottom: 12,
      marginBottom: -12,
    });
    const bubble = root
      .findAllByType(View)
      .find(node => style(node)?.borderRadius === 18)!;
    expect(style(bubble)).toMatchObject({
      paddingVertical: 4,
      paddingLeft: 4,
      paddingRight: 14,
      gap: 8,
      backgroundColor: scheme === 'light' ? '#F0F2F5' : '#3A3B3C',
    });
    const icon = root.findByType(Icon);
    expect(icon.props).toMatchObject({ size: 16, color: '#4A3200' });
    expect(style(icon.parent!)).toMatchObject({
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: '#F7B928',
    });
    const label = root.findByType(Text);
    expect(style(label)).toMatchObject({
      color: scheme === 'light' ? '#050505' : '#E4E6EB',
      fontWeight: '600',
    });
    expect(label.props.numberOfLines).toBe(1);
    await act(async () => target.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  },
);

it.each(['light', 'dark'] as const)(
  'uses the Google pin tag geometry and a separate 48dp target in %s',
  async scheme => {
    const root = await render(
      'google',
      scheme,
      <PinChip label="A* 的启发函数" onPress={no} />,
    );
    expect(style(buttons(root)[0])).toMatchObject({
      minHeight: 48,
      minWidth: 48,
    });
    const tag = root
      .findAllByType(View)
      .find(node => style(node)?.borderRadius === 8)!;
    expect(style(tag)).toMatchObject({
      paddingVertical: 6,
      paddingLeft: 8,
      paddingRight: 12,
      gap: 8,
      backgroundColor: scheme === 'light' ? '#FFE7A3' : '#4D3B00',
    });
    expect(root.findByType(Icon).props).toMatchObject({ size: 18 });
    expect(style(root.findByType(Text))).toMatchObject({
      color: scheme === 'light' ? '#4D3800' : '#FFE7A3',
      fontWeight: '500',
    });
  },
);

it.each(['paper', 'glass', 'win11'] as const)(
  'preserves the existing %s pin shape',
  async skin => {
    const root = await render(
      skin,
      'light',
      <PinChip label="已有便签" onPress={no} />,
    );
    expect(style(buttons(root)[0])).toMatchObject({
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: skins[skin].tokens.light.color.pinBg,
    });
    expect(root.findByType(Icon).props.size).toBe(16);
  },
);

it.each(['light', 'dark'] as const)(
  'paints the Google continue recap with the committed %s surface',
  async scheme => {
    const state: ShelfState = {
      ...shelfSamples.normal,
      continueCard: {
        ...shelfSamples.normal.continueCard!,
        recap: '上次读到这里',
      },
    };
    const root = await render(
      'google',
      scheme,
      <ShelfView state={state} intents={shelfIntents} />,
    );
    const recap = root
      .findAllByType(Text)
      .find(node => node.props.children === '上次读到这里')!;
    expect(style(recap)).toMatchObject({
      backgroundColor: scheme === 'light' ? '#FFFFFF' : 'rgba(0,0,0,.25)',
    });
  },
);

it.each([
  ['light', '2026-10-29', 31, 29],
  ['dark', '2026-11-05', 30, 5],
] as const)(
  'distinguishes future Win11 calendar days from past zero-minute days for %s/%s',
  async (scheme, date, days, today) => {
    const month = Number(date.slice(5, 7));
    const minutes = Array.from({ length: days }, (_, i) =>
      i + 1 >= today ? 35 : 0,
    );
    const state: HomeState = {
      loading: false,
      error: null,
      demo: false,
      date,
      greeting: '晚上好',
      due: 0,
      goal: 20,
      reminder: false,
      shelf: shelfSamples.empty,
      books: [],
      stuck: [],
      stats: {
        streak: 0,
        best: 0,
        today: 35,
        week: [0, 0, 0, 0, 0, 0, 0],
        month: minutes,
        totals: { sections: 0, cards: 0, asks: 0, detours: 0 },
      },
    };
    const root = await render(
      'win11',
      scheme,
      <LearningStatsView state={state} intents={homeIntents} back={no} />,
    );
    const cell = (day: number) =>
      root
        .findByProps({
          accessibilityLabel: `${month} 月 ${day} 日 · ${
            minutes[day - 1]
          } 分钟`,
        })
        .findByType(Gradient);
    const tokens = skins.win11.tokens[scheme];
    expect(cell(today - 1).props.colors).toEqual(tokens.brand!.heat![0]);
    expect(style(cell(today))).toMatchObject({
      borderWidth: 2,
      borderColor: tokens.color.accent,
    });
    expect(cell(today).props.colors).toEqual(tokens.brand!.heat![3]);
    for (let day = today + 1; day <= days; day++) {
      const future = cell(day);
      expect(future.props.colors).toEqual(['transparent', 'transparent']);
      expect(style(future)).toMatchObject({
        borderWidth: 1,
        borderColor: tokens.color.line,
      });
      expect(style(future.findByType(Text)).color).toBe(tokens.color.ink3);
    }
    expect(state.stats.month).toEqual(minutes);
  },
);
