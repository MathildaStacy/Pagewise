import type { Book, BookPart, Section } from '@core/types';
import { createRepos } from '@data/repos';
import type { Container } from '../container';

export async function loadShelf(c: Container) {
  const books = await c.repos.books.list();
  return Promise.all(
    books.map(async book => {
      const [sections, study, parts, stuck] = await Promise.all([
        c.repos.sections.tree(book.id),
        c.repos.study.get(book.id),
        c.repos.parts.list(book.id),
        c.repos.notes.stuck.list(book.id, undefined, { resolved: false }),
      ]);
      const plan = study?.main_section
        ? await c.repos.plans.get(book.id, study.main_section, study.main_part)
        : undefined;
      return { book, sections, study, parts, stuck, plan };
    }),
  );
}
export type ShelfRecord = Awaited<ReturnType<typeof loadShelf>>[number];
export async function openLibraryBook(c: Container, id: string) {
  const book = await c.repos.books.get(id);
  if (!book) throw new Error('这本书已经不在书架上了');
  await c.repos.books.touchOpened(id);
  return book;
}
export async function loadBookMap(c: Container, id: string) {
  const [book, sections, study, stuck] = await Promise.all([
    c.repos.books.get(id),
    c.repos.sections.tree(id),
    c.repos.study.get(id),
    c.repos.notes.stuck.list(id, undefined, { resolved: false }),
  ]);
  if (!book) throw new Error('这本书已经不在书架上了');
  return { book, sections, study, stuck };
}
export type MapRecord = Awaited<ReturnType<typeof loadBookMap>>;
export async function loadSection(c: Container, bookId: string, id: string) {
  const [section, study, qa, stuck, blocks] = await Promise.all([
    c.repos.sections.get(bookId, id),
    c.repos.study.get(bookId),
    c.repos.notes.qa.list(bookId, id),
    c.repos.notes.stuck.list(bookId, id, { resolved: false }),
    c.repos.blocks.bySection(bookId, id),
  ]);
  if (!section) throw new Error('找不到这个小节');
  const [parent, plan] = await Promise.all([
    section.parent_id
      ? c.repos.sections.get(bookId, section.parent_id)
      : undefined,
    c.repos.plans.get(
      bookId,
      id,
      study?.main_section === id ? study.main_part : 0,
    ),
  ]);
  return { section, parent, study, qa, stuck, blocks, plan };
}
export async function startSection(c: Container, bookId: string, id: string) {
  await c.db.transaction(async tx => {
    const repos = createRepos(tx);
    const section = await repos.sections.get(bookId, id);
    if (!section?.is_leaf || section.block_from === null)
      throw new Error('这部分正文还未就绪');
    const study = await repos.study.get(bookId);
    if (study?.main_section !== id) {
      await repos.study.put({
        book_id: bookId,
        main_section: id,
        mode: 'listen',
        reader_view: study?.reader_view ?? 'flow',
        read_anchor: section.block_from,
        last_active_at: c.clock.now().toISOString(),
      });
      await repos.sections.update(bookId, id, { status: 'learning' });
    }
    await repos.books.touchOpened(bookId);
  });
  c.events.emit('section.status', {
    bookId,
    sectionId: id,
    status: 'learning',
  });
}
export async function confirmMapFlag(c: Container, bookId: string, id: string) {
  const section = await c.repos.sections.update(bookId, id, {
    flag: null,
    flag_detail: null,
    source: 'manual',
  });
  if (!section) throw new Error('找不到这个小节');
  c.events.emit('section.status', {
    bookId,
    sectionId: id,
    status: section.status,
  });
}
/** Split only at a detected second heading, so manual fixes never invent book text. */
export async function splitMapSection(
  c: Container,
  bookId: string,
  id: string,
): Promise<void> {
  await c.db.transaction(async tx => {
    const repos = createRepos(tx);
    const section = await repos.sections.get(bookId, id);
    if (!section) throw new Error('找不到这个小节');
    const blocks = await repos.blocks.bySection(bookId, id);
    const split = blocks.findIndex(
      (block, index) => index > 0 && block.type === 'title',
    );
    if (split < 1)
      throw new Error('还没有第二个标题的位置，暂时保留标记，解析完成后再核对');
    const all = await repos.sections.tree(bookId);
    const newId = `${id}-split`;
    if (all.some(s => s.id === newId)) throw new Error('这个小节已经拆分过了');
    const newSection: Section = {
      ...section,
      id: newId,
      no: null,
      title: blocks[split].text.replace(/^\[示意内容\]\s*/, ''),
      block_from: blocks[split].seq,
      page_from: blocks[split].page,
      chars: blocks.slice(split).reduce((sum, b) => sum + b.chars, 0),
      status: 'new',
      summary: null,
      guide: null,
      source: 'manual',
      flag: null,
      flag_detail: null,
      parts: 1,
    };
    const index = all.findIndex(s => s.id === id);
    all.splice(index + 1, 0, newSection);
    all.forEach((s, ord) => {
      s.ord = ord;
    });
    await repos.sections.replaceAll(bookId, all);
    for (const value of all)
      await repos.sections.update(bookId, value.id, { ord: value.ord });
    await repos.sections.update(bookId, id, {
      source: 'manual',
      flag: null,
      flag_detail: null,
      block_to: blocks[split - 1].seq,
      page_to: blocks[split - 1].page,
      chars: blocks.slice(0, split).reduce((sum, b) => sum + b.chars, 0),
    });
    await tx.run(
      'UPDATE block SET section_id=? WHERE book_id=? AND section_id=? AND seq>=?',
      [newId, bookId, id, blocks[split].seq],
    );
    await repos.sections.setParts(bookId, id, [
      {
        part_no: 0,
        block_from: blocks[0].seq,
        block_to: blocks[split - 1].seq,
        name: section.title,
      },
    ]);
    await repos.sections.setParts(bookId, newId, [
      {
        part_no: 0,
        block_from: blocks[split].seq,
        block_to: blocks[blocks.length - 1].seq,
        name: newSection.title,
      },
    ]);
    await tx.run('DELETE FROM lesson_plan WHERE book_id=? AND section_id=?', [
      bookId,
      id,
    ]);
  });
}
export const searchBook = (c: Container, bookId: string, query: string) =>
  c.repos.blocks.search(bookId, query, 20);
