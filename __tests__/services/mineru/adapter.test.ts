import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  adaptContentList,
  createMineruAdapter,
} from '@services/mineru/adapter';
import fixture from '../../../fixtures/mineru-synthetic/sample_content_list.json';
import layout from '../../../fixtures/mineru-synthetic/layout.json';

it('adapts the synthetic package into stable original-page blocks and retains referenceable captions', () => {
  const result = adaptContentList(fixture, { pageFrom: 13, layout });
  expect(result.pagesWithContent).toEqual([13, 14, 16]);
  expect(result.pageNumbers).toEqual([
    { page: 13, printed: 1 },
    { page: 14, printed: 2 },
    { page: 15, printed: 3 },
  ]);
  expect(result.blocks).toHaveLength(15);
  expect(result.blocks[0]).toMatchObject({
    seq: 13001,
    page: 13,
    type: 'title',
    level: 1,
  });
  const list = result.blocks.find(b => b.type === 'list')!;
  expect(list.text).toBe('起点是 A。\n终点是 B。');
  expect(list.bbox).toEqual([0.1, 0.26, 0.5, 0.33]);
  const image = result.blocks.find(b => b.type === 'image')!;
  expect(image).toMatchObject({
    imageFile: 'images/route.svg',
    caption: '图 1：机器人走向目标。\n箭头表示可走的方向。',
  });
  expect(
    result.blocks.filter(b => b.type === 'caption').map(b => b.text),
  ).toEqual([
    '图 1：机器人走向目标。',
    '箭头表示可走的方向。',
    '表 1：自编代价。',
  ]);
  expect(result.blocks.find(b => b.type === 'footnote')?.text).toBe(
    '示意图为本项目自绘。',
  );
  expect(result.blocks.find(b => b.type === 'table')).toMatchObject({
    text: '节点 代价 A 2 & 3',
    html: expect.stringContaining('<table>'),
  });
  expect(result.blocks.find(b => b.type === 'code')?.text).toBe(
    'cost = left + right',
  );
  expect(result.blocks.find(b => b.type === 'equation')).toMatchObject({
    latex: 'f(n)=g(n)+h(n)',
    bbox: [0.1, 0.2, 0.9, 0.3],
  });
  expect(
    result.blocks.some(b => b.text.includes('页眉') || b.text.includes('页脚')),
  ).toBe(false);
});

it('normalizes point, pixel, 0..1000 and relative boxes without using the wrong page dimensions', () => {
  const result = adaptContentList(fixture, { pageFrom: 13, layout });
  expect(result.blocks.find(b => b.text === '点坐标段落')?.bbox).toEqual([
    0.1, 0.2, 0.5, 0.25,
  ]);
  const pixelBox = result.blocks.find(b => b.text === '像素坐标段落。')!.bbox!;
  [0.1, 0.4, 0.9, 0.5].forEach((n, index) =>
    expect(pixelBox[index]).toBeCloseTo(n),
  );
  expect(result.blocks.find(b => b.text.startsWith('这段'))?.bbox).toEqual([
    0.1, 0.11, 0.9, 0.17,
  ]);
  expect(result.blocks.at(-1)?.bbox).toEqual([0.1, 0.15, 0.9, 0.25]);
  const content = [
    {
      type: 'text',
      text: 'original page 2',
      page_idx: 0,
      bbox: [100, 200, 500, 600],
    },
  ];
  const point = adaptContentList(content, {
    pageFrom: 2,
    pageSizes: [
      { w: 1, h: 1 },
      { w: 1000, h: 2000 },
    ],
    coordinateSystem: 'page',
  });
  expect(point.blocks[0].bbox).toEqual([0.1, 0.1, 0.5, 0.3]);
  expect(
    adaptContentList(content, { pageFrom: 1, coordinateSystem: 'page' })
      .blocks[0].bbox,
  ).toBeNull();
});

