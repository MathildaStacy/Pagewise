import type { Book, BookPart, Section } from '@core/types';
import { pageLabel, pageRangeLabel, type PageLabelBook } from '@core/ids';
import type { MapRecord, ShelfRecord } from '@app/usecases/library';
import type {
  BookMapState,
  MapNode,
  ParseProgressState,
  ShelfBook,
  ShelfState,
} from './types';

export const pageRange = (
  section: Pick<Section, 'page_from' | 'page_to'>,
  book: PageLabelBook = { page_offset: 0 },
) =>
  section.page_from === null
    ? 'EPUB · 章节位置'
    : pageRangeLabel(book, section.page_from, section.page_to);
export const sectionName = (s: Pick<Section, 'no' | 'title'>) =>
  `${s.no ? s.no + ' ' : ''}${s.title}`;
const stageLabels = ['上传', '排队', '解析', '下载结果', '建地图'];
export function parsePart(part: BookPart): ParseProgressState['parts'][number] {
  const stageIndex: Record<BookPart['stage'], number> = {
    queued: 0,
    splitting: 0,
    requesting: 0,
    uploading: 0,
    waiting: 1,
    running: 2,
    downloading: 3,
    importing: 4,
    done: 5,
    failed: 0,
  };
  const index = stageIndex[part.stage];
  const percent = part.total_pages
    ? Math.min(1, Math.max(0, (part.extracted_pages ?? 0) / part.total_pages))
    : 0;
  const failed = part.stage === 'failed' || Boolean(part.error_code);
  return {
    number: part.part_no,
    label: `第 ${part.part_no} 片 · p.${part.page_from}–${part.page_to}`,
    statusText: failed
      ? '已暂停'
      : index === 5
      ? '完成'
      : `${stageLabels[index]} ${Math.round(
          (index === 2 || part.stage === 'uploading' ? percent : 0) * 100,
        )}%`,
    tone: failed ? 'bad' : index === 5 ? 'ok' : 'muted',
    progress:
      index === 5
        ? 1
        : (index + (index === 2 || part.stage === 'uploading' ? percent : 0)) /
          5,
    stages: stageLabels.map((label, i) => ({
      label,
      state:
        i < index
          ? 'done'
          : i === index
          ? failed
            ? 'error'
            : 'current'
          : 'todo',
    })),
    ...(failed
      ? {
          error:
            part.error_msg ||
            (part.error_code === 'A0211'
              ? 'MinerU Token 已过期，请更新后重试'
              : '这一片解析失败，请重试'),
        }
      : {}),
  };
}
export function shelfStatus(record: ShelfRecord): ShelfBook['status'] {
  const { book, study, sections, parts } = record;
  if (
    book.status === 'paused' ||
    book.status === 'failed' ||
    parts.some(p => p.error_code)
  )
    return {
      tone: 'bad',
      text: `解析暂停：${
        parts.find(p => p.error_code)?.error_code === 'A0211'
          ? 'Token 已过期'
          : parts.find(p => p.error_msg)?.error_msg || '请查看解析进度'
      }`,
    };
  if (book.status === 'parsing' || book.status === 'importing') {
    const current = parts.find(p => p.stage !== 'done');
    const progress = parts.length
      ? Math.round(
          (parts.reduce((sum, p) => sum + parsePart(p).progress, 0) /
            parts.length) *
            100,
        )
      : 0;
    return {
      tone: 'stuck',
      text: `解析中 · ${
        current ? parsePart(current).statusText.split(' ')[0] : '准备中'
      } · ${progress}%${
        book.ready_to_page ? ` · p.1–${book.ready_to_page} 可学` : ''
      }`,
    };
  }
  if (study?.main_section) {
    const leaves = sections.filter(s => s.is_leaf);
    return {
      tone: 'accent',
      text: `在学 ${
        sections.find(s => s.id === study.main_section)?.no ??
        sections.find(s => s.id === study.main_section)?.title ??
        study.main_section
      } · 已学 ${leaves.filter(s => s.status === 'done').length}/${
        leaves.length
      } 个小节`,
    };
  }
  return {
    tone: 'muted',
    text: `${
      book.format === 'epub' ? 'EPUB · 本地解析 · ' : ''
    }已就绪 · 未开始`,
  };
}
export const bookMeta = (book: Book, chapters?: number) =>
  [
    book.author,
    book.format.toUpperCase(),
    book.pages
      ? `${book.pages} 页`
      : chapters !== undefined
      ? `${chapters} 章`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
export function presentShelf(
  records: ShelfRecord[],
  now: Date,
  demo: boolean,
): Pick<ShelfState, 'books' | 'continueCard' | 'empty' | 'demo'> {
  const books = records.map(record => ({
    id: record.book.id,
    title: record.book.title,
    author: record.book.author,
    meta: bookMeta(
      record.book,
      record.sections.filter(section => !section.parent_id).length,
    ),
    cover: {
      title: record.book.title.replace(/[（(].*$/u, ''),
      color: record.book.cover_color,
    },
    status: shelfStatus(record),
  }));
  const current = [...records]
    .filter(r => r.study?.main_section)
    .sort((a, b) =>
      (b.book.last_opened_at ?? '').localeCompare(a.book.last_opened_at ?? ''),
    )[0];
  if (!current)
    return { books, continueCard: null, empty: books.length === 0, demo };
  const section = current.sections.find(
    s => s.id === current.study!.main_section,
  );
  const byId = new Map(current.sections.map(value => [value.id, value]));
  let chapter = section;
  for (
    let depth = 0;
    chapter && chapter.level !== 1 && depth < byId.size;
    depth++
  )
    chapter = chapter.parent_id ? byId.get(chapter.parent_id) : undefined;
  if (chapter?.level !== 1) chapter = undefined;
  const chapterNo = chapter?.no?.trim();
  const chapterLabel = chapter
    ? chapterNo
      ? `第 ${chapterNo} 章 ${chapter.title}`
      : chapter.title
    : '';
  const days = current.study?.last_active_at
    ? Math.floor(
        (now.getTime() - Date.parse(current.study.last_active_at)) / 86400000,
      )
    : 0;
  const step = current.study!.main_step;
  const latestStuck = current.stuck
    .filter(value => value.section_id === section?.id && !value.resolved_at)
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)[0];
  const brief = (value: string) => {
    const chars = Array.from(value.replace(/\s+/gu, ' ').trim());
    return chars.length > 54
      ? `${chars.slice(0, 54).join('')}…`
      : chars.join('');
  };
  const question = current.recentQuestion?.content.trim();
  const target = current.plan?.steps
    .slice(step)
    .find(value => value.status !== 'done' && value.status !== 'skipped');
  const recap = [
    question ? `上次问：${brief(question)}` : '',
    latestStuck ? `卡点：${brief(latestStuck.text)}` : '',
    target ? `接着学：${brief(target.title)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return {
    books,
    empty: false,
    demo,
    continueCard: {
      bookId: current.book.id,
      kicker: `继续学习 · ${current.book.title}`,
      title: section ? sectionName(section) : current.study!.main_section!,
      meta: [chapterLabel, section ? pageRange(section, current.book) : '']
        .filter(Boolean)
        .join(' · '),
      ...(recap
        ? { recap: `${days >= 1 ? `上次 ${days} 天前 · ` : ''}${recap}` }
        : {}),
      steps:
        current.plan?.steps.map(s => ({
          done: s.status === 'done' || s.status === 'skipped',
        })) ?? [],
      stepLabel: current.plan?.steps.length
        ? `第 ${Math.min(step + 1, current.plan.steps.length)}/${
            current.plan.steps.length
          } 步`
        : '新的一节',
    },
  };
}
export function presentMap(
  record: MapRecord,
  expanded: Record<string, boolean>,
): Pick<BookMapState, 'title' | 'check' | 'chapters' | 'scrollToSectionId'> {
  const { book, sections, study, stuck } = record;
  const current = sections.find(s => s.id === study?.main_section);
  const flagged = sections.filter(s => s.flag);
  const roots = sections.filter(s => !s.parent_id);
  const chapterCount =
    roots.filter(s => /^\d+$/.test(s.no ?? '')).length || roots.length;
  const children = (id: string) => sections.filter(s => s.parent_id === id);
  const descendant = (s: Section) =>
    Boolean(
      current &&
        s.block_from !== null &&
        s.block_to !== null &&
        current.block_from !== null &&
        s.block_from <= current.block_from &&
        s.block_to >= current.block_from,
    );
  const node = (s: Section): MapNode => {
    const kids = children(s.id);
    return {
      id: s.id,
      label: sectionName(s),
      level: s.level,
      status: s.status,
      current: s.id === study?.main_section,
      pageLabel: kids.length
        ? `${kids.filter(k => k.status === 'done').length}/${kids.length}`
        : s.page_from !== null
        ? pageLabel(book, s.page_from)
        : '章节',
      tags: [
        ...(s.flag ? [{ tone: 'stuck' as const, label: '需确认' }] : []),
        ...(stuck.some(value => value.section_id === s.id)
          ? [{ tone: 'stuck' as const, label: '卡点' }]
          : []),
      ],
      flagged: Boolean(s.flag),
      expandable: kids.length > 0,
      expanded: expanded[s.id] ?? descendant(s),
      children: kids.map(node),
    };
  };
  return {
    title: book.title.replace(/[（(].*$/u, ''),
    scrollToSectionId: study?.main_section ?? undefined,
    check: {
      ok: sections.length > 0,
      tone: flagged.length ? 'stuck' : 'muted',
      text:
        book.format === 'epub'
          ? `从 EPUB 目录建立：${chapterCount} 章`
          : book.has_outline
          ? `已和 PDF 书签核对：${chapterCount} 章${
              flagged.length ? '' : '一致'
            }`
          : `已建立书的地图 · ${chapterCount} 章`,
      sub: flagged.length
        ? `${flagged.length} 处需要你确认 · 点开黄色标记逐项核对`
        : book.status === 'ready'
        ? '没有需要确认的地方'
        : '解析中，已就绪的章节可以先学',
    },
    chapters: sections
      .filter(s => !s.parent_id)
      .map(s => ({
        id: s.id,
        no: s.no ?? '',
        title: s.title,
        meta: [
          pageRange(s, book),
          children(s.id).length ? `${children(s.id).length} 节` : '',
          s.status === 'done'
            ? '已学完'
            : descendant(s)
            ? `在学 ${current?.no ?? current?.title ?? study?.main_section}`
            : '',
        ]
          .filter(Boolean)
          .join(' · '),
        status: s.status,
        current: descendant(s),
        expanded: expanded[s.id] ?? descendant(s),
        leaf: s.is_leaf,
        children: children(s.id).map(node),
      })),
  };
}
export function markSnippet(
  text: string,
  query: string,
): { text: string; hit: boolean }[] {
  const q = query.replace(/\s/gu, '');
  const index = text.toLocaleLowerCase().indexOf(q.toLocaleLowerCase());
  if (!q || index < 0) return [{ text, hit: false }];
  return [
    { text: text.slice(0, index), hit: false },
    { text: text.slice(index, index + q.length), hit: true },
    { text: text.slice(index + q.length), hit: false },
  ].filter(s => s.text);
}
