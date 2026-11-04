import {
  explainInput,
  explainMap,
  mentionedLabels,
  referencedMaterial,
} from '@app/study/explainContext';
import { translationBackground } from '@app/study/translation';
import { learningSelection } from '@core/learningScope';
import { splitSentences } from '@core/text';
import type { Block, Section } from '@core/types';

const section = (
  id: string,
  parent_id: string | null,
  level: 1 | 2 | 3,
  ord: number,
  patch: Partial<Section> = {},
): Section => ({
  book_id: 'book',
  id,
  parent_id,
  level,
  ord,
  no: id.replace(/^ch/, ''),
  title: id,
  is_leaf: level === 3,
  block_from: null,
  block_to: null,
  page_from: 1,
  page_to: 2,
  chars: 500,
  parts: 1,
  status: 'new',
  summary: null,
  guide: null,
  source: 'auto',
  flag: null,
  flag_detail: null,
  merged_into: null,
  ...patch,
});
const block = (
  seq: number,
  type: Block['type'],
  text: string,
  patch: Partial<Block> = {},
): Block => ({
  id: seq,
  book_id: 'book',
  seq,
  page: Math.floor(seq / 1000),
  loc: null,
  x0: null,
  y0: null,
  x1: null,
  y1: null,
  type,
  level: null,
  text,
  latex: null,
  html: null,
  image_path: null,
  section_id: '3.5.3',
  chars: text.length,
  ...patch,
});
const sections = [
  section('cover', null, 1, 0, { title: '封面', no: null, is_leaf: true }),
  section('ch1', null, 1, 1, { title: '因子投资基础' }),
  section('1.1', 'ch1', 2, 2, { title: '一个公式' }),
  section('ch3', null, 1, 3, { title: '主流因子解读' }),
  section('3.5', 'ch3', 2, 4, { title: '动量因子' }),
  section('3.5.2', '3.5', 3, 5, { title: '动量因子成因' }),
  section('3.5.3', '3.5', 3, 6, {
    title: '动量因子实证',
    guide: JSON.stringify({ one_line: '用 A 股数据检验动量', full: '' }),
  }),
  section('u499', null, 1, 7, { title: '参考文献', no: null, is_leaf: true }),
];
const roles = learningSelection(sections, {}, '因子投资');
const blocks = [
  block(168002, 'title', '3.5.3 动量因子实证'),
  block(168003, 'text', '熟悉 A 股市场的读者可能有这样的体会。'),
  block(169001, 'image', '', { image_path: 'images/p169_1.jpg' }),
  block(169002, 'caption', '图3.20 动量变量数据覆盖度'),
  block(169003, 'table', 'Low 2 3 High', {
    html: '<table><tr><td>Low</td><td>High</td></tr></table>',
  }),
  block(169004, 'caption', '表3.19 动量分组的描述性统计'),
  block(169005, 'text', '如表3.19所示，High 组的收益最高，见式（3.1）。'),
  block(169006, 'equation', 'r', { latex: 'r_t = a + b x_t \\tag{3.1}' }),
];

it('splits sentences at full stops without breaking math, quotes or abbreviations', () => {
  expect(
    splitSentences(
      '动量来自风险补偿。Daniel et al. (1998) 认为是过度自信！收益为 $r=0.5. 2$ 时显著。“动量崩溃”。',
    ),
  ).toEqual([
    '动量来自风险补偿。',
    'Daniel et al. (1998) 认为是过度自信！',
    '收益为 $r=0.5. 2$ 时显著。“动量崩溃”。',
  ]);
  expect(splitSentences('Momentum works. It fails in crashes.')).toEqual([
    'Momentum works.',
    'It fails in crashes.',
  ]);
  expect(splitSentences('没有句号的一段')).toEqual(['没有句号的一段']);
});

it('finds the figures, tables and equations a paragraph mentions', () => {
  expect(mentionedLabels('见表3.19和图 3-2，以及式（3.1）')).toHaveLength(3);
  const refs = referencedMaterial(blocks[6], blocks);
  expect(refs.map(ref => ref.seq)).toEqual([169003, 169006]);
  expect(refs[0]).toMatchObject({
    type: 'table',
    caption: '表3.19 动量分组的描述性统计',
    html: '<table><tr><td>Low</td><td>High</td></tr></table>',
  });
  expect(refs[1]).toMatchObject({
    type: 'equation',
    latex: 'r_t = a + b x_t \\tag{3.1}',
  });
});

it('explains a block with its place in the book, neighbours and mentioned material', () => {
  const input = explainInput({
    block: blocks[6],
    section: blocks,
    nearby: blocks,
    sections,
    roles,
    page: 'p.169',
    focus: '如表3.19所示，High 组的收益最高，见式（3.1）。',
  });
  expect(input).toMatchObject({
    seq: 169005,
    block: { seq: 169005, type: 'text' },
    location: {
      path: ['3 主流因子解读', '3.5 动量因子', '3.5.3 动量因子实证'],
      page: 'p.169',
      guide: '用 A 股数据检验动量',
    },
    focus: '如表3.19所示，High 组的收益最高，见式（3.1）。',
  });
  expect((input.before as { seq: number }[]).map(item => item.seq)).toEqual([
    169003, 169004,
  ]);
  expect((input.after as { seq: number }[]).map(item => item.seq)).toEqual([
    169006,
  ]);
  expect((input.refs as { seq: number }[]).map(ref => ref.seq)).toEqual([
    169003, 169006,
  ]);
});

it('gives a figure its caption and a caption its figure', () => {
  const figure = explainInput({
    block: blocks[2],
    section: blocks,
    nearby: blocks,
    sections,
    roles,
    page: 'p.169',
  });
  expect(figure.block).toMatchObject({
    type: 'image',
    caption: '图3.20 动量变量数据覆盖度',
  });
  expect((figure.before as { seq: number }[]).map(item => item.seq)).toEqual([
    168002, 168003,
  ]);
  const caption = explainInput({
    block: blocks[5],
    section: blocks,
    nearby: blocks,
    sections,
    roles,
    page: 'p.169',
  });
  expect(caption.block).toMatchObject({
    type: 'caption',
    figure: { type: 'table', html: expect.stringContaining('<table>') },
  });
});

it('keeps chapter titles and the current chapter but leaves out front and back matter', () => {
  expect(explainMap(sections, '3.5.3', roles)).toEqual([
    '1 因子投资基础',
    '3 主流因子解读',
    '  3.5 动量因子',
    '    3.5.2 动量因子成因',
    '    3.5.3 动量因子实证 ← 当前',
  ]);
});

it('lends translation the previous passage as reference without making it the task', () => {
  expect(translationBackground('', undefined)).toBeUndefined();
  const text = translationBackground('Level 2 (L2)', {
    source: 'L2 adds displayed depth.',
    answer: 'L2 增加了显示深度。',
  })!;
  expect(text).toContain('本段所在小节：Level 2 (L2)');
  expect(text).toContain('上一段原文：L2 adds displayed depth.');
  expect(text).toContain('上一段译文：L2 增加了显示深度。');
  expect(text).toContain('只翻译 input.block');
});
