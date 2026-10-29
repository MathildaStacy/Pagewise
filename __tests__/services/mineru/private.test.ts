import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMineruAdapter } from '@services/mineru/adapter';

const dir = join(__dirname, '../../../fixtures/private/ml-trading/parsed');
const optional = existsSync(dir) ? describe : describe.skip;
optional(
  'local private MinerU sample (no copyrighted content copied into assertions)',
  () => {
    it('verifies official normalized boxes, printed pages, headers, images, charts and tables', async () => {
      const adapter = createMineruAdapter({
        list: async path => readdirSync(path),
        readText: async path => readFileSync(path, 'utf8'),
      });
      const result = await adapter.adapt(dir, { pageFrom: 101 }, []);
      expect(result.pagesWithContent).toEqual(
        Array.from({ length: 10 }, (_, i) => 101 + i),
      );
      expect(result.pageNumbers).toEqual(
        Array.from({ length: 10 }, (_, i) => ({
          page: 101 + i,
          printed: 60 + i,
        })),
      );
      expect(result.blocks.filter(b => b.type === 'title').length).toBe(17);
      expect(result.blocks.filter(b => b.type === 'image').length).toBe(10);
      // One of the six upstream table entries is completely empty.
      expect(result.blocks.filter(b => b.type === 'table').length).toBe(5);
      expect(result.blocks.filter(b => b.type === 'equation').length).toBe(3);
      expect(
        result.blocks.every(
          b => b.bbox === null || b.bbox.every(n => n >= 0 && n <= 1),
        ),
      ).toBe(true);
      const first = result.blocks.find(
        b => b.page === 101 && b.type === 'text',
      )!;
      expect(first.bbox).toEqual([0.079, 0.067, 0.868, 0.166]);
      for (const block of result.blocks)
        if (block.imageFile)
          expect(existsSync(join(dir, block.imageFile))).toBe(true);
      expect(
        result.blocks.filter(b => b.type === 'caption').length,
      ).toBeGreaterThanOrEqual(6);
      const originals = JSON.parse(
        readFileSync(
          join(
            dir,
            readdirSync(dir).find(p => p.endsWith('_content_list.json'))!,
          ),
          'utf8',
        ),
      ) as { type: string; text?: string }[];
      const discarded = new Set(
        originals
          .filter(r => ['header', 'page_number'].includes(r.type))
          .map(r => r.text),
      );
      expect(result.blocks.every(b => !discarded.has(b.text))).toBe(true);
      expect(result.blocks.map(b => b.seq)).toEqual(
        [...result.blocks.map(b => b.seq)].sort((a, b) => a - b),
      );
    });
  },
);
