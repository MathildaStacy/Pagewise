import type { Block, Book, Message, Section } from '@core/types';
import {
  parse,
  stableStreamText,
  type Inline,
  type RichDoc as CoreDoc,
} from '@core/markup';
import { validateCitations } from '@core/citations';
import {
  parseStudyCard,
  type StudyState as SessionState,
} from '@app/study/types';
import type { RichDoc, RichInline } from '@ui/kit';
import type { QuickKey, ReaderItem, ThreadItem } from './types';

export function sectionLabel(section: Section | null | undefined) {
  return section
    ? [section.no, section.title].filter(Boolean).join(' ')
    : '正在读取';
}
export function blockPage(
  block: Pick<Block, 'page' | 'loc'> | undefined,
  book: Pick<Book, 'page_offset'> | null,
) {
  return block?.page !== null && block?.page !== undefined
    ? `p.${block.page - (book?.page_offset ?? 0)}`
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
    if (b.t === 'aux') return { ...b, body: enrichDoc(b.body, blocks, book) };
    if (b.t === 'quote' || b.t === 'figure') {
      const source = blocks.get(b.ref);
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
export function blockDoc(block: Block, book: Book | null): RichDoc {
  if (block.type === 'title')
    return [{ t: 'p', c: [{ t: 'b', c: [{ t: 'text', v: block.text }] }] }];
  if (block.type === 'equation')
    return [{ t: 'math', tex: block.latex ?? block.text }];
  if (block.type === 'code') return [{ t: 'code', text: block.text }];
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
  return enrichDoc(parse(block.text), new Map([[block.seq, block]]), book);
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
      cell[1]
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .trim(),
    ),
  );
  return rows.length ? rows : [[text || html.replace(/<[^>]*>/g, ' ')]];
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
  let page = '';
  for (const b of blocks) {
    const label = blockPage(b, book);
    if (page !== label) {
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
    result.push({
      kind: 'block',
      ref: `b${b.seq}`,
      seq: b.seq,
      type: b.type,
      doc: blockDoc(b, book),
      page: label,
      marks: [
        ...(done ? ['heard' as const] : []),
        ...(now ? ['now' as const] : []),
        ...(highlights.has(b.seq) ? ['highlight' as const] : []),
        ...(selected === b.seq ? ['selected' as const] : []),
        ...(flash === b.seq || (raw.flashRef === flash && now)
          ? ['flash' as const]
          : []),
      ],
      pin: pins.get(b.seq),
      uri: b.image_path ?? undefined,
      table: b.type === 'table' ? tableRows(b.html, b.text) : undefined,
    });
  }
  return result;
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
