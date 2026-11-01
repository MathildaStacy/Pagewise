import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { nativeMathSvg } from '@services/math/nativeSvg';
import {
  createMathRenderer,
  type MathCacheStore,
} from '@services/math/renderer';

// MathJax's actual viewport for a seven-row vector parenthesis. Its middle
// stem was displaced and clipped on Android beneath scale(1,-1).
const svg = readFileSync(
  path.join(__dirname, 'fixtures/tall-delimiter.svg'),
  'utf8',
);

it('preserves the stretched delimiter pixels without a nested SVG viewport', () => {
  const native = nativeMathSvg(svg);
  expect(native.match(/<svg\b/g)).toHaveLength(1);
  expect(new Resvg(native).render().pixels).toEqual(
    new Resvg(svg).render().pixels,
  );
  expect(nativeMathSvg(native)).toBe(native);
});

it('upgrades persisted formula SVGs without rendering or changing their metrics', async () => {
  const stored = { svg, width: 4, height: 20, baseline: 10 };
  const cache: MathCacheStore = {
    get: jest.fn().mockResolvedValue(stored),
    put: jest.fn().mockResolvedValue(undefined),
    touch: jest.fn().mockResolvedValue(undefined),
    prune: jest.fn().mockResolvedValue(undefined),
  };
  const bridge = { render: jest.fn() };
  const renderer = createMathRenderer({ bridge, cache });
  const result = await renderer.render('vector', true);
  expect(result).toEqual({ ...stored, svg: nativeMathSvg(svg) });
  expect(cache.put).toHaveBeenCalledWith(expect.any(String), result);
  expect(bridge.render).not.toHaveBeenCalled();
  expect(await renderer.render('vector', true)).toBe(result);
  renderer.close();
});
