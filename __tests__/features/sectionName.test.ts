import { sectionName } from '@features/sectionName';
import { sectionLabel as studySectionLabel } from '@features/study/presenters';
import { sectionLabel as reviewSectionLabel } from '@features/review/presenters';
import { presentMap } from '@features/library/presenters';
import {
  presentNotesBook,
  presentNoteDetail,
} from '@features/notes/presenters';
import { createTestDemoContainer } from '@app/testing';
import { loadBookMap } from '@app/usecases/library';
import { loadBookNotes, loadNoteDetail } from '@app/usecases/notes';
import type { MapNode } from '@features/library/types';

it.each([
  ['1.1', '1.1 Introduction', '1.1 Introduction'],
  ['1.1', 'Introduction', '1.1 Introduction'],
  ['1.1', '1.10 Details', '1.1 1.10 Details'],
  ['2', '2D Models', '2 2D Models'],
  ['3.5', '3.5\u3000启发式搜索', '3.5\u3000启发式搜索'],
  [null, 'Part I Basics', 'Part I Basics'],
])(
  'formats the source heading %s / %s without repeating an existing number',
  (no, title, expected) => {
    expect(sectionName({ no, title })).toBe(expected);
  },
);

it('keeps a numbered imported title consistent across the map, reader, review and notes', async () => {
  const c = await createTestDemoContainer();
  try {
    const record = await loadBookMap(c, 'aima');
    const original = record.sections.find(s => s.is_leaf && s.no)!;
    const section = {
      ...original,
      title: `${original.no} ${original.title}`,
      summary: 'Summary',
    };
    const title = section.title;
    const map = presentMap(
      {
        ...record,
        sections: record.sections.map(s => (s.id === section.id ? section : s)),
      },
      {},
    );
    const flatten = (nodes: MapNode[]): MapNode[] =>
      nodes.flatMap(node => [node, ...flatten(node.children)]);
    const node = flatten(
      map.chapters.flatMap(chapter => chapter.children),
    ).find(s => s.id === section.id)!;
    expect(node.label).toBe(title);
    expect(studySectionLabel(section)).toBe(title);
    expect(reviewSectionLabel([section], section.book_id, section.id)).toBe(
      title,
    );

    const notes = await loadBookNotes(c, section.book_id);
    const book = presentNotesBook({ ...notes, sections: [section] });
    expect(book.chapters[0].title).toBe(title);
    expect(book.chapters[0].sections[0].label).toBe(title);
    const detail = await loadNoteDetail(c, section.book_id, section.id);
    expect(presentNoteDetail({ ...detail, section }, section.id).title).toBe(
      title,
    );
  } finally {
    await c.close();
  }
});
