import type { Block } from '../types';

/** A sentence end, allowing closing quotes or brackets after the stop. */
export const TERMINAL = /[.!?。！？…:：;；]["'”’)）\]】」』]*\s*$/u;

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};
const isNumbered = (text: string) =>
  /^(?:(?:chapter|part|appendix)\s+\S+|第\s*\S+\s*[章节部篇]|(?:\d+|[A-Z])(?:\.\d+)+\b)/i.test(
    text.trim(),
  );

/**
 * Margin glossary terms (AIMA's indented italic `Unit`, `Layer`) that the parser emits as
 * blocks of their own. A term sits right of the body column, is short, is not centred like a
 * heading, and repeats in a nearby paragraph. `min` asks for that many before trusting the
 * pattern, so one indented line in a book without margin notes is left alone.
 */
export function marginNotes(
  blocks: readonly Block[],
  { min = 1 }: { min?: number } = {},
): Set<number> {
  const body = blocks.filter(
    b =>
      b.type === 'text' &&
      b.x0 !== null &&
      b.x1 !== null &&
      b.text.length >= 80,
  );
  if (body.length < 2) return new Set();
  const left = median(body.map(b => b.x0!)),
    centre = (left + median(body.map(b => b.x1!))) / 2;
  const notes = new Set<number>();
  blocks.forEach((b, i) => {
    const term = b.text.trim();
    if (
      i === 0 ||
      !['text', 'title'].includes(b.type) ||
      b.x0 === null ||
      b.x0 - left < 0.04 ||
      (b.x1 !== null && Math.abs((b.x0 + b.x1) / 2 - centre) < 0.05) ||
      !term ||
      Array.from(term).length > 40 ||
      term.split(/\s+/).length > 5 ||
      TERMINAL.test(term) ||
      isNumbered(term)
    )
      return;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = /^[A-Za-z]/.test(term)
      ? new RegExp(`\\b${escaped}(?:e?s)?\\b`, 'i')
      : new RegExp(escaped, 'u');
    // Terms cluster, so compare with the nearest body paragraphs rather than raw neighbours.
    for (const step of [-1, 1])
      for (
        let j = i + step, found = 0;
        j >= 0 && j < blocks.length && found < 2;
        j += step
      )
        if (blocks[j].type === 'text' && blocks[j].text.length >= 80) {
          if (pattern.test(blocks[j].text)) {
            notes.add(b.seq);
            return;
          }
          found++;
        }
  });
  return notes.size >= min ? notes : new Set();
}

const TOC_LINE = /\p{L}.*\s(?:\d{1,4}|[ivxlc]{1,6})\s*$/iu;
// E-book PDFs append link icons in the Private Use Area (AIMA's U+E606) after page numbers.
export const PRIVATE_USE = new RegExp(
  `[${String.fromCharCode(0xe000)}-${String.fromCharCode(0xf8ff)}]`,
  'g',
);
/** Contents pages: most short lines end in a page number (`5.1 Game Theory 146`). */
export function tocPages(blocks: readonly Block[]): Set<number> {
  const lines = new Map<number, { all: number; toc: number }>();
  for (const b of blocks) {
    if (b.page === null || !['text', 'title'].includes(b.type)) continue;
    const count = lines.get(b.page) ?? { all: 0, toc: 0 };
    for (const raw of b.text.split('\n')) {
      const line = raw.replace(PRIVATE_USE, '').trim();
      if (!line || line.length > 120) continue;
      count.all++;
      if (TOC_LINE.test(line)) count.toc++;
    }
    lines.set(b.page, count);
  }
  return new Set(
    [...lines]
      .filter(([, n]) => n.toc >= 5 && n.toc >= n.all * 0.6)
      .map(([page]) => page),
  );
}

/** Figure, table and algorithm labels or pseudocode signatures, which are never sections. */
export const figureLabel = (text: string) =>
  /^(?:(?:figure|fig\.|table|algorithm|listing|exhibit)\s+(?:[A-Z][.-])?\d+(?:[.-]\d+)*\b|[图表]\s*\d+(?:[.-]\d+)*|(?:function|procedure)\s+[A-Z][\w?-]*\s*\()/i.test(
    text.trim(),
  );
