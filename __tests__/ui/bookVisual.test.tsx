import Renderer, { act } from 'react-test-renderer';
import { Image } from 'react-native';
import { Line, Path } from 'react-native-svg';
import {
  BookVisualView,
  RichView,
  SkinProvider,
  type BookVisualData,
  type SkinId,
} from '@ui/kit';
import { diagramLayout, visualPosition } from '@ui/kit/BookVisualView';
const chart: BookVisualData = {
  kind: 'chart',
  title: '组合收益率',
  description: '保留原图的负值和峰值。',
  x: {
    label: '日期',
    min: 0,
    max: 10,
    scale: 'linear',
    ticks: [
      { value: 0, label: '1月1日' },
      { value: 10, label: '1月11日' },
    ],
  },
  y: {
    label: '收益率 (%)',
    min: -10,
    max: 10,
    scale: 'linear',
    ticks: [
      { value: -10, label: '-10' },
      { value: 0, label: '0' },
      { value: 10, label: '10' },
    ],
  },
  series: [
    {
      name: '组合',
      type: 'line',
      points: [
        [0, -5],
        [1, 8],
        [10, 2],
      ],
      dashed: false,
    },
  ],
  annotations: [],
};
let tree: Renderer.ReactTestRenderer;
afterEach(async () => {
  if (tree) await act(() => tree.unmount());
});

it.each(
  (['glass', 'paper', 'google', 'meta', 'win11'] as SkinId[]).flatMap(skin =>
    (['light', 'dark'] as const).map(scheme => [skin, scheme] as const),
  ),
)(
  '%s / %s renders a themed vector instead of scan pixels, with honest provenance and a working source action',
  async (skin, scheme) => {
    const original = jest.fn();
    await act(() => {
      tree = Renderer.create(
        <SkinProvider skinId={skin} scheme={scheme} reduceMotion>
          <RichView
            doc={[{ t: 'visual', ref: 45, data: chart }]}
            onFigure={original}
          />
        </SkinProvider>,
      );
    });
    expect(tree.root.findAllByType(Image)).toHaveLength(0);
    expect(JSON.stringify(tree.toJSON())).toContain(
      'AI 近似重绘 · 数值按原图估读',
    );
    const target = tree.root.findAll(
      n =>
        n.props.accessibilityLabel === '对照原扫描图' &&
        typeof n.props.onPress === 'function',
    )[0];
    await act(() => target.props.onPress());
    expect(original).toHaveBeenCalledWith(45);
    const path = tree.root.findByType(Path).props.d as string;
    const points = path
      .match(/[ML][\d.]+,[\d.]+/g)!
      .map(p => p.slice(1).split(',').map(Number));
    // A one-day interval must occupy 1/9 of the following nine-day interval.
    expect(
      (points[1][0] - points[0][0]) / (points[2][0] - points[1][0]),
    ).toBeCloseTo(1 / 9);
    expect(points[1][1]).toBeLessThan(points[0][1]);
  },
);

it('keeps logarithmic orders of magnitude equally spaced', () => {
  const axis = {
    label: '',
    min: 1,
    max: 100,
    scale: 'log' as const,
    ticks: [],
  };
  expect([1, 10, 100].map(n => visualPosition(n, axis))).toEqual([0, 0.5, 1]);
});

it('renders the rebuilt diagram and its labels without an image', async () => {
  const data: BookVisualData = {
    kind: 'diagram',
    title: '投资流程',
    description: '信号传给组合',
    nodes: [
      { id: 'a', label: '信号', x: 0.5, y: 0 },
      { id: 'b', label: '组合', x: 0.5, y: 1 },
    ],
    edges: [{ from: 'a', to: 'b', label: '输入' }],
  };
  await act(() => {
    tree = Renderer.create(
      <SkinProvider skinId="paper" scheme="dark" reduceMotion>
        <BookVisualView data={data} />
      </SkinProvider>,
    );
  });
  const content = JSON.stringify(tree.toJSON());
  expect(content).toContain('结构复原');
  expect(content).toContain('信号');
  expect(content).toContain('组合');
  expect(tree.root.findAllByType(Image)).toHaveLength(0);
});

it('fits the real Chinese trading-system diagram without node overlaps and separates its two return arrows', async () => {
  const data: Extract<BookVisualData, { kind: 'diagram' }> = {
    kind: 'diagram',
    title: '量化交易策略的基本结构',
    description: '三个输入模型，投资组合与执行模型双向连接。',
    nodes: [
      { id: 'a', label: '阿尔法模型', x: 0.12, y: 0.12 },
      { id: 'b', label: '风险控制模型', x: 0.41, y: 0.12 },
      { id: 'c', label: '交易成本模型', x: 0.8, y: 0.12 },
      { id: 'd', label: '投资组合构建模型', x: 0.45, y: 0.55 },
      { id: 'e', label: '执行模型', x: 0.45, y: 0.9 },
    ],
    edges: [
      { from: 'a', to: 'd', label: '' },
      { from: 'b', to: 'd', label: '' },
      { from: 'c', to: 'd', label: '' },
      { from: 'd', to: 'e', label: '' },
      { from: 'e', to: 'd', label: '' },
    ],
  };
  for (const scale of [1, 1.3]) {
    const layout = diagramLayout(data, 370 * scale, 12 * scale, scale);
    expect(layout.width).toBeLessThanOrEqual(370 * scale);
    const nodes = [...layout.nodes.values()];
    for (const [i, a] of nodes.entries()) {
      expect(a.cx - a.w / 2).toBeGreaterThanOrEqual(0);
      expect(a.cx + a.w / 2).toBeLessThanOrEqual(layout.width);
      for (const b of nodes.slice(i + 1)) {
        expect(
          Math.abs(a.cx - b.cx) >= (a.w + b.w) / 2 ||
            Math.abs(a.cy - b.cy) >= (a.h + b.h) / 2,
        ).toBe(true);
      }
    }
  }
  await act(() => {
    tree = Renderer.create(
      <SkinProvider skinId="paper" scheme="light">
        <BookVisualView data={data} />
      </SkinProvider>,
    );
  });
  const arrows = tree.root.findAllByType(Line);
  expect(arrows).toHaveLength(5);
  expect(arrows[3].props.x1).not.toEqual(arrows[4].props.x2);
});
