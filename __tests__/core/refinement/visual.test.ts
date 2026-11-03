import { parseVisual, type ReconstructedChart } from '@core/refinement/visual';
import {
  parseRefinement,
  projectRefinement,
  type RefinementRun,
} from '@core/refinement';
import { formatBlocks } from '@core/context';
import type { Block } from '@core/types';
import { blockDoc, presentTranslation } from '@features/study/presenters';
import { translationPassages } from '@app/study/translation';

const chart: ReconstructedChart = {
  kind: 'chart',
  title: '示例走势',
  description: '依扫描图估读三个观测点。',
  x: {
    label: '天',
    min: 0,
    max: 10,
    scale: 'linear',
    ticks: [
      { value: 0, label: '起点' },
      { value: 10, label: '第10天' },
    ],
  },
  y: {
    label: '收益率 (%)',
    min: -5,
    max: 10,
    scale: 'linear',
    ticks: [
      { value: -5, label: '-5' },
      { value: 0, label: '0' },
      { value: 10, label: '10' },
    ],
  },
  series: [
    {
      name: '组合',
      type: 'line',
      points: [
        [0, -3],
        [1, 5],
        [10, 2],
      ],
      dashed: false,
    },
  ],
  annotations: [],
};
const source: Block = {
  id: 1,
  book_id: 'scan',
  seq: 45001,
  page: 45,
  loc: null,
  x0: 0.2,
  y0: 0.1,
  x1: 0.8,
  y1: 0.5,
  type: 'image',
  level: null,
  text: '',
  latex: null,
  html: null,
  image_path: 'images/original.jpg',
  section_id: 's1',
  chars: 0,
};
const parse = (row: unknown, mode: 'structure' | 'vision' = 'vision') =>
  parseRefinement(
    JSON.stringify({ edits: [row] }),
    [source],
    { seqs: [source.seq], context: [] },
    mode,
  );

it('retains the scan and provenance while an accepted reconstruction replaces the reading image, including bilingual reading', () => {
  const parsed = parse({ seq: source.seq, visual: chart, reason: '重绘曲线' });
  expect(parsed.issues).toEqual([]);
  const run = {
    status: 'applied',
    document: { source: [source], edits: parsed.edits, selected: [source.seq] },
  } as RefinementRun;
  const [book] = projectRefinement([source], run);
  expect(book.image_path).toBe(source.image_path);
  expect(book.page).toBe(45);
  expect(blockDoc(book, null)).toEqual([
    { t: 'visual', ref: 45001, data: chart },
  ]);
  expect(formatBlocks([book])).toContain('不是精确原始数据');
  const [passage] = translationPassages([book]);
  expect(passage.translate).toBe(false);
  expect(
    presentTranslation([{ ...passage, answer: '', complete: true }], null)[0]
      .source[0].t,
  ).toBe('visual');
  expect(projectRefinement([source], { ...run, status: 'undone' })).toEqual([
    source,
  ]);
  expect(
    projectRefinement([{ ...source, image_path: 'images/new.jpg' }], run)[0]
      .refinement,
  ).toBeUndefined();
});

it('reconstructs an image-only table into cells without rewriting the source block', () => {
  const html =
    '<table><tr><th colspan="2">年度</th></tr><tr><td>2020</td><td>-1.2%</td></tr></table>';
  expect(
    parse({ seq: source.seq, type: 'table', html }).edits[0],
  ).toMatchObject({ type: 'table', html });
  expect(source.type).toBe('image');
  expect(
    parse({ seq: source.seq, type: 'table', html: '<table>' }).edits,
  ).toEqual([]);
  expect(parse({ seq: source.seq, visual: chart }, 'structure').edits).toEqual(
    [],
  );
});

it('withholds a reconstruction the model flags as unreliable, including a prior figure reviewed as context', () => {
  const row = { seq: source.seq, visual: chart, reason: '重绘曲线' };
  const issue = {
    seq: source.seq,
    reason: '日期定位不能可靠对应原图，不宜直接用于重绘',
  };
  const sameBatch = parseRefinement(
    JSON.stringify({ edits: [row], issues: [issue] }),
    [source],
    { seqs: [source.seq], context: [] },
    'vision',
  );
  expect(sameBatch.edits).toEqual([]);
  expect(sameBatch.issues).toEqual([issue]);
  expect(sameBatch.retryVisuals).toEqual([]);

  const caption = {
    ...source,
    seq: 45002,
    type: 'caption' as const,
    text: '图3-2',
    image_path: null,
  };
  const followingBatch = parseRefinement(
    JSON.stringify({ edits: [], issues: [issue] }),
    [source, caption],
    { seqs: [caption.seq], context: [source.seq] },
    'vision',
    parse(row).edits,
  );
  expect(followingBatch.reset).toEqual([source.seq]);
  expect(followingBatch.edits).toEqual([]);
});

it.each([
  { ...chart, x: { ...chart.x, min: 10 } },
  { ...chart, y: { ...chart.y, scale: 'log' } },
  {
    ...chart,
    series: [
      {
        ...chart.series[0],
        points: [
          [0, 0],
          [11, 0],
        ],
      },
    ],
  },
  {
    ...chart,
    series: [
      {
        ...chart.series[0],
        points: [
          [1, 0],
          [0, 0],
        ],
      },
    ],
  },
  {
    ...chart,
    series: [{ ...chart.series[0], type: 'bar' }],
    y: { ...chart.y, min: 1 },
  },
  { kind: 'svg', svg: '<svg><image href="https://example.com/a"/></svg>' },
  {
    kind: 'diagram',
    title: '',
    description: '结构',
    nodes: [{ id: 'a', label: '输入', x: 0, y: 0 }],
    edges: [{ from: 'a', to: 'missing', label: '' }],
  },
])(
  'rejects unsupported or contradictory geometry instead of silently drawing it: %#',
  invalid => {
    expect(() => parseVisual(invalid)).toThrow();
    const result = parse({ seq: source.seq, visual: invalid });
    expect(result.edits).toEqual([]);
    expect(result.issues[0].reason).toContain('保留原文');
  },
);

it('preserves directed branches, labels, logarithmic scale, negative values and irregular x intervals', () => {
  expect(parseVisual(chart)).toEqual(chart);
  const noLegend = { ...chart, series: [{ ...chart.series[0], name: '' }] };
  expect(parseVisual(noLegend)).toEqual(noLegend);
  const log = {
    ...chart,
    y: {
      ...chart.y,
      min: 1,
      max: 100,
      scale: 'log',
      ticks: [
        { value: 1, label: '1' },
        { value: 10, label: '10' },
        { value: 100, label: '100' },
      ],
    },
    series: [
      {
        ...chart.series[0],
        points: [
          [0, 1],
          [1, 10],
          [10, 100],
        ],
      },
    ],
  };
  expect(parseVisual(log)).toEqual(log);
  const diagram = {
    kind: 'diagram',
    title: '流程',
    description: '输入到输出',
    nodes: [
      { id: 'a', label: '输入', x: 0.5, y: 0 },
      { id: 'b', label: '输出', x: 0.5, y: 1 },
    ],
    edges: [{ from: 'a', to: 'b', label: '计算' }],
  };
  expect(parseVisual(diagram)).toEqual(diagram);
});
