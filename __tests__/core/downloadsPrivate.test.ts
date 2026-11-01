import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { buildMap } from '@core/map';
import { learningLeaves, learningSelection } from '@core/learningScope';
import type { Block, Book, BookPart } from '@core/types';
import { createMineruAdapter } from '@services/mineru/adapter';
import type { PageSize, RawBlock } from '@services/mineru/types';

// Copyrighted books and original cloud packages are local, ignored fixtures. CI uses the
// synthetic structure/adapter regressions; this suite runs the full 2,879-page acceptance set.
const base = path.join(__dirname, '../../fixtures/private/downloads-20261102');
const run = existsSync(path.join(base, 'raw/rates/part-1'))
  ? describe
  : describe.skip;
const cases = [
  ['islp', 13, 12, []],
  ['hands-on-ml', 19, 30, [181, 326, 520, 594, 663, 784]],
  ['factor', 7, 8, [164]],
  ['blackbox', 13, 18, []],
  ['afml', 22, 30, [114]],
  ['rates', 0, 4, []],
] as const;
run(
  'all six real Downloads PDFs, through the production adapter and map',
  () => {
    test.each(cases)(
      '%s keeps content and a usable body route',
      async (short, count, firstPage, sourcePages) => {
        const d = JSON.parse(
          readFileSync(path.join(base, `${short}-result.json`), 'utf8'),
        ) as {
          book: Book;
          parts: BookPart[];
          importInfo: { sizes: PageSize[]; pageLabels: string[] | null };
        };
        const adapter = createMineruAdapter({
          list: async dir => readdirSync(dir),
          readText: async file => readFileSync(file, 'utf8'),
        });
        const raw: RawBlock[] = [],
          pageNumbers: { page: number; printed: number }[] = [],
          retained: string[] = [];
        for (const part of d.parts) {
          const dir = path.join(base, 'raw', short, `part-${part.part_no}`);
          const content = JSON.parse(
            readFileSync(
              path.join(
                dir,
                readdirSync(dir).find(f => /_content_list\.json$/.test(f))!,
              ),
              'utf8',
            ),
          ) as { type: string; text?: string }[];
          retained.push(
            ...content
              .filter(
                b =>
                  ['ref_text', 'page_footnote', 'aside_text'].includes(
                    b.type,
                  ) && b.text?.trim(),
              )
              .map(b => b.text!.trim()),
          );
          const result = await adapter.adapt(
            dir,
            { pageFrom: part.page_from },
            d.importInfo.sizes,
          );
          raw.push(...result.blocks);
          pageNumbers.push(...result.pageNumbers);
        }
        const blocks: Block[] = raw.map(b => ({
          id: b.seq,
          book_id: d.book.id,
          seq: b.seq,
          page: b.page,
          type: b.type,
          text: b.text,
          chars: Array.from(b.text).length,
          level: b.level ?? null,
          loc: null,
          section_id: null,
          x0: b.bbox?.[0] ?? null,
          y0: b.bbox?.[1] ?? null,
          x1: b.bbox?.[2] ?? null,
          y1: b.bbox?.[3] ?? null,
          latex: b.latex ?? null,
          html: b.html ?? null,
          image_path: b.imageFile ?? null,
        }));
        const map = buildMap(blocks, d.book.outline, [], {
          bookId: d.book.id,
          pageLabels: d.importInfo.pageLabels,
          pageNumbers,
        });
        const selection = learningSelection(map.sections, {}, d.book.title);
        const chapters = map.sections.filter(
          s => /^\d+$/.test(s.no ?? '') && selection.get(s.id)?.role === 'body',
        );
        if (count)
          expect(chapters.map(s => Number(s.no))).toEqual(
            Array.from({ length: count }, (_, i) => i + 1),
          );
        else
          expect(
            map.sections.filter(s => !s.parent_id && s.title !== '目录'),
          ).toHaveLength(10);
        expect(
          learningLeaves(map.sections, {}, d.book.title)[0].page_from,
        ).toBe(firstPage);
        expect(raw.filter(b => b.sourcePage).map(b => b.page)).toEqual(
          sourcePages,
        );
        const texts = new Set(raw.map(b => b.text));
        expect(retained.filter(text => !texts.has(text))).toEqual([]);
        const leaves = map.sections.filter(
          s => s.is_leaf && s.block_from !== null,
        );
        expect(
          blocks
            .filter(
              b =>
                leaves.filter(
                  s => b.seq >= s.block_from! && b.seq <= s.block_to!,
                ).length !== 1,
            )
            .map(b => b.seq),
        ).toEqual([]);
        expect(map.sections.some(s => s.title.includes('\0'))).toBe(false);
        if (short === 'islp') {
          const exercise = map.sections.find(s => s.no === '13.7')!;
          expect(exercise.title).toBe('Exercises');
          expect(
            map.sections.find(
              s => s.parent_id === exercise.id && s.title === 'Conceptual',
            ),
          ).toBeDefined();
        }
        if (short === 'hands-on-ml' || short === 'afml') {
          const byId = new Map(map.sections.map(s => [s.id, s]));
          expect(
            chapters
              .filter(s => short !== 'afml' || s.no !== '1')
              .every(s =>
                /^(?:Part |第.+部分)/i.test(byId.get(s.parent_id!)!.title),
              ),
          ).toBe(true);
        }
      },
      30000,
    );
  },
);
