import type { Block, JsonValue, Section, SectionPart } from '../types';
import { normalizeText, textSimilarity } from './migration';
import type {
  MapFlag,
  MapOptions,
  MapResult,
  OutlineItem,
  PageNumberSample,
} from './types';
export type * from './types';
export {
  buildBlockMigration,
  collectReferencedSeqs,
  migrateReferences,
  normalizeText,
  textSimilarity,
} from './migration';

interface Heading {
  id: string;
  no: string | null;
  title: string;
  level: 1 | 2 | 3;
  seq: number | null;
  page: number | null;
  source: 'auto' | 'bookmark';
  intro: boolean;
  endSeq: number | null;
  flags: { kind: MapFlag['kind']; detail: Record<string, unknown> }[];
}
const cnDigits: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};
function chapterNumber(text: string): number {
  if (/^\d+$/.test(text)) return Number(text);
  let total = 0,
    current = 0;
  for (const char of text) {
    if (char === '十' || char === '百') {
      total += (current || 1) * (char === '十' ? 10 : 100);
      current = 0;
    } else current = cnDigits[char] ?? 0;
  }
  return total + current;
}
function numbered(
  text: string,
  chapterAllowed: boolean,
): Pick<Heading, 'id' | 'no' | 'title' | 'level'> | null {
  const value = text.trim();
  let match = /^(\d+)\.(\d+)\.(\d+)(?!\d|\.\d)\s*(.+)$/.exec(value);
  if (match)
    return {
      id: `${match[1]}.${match[2]}.${match[3]}`,
      no: `${match[1]}.${match[2]}.${match[3]}`,
      title: match[4].trim(),
      level: 3,
    };
  match = /^(\d+)\.(\d+)(?!\d|\.\d)\s*(.+)$/.exec(value);
  if (match)
    return {
      id: `${match[1]}.${match[2]}`,
      no: `${match[1]}.${match[2]}`,
      title: match[3].trim(),
      level: 2,
    };
  match = /^第\s*([0-9一二三四五六七八九十百零〇]+)\s*章\s*(.*)$/.exec(value);
  if (match) {
    const no = String(chapterNumber(match[1]));
    return {
      id: `ch${no}`,
      no,
      title: match[2].trim() || `第${match[1]}章`,
      level: 1,
    };
  }
  match = /^Chapter\s+(\d+)(?:\s*[:：—–-]\s*|\s+)(.+)$/i.exec(value);
  if (match)
    return {
      id: `ch${Number(match[1])}`,
      no: String(Number(match[1])),
      title: match[2].trim(),
      level: 1,
    };
  match = /^(\d+)\s+([^:：—–\s-].*)$/.exec(value);
  if (match && chapterAllowed)
    return {
      id: `ch${Number(match[1])}`,
      no: String(Number(match[1])),
      title: match[2].trim(),
      level: 1,
    };
  match = /^(?:附录|Appendix)\s*([A-Z])(?:\s*[.:：]?\s*(.*))$/i.exec(value);
  if (match)
    return {
      id: `app${match[1].toUpperCase()}`,
      no: match[1].toUpperCase(),
      title: match[2]?.trim() || `附录 ${match[1].toUpperCase()}`,
      level: 1,
    };
  return null;
}
const levelOf = (value: number): 1 | 2 | 3 =>
  Math.max(1, Math.min(3, Math.trunc(value))) as 1 | 2 | 3;
const headingText = (text: string) =>
  normalizeText(
    text
      .replace(/^第\s*[0-9一二三四五六七八九十百零〇]+\s*章\s*/, '')
      .replace(/^Chapter\s+\d+\s*[:：—–-]?\s*/i, '')
      .replace(/^(?:Chapter\s+)?\d+(?:\.\d+)*\s*[.:：]?\s*/i, '')
      .replace(/^(?:附录|Appendix)\s*[A-Z]\s*/i, ''),
  );