it('reads a real directory-shaped package through injected IO and prefixes nested image paths', async () => {
  const dir = join(__dirname, '../../../fixtures/mineru-synthetic');
  const adapter = createMineruAdapter({
    list: async root => readdirSync(root),
    readText: async path => readFileSync(path, 'utf8'),
  });
  const result = await adapter.adapt(dir, { pageFrom: 13 }, []);
  expect(result.blocks).toEqual(
    adaptContentList(fixture, { pageFrom: 13, layout }).blocks,
  );
  const nested = createMineruAdapter({
    list: async () => ['auto/sample_content_list.json', 'auto/layout.json'],
    readText: async path =>
      JSON.stringify(path.endsWith('layout.json') ? layout : fixture),
  });
  expect(
    (await nested.adapt('/result', { pageFrom: 13 }, [])).blocks.find(
      b => b.type === 'image',
    )?.imageFile,
  ).toBe('auto/images/route.svg');
});

it('preserves page-local input order, list arrays, headings and equation-only blocks', () => {
  const result = adaptContentList(
    [
      { type: 'text', page_idx: 1, text: 'second page' },
      { type: 'title', page_idx: 0, text: 'Heading', level: 3 },
      { type: 'list', page_idx: 0, list_items: ['one', { text: 'two' }] },
      { type: 'interline_equation', page_idx: 0, latex: 'x^2' },
      { type: 'mystery', page_idx: 0, text: 'unknown type' },
    ],
    { pageFrom: 1 },
  );
  expect(result.blocks.map(b => b.seq)).toEqual([1001, 1002, 1003, 2001]);
  expect(result.blocks[0]).toMatchObject({ level: 3, type: 'title' });
  expect(result.blocks[1].text).toBe('one\ntwo');
  expect(result.blocks[2].latex).toBe('x^2');
});

it('handles bad boxes as unavailable geometry while keeping readable text', () => {
  const result = adaptContentList(
    [
      {
        type: 'text',
        text: 'inverted',
        page_idx: 0,
        bbox: [900, 800, -100, 200],
      },
      { type: 'text', text: 'invalid', page_idx: 0, bbox: [0, 0, 'oops', 100] },
      { type: 'text', text: 'zero', page_idx: 0, bbox: [100, 100, 100, 200] },
    ],
    { pageFrom: 1 },
  );
  expect(result.blocks.map(b => b.bbox)).toEqual([
    [0, 0.2, 0.9, 0.8],
    null,
    null,
  ]);
});

it('rejects malformed content, unsafe image paths, ambiguous packages and page sequence overflow', async () => {
  for (const value of [{}, [null], [{ type: 'text', text: 'missing page' }]])
    expect(() => adaptContentList(value, { pageFrom: 1 })).toThrow();
  for (const img_path of [
    '../secret.png',
    '/secret.png',
    'https://external/image',
  ])
    expect(() =>
      adaptContentList([{ type: 'image', img_path, page_idx: 0 }], {
        pageFrom: 1,
      }),
    ).toThrow();
  expect(() =>
    adaptContentList(
      Array.from({ length: 1000 }, () => ({
        type: 'text',
        text: 'block',
        page_idx: 0,
      })),
      { pageFrom: 1 },
    ),
  ).toThrow();
  const adapter = createMineruAdapter({
    list: async () => ['one_content_list.json', 'two_content_list.json'],
    readText: async () => '[]',
  });
  await expect(adapter.adapt('/r', { pageFrom: 1 }, [])).rejects.toMatchObject({
    code: 'protocol',
  });
  const broken = createMineruAdapter({
    list: async () => ['content_list.json'],
    readText: async () => 'invalid-json',
  });
  await expect(broken.adapt('/r', { pageFrom: 1 }, [])).rejects.toMatchObject({
    code: 'protocol',
  });
});

it('retains chart images and their captions as referenceable image blocks', () => {
  const result = adaptContentList(
    [
      {
        type: 'chart',
        img_path: 'images/chart.svg',
        chart_caption: ['图表说明'],
        chart_footnote: ['图表脚注'],
        page_idx: 0,
        bbox: [100, 100, 900, 500],
      },
    ],
    { pageFrom: 1 },
  );
  expect(result.blocks).toEqual([
    {
      seq: 1001,
      page: 1,
      bbox: [0.1, 0.1, 0.9, 0.5],
      type: 'image',
      text: '',
      imageFile: 'images/chart.svg',
      caption: '图表说明',
    },
    { seq: 1002, page: 1, bbox: null, type: 'caption', text: '图表说明' },
    { seq: 1003, page: 1, bbox: null, type: 'footnote', text: '图表脚注' },
  ]);
});
