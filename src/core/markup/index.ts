/** Skin-independent AST from docs/dev/05-engine-ai.md §2. */
export type Inline =
  | { t: 'text'; v: string }
  | { t: 'code'; v: string }
  | { t: 'b'; c: Inline[] }
  | { t: 'math'; tex: string }
  | { t: 'cite'; ref: number; verified: boolean; detour: boolean }
  | { t: 'unverified' };
export type Block =
  | { t: 'p'; c: Inline[] }
  | { t: 'list'; ordered: boolean; items: Inline[][] }
  | { t: 'math'; tex: string }
  | { t: 'quote' | 'figure'; ref: number; verified: boolean }
  | { t: 'aux'; kind: 'derive' | 'example'; body: Block[]; open: boolean }
  | { t: 'check'; c: Inline[] }
  | { t: 'code'; text: string; language?: string };
export type RichDoc = Block[];
export interface ParseOptions {
  streaming?: boolean;
  /** Explicit final overrides streaming when the network stream is complete or stopped. */
  final?: boolean;
}
type Group = 'derive' | 'example' | 'check';
const groups: readonly Group[] = ['derive', 'example', 'check'];
const streamingMode = (options: ParseOptions) =>
  options.final === undefined ? Boolean(options.streaming) : !options.final;
function escaped(text: string, position: number): boolean {
  let slash = position - 1;
  while (slash >= 0 && text[slash] === '\\') slash--;
  return (position - slash - 1) % 2 === 1;
}
function endMarker(
  text: string,
  marker: string,
  from: number,
  until = text.length,
): number {
  let position = text.indexOf(marker, from);
  while (position >= 0 && position < until) {
    if (!escaped(text, position)) return position;
    position = text.indexOf(marker, position + marker.length);
  }
  return -1;
}
function addText(nodes: Inline[], text: string) {
  if (!text) return;
  const last = nodes[nodes.length - 1];
  if (last?.t === 'text') last.v += text;
  else nodes.push({ t: 'text', v: text });
}
/** Backticks inside code are literal; a span closes only on an equally long run. */
function codeSpan(text: string, from: number) {
  let count = 1;
  while (text[from + count] === '`') count++;
  let at = from + count;
  while (at < text.length) {
    at = text.indexOf('`', at);
    if (at < 0) break;
    let length = 1;
    while (text[at + length] === '`') length++;
    if (length === count) {
      let v = text.slice(from + count, at).replace(/\n/g, ' ');
      if (v.startsWith(' ') && v.endsWith(' ') && v.trim()) v = v.slice(1, -1);
      return { v, end: at + count };
    }
    at += length;
  }
  return null;
}
/** Only incomplete prefixes of supported tags are hidden; ordinary brackets remain text. */
function pendingTag(tail: string): boolean {
  const literal = [
    '[[derive]]',
    '[[/derive]]',
    '[[example]]',
    '[[/example]]',
    '[[check]]',
    '[[/check]]',
  ];
  return (
    literal.some(tag => tag.startsWith(tail)) ||
    /^\[\[(?:b|q|fig)(?::\d*\]?)?$/.test(tail) ||
    ['[[b:', '[[q:', '[[fig:'].some(tag => tag.startsWith(tail))
  );
}
export function parseInline(
  text: string,
  options: ParseOptions = {},
): Inline[] {
  const nodes: Inline[] = [];
  const streaming = streamingMode(options);
  let plain = '';
  const flush = () => {
    addText(nodes, plain);
    plain = '';
  };
  for (let i = 0; i < text.length; ) {
    if (
      text[i] === '\\' &&
      i + 1 < text.length &&
      /[\\*`$[\]]/.test(text[i + 1])
    ) {
      plain += text[i + 1];
      i += 2;
      continue;
    }
    if (text[i] === '`') {
      const span = codeSpan(text, i);
      if (span) {
        flush();
        nodes.push({ t: 'code', v: span.v });
        i = span.end;
        continue;
      }
      // An unmatched delimiter remains literal, including longer backtick runs.
      while (text[i] === '`') plain += text[i++];
      continue;
    }
    if (text.startsWith('[[', i)) {
      const end = text.indexOf(']]', i + 2);
      if (end < 0) {
        if (streaming && pendingTag(text.slice(i))) break;
        plain += text.slice(i);
        break;
      }
      const raw = text.slice(i, end + 2);
      const matched = /^\[\[b:(\d+)\]\]$/.exec(raw);
      if (matched && Number.isSafeInteger(Number(matched[1]))) {
        flush();
        nodes.push({
          t: 'cite',
          ref: Number(matched[1]),
          verified: false,
          detour: false,
        });
      } else plain += raw;
      i = end + 2;
      continue;
    }
    if (text.startsWith('**', i)) {
      const end = endMarker(text, '**', i + 2);
      if (end >= 0) {
        flush();
        nodes.push({ t: 'b', c: parseInline(text.slice(i + 2, end), options) });
        i = end + 2;
        continue;
      }
    }
    if (text[i] === '$') {
      const delimiter = text.startsWith('$$', i) ? '$$' : '$';
      const end = endMarker(text, delimiter, i + delimiter.length);
      if (end >= 0) {
        flush();
        nodes.push({ t: 'math', tex: text.slice(i + delimiter.length, end) });
        i = end + delimiter.length;
        continue;
      }
    }
    plain += text[i];
    i++;
  }
  flush();
  return nodes;
}
function ordinary(text: string, options: ParseOptions): RichDoc {
  const doc: RichDoc = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) {
      const c = parseInline(paragraph.join('\n'), options);
      if (c.length) doc.push({ t: 'p', c });
      paragraph = [];
    }
  };
  for (const line of text.split('\n')) {
    if (!line.trim()) {
      flush();
      continue;
    }
    const reference = /^\s*\[\[(q|fig):(\d+)\]\]\s*$/.exec(line);
    if (reference && Number.isSafeInteger(Number(reference[2]))) {
      flush();
      doc.push({
        t: reference[1] === 'q' ? 'quote' : 'figure',
        ref: Number(reference[2]),
        verified: false,
      });
      continue;
    }
    const heading = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      flush();
      doc.push({
        t: 'p',
        c: [{ t: 'b', c: parseInline(heading[1], options) }],
      });
      continue;
    }
    const item = /^\s*(?:(-)|\d+\.)\s+(.*)$/.exec(line);
    if (item) {
      flush();
      const ordered = !item[1];
      const last = doc[doc.length - 1];
      if (last?.t === 'list' && last.ordered === ordered)
        last.items.push(parseInline(item[2], options));
      else
        doc.push({
          t: 'list',
          ordered,
          items: [parseInline(item[2], options)],
        });
      continue;
    }
    paragraph.push(line);
  }
  flush();
  return doc;
}
function groupInline(doc: RichDoc): Inline[] {
  const nodes: Inline[] = [];
  const line = (content: Inline[]) => {
    if (nodes.length) addText(nodes, '\n');
    nodes.push(...content);
  };
  for (const block of doc) {
    if (block.t === 'p' || block.t === 'check') line(block.c);
    else if (block.t === 'math') line([{ t: 'math', tex: block.tex }]);
    else if (block.t === 'list') block.items.forEach(line);
    else if (block.t === 'code') line([{ t: 'text', v: block.text }]);
    else if (block.t === 'aux') line(groupInline(block.body));
    else line([{ t: 'cite', ref: block.ref, verified: false, detour: false }]);
  }
  return nodes;
}
interface BlockResult {
  doc: RichDoc;
  end: number;
  closed: boolean;
}
function blocks(
  text: string,
  from: number,
  options: ParseOptions,
  closing?: Group,
): BlockResult {
  const doc: RichDoc = [];
  let start = from;
  let i = from;
  const flush = (end: number) => {
    if (end > start) doc.push(...ordinary(text.slice(start, end), options));
  };
  while (i < text.length) {
    if ((i === 0 || text[i - 1] === '\n') && !escaped(text, i)) {
      const lineEnd = text.indexOf('\n', i);
      const end = lineEnd < 0 ? text.length : lineEnd;
      const fence = /^ {0,3}(`{3,}|~{3,})([^\n]*)$/.exec(text.slice(i, end));
      if (fence) {
        flush(i);
        const bodyStart = lineEnd < 0 ? text.length : lineEnd + 1;
        let next = bodyStart,
          close = -1,
          after = text.length;
        while (next < text.length) {
          const nextEnd = text.indexOf('\n', next);
          const stop = nextEnd < 0 ? text.length : nextEnd;
          const candidate = text.slice(next, stop).trim();
          if (
            candidate.length >= fence[1].length &&
            Array.from(candidate).every(char => char === fence[1][0])
          ) {
            close = next;
            after = nextEnd < 0 ? text.length : nextEnd + 1;
            break;
          }
          if (nextEnd < 0) break;
          next = nextEnd + 1;
        }
        const body = text
          .slice(bodyStart, close < 0 ? text.length : close)
          .replace(/\n$/, '');
        const language = fence[2].trim().split(/\s+/)[0];
        doc.push({ t: 'code', text: body, ...(language ? { language } : {}) });
        i = after;
        start = i;
        continue;
      }
    }
    if (text[i] === '`' && !escaped(text, i)) {
      const span = codeSpan(text, i);
      if (span) {
        i = span.end;
        continue;
      }
      while (text[i] === '`') i++;
      continue;
    }
    if (!escaped(text, i) && text.startsWith('$$', i)) {
      const end = endMarker(text, '$$', i + 2);
      if (end >= 0) {
        flush(i);
        doc.push({ t: 'math', tex: text.slice(i + 2, end).trim() });
        i = end + 2;
        start = i;
        continue;
      }
      // The unfinished expression remains literal; inline parsing handles any pending tags.
      i += 2;
      continue;
    }
    if (text[i] === '$' && !escaped(text, i) && text[i + 1] !== '$') {
      const end = endMarker(text, '$', i + 1);
      if (end >= 0) {
        i = end + 1;
        continue;
      }
    }
    if (!escaped(text, i) && text.startsWith('[[', i)) {
      if (closing && text.startsWith(`[[/${closing}]]`, i)) {
        flush(i);
        return { doc, end: i + closing.length + 5, closed: true };
      }
      const group = groups.find(value => text.startsWith(`[[${value}]]`, i));
      if (group) {
        flush(i);
        const bodyStart = i + group.length + 4;
        const nested = blocks(text, bodyStart, options, group);
        if (group === 'check')
          doc.push({ t: 'check', c: groupInline(nested.doc) });
        else
          doc.push({
            t: 'aux',
            kind: group,
            body: nested.doc,
            open: streamingMode(options) && !nested.closed,
          });
        i = nested.end;
        start = i;
        continue;
      }
      const end = text.indexOf(']]', i + 2);
      if (end >= 0) {
        i = end + 2;
        continue;
      }
    }
    i++;
  }
  flush(text.length);
  return { doc, end: text.length, closed: false };
}
/** Reparse the full response on every refresh; final and completed-stream ASTs are identical. */
export function parse(text: string, options: ParseOptions = {}): RichDoc {
  return blocks(text.replace(/\r\n?/g, '\n'), 0, options).doc;
}
/** MinerU may store a complete fence in code_body. Also works for already imported books. */
export function parseSourceCode(text: string): Extract<Block, { t: 'code' }> {
  if (/^\s*(?:`{3,}|~{3,})/.test(text)) {
    const doc = parse(text);
    if (doc.length === 1 && doc[0].t === 'code') return doc[0];
  }
  return { t: 'code', text };
}
const fenceLine = /^ {0,3}(`{3,}|~{3,})/;
/** A lone list, heading or fence marker that the next characters will turn into structure. */
const markerLine = /^\s*(?:-|\d+\.?|#{1,6}|`{1,2}|~{1,2})\s*$/;
/** Text after a `$` that holds CJK is prose (e.g. a price), not a formula still arriving. */
const proseAfterDollar = /[\p{Script=Han}\u3000-\u303f\uff00-\uffef]/u;
/** Unclosed `$` openers further back than this are treated as literal dollars. */
const MATH_HOLD = 160;
/**
 * While streaming, drop a trailing fragment that would otherwise flash as raw markup until its
 * closing marker arrives: an unclosed `**`, `$`/`$$`, or a lone list/heading/fence marker line.
 * Completed text is never changed, so the final render is unaffected.
 */
export function stableStreamText(source: string): string {
  const text = source.replace(/\r\n?/g, '\n');
  let fence: string | null = null,
    afterFence = 0,
    offset = 0;
  for (const line of text.split('\n')) {
    const marker = fenceLine.exec(line)?.[1];
    offset += line.length + 1;
    if (!marker) continue;
    if (!fence) fence = marker;
    else if (
      marker[0] === fence[0] &&
      marker.length >= fence.length &&
      !line.trim().slice(marker.length)
    ) {
      fence = null;
      afterFence = offset;
    }
  }
  // Inside an open fence everything is code and already renders as such.
  if (fence) return text;
  const lineStart = text.lastIndexOf('\n') + 1;
  const lastLine = text.slice(lineStart);
  if (lastLine.trim() && markerLine.test(lastLine))
    return text.slice(0, lineStart);
  const blank = /\n[ \t]*\n/g;
  let start = Math.min(afterFence, text.length);
  for (let m = blank.exec(text); m; m = blank.exec(text))
    start = Math.max(start, m.index + m[0].length);
  // List items and headings close inline markup within their own line.
  if (/^\s*(?:-|\d+\.|#{1,6})\s/.test(lastLine)) start = lineStart;
  for (let i = start; i < text.length; ) {
    if (text[i] === '\\' && /[\\*`$[\]]/.test(text[i + 1] ?? '')) {
      i += 2;
      continue;
    }
    if (text[i] === '`') {
      const span = codeSpan(text, i);
      if (!span) return text.slice(0, i);
      i = span.end;
      continue;
    }
    if (text.startsWith('**', i)) {
      const end = endMarker(text, '**', i + 2);
      if (end < 0) return text.slice(0, i);
      i = end + 2;
      continue;
    }
    if (text[i] === '$') {
      const delimiter = text.startsWith('$$', i) ? '$$' : '$';
      const end = endMarker(text, delimiter, i + delimiter.length);
      if (end >= 0) {
        i = end + delimiter.length;
        continue;
      }
      const tail = text.slice(i + delimiter.length);
      if (tail.length <= MATH_HOLD && !proseAfterDollar.test(tail))
        return text.slice(0, i);
      i += delimiter.length;
      continue;
    }
    i++;
  }
  return text;
}
