import { buildMap, inferPageOffset } from '@core/map';
import { pageLabel } from '@core/ids';
import type { Block, OutlineEntry, Section } from '@core/types';

const makeBlock = (
  seq: number,
  page: number | null,
  type: Block['type'],
  text: string,
  chars = Array.from(text).length,
  level: number | null = null,
): Block => ({
  id: seq,
  book_id: 'synthetic',
  seq,
  page,
  type,
  text,
  chars,
  level,
  loc: null,
  x0: null,
  y0: null,
  x1: null,
  y1: null,
  latex: null,
  html: null,
  image_path: null,
  section_id: null,
});
function fixture() {
  const blocks: Block[] = [],
    counter = new Map<number, number>();
  const add = (
    page: number,
    type: Block['type'],
    text: string,
    chars?: number,
    level?: number,
  ) => {
    const count = (counter.get(page) ?? 0) + 1;
    counter.set(page, count);
    blocks.push(makeBlock(page * 1000 + count, page, type, text, chars, level));
  };
  add(13, 'title', '第1章 基础', undefined, 1);
  add(13, 'text', '章首介绍', 200);
  add(13, 'title', '1.1 起步', undefined, 2);
  add(14, 'text', '第一节正文', 500);
  add(15, 'title', '1.2 极短', undefined, 2);
  add(15, 'text', '短节正文', 80);
  add(16, 'title', '1.3 稳定内容', undefined, 2);
  add(16, 'text', '完整正文', 500);
  add(20, 'title', 'Chapter 2 Search', undefined, 1);
  add(20, 'title', '2.1 变长流程', undefined, 2);
  add(21, 'title', '2.1.1 搜索算法', undefined, 3);
  add(21, 'title', '与稳定性', undefined, 3);
  add(21, 'text', '搜索的开端', 1200);
  add(22, 'text', '公式之前的引导', 900);
  add(22, 'equation', 'a+b=c', 100);
  add(22, 'caption', '公式说明', 200);
  add(23, 'text', '更多分析', 900);
  add(23, 'text', '最后一部分', 1000);
  add(30, 'title', '第三章 系统', undefined, 1);
  add(30, 'text', '3.1 编号正文标题', undefined, 2);
  add(30, 'text', '系统正文', 1000);
  add(31, 'text', '书签定位到这一段', 600);
  add(40, 'title', '附录 A 补充', undefined, 1);
  add(40, 'text', '附录正文', 500);
  const outline: OutlineEntry[] = [
    { title: '1 基础', page: 13, level: 1 },
    { title: '1.1 起步', page: 13, level: 3 },
    { title: '2.1.1 搜索算法 与稳定性', page: 21, level: 3 },
    { title: '3.2 书签补充', page: 31, level: 2 },
  ];
  const pages = [...new Set(blocks.map(block => block.page!))];
  return {
    blocks,
    outline,
    options: {
      pageNumbers: pages.map(page => ({ page, label: String(page - 12) })),
    },
  };
}
it('builds a deterministic three-chapter tree with appendix, ranges, short merges, title merges and long parts', () => {
  const { blocks, outline, options } = fixture(),
    before = JSON.stringify(blocks),
    result = buildMap(blocks, outline, [], options),
    byId = new Map(result.sections.map(section => [section.id, section]));
  expect(
    result.sections
      .filter(section => section.level === 1)
      .map(section => section.id),
  ).toEqual(['ch1', 'ch2', 'ch3', 'appA']);
  expect(byId.get('1.1')).toMatchObject({
    parent_id: 'ch1',
    level: 3,
    block_from: 13002,
    block_to: 14001,
  });
  expect(byId.get('1.2')).toMatchObject({
    merged_into: '1.3',
    is_leaf: false,
    flag: 'merged',
  });
  expect(byId.get('1.3')).toMatchObject({ block_from: 15001, block_to: 16002 });
  expect(byId.get('2.1.1')).toMatchObject({
    title: '搜索算法 与稳定性',
    parent_id: '2.1',
    parts: 2,
    flag: 'split',
  });
  expect(byId.get('3.2')).toMatchObject({
    source: 'bookmark',
    flag: 'missing',
    block_from: 31001,
    block_to: 31001,
    parent_id: 'ch3',
  });
  expect(result.flags.map(flag => flag.kind)).toEqual(
    expect.arrayContaining(['level', 'missing', 'merged', 'split']),
  );
  expect(result.pageOffset).toBe(12);
  expect(result.pageOffsetReliable).toBe(true);
  expect(JSON.stringify(blocks)).toBe(before);
  expect(buildMap(blocks, outline, result.sections, options)).toEqual(result);
  expect(buildMap([...blocks].reverse(), outline, [], options)).toEqual(result);
});
it('keeps the introduction in the first child and protects formula groups while splitting sparse seq ranges', () => {
  const { blocks, outline } = fixture(),
    result = buildMap(blocks, outline),
    parts = result.parts.filter(part => part.section_id === '2.1.1');
  expect(parts).toHaveLength(2);
  const formula = blocks.find(block => block.type === 'equation')!,
    index = blocks.indexOf(formula);
  const group = blocks.slice(index - 1, index + 2);
  expect(
    parts.some(part =>
      group.every(
        block => block.seq >= part.block_from && block.seq <= part.block_to,
      ),
    ),
  ).toBe(true);
  for (const part of parts) {
    const own = blocks.filter(
      block => block.seq >= part.block_from && block.seq <= part.block_to,
    );
    expect(
      own.reduce((sum, block) => sum + block.chars, 0),
    ).toBeGreaterThanOrEqual(1500);
    expect(
      own.reduce((sum, block) => sum + block.chars, 0),
    ).toBeLessThanOrEqual(3000);
  }
  expect(parts[0].block_to).toBeLessThan(parts[1].block_from);
  expect(result.parts.some(part => part.section_id === '1.2')).toBe(false);
});
it('preserves manual map records and previously learned status, summaries and guide text', () => {
  const { blocks, outline, options } = fixture(),
    initial = buildMap(blocks, outline, [], options);
  const manual: Section = {
    ...initial.sections.find(section => section.id === '1.3')!,
    source: 'manual',
    title: '用户改过的标题',
    status: 'done',
    summary: '用户摘要',
    guide: '用户导读',
    ord: 42,
  };
  const previous = initial.sections.map(section =>
    section.id === manual.id
      ? manual
      : section.id === '2.1.1'
      ? { ...section, status: 'learning' as const, summary: '已学内容' }
      : section,
  );
  const result = buildMap(blocks, outline, previous, options);
  expect(result.sections.find(section => section.id === manual.id)).toEqual(
    manual,
  );
  expect(result.sections.find(section => section.id === '2.1.1')).toMatchObject(
    { status: 'learning', summary: '已学内容' },
  );
  expect(previous.find(section => section.id === manual.id)).toEqual(manual);
});
it('uses PDF label mapping first, requires supported page-number coverage and exposes uncertain offsets', () => {
  expect(
    inferPageOffset([13, 14, 15], null, [
      { page: 13, label: 1 },
      { page: 14, label: 2 },
    ]),
  ).toEqual({ pageOffset: 12, reliable: true });
  expect(
    inferPageOffset([13, 14, 15, 16], null, [{ page: 13, label: 1 }]),
  ).toEqual({ pageOffset: 0, reliable: false });
  expect(
    inferPageOffset(
      [1, 2, 3, 4],
      ['i', 'ii', '1', '2'],
      [{ page: 3, label: 30 }],
    ),
  ).toEqual({ pageOffset: 2, reliable: true });
  expect(
    inferPageOffset([1], null, [
      { page: 1, label: 'a' },
      { page: 1, label: 1 },
      { page: 1, label: 2 },
    ]),
  ).toEqual({ pageOffset: 0, reliable: false });
  const book = { page_offset: 12 };
  expect(pageLabel(book, 115)).toBe('p.103');
  expect(pageLabel({ ...book, pageLabels: ['i', 'ii', '1'] }, 3)).toBe('p.1');
  expect(pageLabel({ ...book, format: 'epub' }, null, '目录 · 3')).toBe(
    '目录 · 3',
  );
  expect(pageLabel(book, null)).toBe('无页码');
});
it('recognizes numbered text titles but retains prose and generates stable IDs for unnumbered headings', () => {
  const blocks = [
    makeBlock(1001, 1, 'title', '无编号章', 10, 1),
    makeBlock(1002, 1, 'text', '1.1 这个短文本是标题'),
    makeBlock(1003, 1, 'text', '正文'.repeat(200)),
    makeBlock(2001, 2, 'title', '详细说明', 4, 2),
    makeBlock(2002, 2, 'text', '正文'.repeat(200)),
    makeBlock(3001, 3, 'text', '3.2 ' + '这是一段很长的编号正文'.repeat(8)),
  ];
  const map = buildMap(blocks);
  expect(map.sections.map(section => section.id)).toEqual([
    'u1001',
    '1.1',
    'u2001',
  ]);
  expect(map.sections.find(section => section.id === 'u2001')?.block_to).toBe(
    3001,
  );
});
it('does not promote a numbered street address to a chapter based on a distant n.1 heading', () => {
  const blocks = [
    makeBlock(3001, 3, 'text', '11 Example Street'),
    makeBlock(3002, 3, 'text', 'Publisher contact details.'),
    makeBlock(292001, 292, 'title', '11 Model Pipeline', 17, 1),
    makeBlock(292002, 292, 'text', 'Chapter introduction.'.repeat(30)),
    makeBlock(293001, 293, 'title', '11.1 First stage', 16, 2),
    makeBlock(293002, 293, 'text', 'Chapter content.'.repeat(30)),
    makeBlock(400001, 400, 'text', '12 Genuine Text Chapter'),
    makeBlock(400002, 400, 'text', 'Chapter introduction.'.repeat(30)),
    makeBlock(401001, 401, 'title', '12.1 First stage', 16, 2),
    makeBlock(401002, 401, 'text', 'Chapter content.'.repeat(30)),
  ];
  const map = buildMap(blocks);
  expect(map.sections.find(section => section.id === 'ch11')).toMatchObject({
    page_from: 292,
  });
  expect(map.sections.some(section => section.page_from === 3)).toBe(false);
  expect(map.sections.find(section => section.id === 'ch12')).toMatchObject({
    page_from: 400,
  });
});
it.each([
  'Chapter 03: Market Microstructure',
  'Chapter 03：Market Microstructure',
  'Chapter 03 - Market Microstructure',
  'Chapter 03 – Market Microstructure',
  'Chapter 03—Market Microstructure',
  'Chapter 03 Market Microstructure',
])(
  'recognizes the explicit chapter heading %s without requiring a numbered child',
  title => {
    const map = buildMap([
      makeBlock(88001, 88, 'title', title, undefined, 1),
      makeBlock(88002, 88, 'text', 'Synthetic chapter content.', 500),
    ]);
    expect(map.sections[0]).toMatchObject({
      id: 'ch3',
      no: '3',
      title: 'Market Microstructure',
      level: 1,
    });
  },
);
it('requires the Chapter prefix for chapter punctuation and leaves ordinary addresses unnumbered', () => {
  const map = buildMap([
    makeBlock(3001, 3, 'text', '11: Example Street'),
    makeBlock(3002, 3, 'text', '11 - Example Street'),
    makeBlock(88001, 88, 'title', '03: Market Microstructure', undefined, 1),
    makeBlock(88002, 88, 'text', 'Synthetic chapter content.', 500),
    makeBlock(89001, 89, 'title', '3.1 First section', undefined, 2),
    makeBlock(89002, 89, 'text', 'Synthetic section content.', 500),
    makeBlock(292001, 292, 'title', '11 - Example Street', undefined, 1),
    makeBlock(292002, 292, 'text', 'Synthetic chapter content.', 500),
    makeBlock(293001, 293, 'title', '11.1 First section', undefined, 2),
    makeBlock(293002, 293, 'text', 'Synthetic section content.', 500),
  ]);
  expect(map.sections.some(section => section.page_from === 3)).toBe(false);
  expect(map.sections.find(section => section.id === 'u88001')?.no).toBeNull();
  expect(map.sections.find(section => section.id === 'u292001')?.no).toBeNull();
  expect(
    map.sections.some(section => section.id === 'ch3' || section.id === 'ch11'),
  ).toBe(false);
});
it.each([
  'Chapter 03: Market Microstructure',
  'Chapter 03 — Market Microstructure',
])(
  'fills a matched body chapter number from %s without changing IDs, boundaries, parts or learning records',
  title => {
    const blocks = [
      makeBlock(88001, 88, 'title', 'Market Microstructure', undefined, 1),
      makeBlock(88002, 88, 'text', 'Synthetic introduction.', 500),
      makeBlock(89001, 89, 'title', '3.1 First section', undefined, 2),
      makeBlock(89002, 89, 'text', 'Synthetic section content.', 1200),
      makeBlock(90001, 90, 'text', 'Synthetic explanation.', 900),
      makeBlock(90002, 90, 'equation', 'a+b=c', 100),
      makeBlock(90003, 90, 'caption', 'Synthetic caption.', 200),
      makeBlock(91001, 91, 'text', 'Synthetic section content.', 1000),
      makeBlock(91002, 91, 'text', 'Synthetic section content.', 1000),
    ];
    const plainOutline = [
        { title: 'Market Microstructure', page: 88, level: 1 },
      ],
      initial = buildMap(blocks, plainOutline),
      previous = initial.sections.map(section => ({
        ...section,
        status: 'learning' as const,
        summary: 'Saved summary',
        guide: 'Saved guide',
      })),
      baseline = buildMap(blocks, plainOutline, previous),
      result = buildMap(blocks, [{ title, page: 88, level: 1 }], previous);
    expect(result.sections).toEqual(
      baseline.sections.map(section =>
        section.id === 'u88001' ? { ...section, no: '3' } : section,
      ),
    );
    expect(result.parts).toEqual(baseline.parts);
    expect(result.parts.length).toBeGreaterThan(1);
    expect(result.sections.some(section => section.id === 'ch3')).toBe(false);
    expect(previous.find(section => section.id === 'u88001')?.no).toBeNull();
  },
);
it('retains a conflicting body chapter number and exposes the outline disagreement as a map flag', () => {
  const map = buildMap(
    [
      makeBlock(
        88001,
        88,
        'title',
        'Chapter 04: Market Microstructure',
        undefined,
        1,
      ),
      makeBlock(88002, 88, 'text', 'Synthetic chapter content.', 500),
    ],
    [{ title: 'Chapter 03: Market Microstructure', page: 88, level: 1 }],
  );
  expect(map.sections[0]).toMatchObject({ id: 'ch4', no: '4' });
  expect(map.flags).toContainEqual({
    sectionId: 'ch4',
    kind: 'level',
    detail: { reason: 'number-conflict', recognizedNo: '4', outlineNo: '3' },
  });
  expect(map.sections[0].flag_detail).toEqual([
    {
      kind: 'level',
      detail: { reason: 'number-conflict', recognizedNo: '4', outlineNo: '3' },
    },
  ]);
});
it('adds unparsed bookmark locations without inventing ready content and handles titleless or empty books', () => {
  const blocks = [makeBlock(1001, 1, 'text', '正文'.repeat(200))];
  const result = buildMap(blocks, [
    { title: '2.1 尚未解析', page: 40, level: 2 },
  ]);
  expect(result.sections.find(section => section.id === '2.1')).toMatchObject({
    block_from: null,
    block_to: null,
    source: 'bookmark',
  });
  expect(buildMap(blocks).sections[0]).toMatchObject({
    id: 'u1001',
    title: '正文',
    block_from: 1001,
    block_to: 1001,
  });
  expect(buildMap([]).sections).toEqual([]);
  expect(buildMap([]).pageOffsetReliable).toBe(false);
});
it('keeps an indivisible oversized formula group in a single part and handles a short final sibling', () => {
  const blocks = [
    makeBlock(1001, 1, 'title', '1.1 大公式'),
    makeBlock(1002, 1, 'text', '引导', 1500),
    makeBlock(1003, 1, 'equation', '长公式', 2500),
    makeBlock(1004, 1, 'caption', '解释', 1800),
    makeBlock(2001, 2, 'title', '1.2 短节'),
    makeBlock(2002, 2, 'text', '短', 1),
  ];
  const result = buildMap(blocks);
  expect(
    result.sections.find(section => section.id === '1.2')?.merged_into,
  ).toBe('1.1');
  expect(result.parts.filter(part => part.section_id === '1.1')).toHaveLength(
    1,
  );
});
it('rejects mixed books and duplicate block sequences without mutating input', () => {
  const block = makeBlock(1001, 1, 'text', '内容');
  expect(() => buildMap([block, block])).toThrow();
  expect(() =>
    buildMap([block, { ...block, book_id: 'other', seq: 1002 }]),
  ).toThrow();
});