export async function loadParseProgress(
  c: Container,
  bookId: string,
): Promise<{ book: Book; parts: BookPart[] }> {
  const [book, parts] = await Promise.all([
    c.repos.books.get(bookId),
    c.repos.parts.list(bookId),
  ]);
  if (!book) throw new Error('这本书已经不在书架上了');
  return { book, parts };
}
export async function createDemoImportDraft(c: Container, key: string) {
  if (c.mode !== 'demo')
    throw new Error('请在演示书库体验示例文件；系统文件选择将在导入功能中接入');
  const book = await c.repos.books.get(key);
  if (!book) throw new Error('找不到示例文件');
  const id = `demo-import-${key}`;
  if (!(await c.repos.drafts.get(id)))
    await c.repos.drafts.insert({
      id,
      file_path: `demo://${key}`,
      info: {
        title: book.title,
        author: book.author,
        format: book.format,
        pages: book.pages,
        size_bytes: book.size_bytes,
        has_text_layer: true,
        has_outline: true,
        existingBookId: key,
      },
      created_at: c.clock.now().toISOString(),
    });
  return id;
}
export async function loadImportDraft(c: Container, draftId: string) {
  const draft = await c.repos.drafts.get(draftId);
  if (!draft) throw new Error('找不到导入的文件，请返回书架重新选择');
  const info =
    draft.info && typeof draft.info === 'object' && !Array.isArray(draft.info)
      ? draft.info
      : {};
  const mineru = await c.repos.settings.get<{
    confirmUpload?: boolean;
    usedToday?: { date: string; pages: number };
  }>('mineru', {});
  return { draft, info, mineru };
}
