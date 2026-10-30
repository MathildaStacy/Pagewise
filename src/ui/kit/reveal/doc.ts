/** 按「可见字符」逐步截断已解析的富文本，结构始终完整：吐到哪里都不会露出原始 markdown 符号。 */
import type { RichBlock, RichDoc, RichInline } from '../contracts';

/** 截至 at 时刻，前 upto 个可见单元已经吐出。按 upto 升序。 */
export interface RevealMark {
  at: number;
  upto: number;
}
/** 渐显被量化成几档，控制每次渲染拆出的文本片段数。 */
export const FADE_STEPS = 6;

function inlineLength(nodes: readonly RichInline[]): number {
  let length = 0;
  for (const node of nodes)
    length +=
      node.t === 'text' || node.t === 'code'
        ? node.v.length
        : node.t === 'b'
        ? inlineLength(node.c)
        : 1;
  return length;
}
function blockLength(block: RichBlock): number {
  switch (block.t) {
    case 'p':
    case 'check':
      return inlineLength(block.c);
    case 'list':
      return block.items.reduce((sum, item) => sum + inlineLength(item), 0);
    case 'aux':
      return docLength(block.body);
    case 'code':
      return block.text.length;
    default:
      // Formulas, quotes and figures appear as one unit.
      return 1;
  }
}
/** 文字按字符计，公式、引用、图片等整体算一个单元。 */
export function docLength(doc: RichDoc): number {
  return doc.reduce((sum, block) => sum + blockLength(block), 0);
}

/** 每个单元的渐显进度：settled 之前的已清晰，其余按吐出时刻计算并量化。 */
export function fadeClock(
  marks: readonly RevealMark[],
  settled: number,
  now: number,
  fadeMs: number,
): (index: number) => number {
  return index => {
    if (index < settled) return 1;
    let low = 0,
      high = marks.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (marks[mid].upto > index) high = mid;
      else low = mid + 1;
    }
    if (low === marks.length) return 1;
    const progress = (now - marks[low].at) / fadeMs;
    return progress >= 1
      ? 1
      : Math.max(0, Math.floor(progress * FADE_STEPS) / FADE_STEPS);
  };
}

interface Cursor {
  left: number;
  at: number;
  settled: number;
  fade(index: number): number;
}
/** 不把代理对拆成半个字符。 */
function safeEnd(text: string, end: number): number {
  const code = text.charCodeAt(end - 1);
  return code >= 0xd800 && code <= 0xdbff && end < text.length ? end + 1 : end;
}
function textRuns(text: string, c: Cursor): RichInline[] {
  if (c.at + text.length <= c.settled) return [{ t: 'text', v: text }];
  const runs: RichInline[] = [];
  let start = 0,
    level = c.fade(c.at);
  for (let i = 1; i <= text.length; i++) {
    const next = i < text.length ? c.fade(c.at + i) : -1;
    if (next === level) continue;
    const v = text.slice(start, i);
    runs.push(level >= 1 ? { t: 'text', v } : { t: 'text', v, fade: level });
    start = i;
    level = next;
  }
  return runs;
}
function cutInline(nodes: RichInline[], c: Cursor): RichInline[] {
  const out: RichInline[] = [];
  let same = true;
  for (const node of nodes) {
    if (c.left <= 0) {
      same = false;
      break;
    }
    if (node.t === 'text') {
      const take = safeEnd(node.v, Math.min(node.v.length, c.left));
      const runs = textRuns(node.v.slice(0, take), c);
      c.at += take;
      c.left -= take;
      if (take === node.v.length && runs.length === 1 && !('fade' in runs[0]))
        out.push(node);
      else {
        same = false;
        out.push(...runs);
      }
    } else if (node.t === 'code') {
      const take = safeEnd(node.v, Math.min(node.v.length, c.left));
      out.push(
        take === node.v.length ? node : { ...node, v: node.v.slice(0, take) },
      );
      if (take !== node.v.length) same = false;
      c.at += take;
      c.left -= take;
    } else if (node.t === 'b') {
      const inner = cutInline(node.c, c);
      if (inner === node.c) out.push(node);
      else {
        same = false;
        if (inner.length) out.push({ ...node, c: inner });
      }
    } else {
      out.push(node);
      c.at++;
      c.left--;
    }
  }
  return same ? nodes : out;
}
function cutBlock(block: RichBlock, c: Cursor): RichBlock | null {
  switch (block.t) {
    case 'p':
    case 'check': {
      const nodes = cutInline(block.c, c);
      return nodes === block.c
        ? block
        : nodes.length
        ? { ...block, c: nodes }
        : null;
    }
    case 'list': {
      const items: RichInline[][] = [];
      let same = true;
      for (const item of block.items) {
        if (c.left <= 0) {
          same = false;
          break;
        }
        const cut = cutInline(item, c);
        if (cut !== item) same = false;
        if (cut.length) items.push(cut);
      }
      return same ? block : items.length ? { ...block, items } : null;
    }
    case 'aux': {
      const body = cutDoc(block.body, c);
      return body === block.body
        ? block
        : body.length
        ? { ...block, body }
        : null;
    }
    case 'code': {
      const take = safeEnd(block.text, Math.min(block.text.length, c.left));
      c.at += take;
      c.left -= take;
      return take === block.text.length
        ? block
        : { ...block, text: block.text.slice(0, take) };
    }
    default:
      c.at++;
      c.left--;
      return block;
  }
}
function cutDoc(doc: RichDoc, c: Cursor): RichDoc {
  const out: RichDoc = [];
  let same = true;
  for (const block of doc) {
    if (c.left <= 0) {
      same = false;
      break;
    }
    const cut = cutBlock(block, c);
    if (cut !== block) same = false;
    if (cut) out.push(cut);
  }
  return same ? doc : out;
}

/**
 * 只保留前 shown 个可见单元，并给仍在渐显的文字标上 fade。
 * 完全吐出且已清晰的块原样返回（引用不变），便于 memo 跳过渲染。
 */
export function revealDoc(
  doc: RichDoc,
  shown: number,
  settled = shown,
  fade: (index: number) => number = () => 1,
): RichDoc {
  return cutDoc(doc, { left: shown, at: 0, settled, fade });
}
