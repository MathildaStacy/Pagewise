import { createNoteSearchRepo } from '@data/repos/noteSearch';
import type { Container } from '../container';

export function searchNotes(c: Container, query: string, limit = 40) {
  return createNoteSearchRepo(c.db).search(query, limit);
}
export type NoteSearchData = Awaited<ReturnType<typeof searchNotes>>;
