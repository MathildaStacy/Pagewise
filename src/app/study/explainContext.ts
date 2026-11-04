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

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Labels such as 表3.20, 图 3-2, 式（1.3）, Figure 4.1 or Table 2 mentioned in the text. */
export function mentionedLabels(text: string) {
  const labels: { kind: 'figure' | 'equation'; pattern: RegExp }[] = [];
  for (const match of text.matchAll(
    /([图表])\s*(\d+(?:[.\-–]\d+)*)|(Figure|Fig\.|Table|Exhibit)\s*(\d+(?:[.\-–]\d+)*)/giu,
  )) {
    const word = match[1] ?? match[3];
    const number = escape(match[2] ?? match[4]);
    labels.push({
      kind: 'figure',
      pattern: new RegExp(
        /^[图表]$/u.test(word)
          ? `^\\s*${word}\\s*${number}(?![\\d.])`
          : `^\\s*${escape(word)}\\s*${number}(?![\\d.])`,
        'iu',
      ),
    });
  }
  for (const match of text.matchAll(
    /(?:式|公式|Equation|Eq\.)\s*[（(]\s*(\d+(?:\.\d+)*)\s*[)）]/giu,
  )) {
    const number = escape(match[1]);
    labels.push({
      kind: 'equation',
      pattern: new RegExp(
        `\\\\tag\\{\\s*${number}\\s*\\}|[（(]\\s*${number}\\s*[)）]\\s*\\$*\\s*$`,
        'u',
      ),
    });
  }
  return labels;
}

/**
 * Find the figures, tables and equations a block refers to among nearby blocks.
 * The caption carries the label; the material is the figure or table beside it.
 */
export function referencedMaterial(
  block: Block,
  nearby: readonly Block[],
  limit = 3,
): Record<string, JsonValue>[] {
  const found: Record<string, JsonValue>[] = [];
  const seen = new Set<number>([block.seq]);
  const own = nearby.findIndex(item => item.seq === block.seq);
  if (own >= 0) {
    for (const near of [pairedCaption(nearby, own), pairedFigure(nearby, own)])
      if (near) seen.add(near.seq);
  }
  for (const label of mentionedLabels(block.text)) {
    if (found.length >= limit) break;
    const index = nearby.findIndex(
      (item, at) =>
        !seen.has(item.seq) &&
        (label.kind === 'equation'
          ? item.type === 'equation' &&
            label.pattern.test(item.latex ?? item.text)
          : (item.type === 'caption' ||
              (figureLike(item) && !pairedCaption(nearby, at))) &&
            label.pattern.test(item.text)),
    );
    if (index < 0) continue;
    const item = nearby[index];
    const figure = pairedFigure(nearby, index);
    const material = figure
      ? blockMaterial(figure, item, 3000)
      : blockMaterial(item, pairedCaption(nearby, index), 3000);
    seen.add(item.seq);
    if (figure) seen.add(figure.seq);
    found.push(material);
  }
  return found;
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
 * and the figures, tables or equations it mentions. Only the block is citable.
 */
export function explainInput({
  block,
  section,
  nearby,
  sections,
  roles,
  page,
  focus,
}: {
  block: Block;
  section: readonly Block[];
  nearby: readonly Block[];
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
    refs: referencedMaterial(block, nearby),
    ...(focus ? { focus } : {}),
    map: explainMap(sections, block.section_id, roles),
  };
}