function mode(values: number[]): { value: number; count: number } {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const sorted = [...counts].sort(
    (a, b) => b[1] - a[1] || Math.abs(a[0]) - Math.abs(b[0]) || a[0] - b[0],
  );
  return { value: sorted[0]?.[0] ?? 0, count: sorted[0]?.[1] ?? 0 };
}
export function inferPageOffset(
  pages: readonly number[],
  pageLabels: readonly string[] | null = null,
  pageNumbers: readonly PageNumberSample[] = [],
): { pageOffset: number; reliable: boolean } {
  const labels =
    pageLabels?.flatMap((label, index) =>
      /^\d+$/.test(label.trim()) ? [index + 1 - Number(label)] : [],
    ) ?? [];
  if (labels.length) return { pageOffset: mode(labels).value, reliable: true };
  const byPage = new Map<number, Set<number>>();
  for (const sample of pageNumbers) {
    const label = String(sample.label ?? sample.printed ?? '').trim();
    if (
      !/^\d+$/.test(label) ||
      !Number.isSafeInteger(sample.page) ||
      sample.page < 1
    )
      continue;
    const values = byPage.get(sample.page) ?? new Set<number>();
    values.add(sample.page - Number(label));
    byPage.set(sample.page, values);
  }
  const unique = [...byPage]
    .filter(
      ([page, values]) =>
        values.size === 1 && (!pages.length || pages.includes(page)),
    )
    .map(([, values]) => [...values][0]);
  const best = mode(unique),
    coverage = best.count / Math.max(1, new Set(pages).size || byPage.size);
  return coverage >= 0.6
    ? { pageOffset: best.value, reliable: true }
    : { pageOffset: 0, reliable: false };
}
function recognize(blocks: readonly Block[]): Heading[] {
  const result: Heading[] = [];
  const chapterChildren = new Map<number, Block[]>();
  const chapterStarts = new Set(
    blocks.flatMap(block => {
      const match = /^(\d+)\.1(?:\.|\s)/.exec(block.text.trim());
      if (match) {
        const chapter = Number(match[1]);
        const children = chapterChildren.get(chapter) ?? [];
        children.push(block);
        chapterChildren.set(chapter, children);
      }
      return match ? [Number(match[1])] : [];
    }),
  );
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index],
      text = block.text.trim();
    if (!text) continue;
    const chapter = /^(?:Chapter\s+)?(\d+)\s/i.exec(text);
    const chapterAllowed =
      chapter &&
      chapterStarts.has(Number(chapter[1])) &&
      (block.type === 'title' ||
        (chapterChildren.get(Number(chapter[1])) ?? []).some(
          child =>
            child.seq > block.seq &&
            child.page !== null &&
            block.page !== null &&
            child.page >= block.page &&
            child.page <= block.page + 1,
        ));
    const value = numbered(text, Boolean(chapterAllowed));
    if (
      block.type !== 'title' &&
      !(
        block.type === 'text' &&
        value &&
        Array.from(text).length <= 40 &&
        !text.includes('\n')
      )
    )
      continue;
    const previous = result.at(-1),
      hasNumber = !!value;
    if (
      !hasNumber &&
      previous &&
      blocks[index - 1]?.seq === previous.endSeq &&
      block.page !== null &&
      block.page === previous.page &&
      block.type === 'title'
    ) {
      previous.title = `${previous.title} ${text}`.trim();
      previous.endSeq = block.seq;
      const merged = previous.flags.find(flag => flag.kind === 'merged');
      if (merged) (merged.detail.blocks as number[]).push(block.seq);
      else
        previous.flags.push({
          kind: 'merged',
          detail: { blocks: [previous.seq, block.seq] },
        });
      continue;
    }
    const level =
      value?.level ??
      levelOf(block.level ?? (previous ? Math.min(previous.level + 1, 3) : 1));
    result.push({
      ...value,
      id: value?.id ?? `u${block.seq}`,
      no: value?.no ?? null,
      title: value?.title ?? text,
      level,
      seq: block.seq,
      page: block.page,
      source: 'auto',
      intro:
        /^(?:本章引言|本章导读|引言|Chapter\s+Introduction|Introduction)$/i.test(
          text,
        ),
      endSeq: block.seq,
      flags: [],
    });
  }
  return result;
}
function reconcile(
  headings: Heading[],
  outline: readonly OutlineItem[] | null,
  blocks: readonly Block[],
): void {
  // Match only headings within the permitted page window. Normalizing and
  // comparing every title in a full-book outline makes each partial import
  // quadratic, including hundreds of chapters that have not been parsed yet.
  const byPage = new Map<number, Heading[]>();
  const normalizedTitles = new Map<Heading, string>();
  const headingOrder = new Map<Heading, number>();
  const ids = new Set(headings.map(heading => heading.id));
  const firstBlock = new Map<number, Block>();
  for (const block of blocks)
    if (block.page !== null && !firstBlock.has(block.page))
      firstBlock.set(block.page, block);
  const indexHeading = (heading: Heading) => {
    headingOrder.set(heading, headingOrder.size);
    if (heading.page !== null) {
      const page = byPage.get(heading.page) ?? [];
      page.push(heading);
      byPage.set(heading.page, page);
    }
    normalizedTitles.set(heading, headingText(heading.title));
  };
  headings.forEach(indexHeading);
  for (const [index, item] of (outline ?? []).entries()) {
    if (item.level < 1 || item.level > 3 || !item.title.trim()) continue;
    const normalized = headingText(item.title),
      parsed = numbered(item.title, true);
    const candidates = [
      ...(byPage.get(item.page - 1) ?? []),
      ...(byPage.get(item.page) ?? []),
      ...(byPage.get(item.page + 1) ?? []),
    ];
    const match = candidates
      .map(heading => ({
        heading,
        similarity: textSimilarity(
          normalized,
          normalizedTitles.get(heading)!,
          0.8,
        ),
      }))
      .filter(
        candidate =>
          candidate.similarity >= 0.8 &&
          candidate.heading.page !== null &&
          Math.abs(candidate.heading.page - item.page) <= 1,
      )
      .sort(
        (a, b) =>
          b.similarity - a.similarity ||
          Math.abs(a.heading.page! - item.page) -
            Math.abs(b.heading.page! - item.page) ||
          headingOrder.get(a.heading)! - headingOrder.get(b.heading)!,
      )[0]?.heading;
    if (match) {
      if (parsed?.no) {
        if (!match.no) match.no = parsed.no;
        else if (match.no !== parsed.no)
          match.flags.push({
            kind: 'level',
            detail: {
              reason: 'number-conflict',
              recognizedNo: match.no,
              outlineNo: parsed.no,
            },
          });
      }
      if (match.level !== item.level) {
        match.flags.push({
          kind: 'level',
          detail: { recognized: match.level, outline: item.level },
        });
        match.level = levelOf(item.level);
      }
      continue;
    }
    const block = firstBlock.get(item.page);
    let id = parsed?.id ?? `bookmark${index + 1}`;
    if (ids.has(id)) id = `${id}_p${item.page}`;
    const heading: Heading = {
      id,
      no: parsed?.no ?? null,
      title: parsed?.title ?? item.title.trim(),
      level: levelOf(item.level),
      seq: block?.seq ?? null,
      page: item.page,
      source: 'bookmark',
      intro: false,
      endSeq: block?.seq ?? null,
      flags: [
        {
          kind: 'missing',
          detail: { outlineTitle: item.title, page: item.page },
        },
      ],
    };
    headings.push(heading);
    ids.add(id);
    indexHeading(heading);
  }
}
const effectiveSeq = (heading: Heading) =>
  heading.seq ?? (heading.page ?? 0) * 1000;
