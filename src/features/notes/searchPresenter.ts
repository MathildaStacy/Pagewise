import type { NoteSearchData } from '@app/usecases/noteSearch';
import type { NoteSearchState } from './types';

const kinds = { summary: '摘要', qa: '问答', user: '我的笔记', stuck: '卡点' };
export function presentNoteSearch(
  data: NoteSearchData,
): NoteSearchState['results'] {
  return data.hits.map(hit => ({
    id: JSON.stringify([hit.book_id, hit.section_id, hit.kind, hit.item_id]),
    bookId: hit.book_id,
    sectionId: hit.section_id,
    kind: kinds[hit.kind],
    where: `${hit.book_title} · ${[hit.section_no, hit.section_title]
      .filter(Boolean)
      .join(' ')}`,
    excerpt: hit.excerpt,
  }));
}
