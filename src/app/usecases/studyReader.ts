import type { Container } from '../container';
import { createRepos } from '@data/repos';

export async function loadStudyReader(
  c: Container,
  bookId: string,
  sectionId?: string,
) {
  const book = await c.repos.books.get(bookId);
  if (!book) throw new Error('这本书不存在');
  const study = await c.repos.study.get(bookId);
  const id =
    sectionId ??
    study?.main_section ??
    (await c.repos.sections.leaves(bookId))[0]?.id;
  if (!id) throw new Error('本书还没有可读的小节');
  const [section, blocks, highlights, pins, note] = await Promise.all([
    c.repos.sections.get(bookId, id),
    c.repos.blocks.bySection(bookId, id),
    c.repos.notes.highlights.list(bookId),
    c.repos.notes.pins.list(bookId, id),
    c.repos.notes.userText.get(bookId, id),
  ]);
  if (!section) throw new Error('这个小节不存在');
  return {
    book,
    section,
    blocks,
    highlights,
    pins,
    userText: note?.user_text ?? '',
  };
}
export async function loadStudyBlock(
  c: Container,
  bookId: string,
  seq: number,
) {
  const block = await c.repos.blocks.get(bookId, seq);
  if (!block) throw new Error('找不到引用的原文');
  return block;
}
export async function toggleStudyHighlight(
  c: Container,
  bookId: string,
  seq: number,
) {
  await loadStudyBlock(c, bookId, seq);
  const result = await c.repos.notes.highlights.toggle({
    book_id: bookId,
    block_seq: seq,
    created_at: c.clock.now().toISOString(),
  });
  return result;
}
export async function saveStudyBlockNote(
  c: Container,
  bookId: string,
  sectionId: string,
  seq: number,
  text: string,
) {
  await c.db.transaction(async tx => {
    const repos = createRepos(tx);
    const block = await repos.blocks.get(bookId, seq);
    if (!block || block.section_id !== sectionId)
      throw new Error('这段原文不属于当前小节');
    const existing = (await repos.notes.highlights.list(bookId)).find(
      h => h.block_seq === seq && h.start === null && h.end === null,
    );
    if (existing)
      await tx.run('UPDATE highlight SET note=? WHERE id=?', [
        text,
        existing.id,
      ]);
    else
      await repos.notes.highlights.toggle({
        book_id: bookId,
        block_seq: seq,
        note: text,
        created_at: c.clock.now().toISOString(),
      });
  });
}
export async function addStudyStuck(
  c: Container,
  bookId: string,
  sectionId: string,
  text: string,
) {
  const value = text.trim();
  if (!value) return;
  await c.db.transaction(async tx => {
    const repos = createRepos(tx);
    const old = await repos.notes.stuck.list(bookId, sectionId, {
      resolved: false,
    });
    if (!old.some(s => s.text === value))
      await repos.notes.stuck.add({
        book_id: bookId,
        section_id: sectionId,
        text: value,
        source: 'user',
        created_at: c.clock.now().toISOString(),
      });
  });
  c.events.emit('stuck.changed', { bookId, sectionId });
}
export async function saveStudyPin(
  c: Container,
  bookId: string,
  sectionId: string,
  seq: number,
  question: string,
  answer: string,
  messageIds: number[] = [],
) {
  await loadStudyBlock(c, bookId, seq);
  return c.repos.notes.pins.add({
    book_id: bookId,
    section_id: sectionId,
    block_seq: seq,
    question,
    answer_summary: answer,
    message_ids: messageIds,
    created_at: c.clock.now().toISOString(),
  });
}
