import { PRIVATE_USE } from '@core/layout';
import { parseBookTable } from '@app/readingTable';
import type { Block, Book, Message, Section } from '@core/types';
import { sectionName } from '@features/sectionName';
import {
  decodeTextEntities,
  displayTex,
  parse,
  parseSourceCode,
  stableStreamText,
  type Inline,
  type RichDoc as CoreDoc,
} from '@core/markup';
import { validateCitations } from '@core/citations';
import { pageLabel, pageRangeLabel, type PageLabelBook } from '@core/ids';
import {
  parseStudyCard,
  type StudyState as SessionState,
} from '@app/study/types';
import type { BookVisualData, RichDoc, RichInline, RichTable } from '@ui/kit';
import type { TranslationProgress } from '@app/study/translation';
import type {
  QuickKey,
  ReaderBlock,
  ReaderItem,
  RefinementContent,
  ThreadItem,
  TranslationReadingPassage,
} from './types';

export function sectionLabel(section: Section | null | undefined) {
  return section ? sectionName(section) : '正在读取';
}
export function blockPage(
  block: Pick<Block, 'page' | 'loc'> | undefined,
  book: PageLabelBook | null,
) {
  return block?.page !== null && block?.page !== undefined
    ? pageLabel(book ?? { page_offset: 0 }, block.page, block.loc)
    : block?.loc
    ? `位置 ${block.loc}`
    : '原文';
}
export function stepPages(
  from: number,
  to: number,
  blocks: readonly Block[],
  book: Book | null,
) {
  const found = blocks.filter(b => b.seq >= from && b.seq <= to);
  if (found[0]?.page != null && found[found.length - 1]?.page != null)
    return pageRangeLabel(
      book ?? { page_offset: 0 },
      found[0].page,
      found[found.length - 1].page,
    );
  const first = blockPage(found[0], book),
    last = blockPage(found[found.length - 1], book);
  return first === last ? first : `${first}–${last.replace('p.', '')}`;
}
export function enrichDoc(
  doc: CoreDoc,
  blocks: ReadonlyMap<number, Block>,
  book: Book | null,
): RichDoc {
  const inline = (items: Inline[]): RichInline[] =>
    items.map(item => {
      if (item.t === 'b') return { ...item, c: inline(item.c) };
      if (item.t === 'cite')
        return { ...item, label: blockPage(blocks.get(item.ref), book) };
      return item;
    });
  return doc.map(b => {
    if (b.t === 'p' || b.t === 'check') return { ...b, c: inline(b.c) };
    if (b.t === 'list') return { ...b, items: b.items.map(inline) };
    if (b.t === 'table')
      return { ...b, rows: b.rows.map(row => row.map(inline)) };
    if (b.t === 'aux') return { ...b, body: enrichDoc(b.body, blocks, book) };
    if (b.t === 'quote' || b.t === 'figure') {
      const source = blocks.get(b.ref);
      if (b.t === 'figure' && b.verified && source?.refinement?.visual)
        return { t: 'visual', ref: b.ref, data: source.refinement.visual };
      return {
        ...b,
        label: blockPage(source, book),
        text: source?.text,
        ...(source?.image_path ? { uri: source.image_path } : {}),
      };
    }
    return b;
  });
}
export function messageDoc(
  text: string,
  allowed: number[],
  blocks: ReadonlyMap<number, Block>,
  book: Book | null,
  mainSection: string,
  streaming = false,
) {
  const checked = validateCitations(parse(text, { streaming }), {
    allowedRefs: allowed,
    blocks: blocks.values(),
    mainSectionId: mainSection,
  });
  return enrichDoc(checked.doc, blocks, book);
}
export function blockDoc(source: Block, book: Book | null): RichDoc {
  if (source.refinement?.visual)
    return [{ t: 'visual', ref: source.seq, data: source.refinement.visual }];
  // E-book link icons in the Private Use Area have no glyph and render as boxes.
  const block = { ...source, text: source.text.replace(PRIVATE_USE, '') };
  if (block.type === 'title')
    return [
      {
        t: 'p',
        heading: block.level ?? 2,
        c: [{ t: 'b', c: [{ t: 'text', v: block.text }] }],
      },
    ];
  if (block.type === 'equation')
    return [{ t: 'math', tex: displayTex(block.latex ?? block.text) }];
  if (block.type === 'code') return [parseSourceCode(block.text)];
  if (block.type === 'image')
    return [
      {
        t: 'figure',
        ref: block.seq,
        verified: true,
        label: blockPage(block, book),
        text: block.text,
        ...(block.image_path ? { uri: block.image_path } : {}),
      },
    ];
  // MinerU escapes printed bullet markers. Restore their layout only in book text.
  return enrichDoc(
    parse(block.text.replace(/^\s*\\-\s+/gm, '- ')),
    new Map([[block.seq, block]]),
    book,
  );
}

