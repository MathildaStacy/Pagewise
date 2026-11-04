import { createTestDemoContainer } from '@app/testing';
import type { Container } from '@app/container';
import {
  loadBookNotes,
  loadNoteDetail,
  loadNotes,
  saveUserNote,
} from '@app/usecases/notes';
import {
  presentNoteDetail,
  presentNotes,
  sectionHasNotes,
} from '@features/notes/presenters';

let c: Container;
beforeEach(async () => {
  c = await createTestDemoContainer();
});
afterEach(async () => {
  jest.restoreAllMocks();
  await c.close();
});

const queries = () => {
  const all = jest.spyOn(c.db, 'all'),
    get = jest.spyOn(c.db, 'get');
  return {
    count: () => all.mock.calls.length + get.mock.calls.length,
    sql: () => [...all.mock.calls, ...get.mock.calls].map(([sql]) => sql),
    reset: () => {
      all.mockClear();
      get.mockClear();
    },
  };
};

it('keeps shelf counts and section detail equal to the full book notes', async () => {
  await saveUserNote(c, 'aima', '3.5.2', '我的理解');
  const block = (await c.repos.blocks.bySection('aima', '3.5.2')).find(
    b => b.type === 'text',
  )!;
  for (const start of [0, 5])
    await c.repos.notes.highlights.toggle({
      book_id: 'aima',
      block_seq: block.seq,
      start,
      end: start + 3,
      created_at: c.clock.now().toISOString(),
    });
  const full = await loadBookNotes(c, 'aima');
  const overview = (await loadNotes(c)).find(d => d.book.id === 'aima')!;
  expect(overview).toMatchObject({
    sectionCount: full.sections.filter(s => sectionHasNotes(full, s)).length,
    qaCount: full.qa.length,
    highlightCount: full.highlights.length,
  });
  expect(overview.sectionCount).toBeGreaterThan(0);
  expect(presentNotes([overview]).books[0]).toMatchObject({
    hasNotes: true,
    meta: `${overview.sectionCount} 节有笔记 · ${full.qa.length} 条问答 · ${full.highlights.length} 处批注`,
  });

  const detail = await loadNoteDetail(c, 'aima', '3.5.2');
  expect(detail.section?.id).toBe('3.5.2');
  expect(detail.qa).toEqual(full.qa.filter(q => q.section_id === '3.5.2'));
  expect(detail.stuck).toEqual(
    full.stuck.filter(s => s.section_id === '3.5.2'),
  );
  expect(detail.pins).toEqual(full.pins.filter(p => p.section_id === '3.5.2'));
  expect(detail.highlights).toEqual(
    full.highlights.filter(h =>
      detail.sectionBlocks.some(b => b.seq === h.block_seq),
    ),
  );
  expect(detail.userNote?.user_text).toBe('我的理解');
  expect(
    presentNoteDetail(detail, '3.5.2').highlights.filter(
      h => h.ref === `b${block.seq}`,
    ),
  ).toHaveLength(2);
});

it('reads ten books of one hundred sections in two shelf queries and eight detail queries', async () => {
  const template = (await c.repos.books.get('aima'))!;
  for (const book of await c.repos.books.list())
    await c.repos.books.remove(book.id);
  for (let bookNo = 0; bookNo < 10; bookNo++) {
    const id = `perf-${bookNo}`;
    await c.repos.books.insert({ ...template, id, sha256: id });
    await c.db.transaction(async tx => {
      for (let sectionNo = 0; sectionNo < 100; sectionNo++)
        await tx.run(
          'INSERT INTO section(book_id,id,level,ord,title,is_leaf,source) VALUES (?,?,1,?,?,1,?)',
          [id, `s${sectionNo}`, sectionNo, `小节${sectionNo}`, 'auto'],
        );
    });
  }
  const q = queries();
  expect(await loadNotes(c)).toHaveLength(10);
  expect(q.count()).toBe(2);
  q.reset();
  const detail = await loadNoteDetail(c, 'perf-0', 's50');
  expect(detail.section?.title).toBe('小节50');
  expect(q.count()).toBe(8);
  // The detail page never loads the whole table of contents.
  expect(
    q.sql().some(sql => /FROM section WHERE book_id=\? ORDER/.test(sql)),
  ).toBe(false);
});

it('batches highlighted blocks and keeps repeated highlights for export', async () => {
  const blocks = await c.repos.blocks.bySection('aima', '3.5.2');
  for (const block of blocks)
    for (const start of [1, 4])
      await c.repos.notes.highlights.toggle({
        book_id: 'aima',
        block_seq: block.seq,
        start,
        end: start + 1,
        created_at: c.clock.now().toISOString(),
      });
  const q = queries();
  const notes = await loadBookNotes(c, 'aima');
  expect(notes.highlights.length).toBeGreaterThanOrEqual(blocks.length * 2);
  expect(notes.blocks).toHaveLength(notes.highlights.length);
  expect(notes.blocks.map(b => b.seq)).toEqual(
    notes.highlights.map(h => h.block_seq),
  );
  // No per-section note or per-highlight block lookups.
  expect(q.sql().filter(sql => /section_id = \?$/.test(sql))).toHaveLength(0);
  expect(q.sql().filter(sql => /seq=\?$/.test(sql))).toHaveLength(0);
});

it('chunks large block lookups below the SQLite parameter limit', async () => {
  const blocks = await c.repos.blocks.range('aima', 0, Number.MAX_SAFE_INTEGER);
  const refs = blocks.map(b => b.seq);
  const all = jest.spyOn(c.db, 'all');
  const found = await c.repos.blocks.byRefs('aima', [...refs, ...refs, -1]);
  expect(found.map(b => b.seq)).toEqual(
    [...new Set(refs)].sort((a, b) => a - b),
  );
  expect(all).toHaveBeenCalledTimes(Math.ceil(new Set(refs).size / 400) || 0);
});