it('passes chapter introductions through section parents into the first learning leaf', () => {
  const blocks = [
    makeBlock(1001, 1, 'title', '第十章 正文', 6, 1),
    makeBlock(1002, 1, 'text', '章首引言', 450),
    makeBlock(1003, 1, 'title', '10.1 第一节', 8, 2),
    makeBlock(1004, 1, 'title', '10.1.1 第一小节', 12, 3),
    makeBlock(1005, 1, 'text', '小节正文', 500),
  ];
  const map = buildMap(blocks);
  expect(map.sections.find(section => section.id === 'ch10')).toBeTruthy();
  expect(map.sections.find(section => section.id === '10.1.1')).toMatchObject({
    block_from: 1002,
    block_to: 1005,
  });
});
it('merges a named introduction into the first section, and follows short-section merge chains to the final target', () => {
  const blocks = [
    makeBlock(1001, 1, 'title', '第1章 正文', 6, 1),
    makeBlock(2001, 2, 'title', '本章引言', 4, 2),
    makeBlock(2002, 2, 'text', '引言正文', 500),
    makeBlock(3001, 3, 'title', '1.1 第一节', 8, 2),
    makeBlock(3002, 3, 'title', '1.1.1 第一小节', 12, 3),
    makeBlock(3003, 3, 'text', '正文', 500),
    makeBlock(4001, 4, 'title', '1.2 短甲', 8, 2),
    makeBlock(4002, 4, 'text', '短', 30),
    makeBlock(5001, 5, 'title', '1.3 短乙', 8, 2),
    makeBlock(5002, 5, 'text', '短', 30),
    makeBlock(6001, 6, 'title', '1.4 最后', 8, 2),
    makeBlock(6002, 6, 'text', '长正文', 600),
  ];
  const map = buildMap(blocks);
  expect(
    map.sections.find(section => section.id === 'u2001')?.merged_into,
  ).toBe('1.1');
  expect(map.sections.find(section => section.id === '1.1.1')?.block_from).toBe(
    2001,
  );
  expect(map.sections.find(section => section.id === '1.2')).toMatchObject({
    merged_into: '1.4',
    flag_detail: { into: '1.4' },
  });
  expect(map.sections.find(section => section.id === '1.4')?.block_from).toBe(
    4001,
  );
});
it('keeps parsed titleless content available when all bookmark pages are still pending', () => {
  const map = buildMap(
    [makeBlock(1001, 1, 'text', '正文', 500)],
    [{ title: 'Chapter 2 Pending', page: 200, level: 1 }],
  );
  expect(map.sections.find(section => section.id === 'u1001')).toMatchObject({
    block_from: 1001,
    is_leaf: true,
  });
  expect(map.sections.find(section => section.id === 'ch2')).toMatchObject({
    block_from: null,
  });
});
it('handles repeated IDs, unsupported outline levels and numeric-only titles deterministically', () => {
  const blocks = [
    makeBlock(1001, 1, 'title', '1.1', 3, 2),
    makeBlock(1002, 1, 'text', '正文', 500),
    makeBlock(2001, 2, 'title', '1.2 相同标题', 10, 2),
    makeBlock(2002, 2, 'text', '正文', 500),
    makeBlock(3001, 3, 'title', '1.2 重复编号', 10, 2),
    makeBlock(3002, 3, 'text', '正文', 500),
  ];
  const map = buildMap(blocks, [
    { title: '忽略', page: 1, level: 4 },
    { title: '1.2 相同标题', page: 99, level: 2 },
  ]);
  expect(new Set(map.sections.map(section => section.id)).size).toBe(
    map.sections.length,
  );
  expect(map.sections.find(section => section.id === 'u1001')?.title).toBe(
    '1.1',
  );
  expect(map.sections.some(section => section.id === '1.2_b3001')).toBe(true);
  expect(map.sections.some(section => section.id === '1.2_p99')).toBe(true);
  expect(map.sections.some(section => section.title === '忽略')).toBe(false);
});