export function presentTranslation(
  parts: TranslationProgress[],
  book: Book | null,
): TranslationReadingPassage[] {
  return parts.map(part => {
    const source = part.block;
    const translated =
      part.answer === null || (source.type === 'table' && !part.complete)
        ? null
        : {
            ...source,
            // A title's rank comes from the book, even if a model adds Markdown marks.
            text:
              source.type === 'title'
                ? part.answer.replace(/^\s*#{1,6}\s+/, '')
                : part.complete
                ? part.answer
                : stableStreamText(part.answer),
            html: source.type === 'table' ? part.answer : null,
            type: source.type === 'image' ? ('caption' as const) : source.type,
          };
    return {
      id: part.id,
      ref: source.seq,
      page: blockPage(source, book),
      type: source.type,
      source: blockDoc(source, book),
      sourceTable:
        source.type === 'table'
          ? tableContent(source.html, source.text)
          : undefined,
      sourceGrid:
        source.type === 'table'
          ? tableGrid(source.html, source.text)
          : undefined,
      answer: translated ? blockDoc(translated, book) : null,
      answerTable:
        translated?.type === 'table'
          ? tableContent(translated.html, translated.text)
          : undefined,
      answerGrid:
        translated?.type === 'table'
          ? tableGrid(translated.html, translated.text)
          : undefined,
      complete: part.complete,
      preserved: !part.translate,
    };
  });
}
export function quickActions(
  raw: SessionState,
): { key: QuickKey; label: string; kind?: 'primary' | 'detour' }[] {
  const main = raw.section?.no ?? raw.section?.title ?? '';
  const detour = raw.detours[raw.detours.length - 1];
  if (detour?.reviewStuckId)
    return [
      { key: 'reviewOk', label: `清楚了，继续 ${main}`, kind: 'detour' },
      { key: 'reviewAgain', label: '还是不太懂' },
    ];
  if (detour) {
    const section = raw.sections.find(s => s.id === detour.sectionId);
    return [
      { key: 'backMain', label: `回到主线 ${main}`, kind: 'detour' },
      { key: 'detourSource', label: `看 ${section?.no ?? '岔路'} 原文` },
    ];
  }
  const resumeIndex =
    raw.messages
      .map((m, i) => ({ m, i }))
      .reverse()
      .find(
        ({ m }) =>
          m.kind === 'card' &&
          parseStudyCard(m.content)?.kind === 'resume' &&
          m.in_context,
      )?.i ?? -1;
  if (
    resumeIndex >= 0 &&
    !raw.messages
      .slice(resumeIndex + 1)
      .some(m => m.kind === 'assistant' || m.kind === 'user')
  )
    return [];
  if (raw.phase === 'ready')
    return [
      { key: 'nextSection', label: '懂了，下一节', kind: 'primary' },
      { key: 'reteachSection', label: '再讲一遍这一节' },
      { key: 'source', label: '看原文' },
    ];
  if (raw.phase === 'quiz')
    return [
      { key: 'alt', label: '换个说法' },
      { key: 'example', label: '举个例子' },
      { key: 'source', label: '看原文' },
    ];
  const steps = raw.plan?.steps ?? [],
    step = steps[raw.main.step];
  if (!step) return [];
  const last = raw.main.step === steps.length - 1;
  const result: {
    key: QuickKey;
    label: string;
    kind?: 'primary' | 'detour';
  }[] = [
    {
      key: last && raw.main.part < raw.parts.length - 1 ? 'nextPart' : 'next',
      label: last
        ? raw.main.part < raw.parts.length - 1
          ? '懂了，下一段'
          : '懂了'
        : '懂了，下一步',
      kind: 'primary',
    },
    { key: 'alt', label: '换个说法' },
    { key: 'example', label: '举个例子' },
  ];
  if (
    step.kind === 'derivation' ||
    step.kind === 'definition' ||
    raw.blocks.some(
      b =>
        b.type === 'equation' &&
        b.seq >= step.block_from &&
        b.seq <= step.block_to,
    )
  )
    result.push({ key: 'derive', label: '展开推导' });
  if (!last) result.push({ key: 'skip', label: '这步熟，跳过' });
  result.push(
    { key: 'quiz', label: '考考我' },
    { key: 'source', label: '看原文' },
  );
  return result;
}
interface Presented {
  id: string;
  blocks: ReadonlyMap<number, Block>;
  book: Book | null;
  main: string;
  item: ThreadItem;
}
/** Messages are immutable in the session store; reuse their items so unchanged rows skip parsing and rendering. */
const presentedMessages = new WeakMap<Message, Presented>();
function presentMessage(
  message: Message,
  raw: SessionState,
  blocks: ReadonlyMap<number, Block>,
  expanded: Set<string>,
  depth = 0,
): ThreadItem | null {
  const id = String(message.id),
    detour = message.detour_id !== null;
  if (message.kind === 'user' || message.kind === 'assistant') {
    const key = raw.streamKeys[message.id] ?? id,
      hit = presentedMessages.get(message);
    if (
      hit?.id === key &&
      hit.blocks === blocks &&
      hit.book === raw.book &&
      hit.main === raw.main.sectionId
    )
      return hit.item;
    const item: ThreadItem =
      message.kind === 'user'
        ? {
            kind: 'user',
            id: key,
            text: message.content,
            detour,
            quote:
              message.quote_seq !== null
                ? `${blockPage(blocks.get(message.quote_seq), raw.book)} · ${
                    blocks.get(message.quote_seq)?.text.slice(0, 60) ?? ''
                  }`
                : undefined,
          }
        : {
            kind: 'ai',
            id: key,
            sources: (
              message.raw as unknown as {
                search?: { sources: { url: string; title: string }[] };
              } | null
            )?.search?.sources,
            doc: messageDoc(
              message.content,
              message.allowed_refs ?? [],
              blocks,
              raw.book,
              raw.main.sectionId,
            ),
            streaming: false,
            detour,
          };
    presentedMessages.set(message, {
      id: key,
      blocks,
      book: raw.book,
      main: raw.main.sectionId,
      item,
    });
    return item;
  }
  if (message.kind === 'tool') return null;
  const card = parseStudyCard(message.content);
  if (!card) return null;
  switch (card.kind) {
    case 'divider':
      return { ...card, id };
    case 'stepHeader':
      return { ...card, id };
    case 'resume':
      return {
        kind: 'resume',
        id,
        title: card.title,
        lines: card.lines,
        actions:
          message.in_context &&
          !raw.messages
            .slice(raw.messages.findIndex(m => m.id === message.id) + 1)
            .some(m => m.kind === 'assistant' || m.kind === 'user')
            ? [
                { key: 'go', label: '直接继续', primary: true },
                ...(card.hasStuck
                  ? [{ key: 'review' as const, label: '先复习卡点' }]
                  : []),
              ]
            : [],
      };
    case 'quiz':
      return {
        kind: 'quiz',
        id,
        title: card.final ? '本节小测' : '检查一下',
        question: card.question,
        locked: card.picked !== null,
        deferred: card.deferred,
        options: card.options.map((label, i) => ({
          label,
          state:
            card.picked === null
              ? 'idle'
              : i === card.answer
              ? 'right'
              : i === card.picked
              ? 'wrong'
              : 'muted',
        })),
        explain: card.picked !== null ? card.explain : undefined,
      };
    case 'proposal':
      return {
        kind: 'proposal',
        id,
        title: card.title,
        body: card.body,
        state: card.state,
        resultText:
          card.state === 'accepted'
            ? '已确认'
            : card.state === 'dismissed'
            ? '已忽略'
            : undefined,
        actions: [
          {
            key: 'accept',
            label: card.type === 'mark_stuck' ? '记下' : '确认',
          },
          { key: 'dismiss', label: '不用' },
        ],
      };
    case 'done':
      return { ...card, id };
    case 'tools':
      return {
        kind: 'tools',
        id,
        detour,
        lines: [{ text: card.text, running: false }],
      };
    case 'partSummary':
      return {
        kind: 'fold',
        id,
        title: `第 ${card.part + 1} 段小结`,
        count: '已讲完',
        expanded: expanded.has(id),
        items: [
          {
            kind: 'ai',
            id: `${id}-summary`,
            doc: messageDoc(
              card.summary,
              [],
              blocks,
              raw.book,
              raw.main.sectionId,
            ),
            streaming: false,
            detour: false,
          },
        ],
      };
    case 'fold':
      return {
        kind: 'fold',
        id,
        title: card.title,
        count: `${card.count} 条`,
        expanded: expanded.has(id),
        items:
          depth > 0
            ? []
            : raw.messages
                .filter(m => card.messageIds.includes(m.id))
                .map(m => presentMessage(m, raw, blocks, expanded, depth + 1))
                .filter((x): x is ThreadItem => x !== null),
      };
  }
}
export function presentThread(
  raw: SessionState,
  blocks: ReadonlyMap<number, Block>,
  expanded: Set<string>,
  history = false,
): ThreadItem[] {
  const folded = new Set(
    raw.messages.flatMap(m => {
      const c = m.kind === 'card' ? parseStudyCard(m.content) : null;
      return c?.kind === 'fold' ? c.messageIds : [];
    }),
  );
  const messages = raw.messages.filter(m => !folded.has(m.id));
  const old = messages.filter(
    m =>
      !m.in_context &&
      m.detour_id === null &&
      (m.kind === 'user' || m.kind === 'assistant'),
  );
  const oldIds = new Set(old.map(m => m.id));
  let result: ThreadItem[] = messages
    .filter(m => !oldIds.has(m.id))
    .map(m => presentMessage(m, raw, blocks, expanded))
    .filter((x): x is ThreadItem => x !== null);
  if (old.length)
    result.unshift({
      kind: 'history',
      id: 'history',
      label: `更早的学习记录 · ${old.length} 条消息`,
      expanded: history,
      items: old
        .map(m => presentMessage(m, raw, blocks, expanded))
        .filter((x): x is ThreadItem => x !== null),
    });
  if (raw.tools.length)
    result.push({
      kind: 'tools',
      id: 'live-tools',
      lines: raw.tools.map(t => ({ text: t.text, running: t.running })),
      detour: raw.tools.some(t => t.detour),
    });
  if (raw.streaming)
    result.push({
      kind: 'ai',
      id: raw.streaming.entryId,
      doc: messageDoc(
        stableStreamText(raw.streaming.text),
        raw.streaming.allowedRefs,
        blocks,
        raw.book,
        raw.main.sectionId,
        true,
      ),
      streaming: true,
      detour: raw.streaming.detourId !== null,
    });
  else if (raw.busy) result.push({ kind: 'typing', id: 'typing' });
  if (raw.error)
    result.push({
      kind: 'error',
      id: 'request-error',
      text: raw.error,
      retry: true,
      settings: raw.errorSettings,
    });
  const active = raw.detours[raw.detours.length - 1]?.detourId;
  if (active !== undefined) {
    const grouped: ThreadItem[] = [];
    let run: ThreadItem[] = [];
    const flush = () => {
      if (run.length)
        grouped.push({
          kind: 'detourRun',
          id: `detour-${grouped.length}`,
          items: run,
        });
      run = [];
    };
    result.forEach(item => {
      const m = raw.messages.find(msg => String(msg.id) === item.id);
      if (m?.detour_id === active || ('detour' in item && item.detour))
        run.push(item);
      else {
        flush();
        grouped.push(item);
      }
    });
    flush();
    result = grouped;
  }
  return result;
}
export function tableRows(html: string | null, text: string): string[][] {
  if (!html) return text.split('\n').map(line => line.split('\t'));
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(row =>
    [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(cell =>
      decodeTextEntities(
        cell[1].replace(/<(?!\/?(?:sup|sub)\b)[^>]*>/gi, ' '),
      ).trim(),
    ),
  );
  return rows.length ? rows : [[text || html.replace(/<[^>]*>/g, ' ')]];
}
export function tableContent(html: string | null, text: string): RichDoc[][] {
  return tableRows(html, text).map(row => row.map(cell => parse(cell)));
}
export function tableGrid(
  html: string | null,
  text: string,
): RichTable | undefined {
  const table = parseBookTable(text, html);
  return table
    ? {
        ...table,
        cells: table.cells.map(({ text: value, ...cell }) => ({
          ...cell,
          doc: parse(value),
        })),
      }
    : undefined;
}
export function presentRefinementContent(
  block: Pick<Block, 'type' | 'text' | 'latex' | 'html'> & {
    visual?: BookVisualData | null;
    image_path?: string | null;
  },
): RefinementContent {
  if (block.visual) return { kind: 'visual', data: block.visual };
  if (block.type === 'image')
    return {
      kind: 'image',
      uri: block.image_path ?? undefined,
      text: block.text,
    };
  if (block.type === 'equation')
    return { kind: 'equation', tex: displayTex(block.latex ?? block.text) };
  if (block.type === 'table')
    return {
      kind: 'table',
      rows: tableContent(block.html, block.text),
      grid: tableGrid(block.html, block.text),
    };
  return { kind: 'text', text: block.text };
}
export function presentReaderItems(
  blocks: Block[],
  book: Book | null,
  raw: SessionState,
  highlights: Set<number>,
  pins: Map<number, { id: string; label: string }>,
  selected?: number,
  flash?: number,
): ReaderItem[] {
  const result: ReaderItem[] = [];
  /** Reader blocks that a later source block may continue, by every seq they already hold. */
  const open = new Map<number, ReaderBlock>();
  let page = '';
  for (const b of blocks) {
    const label = blockPage(b, book);
    const into =
      b.refinement?.continuesFrom != null
        ? open.get(b.refinement.continuesFrom)
        : undefined;
    // A continued paragraph keeps the page number after it, as in the printed book.
    if (!into && page !== label) {
      page = label;
      result.push({ kind: 'pageBreak', page: label, id: `page-${b.seq}` });
    }
    const current = raw.plan?.steps[raw.main.step];
    const done =
      raw.sections.find(s => s.id === b.section_id)?.status === 'done' ||
      raw.plan?.steps.some(
        s =>
          (s.status === 'done' || s.status === 'skipped') &&
          b.seq >= s.block_from &&
          b.seq <= s.block_to,
      );
    const now =
      current &&
      b.seq >= current.block_from &&
      b.seq <= current.block_to &&
      raw.phase !== 'ready';
    const marks: ReaderBlock['marks'] = [
      ...(done ? ['heard' as const] : []),
      ...(now ? ['now' as const] : []),
      ...(highlights.has(b.seq) ? ['highlight' as const] : []),
      ...(selected === b.seq ? ['selected' as const] : []),
      ...(flash === b.seq || (raw.flashRef === flash && now)
        ? ['flash' as const]
        : []),
    ];
    const heading = b.refinement?.heading;
    const doc = heading
      ? blockDoc({ ...b, text: b.text.slice(heading.length).trimStart() }, book)
      : blockDoc(b, book);
    if (into) {
      into.doc = joinDocs(into.doc, doc, b.type === 'title' ? '\n' : ' ');
      into.joined = [...(into.joined ?? []), b.seq];
      into.marks = [...new Set([...into.marks, ...marks])];
      into.pin ??= pins.get(b.seq);
      open.set(b.seq, into);
      continue;
    }
    const item: ReaderBlock = {
      kind: 'block',
      refined: reworded(b),
      continuesFrom: b.refinement?.continuesFrom ?? undefined,
      headingLevel: b.type === 'title' ? b.level ?? undefined : undefined,
      ...(heading
        ? {
            runIn: {
              text: b.text.slice(0, heading.length).trim(),
              level: heading.level,
            },
          }
        : {}),
      ...(b.refinement?.role === 'note' ? { note: true } : {}),
      ref: `b${b.seq}`,
      seq: b.seq,
      type: b.type,
      doc,
      page: label,
      marks,
      pin: pins.get(b.seq),
      uri: b.image_path ?? undefined,
      table: b.type === 'table' ? tableContent(b.html, b.text) : undefined,
      tableGrid: b.type === 'table' ? tableGrid(b.html, b.text) : undefined,
    };
    result.push(item);
    if (b.type === 'text' || b.type === 'title') open.set(b.seq, item);
  }
  return result;
}
/** Structure changes show on their own; badge only blocks whose wording the AI changed. */
const reworded = (b: Block) => {
  // Spacing and e-book link icons are invisible in the reader either way.
  const visible = (text: string) =>
    text.replace(PRIVATE_USE, '').replace(/\s+/g, '');
  return (
    !!b.refinement &&
    (visible(b.refinement.originalText) !== visible(b.text) ||
      !!b.refinement.visual ||
      (b.refinement.originalType === 'image' && b.type === 'table'))
  );
};
/** Joins the last paragraph of `a` with the first paragraph of `b` into one printed paragraph. */
export function joinDocs(a: RichDoc, b: RichDoc, gap: string): RichDoc {
  const last = a.at(-1),
    first = b[0];
  if (last?.t !== 'p' || first?.t !== 'p') return [...a, ...b];
  const tail = last.c.at(-1),
    head = first.c[0];
  const glue =
    gap === ' ' &&
    tail?.t === 'text' &&
    head?.t === 'text' &&
    (/[-㐀-鿿]$/u.test(tail.v) || /^[\s,.;:)\]，。；：）、㐀-鿿]/u.test(head.v))
      ? ''
      : gap;
  return [
    ...a.slice(0, -1),
    {
      t: 'p',
      c: [
        ...last.c,
        ...(glue ? [{ t: 'text' as const, v: glue }] : []),
        ...first.c,
      ],
    },
    ...b.slice(1),
  ];
}

