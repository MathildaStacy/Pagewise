import { blockLabels, mentionedLabels } from '@core/labels';
import type { Block, JsonValue, Section } from '@core/types';
import type { ContentRole } from '@core/learningScope';

const clip = (text: string, size: number) => {
  const chars = Array.from(text);
  return chars.length > size ? `${chars.slice(0, size).join('')}…` : text;
};
const sectionName = (section: Section) =>
  section.no && !section.title.startsWith(section.no)
    ? `${section.no} ${section.title}`
    : section.title;
const figureLike = (block: Block) =>
  block.type === 'image' || block.type === 'table';

/** A caption is its own block next to the figure or table it names. */
function pairedCaption(blocks: readonly Block[], index: number) {
  const block = blocks[index];
  if (!figureLike(block)) return undefined;
  return [blocks[index + 1], blocks[index - 1]].find(
    near => near?.type === 'caption',
  );
}
function pairedFigure(blocks: readonly Block[], index: number) {
  if (blocks[index].type !== 'caption') return undefined;
  return [blocks[index - 1], blocks[index + 1]].find(
    near => near && figureLike(near),
  );
}

/** What the model can read for a block: tables as HTML, figures through their caption and redrawn data. */
export function blockMaterial(
  block: Block,
  caption?: Block,
  size = 4000,
): Record<string, JsonValue> {
  return {
    seq: block.seq,
    type: block.type,
    text: clip(block.text, size),
    latex: block.latex ?? null,
    ...(block.type === 'table' && block.html
      ? { html: clip(block.html, size) }
      : {}),
    ...(caption ? { caption: caption.text } : {}),
    ...(block.refinement?.visual
      ? { visual: JSON.parse(JSON.stringify(block.refinement.visual)) }
      : {}),
  };
}

type ReferenceOptions = {
  /** Blocks from the rest of the book that carry the labels the nearby blocks lack. */
  elsewhere?: readonly Block[];
  sections?: readonly Section[];
  limit?: number;
};

/** The chapter number a section sits in, from the first numbered node on its path: 3 for 3.5.3. */
function chapterLookup(sections: readonly Section[]) {
  const known = new Map<string | null, string | null>();
  return (id: string | null) => {
    if (!known.has(id)) {
      const no = sectionPath(sections, id).find(node => node.no)?.no;
      const digits = no ? /^\d+/u.exec(no)?.[0] : undefined;
      known.set(id, digits ? String(Number(digits)) : null);
    }
    return known.get(id) ?? null;
  };
}

/** A figure or table with its own caption is found through the caption. */
function labelled(blocks: readonly Block[], at: number, key: string) {
  const item = blocks[at];
  return (
    (!figureLike(item) || !pairedCaption(blocks, at)) &&
    blockLabels(item).includes(key)
  );
}

/**
 * Find the figures, tables and equations a block refers to, first among nearby blocks,
 * then `elsewhere` in the chapter the label names (第 2 章, or 4 in 图4.3) or the current one.
 */
function resolveReferences(
  block: Block,
  nearby: readonly Block[],
  { elsewhere = [], sections = [], limit = 3 }: ReferenceOptions,
) {
  const found: Record<string, JsonValue>[] = [];
  const missing: string[] = [];
  const chapterOf = chapterLookup(sections);
  const seen = new Set<number>([block.seq]);
  const own = new Set(blockLabels(block));
  const at = nearby.findIndex(item => item.seq === block.seq);
  if (at >= 0) {
    for (const near of [pairedCaption(nearby, at), pairedFigure(nearby, at)])
      if (near) {
        seen.add(near.seq);
        blockLabels(near).forEach(key => own.add(key));
      }
  }
  const take = (pool: readonly Block[], index: number) => {
    const item = pool[index];
    const figure = pairedFigure(pool, index);
    seen.add(item.seq);
    if (figure) seen.add(figure.seq);
    return figure
      ? blockMaterial(figure, item, 3000)
      : blockMaterial(item, pairedCaption(pool, index), 3000);
  };
  for (const label of mentionedLabels(block.text)) {
    if (found.length >= limit) break;
    if (own.has(label.key)) continue;
    const local = nearby.findIndex(
      (item, index) =>
        !seen.has(item.seq) &&
        labelled(nearby, index, label.key) &&
        (!label.chapter ||
          [null, label.chapter].includes(chapterOf(item.section_id))),
    );
    if (local >= 0) {
      found.push(take(nearby, local));
      continue;
    }
    const candidates = elsewhere.flatMap((item, index) =>
      !seen.has(item.seq) && labelled(elsewhere, index, label.key)
        ? [index]
        : [],
    );
    const wanted =
      label.chapter ?? label.numbered ?? chapterOf(block.section_id);
    // A dotted number names its block wherever it sits; a bare one only when the book has just one.
    const anywhere = label.numbered
      ? !label.chapter || label.chapter === label.numbered
      : !label.chapter && candidates.length === 1;
    const pick =
      candidates.find(
        index =>
          wanted !== null && chapterOf(elsewhere[index].section_id) === wanted,
      ) ?? (anywhere ? candidates[0] : undefined);
    if (pick === undefined) {
      missing.push(label.key);
      continue;
    }
    const where = sectionPath(sections, elsewhere[pick].section_id).at(-1);
    found.push({
      ...take(elsewhere, pick),
      ...(where ? { section: sectionName(where) } : {}),
    });
  }
  return { found, missing };
}

