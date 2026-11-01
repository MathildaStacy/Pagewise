import { buildMap } from '@core/map';
import { learningLeaves } from '@core/learningScope';
import type { Block, OutlineEntry } from '@core/types';

const b = (
  seq: number,
  text: string,
  type: Block['type'] = 'title',
): Block => ({
  id: seq,
  book_id: 'patterns',
  seq,
  page: Math.floor(seq / 1000),
  text,
  type,
  chars: type === 'text' ? 1000 : text.length,
  level: 1,
  loc: null,
  section_id: null,
  x0: null,
  x1: null,
  y0: null,
  y1: null,
  latex: null,
  html: null,
  image_path: null,
});

it('uses contents and the printed-page offset when bookmarks are a dense page navigation list', () => {
  const outline: OutlineEntry[] = Array.from({ length: 30 }, (_, i) => ({
    title: `${i + 1}\0`,
    page: i + 11,
    level: 1,
  }));
  outline.unshift({ title: '目录\0', page: 1, level: 1 });
  const titles = ['起点', '数据', '模型', '风险', '执行', '评价'];
  const blocks = [
    b(
      1001,
      titles.map((t, i) => `第${i + 1}章 ${t} /${i * 5 + 1}`).join('\n'),
      'text',
    ),
    ...titles.flatMap((t, i) => [
      b((i * 5 + 11) * 1000 + 1, t),
      b((i * 5 + 11) * 1000 + 2, '章节正文', 'text'),
    ]),
  ];
  const { sections } = buildMap(blocks, outline);
  expect(sections.filter(s => s.no).map(s => s.no)).toEqual([
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
  ]);
  expect(
    sections.some(s => /^\d+$/.test(s.title) || s.title.includes('\0')),
  ).toBe(false);
  expect(learningLeaves(sections)[0].page_from).toBe(11);
});

it('keeps independently bookmarked adjacent exercise headings separate', () => {
  const blocks = [
    b(1001, '1 Foundations'),
    b(1002, 'Opening', 'text'),
    b(2001, '1.7 Exercises'),
    b(2002, 'Conceptual'),
    b(2003, 'Questions', 'text'),
  ];
  const { sections } = buildMap(blocks, [
    { title: '1 Foundations', page: 1, level: 1 },
    { title: '1.7 Exercises', page: 2, level: 2 },
    { title: 'Conceptual', page: 2, level: 3 },
  ]);
  expect(sections.find(s => s.id === '1.7')?.title).toBe('Exercises');
  expect(sections.find(s => s.title === 'Conceptual')).toMatchObject({
    parent_id: '1.7',
    block_from: 1001,
  });
  expect(sections.filter(s => s.title.includes('Conceptual'))).toHaveLength(1);
});

it('ignores part overview lists and keeps later chapters out of the preceding bibliography', () => {
  const blocks = [
    b(1001, 'Data Analysis'),
    b(
      1002,
      'Chapter 2: Data, 3\nChapter 3: Labels, 5\nChapter 4: Weights, 7',
      'text',
    ),
    b(3001, '第2章 Data'),
    b(3002, '2.1 Motivation'),
    b(3003, 'Body', 'text'),
    b(4001, 'BIBLIOGRAPHY'),
    b(4002, 'References', 'text'),
    b(5001, 'Labels'),
    b(5002, '3.1 Motivation'),
    b(5003, 'Body', 'text'),
    b(6001, 'EXERCISES'),
    b(6002, '3.2 Explain the label', 'text'),
  ];
  const { sections } = buildMap(blocks, [
    { title: 'Part 1: Data Analysis', page: 1, level: 1 },
    { title: '2 Data', page: 3, level: 2 },
    { title: '3 Labels', page: 5, level: 2 },
  ]);
  const part = sections.find(s => s.level === 1)!;
  const chapters = sections.filter(s => /^\d+$/.test(s.no ?? ''));
  expect(chapters.map(s => s.no)).toEqual(['2', '3']);
  expect(chapters.every(s => s.parent_id === part.id)).toBe(true);
  expect(chapters[0].flag_detail).toBeNull();
  expect(sections.find(s => s.no === '3.1')?.parent_id).toBe(chapters[1].id);
  expect(sections.some(s => s.no === '3.2')).toBe(false);
  expect(learningLeaves(sections).some(s => s.no === '3.1')).toBe(true);
});

it('keeps repeated chapter numbers in appendix answers and out of the default route', () => {
  const blocks = [
    b(1001, '第1章 基础'),
    b(1002, '1.1 正文'),
    b(1003, '正文', 'text'),
    b(10001, '附录A 答案'),
    b(10002, '第1章：基础'),
    b(10003, '答案', 'text'),
    b(11001, '第2章：进阶'),
    b(11002, '答案', 'text'),
  ];
  const { sections } = buildMap(blocks, [
    { title: '附录A 答案', page: 10, level: 1 },
  ]);
  expect(sections.filter(s => s.no === '1' && !s.parent_id)).toHaveLength(1);
  expect(sections.find(s => s.id === 'appA-ch1')?.parent_id).toBe('appA');
  expect(learningLeaves(sections).every(s => s.page_to! < 10)).toBe(true);
});

it('retains text before a same-page heading in the first reading unit', () => {
  const blocks = [
    b(1001, 'Authors and introductory instructions', 'text'),
    b(1002, '目录'),
    b(1003, 'Contents list', 'text'),
  ];
  const { sections } = buildMap(blocks);
  expect(sections.find(s => s.is_leaf)?.block_from).toBe(1001);
});
