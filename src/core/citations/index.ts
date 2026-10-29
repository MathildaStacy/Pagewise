import type { Block, Inline, RichDoc } from '../markup';

export interface CitationBlock {
  seq: number;
  section_id?: string | null;
}
export interface CitationContext {
  allowedRefs: Iterable<number>;
  /** Existing blocks from the current book: an allowed but deleted block is unverified. */
  blocks: Iterable<CitationBlock>;
  mainSectionId?: string;
}
export interface CitationValidation {
  doc: RichDoc;
  verifiedRefs: number[];
  invalidRefs: number[];
  invalidCitations: number;
  unsupportedParagraphs: number;
  unverifiedCount: number;
  hasUnverified: boolean;
  hasUnverifiedCitation: boolean;
}
const sentenceEnd = /[。！？!?；;.\n]/;
const closingPunctuation = /[”’"'）)】\]]/;
function addText(nodes: Inline[], text: string) {
  if (!text) return;
  const last = nodes[nodes.length - 1];
  if (last?.t === 'text') last.v += text;
  else nodes.push({ t: 'text', v: text });
}
function hasReference(nodes: readonly Inline[]): boolean {
  return nodes.some(
    node => node.t === 'cite' || (node.t === 'b' && hasReference(node.c)),
  );
}
function visibleText(nodes: readonly Inline[]): string {
  return nodes
    .map(node =>
      node.t === 'text'
        ? node.v
        : node.t === 'b'
        ? visibleText(node.c)
        : node.t === 'math'
        ? node.tex
        : '',
    )
    .join('');
}
/** Pure validation using the response's persisted allow-list, never today's changing context. */
export function validateCitations(
  doc: readonly Block[],
  context: CitationContext,
): CitationValidation {
  const allowed = new Set(context.allowedRefs);
  const existing = new Map(
    Array.from(context.blocks, block => [block.seq, block] as const),
  );
  const verifiedRefs = new Set<number>();
  const invalidRefs = new Set<number>();
  let invalidCitations = 0,
    unsupportedParagraphs = 0;
  const verified = (ref: number) => allowed.has(ref) && existing.has(ref);
  const invalid = (ref: number) => {
    invalidCitations++;
    invalidRefs.add(ref);
  };
  function inlines(nodes: readonly Inline[]): Inline[] {
    const state = { pending: false, lastChar: '', lastBoundaryMarked: false };
    function walk(input: readonly Inline[]): Inline[] {
      const output: Inline[] = [];
      for (const node of input) {
        if (node.t === 'cite') {
          if (verified(node.ref)) {
            verifiedRefs.add(node.ref);
            const section = existing.get(node.ref)!.section_id;
            output.push({
              ...node,
              verified: true,
              detour: Boolean(
                context.mainSectionId &&
                  section &&
                  section !== context.mainSectionId,
              ),
            });
          } else {
            invalid(node.ref);
            if (sentenceEnd.test(state.lastChar)) {
              if (!state.lastBoundaryMarked) output.push({ t: 'unverified' });
              state.lastBoundaryMarked = true;
            } else state.pending = true;
          }
        } else if (node.t === 'b') {
          const c = walk(node.c);
          if (c.length) output.push({ t: 'b', c });
        } else if (node.t === 'text') {
          let from = 0;
          for (let index = 0; index < node.v.length; index++) {
            const char = node.v[index];
            if (sentenceEnd.test(char)) {
              state.lastChar = char;
              state.lastBoundaryMarked = false;
              if (state.pending) {
                addText(output, node.v.slice(from, index + 1));
                output.push({ t: 'unverified' });
                from = index + 1;
                state.pending = false;
                state.lastBoundaryMarked = true;
              }
            } else if (!/\s/.test(char) && !closingPunctuation.test(char)) {
              state.lastChar = char;
              state.lastBoundaryMarked = false;
            }
          }
          addText(output, node.v.slice(from));
        } else {
          output.push({ ...node });
          if (node.t === 'math') {
            state.lastChar = 'x';
            state.lastBoundaryMarked = false;
          }
        }
      }
      return output;
    }
    const output = walk(nodes);
    if (state.pending) output.push({ t: 'unverified' });
    return output;
  }
  const unsupported = (nodes: readonly Inline[], inAux: boolean) => {
    if (
      !inAux &&
      !hasReference(nodes) &&
      Array.from(visibleText(nodes)).length > 40
    )
      unsupportedParagraphs++;
  };
  function visit(input: readonly Block[], inAux = false): RichDoc {
    return input.map(block => {
      if (block.t === 'p') {
        unsupported(block.c, inAux);
        return { t: 'p', c: inlines(block.c) };
      }
      if (block.t === 'check') return { t: 'check', c: inlines(block.c) };
      if (block.t === 'list') {
        block.items.forEach(item => unsupported(item, inAux));
        return { ...block, items: block.items.map(inlines) };
      }
      if (block.t === 'aux') return { ...block, body: visit(block.body, true) };
      if (block.t === 'quote' || block.t === 'figure') {
        if (verified(block.ref)) {
          verifiedRefs.add(block.ref);
          return { ...block, verified: true };
        }
        invalid(block.ref);
        return { t: 'p', c: [{ t: 'text', v: '（引用的原文未核实）' }] };
      }
      return { ...block };
    });
  }
  const checked = visit(doc);
  const unverifiedCount = invalidCitations + unsupportedParagraphs;
  return {
    doc: checked,
    verifiedRefs: [...verifiedRefs],
    invalidRefs: [...invalidRefs],
    invalidCitations,
    unsupportedParagraphs,
    unverifiedCount,
    hasUnverified: unverifiedCount > 0,
    hasUnverifiedCitation: invalidCitations > 0,
  };
}
export type ReferenceMapping =
  | ReadonlyMap<number, number>
  | Readonly<Record<number, number>>;
/** Reference migration is explicit. New refs must be validated again against the new response context. */
export function rewriteReferences(
  doc: readonly Block[],
  mapping: ReferenceMapping,
): RichDoc {
  const map = (ref: number) => {
    const next =
      'get' in mapping && typeof mapping.get === 'function'
        ? mapping.get(ref)
        : (mapping as Readonly<Record<number, number>>)[ref];
    return next === undefined ? ref : next;
  };
  const inline = (nodes: readonly Inline[]): Inline[] =>
    nodes.map(node =>
      node.t === 'cite'
        ? { ...node, ref: map(node.ref), verified: false, detour: false }
        : node.t === 'b'
        ? { ...node, c: inline(node.c) }
        : { ...node },
    );
  return doc.map(block => {
    if (block.t === 'p' || block.t === 'check')
      return { ...block, c: inline(block.c) };
    if (block.t === 'list') return { ...block, items: block.items.map(inline) };
    if (block.t === 'quote' || block.t === 'figure')
      return { ...block, ref: map(block.ref), verified: false };
    if (block.t === 'aux')
      return { ...block, body: rewriteReferences(block.body, mapping) };
    return { ...block };
  });
}
export const CITATION_REMINDER =
  '只能引用本轮上下文里出现过的块，引用格式 [[b:<id>]]';
/** Call once per completed answer. The returned reminder belongs to the next turn. */
export function advanceCitationStreak(
  previous: number,
  hasUnverifiedCitation: boolean,
): { streak: number; reminder: string | null } {
  const streak = hasUnverifiedCitation
    ? Math.max(0, Math.trunc(previous)) + 1
    : 0;
  return streak >= 3
    ? { streak: 0, reminder: CITATION_REMINDER }
    : { streak, reminder: null };
}