/**
 * The figures, tables and equations a block refers to. The caption carries the label;
 * the material is the figure or table beside it. Nearby blocks win over `elsewhere`.
 */
export function referencedMaterial(
  block: Block,
  nearby: readonly Block[],
  options: ReferenceOptions = {},
): Record<string, JsonValue>[] {
  return resolveReferences(block, nearby, options).found;
}

/** Label keys the block mentions that nearby blocks do not supply, for a whole-book lookup. */
export function missingLabels(
  block: Block,
  nearby: readonly Block[],
  sections: readonly Section[],
): string[] {
  return resolveReferences(block, nearby, { sections }).missing;
}

/** Chapter titles for the whole book plus the full current chapter, without front or back matter. */
export function explainMap(
  sections: readonly Section[],
  currentId: string | null,
  roles: Map<string, { role: ContentRole }>,
): string[] {
  const byId = new Map(sections.map(section => [section.id, section]));
  const path = sectionPath(sections, currentId);
  const chapter = path[0]?.id;
  const inChapter = (section: Section) => {
    for (
      let node: Section | undefined = section, depth = 0;
      node && depth < 8;
      node = node.parent_id ? byId.get(node.parent_id) : undefined, depth++
    )
      if (node.id === chapter) return true;
    return false;
  };
  return sections
    .filter(
      section =>
        roles.get(section.id)?.role !== 'reference' &&
        (!section.parent_id || inChapter(section)),
    )
    .map(
      section =>
        `${'  '.repeat(Math.max(0, section.level - 1))}${sectionName(section)}${
          section.id === currentId ? ' ← 当前' : ''
        }`,
    );
}

export function sectionPath(
  sections: readonly Section[],
  id: string | null,
): Section[] {
  const byId = new Map(sections.map(section => [section.id, section]));
  const path: Section[] = [];
  for (
    let node = id ? byId.get(id) : undefined;
    node && path.length < 8 && !path.includes(node);
    node = node.parent_id ? byId.get(node.parent_id) : undefined
  )
    path.unshift(node);
  return path;
}

/**
 * Input for explaining one block: the block itself, where it sits, its neighbours,
 * and the figures, tables or equations it mentions, nearby or `elsewhere` in the book.
 * Only the block is citable.
 */
export function explainInput({
  block,
  section,
  nearby,
  elsewhere,
  sections,
  roles,
  page,
  focus,
}: {
  block: Block;
  section: readonly Block[];
  nearby: readonly Block[];
  elsewhere?: readonly Block[];
  sections: readonly Section[];
  roles: Map<string, { role: ContentRole }>;
  page: string;
  focus?: string;
}): Record<string, JsonValue> {
  const index = section.findIndex(item => item.seq === block.seq);
  const caption = index >= 0 ? pairedCaption(section, index) : undefined;
  const figure = index >= 0 ? pairedFigure(section, index) : undefined;
  const skip = new Set([caption?.seq, figure?.seq]);
  const neighbour = (item: Block) => ({
    seq: item.seq,
    type: item.type,
    text: clip(
      item.type === 'equation' ? item.latex ?? item.text : item.text,
      300,
    ),
  });
  const readable = (item: Block) =>
    !skip.has(item.seq) && (item.text.trim() || item.latex);
  const before =
    index > 0 ? section.slice(0, index).filter(readable).slice(-2) : [];
  const after = index >= 0 ? section.slice(index + 1).filter(readable) : [];
  const path = sectionPath(sections, block.section_id);
  let guide: string | null = null;
  try {
    guide = path.at(-1)?.guide
      ? (JSON.parse(path.at(-1)!.guide!) as { one_line?: string }).one_line ??
        null
      : null;
  } catch {
    guide = null;
  }
  return {
    seq: block.seq,
    block: figure
      ? { ...blockMaterial(block), figure: blockMaterial(figure) }
      : blockMaterial(block, caption),
    location: {
      path: path.map(sectionName),
      page,
      ...(guide ? { guide } : {}),
    },
    before: before.map(neighbour),
    after: after.slice(0, 1).map(neighbour),
    refs: referencedMaterial(block, nearby, { elsewhere, sections }),
    ...(focus ? { focus } : {}),
    map: explainMap(sections, block.section_id, roles),
  };
}
