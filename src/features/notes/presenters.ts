import type { Section } from '@core/types';
import type { BookNotesData, NoteDetailData } from '@app/usecases/notes';
import type { NotesState, NotesBookState, NoteDetailState } from './types';

export function sectionHasNotes(data: BookNotesData, s: Section): boolean {
  return (
    !!s.summary ||
    data.qa.some(q => q.section_id === s.id) ||
    data.stuck.some(q => q.section_id === s.id) ||
    data.userNotes.some(n => n.section_id === s.id && !!n.user_text) ||
    data.pins.some(p => p.section_id === s.id) ||
    data.blocks.some(b => b.section_id === s.id)
  );
}
export function presentNotes(data: BookNotesData[]): NotesState {
  return {
    loading: false,
    books: data.flatMap(d =>
      d.book
        ? [
            {
              id: d.book.id,
              title: d.book.title,
              cover: { title: d.book.title, color: d.book.cover_color },
              meta: d.sections.some(s => sectionHasNotes(d, s))
                ? `${
                    d.sections.filter(s => sectionHasNotes(d, s)).length
                  } 节有笔记 · ${d.qa.length} 条问答 · ${
                    d.highlights.length
                  } 处高亮`
                : '还没有笔记',
              hasNotes: d.sections.some(s => sectionHasNotes(d, s)),
            },
          ]
        : [],
    ),
  };
}
function chapterOf(sections: Section[], s: Section): Section {
  let current = s;
  const visited = new Set<string>();
  while (current.parent_id && !visited.has(current.id)) {
    visited.add(current.id);
    const parent = sections.find(x => x.id === current.parent_id);
    if (!parent) break;
    current = parent;
  }
  return current;
}
export function presentNotesBook(data: BookNotesData): NotesBookState {
  const chapters: NotesBookState['chapters'] = [];
  const groups = new Map<string, number>();
  for (const section of data.sections.filter(s => sectionHasNotes(data, s))) {
    const chapter = chapterOf(data.sections, section);
    let index = groups.get(chapter.id);
    if (index === undefined) {
      index = chapters.length;
      groups.set(chapter.id, index);
      chapters.push({
        title: `${chapter.no ?? ''} ${chapter.title}`.trim(),
        sections: [],
      });
    }
    const qa = data.qa.filter(q => q.section_id === section.id),
      stuck = data.stuck.filter(
        s => s.section_id === section.id && !s.resolved_at,
      ),
      highlights = data.blocks.filter(b => b.section_id === section.id);
    const tags: NotesBookState['chapters'][number]['sections'][number]['tags'] =
      [];
    if (qa.length) tags.push({ tone: 'default', label: `问答 ${qa.length}` });
    if (stuck.length)
      tags.push({ tone: 'stuck', label: `卡点 ${stuck.length}` });
    if (highlights.length)
      tags.push({ tone: 'default', label: `高亮 ${highlights.length}` });
    if (qa.some(q => q.from_section))
      tags.push({ tone: 'detour', label: '岔路' });
    chapters[index].sections.push({
      id: section.id,
      label: `${section.no ?? ''} ${section.title}`.trim(),
      status: section.status === 'new' ? undefined : section.status,
      summary: section.summary ?? undefined,
      tags,
    });
  }
  return {
    title: data.book?.title ?? '书籍笔记',
    chapters,
    overlay: null,
    loading: false,
  };
}
export function presentNoteDetail(
  data: NoteDetailData,
  sectionId: string,
): NoteDetailState {
  const s = data.section,
    qa = data.qa.filter(q => q.section_id === sectionId);
  const blockSet = new Set(data.sectionBlocks.map(b => b.seq));
  return {
    title: s ? `${s.no ?? ''} ${s.title}`.trim() : sectionId,
    subtitle: `笔记${
      s?.page_from != null
        ? ` · p.${s.page_from}${
            s.page_to !== s.page_from ? `–${s.page_to}` : ''
          }`
        : ''
    }`,
    canOpenSource: data.sectionBlocks.length > 0,
    summary: s?.summary ?? undefined,
    qa: qa.filter(q => !q.from_section).map(q => ({ q: q.q, a: q.a })),
    detourQa: qa
      .filter(q => q.from_section)
      .map(q => ({ from: `学 ${q.from_section} 时回来问的`, q: q.q, a: q.a })),
    stuck: data.stuck
      .filter(item => item.section_id === sectionId)
      .map(item => ({ text: item.text, resolved: !!item.resolved_at })),
    highlights: data.highlights
      .filter(h => blockSet.has(h.block_seq))
      .map(h => {
        const b = data.sectionBlocks.find(x => x.seq === h.block_seq)!;
        return {
          ref: `b${b.seq}`,
          text: b.text,
          page: b.page != null ? `p.${b.page}` : b.loc ?? '原文',
        };
      }),
    pins: data.pins
      .filter(p => p.section_id === sectionId)
      .map(p => ({
        ref: `b${p.block_seq}`,
        q: p.question,
        page:
          data.sectionBlocks.find(b => b.seq === p.block_seq)?.page != null
            ? `p.${data.sectionBlocks.find(b => b.seq === p.block_seq)!.page}`
            : '原文',
      })),
    userText: data.userNote?.user_text ?? '',
    loading: false,
    saveStatus: '已保存',
  };
}
export function exportPreview(
  title: string,
  format: 'md' | 'anki',
  count: number,
): { tree: string; desc: string } {
  return format === 'md'
    ? {
        tree: `Pagewise导出/${title}/\n  README.md\n  第01章/\n    1.1-小节名.md\n  …`,
        desc: '每节一个文件：摘要、问答、岔路记录、卡点、高亮、我的笔记。',
      }
    : {
        tree: `Pagewise导出/${title}-闪卡.csv\n  正面,背面,标签`,
        desc: `${count} 张闪卡，标签按「书::小节」组织。`,
      };
}
