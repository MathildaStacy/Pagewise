import type { Block, JsonValue, Message } from '../types';
import type {
  BlockMigration,
  MigratedReferences,
  ReferencedRecords,
} from './types';

export function normalizeText(text: string): string {
  return text
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[\p{P}\s]/gu, '');
}
/** Banded edit distance keeps nearly identical long OCR paragraphs practical. */
export function textSimilarity(
  left: string,
  right: string,
  threshold = 0,
): number {
  if (left === right) return left ? 1 : 0;
  if (!left || !right) return 0;
  const length = Math.max(left.length, right.length),
    limit = Math.floor(length * (1 - threshold) + 1e-8);
  if (Math.abs(left.length - right.length) > limit) return 0;
  let row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i++) {
    const next = Array<number>(right.length + 1).fill(limit + 1);
    next[0] = i;
    const from = Math.max(1, i - limit),
      to = Math.min(right.length, i + limit);
    let min = limit + 1;
    for (let j = from; j <= to; j++) {
      next[j] = Math.min(
        next[j - 1] + 1,
        row[j] + 1,
        row[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
      min = Math.min(min, next[j]);
    }
    if (min > limit) return 0;
    row = next;
  }
  return row[right.length] <= limit ? 1 - row[right.length] / length : 0;
}
const sourceText = (block: Block) =>
  normalizeText(block.text || block.latex || block.html || '');
export function buildBlockMigration(
  oldBlocks: readonly Block[],
  newBlocks: readonly Block[],
  referencedSeqs: Iterable<number> = oldBlocks.map(block => block.seq),
): BlockMigration {
  const oldBySeq = new Map(oldBlocks.map(block => [block.seq, block]));
  const candidates = newBlocks.map(block => ({
    block,
    text: sourceText(block),
  }));
  const used = new Set<number>(),
    matches: BlockMigration['matches'] = [],
    unmatched: number[] = [];
  for (const oldSeq of [...new Set(referencedSeqs)].sort((a, b) => a - b)) {
    const old = oldBySeq.get(oldSeq),
      text = old ? sourceText(old) : '';
    if (!old || !text) {
      unmatched.push(oldSeq);
      continue;
    }
    const eligible = candidates.filter(
      candidate =>
        !used.has(candidate.block.seq) &&
        (old.page === null
          ? candidate.block.page === null
          : candidate.block.page !== null &&
            Math.abs(candidate.block.page - old.page) <= 1),
    );
    const ranked = eligible
      .map(candidate => ({
        ...candidate,
        similarity: textSimilarity(text, candidate.text, 0.9),
      }))
      .filter(candidate => candidate.similarity >= 0.9 - 1e-10)
      .sort(
        (a, b) =>
          b.similarity - a.similarity ||
          (old.page === null
            ? Number(b.block.loc === old.loc) - Number(a.block.loc === old.loc)
            : Math.abs(a.block.page! - old.page) -
              Math.abs(b.block.page! - old.page)) ||
          Math.abs(a.block.seq - oldSeq) - Math.abs(b.block.seq - oldSeq) ||
          a.block.seq - b.block.seq,
      );
    const best = ranked[0];
    if (!best) {
      unmatched.push(oldSeq);
      continue;
    }
    used.add(best.block.seq);
    matches.push({
      oldSeq,
      newSeq: best.block.seq,
      similarity: best.similarity,
      pageDelta: old.page === null ? null : best.block.page! - old.page,
    });
  }
  return {
    matches,
    mapping: Object.fromEntries(
      matches.map(match => [match.oldSeq, match.newSeq]),
    ),
    unmatched,
  };
}
const refPattern = /\[\[(?:b|q|fig):(\d+)\]\]/g;
export function collectReferencedSeqs(records: ReferencedRecords): number[] {
  const refs = new Set<number>();
  for (const message of records.messages ?? []) {
    for (const seq of message.allowed_refs ?? []) refs.add(seq);
    if (message.quote_seq !== null) refs.add(message.quote_seq);
    for (const match of message.content.matchAll(refPattern))
      refs.add(Number(match[1]));
    for (const part of message.parts ?? [])
      if (
        part &&
        typeof part === 'object' &&
        !Array.isArray(part) &&
        part.t === 'text' &&
        typeof part.text === 'string'
      )
        for (const match of part.text.matchAll(refPattern))
          refs.add(Number(match[1]));
  }
  for (const highlight of records.highlights ?? [])
    refs.add(highlight.block_seq);
  for (const pin of records.pins ?? []) refs.add(pin.block_seq);
  return [...refs].sort((a, b) => a - b);
}
/** Unmatched annotations remain available as orphaned notes, never attached to a reused seq. */
export function migrateReferences(
  records: ReferencedRecords,
  migration: BlockMigration,
): MigratedReferences {
  const result: MigratedReferences = {
    messages: [],
    highlights: [],
    pins: [],
    orphaned: { highlights: [], pins: [] },
    moved: [],
  };
  const mapped = (seq: number) => migration.mapping[seq];
  for (const message of records.messages ?? []) {
    const missing = new Set<number>();
    const rewrite = (text: string) =>
      text.replace(refPattern, (full: string, ref: string) => {
        const seq = Number(ref),
          next = mapped(seq);
        if (next === undefined) {
          missing.add(seq);
          return full;
        }
        return full.replace(`:${ref}]]`, `:${next}]]`);
      });
    const content = rewrite(message.content);
    const parts =
      message.parts?.map(part =>
        part &&
        typeof part === 'object' &&
        !Array.isArray(part) &&
        part.t === 'text' &&
        typeof part.text === 'string'
          ? ({ ...part, text: rewrite(part.text) } as JsonValue)
          : part,
      ) ?? null;
    const quote = message.quote_seq === null ? null : mapped(message.quote_seq);
    if (message.quote_seq !== null && quote === undefined)
      missing.add(message.quote_seq);
    const allowed =
      message.allowed_refs?.flatMap(seq =>
        mapped(seq) === undefined ? [] : [mapped(seq)],
      ) ?? null;
    const changed =
      content !== message.content ||
      JSON.stringify(parts) !== JSON.stringify(message.parts);
    const migrated: Message = {
      ...message,
      content,
      parts,
      quote_seq: quote ?? null,
      allowed_refs: allowed,
      raw: changed ? null : message.raw,
      unverified: message.unverified + missing.size,
    };
    result.messages.push(migrated);
    for (const oldSeq of missing)
      result.moved.push({
        kind: 'message',
        id: message.id,
        oldSeq,
        label: '原文位置已变化',
      });
  }
  for (const highlight of records.highlights ?? []) {
    const seq = mapped(highlight.block_seq);
    if (seq === undefined) {
      result.orphaned.highlights.push({ ...highlight });
      result.moved.push({
        kind: 'highlight',
        id: highlight.id,
        oldSeq: highlight.block_seq,
        label: '原文位置已变化',
      });
    } else result.highlights.push({ ...highlight, block_seq: seq });
  }
  for (const pin of records.pins ?? []) {
    const seq = mapped(pin.block_seq);
    if (seq === undefined) {
      result.orphaned.pins.push({ ...pin });
      result.moved.push({
        kind: 'pin',
        id: pin.id,
        oldSeq: pin.block_seq,
        label: '原文位置已变化',
      });
    } else result.pins.push({ ...pin, block_seq: seq });
  }
  return result;
}
