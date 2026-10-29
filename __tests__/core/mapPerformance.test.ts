import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { buildMap } from '@core/map';
import * as migration from '@core/map/migration';
import type { Block, OutlineEntry } from '@core/types';

const block = (
  seq: number,
  page: number,
  type: Block['type'],
  text: string,
): Block => ({
  id: seq,
  book_id: 'scale',
  seq,
  page,
  type,
  text,
  chars: text.length,
  level: type === 'title' ? 3 : null,
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
test('200 parsed pages reconcile a 1030-bookmark outline using page-local comparisons', () => {
  const blocks: Block[] = [];
  for (let page = 1; page <= 200; page++) {
    for (let ordinal = 1; ordinal <= 10; ordinal++)
      blocks.push(
        block(
          page * 1000 + ordinal,
          page,
          ordinal === 1 || ordinal === 6 ? 'title' : 'text',
          ordinal === 1 || ordinal === 6
            ? `第${page}页主题${ordinal}小节标题`
            : '合成正文用于验证地图导入规模。'.repeat(12),
        ),
      );
  }
  const outline: OutlineEntry[] = Array.from({ length: 1030 }, (_, index) => ({
    title: `目录主题${index}小节标题`,
    page: Math.floor((index * 800) / 1030) + 1,
    level: 3,
  }));
  const compare = jest.spyOn(migration, 'textSimilarity');
  try {
    const result = buildMap(blocks, outline);
    expect(result.sections.length).toBeGreaterThan(800);
    // The old global scan performed roughly 900,000 edit-distance calls here.
    // This deterministic bound catches that algorithmic regression without a
    // machine-speed or CI-load-dependent wall-clock assertion.
    expect(compare.mock.calls.length).toBeGreaterThan(1000);
    expect(compare.mock.calls.length).toBeLessThan(12000);
  } finally {
    compare.mockRestore();
  }
});

const privateRoot = path.join(
  __dirname,
  '../../fixtures/private/ml-trading-200',
);
const privateBlocks = path.join(privateRoot, 'benchmark-blocks.json');
const privateOutline = path.join(privateRoot, 'benchmark-outline.json');
(existsSync(privateBlocks) && existsSync(privateOutline) ? test : test.skip)(
  'private 200-page live MinerU result builds the same 1170 sections with bounded comparisons',
  () => {
    const blocks = JSON.parse(readFileSync(privateBlocks, 'utf8')) as Block[];
    const outline = JSON.parse(
      readFileSync(privateOutline, 'utf8'),
    ) as OutlineEntry[];
    expect(blocks).toHaveLength(2185);
    expect(outline).toHaveLength(1030);
    const compare = jest.spyOn(migration, 'textSimilarity');
    try {
      const result = buildMap(blocks, outline);
      expect(result.sections).toHaveLength(1170);
      expect(result.parts).toHaveLength(267);
      expect(compare.mock.calls.length).toBeLessThan(12000);
    } finally {
      compare.mockRestore();
    }
  },
);
