import fs from 'node:fs';
import path from 'node:path';
import { parseColor } from '@ui/kit/color';
import type { ColorTokens, Tokens } from '@ui/kit/tokens';
import { paperTokens } from '@ui/skins/paper/tokens';
import { glassTokens } from '@ui/skins/glass/tokens';

const variants: [string, Tokens][] = [
  ['paper light', paperTokens.light],
  ['paper dark', paperTokens.dark],
  ['glass light', glassTokens.light],
  ['glass dark', glassTokens.dark],
];

function leaves(value: unknown, prefix = ''): [string, unknown][] {
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) =>
      leaves(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [[prefix, value]];
}

const shell = fs.readFileSync(
  path.join(__dirname, '../../docs/design/prototype/shell.html'),
  'utf8',
);
const root = /:root\s*\{([^}]+)\}/.exec(shell)![1];
const prototype = Object.fromEntries(
  [...root.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map(([, key, value]) => [
    key,
    value.trim(),
  ]),
);
const paperMapping: Record<string, (keyof ColorTokens)[]> = {
  acc: ['accent', 'stepDone'],
  'acc-bg': ['accentBg'],
  'acc-ink': ['accentInk'],
  detour: ['detour'],
  'detour-bg': ['detourBg'],
  stuck: ['stuck'],
  'stuck-bg': ['stuckBg'],
  ok: ['ok'],
  'ok-bg': ['okBg'],
  bad: ['bad'],
  'bad-bg': ['badBg'],
  hl: ['highlight'],
  ink: ['ink'],
  ink2: ['ink2'],
  ink3: ['ink3'],
  line: ['line', 'glassLine'],
  bg: ['bg', 'surfaceAlt', 'stepTodo'],
  card: ['surface', 'glass', 'glassStrong', 'onAccent'],
  paper: ['paper'],
};

describe('design token completeness', () => {
  it.each(variants)(
    '%s supplies the entire contract without empty leaves',
    (_, tokens) => {
      const expectedPaths = leaves(paperTokens.light)
        .map(([key]) => key)
        .sort();
      const values = leaves(tokens);
      expect(values.map(([key]) => key).sort()).toEqual(expectedPaths);
      for (const [key, value] of values) {
        expect({ key, present: value !== null && value !== undefined }).toEqual(
          { key, present: true },
        );
        if (typeof value === 'string') {
          expect({ key, present: value.trim().length > 0 }).toEqual({
            key,
            present: true,
          });
        } else if (typeof value === 'number') {
          expect(Number.isFinite(value)).toBe(true);
        }
      }
      expect(tokens.type.bookBody.fontFamily).toBe('serif');
      expect(tokens.type.sansFamily).toBe('sans-serif');
      expect(tokens.type.num.fontVariant).toEqual(['tabular-nums']);
      expect(tokens.motion.fast).toBeLessThan(tokens.motion.normal);
      expect(tokens.motion.normal).toBeLessThan(tokens.motion.slow);
      expect(tokens.shape.pill).toBe(999);
      for (const color of Object.values(tokens.color)) {
        expect(() => parseColor(color)).not.toThrow();
      }
    },
  );

  it('exposes distinct light/dark variants and material capabilities', () => {
    for (const skin of [paperTokens, glassTokens]) {
      expect(skin.light.scheme).toBe('light');
      expect(skin.dark.scheme).toBe('dark');
      expect(skin.light.color.bg).not.toBe(skin.dark.color.bg);
    }
    expect(paperTokens.light.capabilities).toEqual({
      blur: false,
      haptics: false,
    });
    expect(glassTokens.light.capabilities).toEqual({
      blur: true,
      haptics: false,
    });
    expect(paperTokens.light.motion.pressScale).toBe(1);
    expect(glassTokens.light.motion.pressScale).toBe(0.96);
  });

  it('maps every color variable from paper prototype :root', () => {
    const sourceColors = Object.keys(prototype).filter(key =>
      /^#|^rgba?\(/i.test(prototype[key]),
    );
    expect(Object.keys(paperMapping).sort()).toEqual(sourceColors.sort());
  });

  it.each(Object.entries(paperMapping))(
    'paper light preserves --%s exactly',
    (source, keys) => {
      for (const key of keys) {
        expect({
          token: key,
          color: parseColor(paperTokens.light.color[key]),
        }).toEqual({
          token: key,
          color: parseColor(prototype[source]),
        });
      }
    },
  );

  it('keeps specified body scales, shapes, and motion timings', () => {
    expect(paperTokens.light.type.aiBody).toMatchObject({
      fontSize: 16,
      lineHeight: 28.48,
    });
    expect(paperTokens.light.type.bookBody).toMatchObject({
      fontSize: 16.5,
      lineHeight: 31.35,
    });
    expect(paperTokens.light.shape.sheet).toBe(18);
    expect(paperTokens.light.motion).toMatchObject({
      fast: 150,
      normal: 260,
      slow: 400,
    });
    expect(glassTokens.light.type.largeTitle).toMatchObject({
      fontSize: 34,
      fontWeight: '700',
    });
    expect(glassTokens.light.shape.sheet).toBe(40);
    expect(glassTokens.light.motion).toMatchObject({ normal: 380, slow: 460 });
  });
});