export function presentOriginalPages(
  blocks: Block[],
  book: Book | null,
  section: Section | null,
  raw: SessionState,
  highlights: Set<number>,
  pins: Map<number, { id: string; label: string }>,
  images: Map<number, { uri: string; w: number; h: number }>,
  sizes: { w: number; h: number }[] = [],
  selected?: number,
  flash?: number,
): import('./types').ReaderOriginalPage[] {
  if (!section || !book || book.format !== 'pdf') return [];
  const pageNumbers = blocks.flatMap(b => (b.page === null ? [] : [b.page]));
  const first = section.page_from ?? Math.min(...pageNumbers);
  const last = section.page_to ?? Math.max(...pageNumbers);
  if (
    !Number.isFinite(first) ||
    !Number.isFinite(last) ||
    first < 1 ||
    last < first
  )
    return [];
  const presented = new Map(
    presentReaderItems(blocks, book, raw, highlights, pins, selected, flash)
      .filter(
        (b): b is Extract<ReaderItem, { kind: 'block' }> => b.kind === 'block',
      )
      .map(b => [b.seq, b]),
  );
  return Array.from({ length: last - first + 1 }, (_, i) => {
    const page = first + i;
    return {
      page,
      label: blockPage({ page } as Block, book),
      image: images.get(page) ?? null,
      size: sizes[page - 1] ?? { w: 612, h: 792 },
      blocks: blocks
        .filter(
          b =>
            b.page === page &&
            [b.x0, b.y0, b.x1, b.y1].every(
              n => n !== null && Number.isFinite(n),
            ) &&
            b.x1! > b.x0! &&
            b.y1! > b.y0!,
        )
        .map(b => ({
          ref: b.seq,
          x0: b.x0!,
          y0: b.y0!,
          x1: b.x1!,
          y1: b.y1!,
          marks: presented.get(b.seq)?.marks ?? [],
          selectable: b.type !== 'title',
          label: b.text.slice(0, 100) || `内容块 b${b.seq}`,
          pin: pins.has(b.seq),
          pinId: pins.get(b.seq)?.id,
          pinLabel: pins.get(b.seq)?.label,
        })),
    };
  });
}
