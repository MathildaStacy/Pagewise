import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { buildMap } from '@core/map';
import { layoutCharacters, ruleEdits } from '@core/refinement';
import type { Block, Section } from '@core/types';
import { learningLeaves } from '@core/learningScope';
import { structureIssues } from '@core/map/structureChecks';

// The real AIMA 4th-edition MinerU result (all 2145 pages), exported from the app into the
// gitignored private fixture folder. Skipped when the book is not on this machine.
const file = path.join(__dirname, '../../fixtures/private/aima/blocks.json');
const run = existsSync(file) ? describe : describe.skip;

run('AIMA map and structure refinement on the real parse', () => {
  const blocks = existsSync(file)
    ? (JSON.parse(readFileSync(file, 'utf8')) as Block[])
    : [];
  const map = buildMap(blocks, null, [], { bookId: blocks[0]?.book_id });
  const byId = new Map(map.sections.map(s => [s.id, s]));
  const units = map.sections.filter(s => s.is_leaf && !s.merged_into);
  const own = (s: Section) =>
    blocks.filter(b => b.seq >= s.block_from! && b.seq <= s.block_to!);

  it('excludes bibliography from the default path and surfaces the missing 20.3.1 beside its source', () => {
    const bibliography = map.sections.find(s => s.title === 'Bibliography')!;
    expect(bibliography.parts).toBe(103);
    expect(
      learningLeaves(map.sections).some(s => s.id === bibliography.id),
    ).toBe(false);
    expect(map.sections.some(s => s.id === bibliography.id)).toBe(true);
    expect(structureIssues(map.sections)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('20.3.1'),
          sectionId: '20.3-intro',
        }),
        expect.objectContaining({
          message: expect.stringContaining('26.2 编号重复'),
        }),
      ]),
    );
  });

  it('starts the real learning route at chapter 1 rather than the repeated title pages and preface group', () => {
    const route = learningLeaves(
      map.sections,
      {},
      'Artificial Intelligence A Modern Approach',
    );
    expect(route[0].id).toBe('ch1-intro');
    expect(route.some(s => s.page_to !== null && s.page_to < 29)).toBe(false);
    expect(map.sections.some(s => s.title === 'New to this edition')).toBe(
      true,
    );
  });

  it('follows the printed structure: 28 chapters, two appendices, numbered sections in order', () => {
    const top = map.sections.filter(s => s.level === 1 && s.no);
    expect(top.map(s => s.id)).toEqual([
      ...Array.from({ length: 28 }, (_, i) => `ch${i + 1}`),
      'appA',
      'appB',
    ]);
    // Before: 268 numbered sections hung under margin terms such as `Softmax`.
    expect(
      map.sections.filter(
        s => s.no?.includes('.') && s.parent_id && !byId.get(s.parent_id)?.no,
      ),
    ).toEqual([]);
    // Before: 76 IDs were suffixed because contents lines took them. The one left is a
    // source book itself repeats `26.2` on physical page 1692.
    expect(
      map.sections.filter(s => /_[bp]\d+$/.test(s.id)).map(s => s.id),
    ).toEqual(['26.2_b1692003']);
  });

  it('makes study units a readable size and puts every block in one', () => {
    const chars = units.map(u => u.chars).sort((a, b) => a - b);
    // Before: 891 units, 157 under 1000 characters, median 2682, 296 blocks in none.
    expect(units.length).toBeLessThan(620);
    expect(chars.filter(c => c < 1000).length).toBeLessThan(15);
    expect(chars[Math.floor(chars.length / 2)]).toBeGreaterThan(4000);
    const covered = new Set(units.flatMap(u => own(u).map(b => b.seq)));
    expect(blocks.length - covered.size).toBeLessThanOrEqual(1);
  });

  it('reads chapter 21 the way the book does', () => {
    const tree = map.sections
      .filter(s => s.page_from! >= 1378 && s.page_to! <= 1448 && s.level > 1)
      .map(s => s.id);
    expect(tree.slice(0, 6)).toEqual([
      'ch21-intro',
      '21.1',
      '21.1.1',
      '21.1.2',
      '21.2',
      '21.2.1',
    ]);
    expect(tree).not.toContain('u1387003'); // the margin term `Hidden layer`
    const intro = own(byId.get('ch21-intro')!);
    expect(intro[0].text).toBe('Chapter 21 Deep Learning');
    const first = own(byId.get('21.1.1')!);
    expect(first[0].text).toMatch(/^21\.1 Simple Feedforward Networks/);
    // 21.1.2 now holds its own text instead of losing it to `Hidden layer`.
    expect(byId.get('21.1.2')!.chars).toBeGreaterThan(8000);
  });

  it('suggests structure without changing wording, across chapters', () => {
    const sample = ['19.6.2', '21.1.1', '21.3-intro', '24.1', '26.5.2', 'A.3'];
    for (const id of sample) {
      const source = own(byId.get(id)!);
      const edits = ruleEdits(source);
      for (const e of edits) {
        const b = source.find(s => s.seq === e.seq)!;
        expect(layoutCharacters(e.text)).toBe(layoutCharacters(b.text));
        if (e.role === 'note') expect(b.x0!).toBeGreaterThan(0.18);
      }
    }
    const unit = own(byId.get('21.1.1')!);
    const notes = ruleEdits(unit)
      .filter(e => e.role === 'note')
      .map(e => unit.find(b => b.seq === e.seq)!.text.trim());
    // MinerU dropped the `Unit` term on p.1381 entirely, so it cannot appear here.
    expect(notes).toEqual(
      expect.arrayContaining([
        'Feedforward network',
        'Recurrent network',
        'Activation function',
      ]),
    );
    // Pseudocode lines on one page are not glued into a paragraph.
    const gd = own(byId.get('19.6.2')!);
    expect(
      ruleEdits(gd).filter(e => {
        const from = gd.find(b => b.seq === e.continuesFrom);
        return from && from.page === gd.find(b => b.seq === e.seq)!.page;
      }),
    ).toEqual([]);
  });
});
