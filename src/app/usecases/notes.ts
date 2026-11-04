import type { Container } from '../container';
import { withBookCover } from './bookCovers';

const pendingWrites = new WeakMap<Container, Promise<unknown>>();
export async function saveUserNote(
  c: Container,
  bookId: string,
  sectionId: string,
  value: string,
): Promise<void> {
  const previous = pendingWrites.get(c) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(() =>
      c.repos.notes.userText.set(
        bookId,
        sectionId,
        value,
        c.clock.now().toISOString(),
      ),
    );
  // Readers wait for settlement; the saving caller still receives the failure.
  pendingWrites.set(
    c,
    next.catch(() => undefined),
  );
  await next;
}
export async function loadBookNotes(c: Container, bookId: string) {
  await pendingWrites.get(c);
  const [book, sections, qa, stuck, highlights, pins, cardCount, userNotes] =
    await Promise.all([
      c.repos.books.get(bookId),
      c.repos.sections.tree(bookId),
      c.repos.notes.qa.list(bookId),
      c.repos.notes.stuck.list(bookId),
      c.repos.notes.highlights.list(bookId),
      c.repos.notes.pins.list(bookId),
      c.db.get<{ count: number }>(
        'SELECT COUNT(*) AS count FROM card WHERE book_id=?',
        [bookId],
      ),
      c.repos.notes.userText.list(bookId),
    ]);
  // One batched read instead of a query per highlight; duplicates keep their slot.
  const bySeq = new Map(
    (
      await c.repos.blocks.byRefs(
        bookId,
        highlights.map(h => h.block_seq),
      )
    ).map(block => [block.seq, block]),
  );
  const blocks = highlights.flatMap(h => {
    const block = bySeq.get(h.block_seq);
    return block ? [block] : [];
  });
  return {
    book: book ? await withBookCover(c, book) : undefined,
    sections,
    qa,
    stuck,
    highlights,
    pins,
    userNotes,
    blocks,
    cardCount: cardCount?.count ?? 0,
  };
}
export type BookNotesData = Awaited<ReturnType<typeof loadBookNotes>>;
/** The notes shelf only shows counts, so it never loads every book's notes. */
export async function loadNotes(c: Container) {
  await pendingWrites.get(c);
  const [books, counts] = await Promise.all([
    c.repos.books.list(),
    c.repos.notes.counts(),
  ]);
  const byBook = new Map(counts.map(row => [row.book_id, row]));
  return Promise.all(
    books.map(async book => ({
      book: await withBookCover(c, book),
      sectionCount: byBook.get(book.id)?.section_count ?? 0,
      qaCount: byBook.get(book.id)?.qa_count ?? 0,
      highlightCount: byBook.get(book.id)?.highlight_count ?? 0,
    })),
  );
}
export type NotesOverviewData = Awaited<ReturnType<typeof loadNotes>>;
export async function loadNoteDetail(
  c: Container,
  bookId: string,
  sectionId: string,
) {
  await pendingWrites.get(c);
  // Only this section's rows; the detail page never needs the rest of the book.
  const [book, section, qa, stuck, highlights, pins, userNote, blocks] =
    await Promise.all([
      c.repos.books.get(bookId),
      c.repos.sections.get(bookId, sectionId),
      c.repos.notes.qa.list(bookId, sectionId),
      c.repos.notes.stuck.list(bookId, sectionId),
      c.repos.notes.highlights.list(bookId, sectionId),
      c.repos.notes.pins.list(bookId, sectionId),
      c.repos.notes.userText.get(bookId, sectionId),
      c.repos.blocks.bySection(bookId, sectionId),
    ]);
  return {
    book,
    section,
    qa,
    stuck,
    highlights,
    pins,
    userNote,
    sectionBlocks: blocks,
  };
}
export type NoteDetailData = Awaited<ReturnType<typeof loadNoteDetail>>;
export function saveExportPreferences(
  c: Container,
  format: 'md' | 'anki',
  strip: boolean,
) {
  return c.repos.settings.set('export', { format, strip });
}
export async function loadExportPreferences(c: Container) {
  const saved = await c.repos.settings.get<{
    format?: unknown;
    strip?: unknown;
  }>('export', {});
  return {
    format: saved.format === 'anki' ? ('anki' as const) : ('md' as const),
    strip: saved.strip !== false,
  };
}
