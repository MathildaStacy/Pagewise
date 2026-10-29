import Renderer, { act } from 'react-test-renderer';
import { SvgXml } from 'react-native-svg';
import { Text, PixelRatio } from 'react-native';
import {
  MathProvider,
  SkinProvider,
  type FormulaRender,
  type FormulaRenderer,
} from '@ui/kit';
import { MathView } from '@ui/kit/base/content';
import { paperLight, paperDark } from '@ui/skins/paper/tokens';
const result: FormulaRender = {
  svg: '<svg><path fill="currentColor"/></svg>',
  width: 4,
  height: 2,
  baseline: 1.5,
};
let renderer: Renderer.ReactTestRenderer | undefined;
afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = undefined;
  jest.useRealTimers();
});
const content = (
  service: FormulaRenderer,
  tex = 'x',
  scheme: 'light' | 'dark' = 'light',
  display = true,
) => (
  <MathProvider renderer={service}>
    <SkinProvider skinId="paper" scheme={scheme} reduceMotion>
      <MathView tex={tex} display={display} />
    </SkinProvider>
  </MathProvider>
);
it('renders inline and display SVG offline, sizes ex in dp and changes color without rerendering TeX', async () => {
  const service = { render: jest.fn().mockResolvedValue(result) };
  await act(async () => {
    renderer = Renderer.create(content(service));
  });
  let svg = renderer!.root.findByType(SvgXml);
  expect(svg.props.xml).toBe(result.svg);
  expect(svg.props.width).toBe(
    4 * paperLight.type.aiBody.fontSize * PixelRatio.getFontScale() * 0.5,
  );
  expect(svg.props.color).toBe(paperLight.color.ink);
  await act(async () => renderer!.update(content(service, 'x', 'dark', false)));
  svg = renderer!.root.findByType(SvgXml);
  expect(svg.props.color).toBe(paperDark.color.ink);
  expect(svg.props.style).toEqual({
    transform: [
      {
        translateY:
          0.5 *
          paperDark.type.aiBody.fontSize *
          PixelRatio.getFontScale() *
          0.5,
      },
    ],
  });
  expect(service.render).toHaveBeenCalledTimes(2); // display and inline have different cache entries.
  await act(async () =>
    renderer!.update(content(service, 'x', 'light', false)),
  );
  expect(service.render).toHaveBeenCalledTimes(2);
});
it('preserves provided SVG compatibility and shows TeX when rendering fails', async () => {
  const service = {
    render: jest.fn().mockRejectedValue(new Error('WebView failed')),
  };
  await act(async () => {
    renderer = Renderer.create(content(service, '\\frac{a}{b}'));
  });
  expect(renderer!.root.findAllByType(SvgXml)).toHaveLength(0);
  const fallback = renderer!.root
    .findAllByType(Text)
    .find(node => node.props.children === '\\frac{a}{b}');
  expect(fallback?.props.style).toMatchObject({
    fontFamily: 'monospace',
    color: paperLight.color.ink2,
  });
  await act(async () =>
    renderer!.update(
      <SkinProvider skinId="paper" scheme="dark" reduceMotion>
        <MathView tex="x" svg={result.svg} width={20} height={12} />
      </SkinProvider>,
    ),
  );
  expect(renderer!.root.findByType(SvgXml).props).toMatchObject({
    width: 20,
    height: 12,
    color: paperDark.color.ink,
  });
});
it('has a 3s UI fallback deadline even if an injected renderer stalls, and ignores late or outdated results', async () => {
  jest.useFakeTimers();
  let finish!: (value: FormulaRender) => void;
  const service = {
    render: jest.fn(
      () =>
        new Promise<FormulaRender>(resolve => {
          finish = resolve;
        }),
    ),
  };
  await act(async () => {
    renderer = Renderer.create(content(service));
  });
  await act(async () => jest.advanceTimersByTime(3000));
  await act(async () => finish(result));
  expect(renderer!.root.findAllByType(SvgXml)).toHaveLength(0);
  const ready = { render: jest.fn().mockResolvedValue(result) };
  await act(async () => renderer!.update(content(ready, 'y')));
  expect(renderer!.root.findByType(SvgXml).props.xml).toBe(result.svg);
  const stale = {
    render: jest.fn(
      () =>
        new Promise<FormulaRender>(resolve => {
          finish = resolve;
        }),
    ),
  };
  await act(async () => renderer!.update(content(stale, 'z')));
  expect(renderer!.root.findAllByType(SvgXml)).toHaveLength(0);
  await act(async () => renderer!.update(content(ready, 'new')));
  await act(async () => finish({ ...result, svg: '<svg>stale</svg>' }));
  expect(renderer!.root.findByType(SvgXml).props.xml).toBe(result.svg);
});
it('renders TeX directly outside a renderer provider', async () => {
  await act(async () => {
    renderer = Renderer.create(
      <SkinProvider skinId="paper" scheme="light" reduceMotion>
        <MathView tex="a+b" />
      </SkinProvider>,
    );
  });
  expect(JSON.stringify(renderer!.toJSON())).toContain('a+b');
  expect(renderer!.root.findAllByType(SvgXml)).toHaveLength(0);
});
