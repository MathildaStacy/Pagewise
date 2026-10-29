import type { Container } from '../container';
import { createRepos } from '@data/repos';
import { getReaderRuntime } from '../readerRuntime';
import { resolveStudyBlockImage } from '../bookImages';

export async function loadOriginalReaderWindow(
  c: Container,
  bookId: string,
  page: number,
  widthPx: number,
) {
  const book = await c.repos.books.get(bookId);
  if (!book || book.format !== 'pdf') throw new Error('EPUB 只有重排模式');
  if (c.mode === 'demo')
    throw new Error('Demo 只有示意原文，真实 PDF 导入后可用原版阅读');
  return getReaderRuntime(c).window(bookId, page, widthPx);
}
export async function loadOriginalReaderInfo(c: Container, bookId: string) {
  if (c.mode === 'demo') return null;
  return getReaderRuntime(c).info(bookId);
}

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
  const originalBlocks =
    section.page_from !== null && section.page_to !== null
      ? (
          await Promise.all(
            Array.from(
              { length: section.page_to - section.page_from + 1 },
              (_, i) => c.repos.blocks.byPage(bookId, section.page_from! + i),
            ),
          )
        ).flat()
      : blocks;
  return {
    book,
    section,
    blocks: blocks.map(b => resolveStudyBlockImage(c, bookId, b)),
    originalBlocks: originalBlocks.map(b =>
      resolveStudyBlockImage(c, bookId, b),
    ),
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
  return resolveStudyBlockImage(c, bookId, block);
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
