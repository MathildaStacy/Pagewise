import type { Container } from '../container';

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
  pendingWrites.set(c, next);
  await next;
}
export async function loadBookNotes(c: Container, bookId: string) {
  await pendingWrites.get(c);
  const [book, sections, qa, stuck, highlights, pins, cardCount] =
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
    ]);
  const userNotes = await Promise.all(
    sections.map(s => c.repos.notes.userText.get(bookId, s.id)),
  );
  const blocks = await Promise.all(
    highlights.map(h => c.repos.blocks.get(bookId, h.block_seq)),
  );
  return {
    book,
    sections,
    qa,
    stuck,
    highlights,
    pins,
    userNotes: userNotes.filter(n => n !== undefined),
    blocks: blocks.filter(b => b !== undefined),
    cardCount: cardCount?.count ?? 0,
  };
}
export type BookNotesData = Awaited<ReturnType<typeof loadBookNotes>>;
export async function loadNotes(c: Container) {
  const books = await c.repos.books.list();
  return Promise.all(books.map(b => loadBookNotes(c, b.id)));
}
export async function loadNoteDetail(
  c: Container,
  bookId: string,
  sectionId: string,
) {
  await pendingWrites.get(c);
  const [data, userNote, blocks] = await Promise.all([
    loadBookNotes(c, bookId),
    c.repos.notes.userText.get(bookId, sectionId),
    c.repos.blocks.bySection(bookId, sectionId),
  ]);
  return {
    ...data,
    section: data.sections.find(s => s.id === sectionId),
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