function stats(section: Section, blocks: readonly Block[]): void {
  const own = blocks.filter(
    block =>
      section.block_from !== null &&
      section.block_to !== null &&
      block.seq >= section.block_from &&
      block.seq <= section.block_to,
  );
  section.chars = own.reduce(
    (sum, block) => sum + (block.chars || Array.from(block.text).length),
    0,
  );
  const pages = own.flatMap(block => (block.page === null ? [] : [block.page]));
  section.page_from = pages.length ? Math.min(...pages) : section.page_from;
  section.page_to = pages.length ? Math.max(...pages) : section.page_to;
}
const protectedTypes = new Set<Block['type']>([
  'equation',
  'image',
  'table',
  'code',
]);
export function buildSectionParts(
  section: Section,
  blocks: readonly Block[],
): SectionPart[] {
  const own = blocks.filter(
    block =>
      section.block_from !== null &&
      section.block_to !== null &&
      block.seq >= section.block_from &&
      block.seq <= section.block_to,
  );
  if (!own.length) return [];
  const safe = new Set(own.map((_, index) => index).filter(index => index > 0));
  own.forEach((block, index) => {
    if (protectedTypes.has(block.type)) {
      safe.delete(index);
      safe.delete(index + 1);
    }
  });
  const weights = own.map(
      block => block.chars || Array.from(block.text).length,
    ),
    prefix = [0];
  for (const weight of weights) prefix.push(prefix.at(-1)! + weight);
  const total = prefix.at(-1)!,
    starts = [0];
  if (total > 4000) {
    let start = 0,
      remaining = Math.max(2, Math.ceil(total / 3000));
    while (remaining > 1) {
      const left = total - prefix[start],
        target = left / remaining;
      const candidates = [...safe].filter(
        index =>
          index > start &&
          prefix[index] - prefix[start] >= 1500 &&
          total - prefix[index] >= 1500 * (remaining - 1),
      );
      const preferred = candidates.filter(
        index =>
          prefix[index] - prefix[start] >= 1500 &&
          prefix[index] - prefix[start] <= 3000,
      );
      const cut = (preferred.length ? preferred : candidates).sort(
        (a, b) =>
          Math.abs(prefix[a] - prefix[start] - target) -
            Math.abs(prefix[b] - prefix[start] - target) || a - b,
      )[0];
      if (cut === undefined) break;
      starts.push(cut);
      start = cut;
      remaining--;
    }
  }
  return starts.map((start, index) => {
    const end = (starts[index + 1] ?? own.length) - 1;
    return {
      book_id: section.book_id,
      section_id: section.id,
      part_no: index,
      block_from: own[start].seq,
      block_to: own[end].seq,
      name:
        own
          .slice(start, end + 1)
          .find(
            block => block.type === 'title' && block.seq !== section.block_from,
          )?.text ?? `第 ${index + 1} 段`,
    };
  });
}

