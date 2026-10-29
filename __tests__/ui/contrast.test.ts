import { compositeColor, contrastRatio, parseColor } from '@ui/kit/color';
import type { ColorTokens, Tokens } from '@ui/kit/tokens';
import { paperTokens } from '@ui/skins/paper/tokens';
import { glassTokens } from '@ui/skins/glass/tokens';

const variants: [string, Tokens][] = [
  ['paper light', paperTokens.light],
  ['paper dark', paperTokens.dark],
  ['glass light', glassTokens.light],
  ['glass dark', glassTokens.dark],
];

type Pair = {
  fg: keyof ColorTokens;
  bg: keyof ColorTokens;
  min: number;
  use: string;
};
const pairs: Pair[] = [
  { fg: 'ink', bg: 'bg', min: 4.5, use: 'body' },
  { fg: 'ink', bg: 'surface', min: 4.5, use: 'body' },
  { fg: 'ink2', bg: 'surface', min: 4.5, use: 'secondary body' },
  { fg: 'paperInk', bg: 'paper', min: 4.5, use: 'book body' },
  { fg: 'onAccent', bg: 'accent', min: 4.5, use: 'button label' },
  {
    fg: 'accent',
    bg: 'surface',
    min: 3,
    use: 'icon; small text uses accentInk',
  },
  { fg: 'detour', bg: 'detourBg', min: 4.5, use: 'detour body' },
  { fg: 'stuck', bg: 'stuckBg', min: 3, use: 'icon; small text uses stuckInk' },
  { fg: 'ok', bg: 'surface', min: 3, use: 'status icon; small text uses ink' },
  { fg: 'bad', bg: 'badBg', min: 4.5, use: 'error body' },
  { fg: 'derive', bg: 'deriveBg', min: 4.5, use: 'derivation label' },
  { fg: 'example', bg: 'exampleBg', min: 4.5, use: 'example label' },
  { fg: 'pin', bg: 'pinBg', min: 4.5, use: 'pin label' },
  { fg: 'ink', bg: 'highlight', min: 4.5, use: 'highlighted body' },
  { fg: 'accentInk', bg: 'accentBg', min: 4.5, use: 'small accent label' },
  { fg: 'stuckInk', bg: 'stuckBg', min: 4.5, use: 'small warning label' },
  { fg: 'badInk', bg: 'badBg', min: 4.5, use: 'small error label' },
];

// Exact prototype colors take precedence per user instruction (2026-10-29).
// These pairs deliberately preserve the source and report the contrast debt.
const prototypeExceptions: Record<string, string[]> = {
  'glass light': [
    'ink2/surface',
    'onAccent/accent',
    'stuck/stuckBg',
    'ok/surface',
    'bad/badBg',
    'derive/deriveBg',
    'example/exampleBg',
  ],
  'glass dark': ['onAccent/accent', 'detour/detourBg', 'bad/badBg'],
};
describe.each(variants)('%s contrast', (variant, tokens) => {
  it.each(pairs)('$fg/$bg reaches $min for $use', ({ fg, bg, min }) => {
    const ratio = contrastRatio(
      tokens.color[fg],
      tokens.color[bg],
      tokens.color.surface,
    );
    if (prototypeExceptions[variant]?.includes(`${fg}/${bg}`)) {
      expect(ratio).toBeLessThan(min);
      expect(ratio).toBeGreaterThanOrEqual(2);
    } else expect(ratio).toBeGreaterThanOrEqual(min);
  });
});

describe('alpha-aware contrast calculation', () => {
  it('matches WCAG black/white and identical-color reference values', () => {
    expect(contrastRatio('#000', '#FFF')).toBeCloseTo(21, 8);
    expect(contrastRatio('#FFF', '#000')).toBeCloseTo(21, 8);
    expect(contrastRatio('#123456', '#123456')).toBe(1);
  });

  it('composites translucent foreground and background over the actual canvas', () => {
    expect(contrastRatio('rgba(0,0,0,.5)', '#FFF')).toBeCloseTo(3.976653, 5);
    expect(contrastRatio('#FFF', 'rgba(255,255,255,.2)', '#000')).toBeCloseTo(
      12.634654,
      5,
    );
    expect(
      contrastRatio('#FFF', 'rgba(255,255,255,.2)', '#000'),
    ).not.toBeCloseTo(contrastRatio('#FFF', 'rgba(255,255,255,.2)', '#FFF'));
    expect(
      contrastRatio(
        paperTokens.dark.color.ink,
        '#5C4B14',
        paperTokens.dark.color.paper,
      ),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('supports short/long hex alpha, rgb, and fully transparent overlays', () => {
    expect(parseColor('#FFF8')).toEqual({
      r: 255,
      g: 255,
      b: 255,
      a: 136 / 255,
    });
    expect(parseColor('#00000080')).toEqual({ r: 0, g: 0, b: 0, a: 128 / 255 });
    expect(parseColor('rgb(1, 2, 3)')).toEqual({ r: 1, g: 2, b: 3, a: 1 });
    expect(
      compositeColor(parseColor('transparent'), parseColor('transparent')),
    ).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it.each(['red', '#12', 'rgba(300,0,0,1)', 'rgba(0,0,0,2)'])(
    'rejects unsupported or invalid token color %s',
    color => {
      expect(() => parseColor(color)).toThrow('不支持的颜色');
    },
  );
});