function extendIntroductions(
  sections: Section[],
  headings: Heading[],
  blocks: readonly Block[],
): void {
  for (const section of sections) {
    if (section.source === 'manual' || section.is_leaf || section.merged_into)
      continue;
    const first = sections.find(
      child =>
        child.parent_id === section.id &&
        child.block_from !== null &&
        !child.merged_into,
    );
    const heading = headings.find(value => value.id === section.id);
    if (!first || first.source === 'manual' || !heading) continue;
    const inherited =
      section.block_from !== null &&
      heading.seq !== null &&
      section.block_from < heading.seq
        ? section.block_from
        : null;
    const prefix =
      inherited ??
      blocks.find(
        block =>
          heading.endSeq !== null &&
          block.seq > heading.endSeq &&
          block.seq < first.block_from!,
      )?.seq;
    if (prefix !== undefined && prefix !== null && prefix < first.block_from!) {
      first.block_from = prefix;
      stats(first, blocks);
    }
  }
}

/** Rebuild from the book's currently available blocks; no IO or mutation of caller records. */
export function buildMap(
  input: readonly Block[],
  outline: readonly OutlineItem[] | null = null,
  prev: readonly Section[] = [],
  options: MapOptions = {},
): MapResult {
  const blocks = [...input].sort((a, b) => a.seq - b.seq),
    bookId = options.bookId ?? blocks[0]?.book_id ?? prev[0]?.book_id ?? '';
  if (
    blocks.some(
      (block, index) =>
        block.book_id !== bookId ||
        !Number.isSafeInteger(block.seq) ||
        block.seq < 0 ||
        (index > 0 && block.seq === blocks[index - 1].seq),
    )
  )
    throw new Error('地图需要同一本书中唯一且有效的块序号');
  const headings = recognize(blocks);
  reconcile(headings, outline, blocks);
  const manual = prev.filter(section => section.source === 'manual');
  for (const section of manual) {
    const existing = headings.findIndex(
      heading =>
        heading.id === section.id || heading.seq === section.block_from,
    );
    if (existing >= 0) headings.splice(existing, 1);
    headings.push({
      id: section.id,
      no: section.no,
      title: section.title,
      level: section.level,
      seq: section.block_from,
      page: section.page_from,
      source: 'auto',
      intro: false,
      endSeq: section.block_from,
      flags: [],
    });
  }
  if (
    blocks.length &&
    (!headings.length || headings.every(heading => heading.seq === null))
  )
    headings.push({
      id: `u${blocks[0].seq}`,
      no: null,
      title: '正文',
      level: 1,
      seq: blocks[0].seq,
      page: blocks[0].page,
      source: 'auto',
      intro: false,
      endSeq: blocks[0].seq,
      flags: [],
    });
  headings.sort(
    (a, b) =>
      effectiveSeq(a) - effectiveSeq(b) ||
      a.level - b.level ||
      a.id.localeCompare(b.id),
  );
  const ids = new Set<string>();
  for (const heading of headings) {
    if (ids.has(heading.id))
      heading.id = `${heading.id}_b${heading.seq ?? heading.page}`;
    ids.add(heading.id);
  }
  const stack: Section[] = [],
    flags: MapFlag[] = [];
  const sections = headings.map((heading, index): Section => {
    while (stack.length && stack.at(-1)!.level >= heading.level) stack.pop();
    const next = headings
        .slice(index + 1)
        .find(value => value.level <= heading.level),
      own =
        heading.seq === null
          ? []
          : blocks.filter(
              block =>
                block.seq >= heading.seq! &&
                (!next || block.seq < effectiveSeq(next)),
            );
    const previous = prev.find(section => section.id === heading.id),
      kept = manual.find(section => section.id === heading.id);
    const section: Section = kept
      ? { ...kept }
      : {
          book_id: bookId,
          id: heading.id,
          parent_id: stack.at(-1)?.id ?? null,
          level: heading.level,
          ord: index,
          no: heading.no,
          title: heading.title,
          is_leaf: true,
          block_from: own[0]?.seq ?? null,
          block_to: own.at(-1)?.seq ?? null,
          page_from: own[0]?.page ?? heading.page,
          page_to: own.at(-1)?.page ?? heading.page,
          chars: 0,
          parts: 1,
          status: previous?.status ?? 'new',
          summary: previous?.summary ?? null,
          guide: previous?.guide ?? null,
          source: heading.source,
          flag: heading.flags.at(-1)?.kind ?? null,
          flag_detail: heading.flags.length
            ? (JSON.parse(JSON.stringify(heading.flags)) as JsonValue)
            : null,
          merged_into: null,
        };
    if (!kept) stats(section, blocks);
    for (const flag of heading.flags)
      flags.push({ sectionId: section.id, ...flag });
    stack.push(section);
    return section;
  });
  const byId = new Map(sections.map(section => [section.id, section]));
  for (const section of sections)
    if (!manual.some(value => value.id === section.id))
      section.is_leaf = !sections.some(child => child.parent_id === section.id);
  extendIntroductions(sections, headings, blocks);
  for (let index = 0; index < sections.length; index++) {
    const section = sections[index],
      heading = headings[index];
    if (
      section.source === 'manual' ||
      section.block_from === null ||
      (!section.is_leaf && !heading.intro) ||
      (!heading.intro && section.chars >= 300)
    )
      continue;
    const siblings = sections.filter(
      value =>
        value.parent_id === section.parent_id &&
        value.id !== section.id &&
        !value.merged_into &&
        value.source !== 'manual',
    );
    const next = siblings.find(value => value.ord > section.ord),
      target = next ?? siblings.filter(value => value.ord < section.ord).at(-1);
    if (
      !target ||
      target.block_from === null ||
      target.block_to === null ||
      section.block_to === null
    )
      continue;
    target.block_from = Math.min(target.block_from, section.block_from);
    target.block_to = Math.max(target.block_to, section.block_to);
    stats(target, blocks);
    section.merged_into = target.id;
    section.is_leaf = false;
    section.flag = 'merged';
    section.flag_detail = {
      into: target.id,
      reason: heading.intro ? 'chapter-introduction' : 'short-section',
    };
    flags.push({
      sectionId: section.id,
      kind: 'merged',
      detail: {
        into: target.id,
        reason: heading.intro ? 'chapter-introduction' : 'short-section',
      },
    });
  }
  for (const section of sections) {
    const seen = new Set<string>();
    while (section.merged_into && !seen.has(section.merged_into)) {
      seen.add(section.merged_into);
      const target = byId.get(section.merged_into);
      if (!target?.merged_into) break;
      section.merged_into = target.merged_into;
    }
    if (section.merged_into && section.source !== 'manual') {
      if (
        section.flag_detail &&
        typeof section.flag_detail === 'object' &&
        !Array.isArray(section.flag_detail)
      )
        section.flag_detail = {
          ...section.flag_detail,
          into: section.merged_into,
        };
      for (const flag of flags)
        if (flag.sectionId === section.id && flag.detail.into)
          flag.detail.into = section.merged_into;
    }
  }
  extendIntroductions(sections, headings, blocks);
  const parts: SectionPart[] = [];
  for (const section of sections.filter(
    value => value.is_leaf && !value.merged_into,
  )) {
    const ownParts = buildSectionParts(section, blocks);
    parts.push(...ownParts);
    if (section.source !== 'manual') section.parts = ownParts.length;
    if (ownParts.length > 1 && section.source !== 'manual') {
      section.flag = 'split';
      section.flag_detail = { parts: ownParts.length };
      flags.push({
        sectionId: section.id,
        kind: 'split',
        detail: { parts: ownParts.length },
      });
    }
  }
  const pages = blocks.flatMap(block =>
      block.page === null ? [] : [block.page],
    ),
    offset = inferPageOffset(pages, options.pageLabels, options.pageNumbers);
  return {
    sections,
    parts,
    flags,
    pageOffset: offset.pageOffset,
    pageOffsetReliable: offset.reliable,
    pageLabels: options.pageLabels ?? null,
  };
}
