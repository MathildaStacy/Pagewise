import { marginNotes, TERMINAL } from '../layout';
import type { Block, BlockType } from '../types';

export type RefinementMode = 'structure' | 'vision';
export type RefinementStatus =
  | 'paused'
  | 'running'
  | 'ready'
  | 'applied'
  | 'undone'
  | 'failed'
  | 'stale';
/** A run-in heading: the first `length` UTF-16 units of a body block's text. */
export interface RefinementHeading {
  length: number;
  level: number;
}
export interface RefinementEdit {
  seq: number;
  text: string;
  type: BlockType;
  level: number | null;
  latex: string | null;
  html: string | null;
  continuesFrom: number | null;
  /** Optional so runs saved before structural roles still load. */
  heading?: RefinementHeading | null;
  role?: 'note' | null;
  reason: string;
}
export interface RefinementIssue {
  seq: number;
  reason: string;
}
export interface RefinementChunk {
  seqs: number[];
  context: number[];
}
export interface RefinementDocument {
  version: 1;
  source: Block[];
  chunks: RefinementChunk[];
  edits: RefinementEdit[];
  issues: RefinementIssue[];
  selected: number[];
}
export interface RefinementRun {
  id: number;
  book_id: string;
  section_id: string;
  mode: RefinementMode;
  status: RefinementStatus;
  completed: number;
  document: RefinementDocument;
  config: {
    providerId: string;
    model: string;
    effort: string;
    search: boolean;
  } | null;
  error: string | null;
  input_tokens: number;
  output_tokens: number;
  created_at: string;
  updated_at: string;
}
const codeContent = (b: Block) =>
  b.type === 'code' || /^\s*(?:```|~~~)/m.test(b.text);

/** Include source geometry and assets; a new parse must never inherit an old edit. */
export function sourceSignature(blocks: readonly Block[]): string {
  return JSON.stringify(
    blocks.map(b => [
      b.seq,
      b.page,
      b.loc,
      b.type,
      b.level,
      b.text,
      b.latex,
      b.html,
      b.x0,
      b.y0,
      b.x1,
      b.y1,
      b.image_path,
      b.section_id,
    ]),
  );
}
export function refinementChunks(
  blocks: readonly Block[],
  mode: RefinementMode,
  limit = 6000,
): RefinementChunk[] {
  const chunks: RefinementChunk[] = [];
  let current: number[] = [],
    chars = 0,
    pages = new Set<number | null>();
  const flush = () => {
    if (!current.length) return;
    const first = blocks.findIndex(b => b.seq === current[0]);
    const last = blocks.findIndex(b => b.seq === current.at(-1));
    chunks.push({
      seqs: current,
      context: [blocks[first - 1]?.seq, blocks[last + 1]?.seq].filter(
        (seq): seq is number => seq !== undefined,
      ),
    });
    current = [];
    chars = 0;
    pages = new Set();
  };
  for (const b of blocks) {
    if (codeContent(b) || b.type === 'image') {
      flush();
      continue;
    }
    if (mode === 'structure' && (b.type === 'equation' || b.type === 'table')) {
      flush();
      continue;
    }
    const size = b.text.length + (b.latex?.length ?? 0) + (b.html?.length ?? 0);
    if (
      chars + size > limit ||
      (mode === 'vision' && !pages.has(b.page) && pages.size === 2)
    )
      flush();
    current.push(b.seq);
    chars += size;
    pages.add(b.page);
  }
  flush();
  return chunks;
}
/** Only layout changes are allowed without a source image. */
export const layoutCharacters = (text: string) =>
  text
    .replace(/([A-Za-z])-\s*\r?\n\s*(?=[A-Za-z])/g, '$1')
    .replace(/[\s\u00ad]/gu, '');

const joinLines = (text: string) =>
  text
    .replace(/\u00ad/g, '')
    .replace(/([A-Za-z])-\s*\r?\n\s*(?=[A-Za-z])/g, '$1')
    .replace(
      /([^\r\n])\r?\n(?![ \t]*\r?\n)[ \t]*(?=([^\r\n]))/g,
      (_, left: string, right: string) =>
        /[\u3400-\u9fff]/u.test(left) && /[\u3400-\u9fff]/u.test(right)
          ? left
          : left + ' ',
    );
const identity = (b: Block): RefinementEdit => ({
  seq: b.seq,
  text: b.text,
  type: b.type,
  level: b.level,
  latex: b.latex,
  html: b.html,
  continuesFrom: null,
  heading: null,
  role: null,
  reason: '',
});
const unchanged = (e: RefinementEdit, b: Block) =>
  e.text === b.text &&
  e.type === b.type &&
  e.level === b.level &&
  e.latex === b.latex &&
  e.html === b.html &&
  e.continuesFrom === null &&
  !e.heading &&
  !e.role;
const NUMBER = '[\\d一二三四五六七八九十百零〇]+';
/** `Chapter 21` / `第 21 章` → 1, `21.1` → 2, `21.1.1` → 3; null when unnumbered. */
export function numberedLevel(text: string): number | null {
  const t = text.trim();
  if (
    /^(?:chapter|part|appendix)\s+(?:\d+|[ivxlc]+|[a-z])\b/i.test(t) ||
    new RegExp(`^第\\s*${NUMBER}\\s*[章部篇]`, 'u').test(t)
  )
    return 1;
  if (new RegExp(`^第\\s*${NUMBER}\\s*节`, 'u').test(t)) return 2;
  const dotted = /^(?:\d+|[A-Z])((?:\.\d+)+)\.?(?=\s|$)/.exec(t);
  return dotted ? Math.min(6, dotted[1].split('.').length) : null;
}
/** A heading that is only a label such as `Chapter 21`; the name follows in the next block. */
const labelOnly = (text: string) =>
  new RegExp(
    `^(?:(?:chapter|part|appendix)\\s+(?:\\d+|[ivxlc]+|[a-z])|第\\s*${NUMBER}\\s*[章部篇])$`,
    'iu',
  ).test(text.trim());
const CONTINUES = /^\s*(?:[a-z(（,，;；、)）\]—–-]|\d+(?:\.\d+)*\(|[㐀-鿿])/u;
const skippable = (b: Block, notes: ReadonlySet<number>) =>
  ['image', 'caption', 'footnote'].includes(b.type) || notes.has(b.seq);
/** The nearest earlier block, skipping figures, captions, footnotes and margin notes. */
function continuationTarget(
  blocks: readonly Block[],
  index: number,
  notes: ReadonlySet<number>,
): { block: Block; skipped: boolean } | undefined {
  let skipped = false;
  for (let i = index - 1; i >= 0; i--) {
    if (!skippable(blocks[i], notes)) return { block: blocks[i], skipped };
    skipped = true;
  }
  return undefined;
}
/** Deterministic structure suggestions that never change wording; AI review starts from these. */
export function ruleEdits(blocks: readonly Block[]): RefinementEdit[] {
  const notes = marginNotes(blocks);
  const view = new Map(blocks.map(b => [b.seq, identity(b)]));
  const reasons = new Map<number, string[]>();
  const draft = (b: Block, reason: string) => {
    reasons.set(b.seq, [...(reasons.get(b.seq) ?? []), reason]);
    return view.get(b.seq)!;
  };
  for (const b of blocks) {
    if (
      ['text', 'title', 'caption', 'footnote'].includes(b.type) &&
      !codeContent(b)
    ) {
      const text = joinLines(b.text);
      if (text !== b.text) draft(b, '修复段内换行和行尾断词').text = text;
    }
    if (notes.has(b.seq))
      Object.assign(draft(b, '页边术语，不作标题'), {
        role: 'note',
        type: 'text',
        level: null,
      });
  }
  let parent: number | null = null;
  blocks.forEach((b, i) => {
    if (b.type !== 'title' || notes.has(b.seq)) return;
    const previous = blocks[i - 1];
    if (previous?.type === 'title' && labelOnly(previous.text)) {
      Object.assign(draft(b, '与上一行标题标签合并显示'), {
        level: view.get(previous.seq)!.level,
        continuesFrom: previous.seq,
      });
      return;
    }
    const numbered = numberedLevel(b.text);
    const level =
      numbered ?? (parent !== null ? Math.min(6, parent + 1) : b.level);
    if (numbered !== null) parent = numbered;
    if (level !== b.level)
      draft(b, `按原书编号设为 ${level} 级标题`).level = level;
  });
  blocks.forEach((b, i) => {
    if (b.type !== 'text' || notes.has(b.seq) || codeContent(b)) return;
    const target = continuationTarget(blocks, i, notes);
    const previous = target?.block;
    if (
      !previous ||
      previous.type !== 'text' ||
      notes.has(previous.seq) ||
      codeContent(previous) ||
      previous.section_id !== b.section_id ||
      TERMINAL.test(view.get(previous.seq)!.text) ||
      !CONTINUES.test(b.text) ||
      // Same-page neighbours with nothing between are separate lines (pseudocode, lists).
      !(previous.page !== b.page || target!.skipped)
    )
      return;
    draft(b, '接续上一段（原书跨页或被图表隔开）').continuesFrom = previous.seq;
  });
  return blocks.flatMap(b => {
    const e = view.get(b.seq)!;
    return unchanged(e, b)
      ? []
      : [{ ...e, reason: reasons.get(b.seq)!.join('；') }];
  });
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('精修结果格式不正确，请重试');
  return value as Record<string, unknown>;
}
const ROLES = ['heading', 'body', 'runin', 'note', 'continue'];
const structural = (b: Block) =>
  ['text', 'title'].includes(b.type) && !codeContent(b);
// MinerU can wrap ordinary letters in sub/sup tags. Correcting that markup is
// not a large deletion of the printed text (AIMA's gradient-descent pseudocode).
const reviewTextLength = (text: string) =>
  text.replace(/<\/?(?:sub|sup)>/gi, '').length;
function headingLevel(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 6)
    throw new Error('精修标题层级无效');
  return Number(value);
}
const sameEdit = (a: RefinementEdit, b: RefinementEdit) =>
  a.text === b.text &&
  a.type === b.type &&
  a.level === b.level &&
  a.latex === b.latex &&
  a.html === b.html &&
  a.continuesFrom === b.continuesFrom &&
  (a.role ?? null) === (b.role ?? null) &&
  JSON.stringify(a.heading ?? null) === JSON.stringify(b.heading ?? null);
interface Draft {
  edit: RefinementEdit;
  warnings: string[];
  /** `undefined` keeps the current link; `auto` links to the nearest body block. */
  continues: unknown;
  reason: unknown;
}
/** Applies one AI row on top of the current suggestion; throws a reader-facing reason when it cannot. */
function resolveRow(
  row: Record<string, unknown>,
  b: Block,
  current: RefinementEdit,
  mode: RefinementMode,
): Draft {
  if (
    codeContent(b) ||
    b.type === 'image' ||
    (mode === 'structure' && ['equation', 'table'].includes(b.type))
  )
    throw new Error('本模式不能修改代码、图片或受保护的公式表格');
  const e: RefinementEdit = { ...current };
  const warnings: string[] = [];
  const media = ['equation', 'table'].includes(b.type);
  if (row.text !== undefined) {
    if (typeof row.text !== 'string' || (!row.text.trim() && !media))
      throw new Error('精修修改缺少正文');
    if (
      mode === 'structure' &&
      layoutCharacters(row.text) !== layoutCharacters(b.text)
    )
      warnings.push('涉及原文改字，需要切换「原页复核」对照 PDF 校正');
    else if (
      reviewTextLength(row.text) < reviewTextLength(b.text) * 0.5 ||
      reviewTextLength(row.text) >
        Math.max(reviewTextLength(b.text) * 2, reviewTextLength(b.text) + 100)
    )
      warnings.push('修改幅度过大，保留原文，请核对原页');
    else e.text = row.text;
  }
  for (const [field, type] of [
    ['latex', 'equation'],
    ['html', 'table'],
  ] as const) {
    // A formula field on prose (inline `$x$` already lives in `text`) is ignored, not fatal.
    if (row[field] === undefined || b.type !== type) continue;
    const value = row[field];
    if (typeof value !== 'string' || !value.trim())
      throw new Error('精修不能清空公式或表格');
    e[field] = value;
  }
  let role = row.role;
  if (role === undefined && row.type !== undefined && row.type !== e.type) {
    if (!structural(b) || !['text', 'title'].includes(String(row.type)))
      throw new Error('精修不能改变原文的内容类型');
    role = row.type === 'title' ? 'heading' : 'body';
  }
  if (role === undefined && row.level != null && e.type === 'title')
    role = 'heading';
  if (role !== undefined && role !== null) {
    if (!ROLES.includes(String(role))) throw new Error('精修结构角色无效');
    if (!structural(b)) throw new Error('只有正文和标题可以调整结构');
  }
  if (role === 'heading')
    Object.assign(e, {
      type: 'title',
      level: headingLevel(
        row.level ??
          (e.type === 'title' ? e.level : null) ??
          numberedLevel(b.text) ??
          2,
      ),
      heading: null,
      role: null,
    });
  else if (role === 'body')
    Object.assign(e, { type: 'text', level: null, heading: null, role: null });
  else if (role === 'note')
    Object.assign(e, {
      type: 'text',
      level: null,
      heading: null,
      role: 'note',
      continuesFrom: null,
    });
  else if (role === 'runin') {
    const title = typeof row.heading === 'string' ? row.heading.trim() : '';
    const lead = e.text.length - e.text.trimStart().length;
    if (!title || !e.text.startsWith(title, lead))
      throw new Error('段首小标题必须是该段开头的原文');
    if (!e.text.slice(lead + title.length).trim())
      throw new Error('段首小标题不能占满整段，请标为标题');
    Object.assign(e, {
      type: 'text',
      level: null,
      role: null,
      continuesFrom: null,
      heading: {
        length: lead + title.length,
        level: headingLevel(row.level ?? numberedLevel(title) ?? 4),
      },
    });
  } else if (role === 'continue' && e.type === 'text')
    Object.assign(e, { heading: null, role: null });
  return {
    edit: e,
    warnings,
    continues: role === 'continue' ? 'auto' : row.continuesFrom,
    reason: row.reason,
  };
}
/**
 * Parses one batch. Only an unreadable response fails the batch; a bad row becomes an issue on
 * its block and keeps the current suggestion. `base` holds earlier suggestions (rules or prior
 * batches); `reset` lists blocks the AI returned to their parsed form.
 */
export function parseRefinement(
  text: string,
  blocks: readonly Block[],
  chunk: RefinementChunk,
  mode: RefinementMode,
  base: readonly RefinementEdit[] = [],
): { edits: RefinementEdit[]; issues: RefinementIssue[]; reset: number[] } {
  let data: Record<string, unknown>;
  try {
    data = record(
      JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')),
    );
  } catch {
    throw new Error('AI 没有返回完整的精修建议，请重试');
  }
  if (!Array.isArray(data.edits)) throw new Error('精修结果缺少修改列表');
  const bySeq = new Map(blocks.map((b, i) => [b.seq, { b, i }]));
  const baseBySeq = new Map(base.map(e => [e.seq, e]));
  const allowed = new Set(chunk.seqs);
  const issues: RefinementIssue[] = [];
  const at = (seq: unknown) =>
    typeof seq === 'number' && bySeq.has(seq) ? seq : chunk.seqs[0];
  for (const value of Array.isArray(data.issues) ? data.issues : []) {
    const row =
      value && typeof value === 'object'
        ? (value as Record<string, unknown>)
        : {};
    if (typeof row.reason === 'string' && row.reason.trim())
      issues.push({ seq: at(row.seq), reason: row.reason.slice(0, 500) });
  }
  const drafts = new Map<number, Draft>();
  let ignored = 0;
  for (const value of data.edits) {
    const row =
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : undefined;
    const seq = row?.seq;
    if (
      !row ||
      typeof seq !== 'number' ||
      !allowed.has(seq) ||
      drafts.has(seq)
    ) {
      ignored++;
      continue;
    }
    const { b } = bySeq.get(seq)!;
    try {
      drafts.set(
        seq,
        resolveRow(row, b, baseBySeq.get(seq) ?? identity(b), mode),
      );
    } catch (error) {
      issues.push({
        seq,
        reason: `${
          error instanceof Error ? error.message : '修改无效'
        }，已保留原文`,
      });
    }
  }
  if (ignored)
    issues.push({
      seq: chunk.seqs[0],
      reason: `AI 返回了 ${ignored} 条本批以外、重复或格式不全的修改，已忽略`,
    });
  const notes = new Set(base.filter(e => e.role === 'note').map(e => e.seq));
  for (const [seq, d] of drafts)
    if (d.edit.role === 'note') notes.add(seq);
    else notes.delete(seq);
  const viewOf = (seq: number) =>
    drafts.get(seq)?.edit ?? baseBySeq.get(seq) ?? identity(bySeq.get(seq)!.b);
  /** The block `edit` may continue from, or null when `from` is not that block. */
  const joinable = (edit: RefinementEdit, i: number, from: unknown) => {
    const target = continuationTarget(blocks, i, notes);
    if (!target || (from !== 'auto' && from !== target.block.seq)) return null;
    const previous = viewOf(target.block.seq);
    const prose =
      edit.type === 'text' &&
      !edit.role &&
      !edit.heading &&
      previous.type === 'text' &&
      !previous.role &&
      structural(target.block);
    const title =
      edit.type === 'title' &&
      previous.type === 'title' &&
      !target.skipped &&
      labelOnly(previous.text);
    return prose || title ? target.block.seq : null;
  };
  const edits: RefinementEdit[] = [],
    reset: number[] = [];
  for (const [seq, d] of drafts) {
    const { b, i } = bySeq.get(seq)!;
    const e = d.edit;
    if (d.continues === null) e.continuesFrom = null;
    else if (d.continues !== undefined) {
      const linked = joinable(e, i, d.continues);
      if (linked === null)
        d.warnings.push(
          '续段只能连接相邻的正文块（可跳过图片、图注、脚注和页边术语）',
        );
      // Without the page image a prose join needs the text itself to run on.
      else if (
        mode === 'structure' &&
        e.type === 'text' &&
        (TERMINAL.test(viewOf(linked).text) || !CONTINUES.test(e.text))
      )
        d.warnings.push('上一段已经结束或本段像新段落开头，未接续');
      else e.continuesFrom = linked;
    }
    // A role change can invalidate an inherited link.
    if (e.continuesFrom !== null && joinable(e, i, e.continuesFrom) === null)
      e.continuesFrom = null;
    d.warnings.forEach(reason => issues.push({ seq, reason }));
    const before = baseBySeq.get(seq);
    if (unchanged(e, b)) {
      if (before) reset.push(seq);
      continue;
    }
    if (sameEdit(e, before ?? identity(b))) continue;
    const reason =
      typeof d.reason === 'string' && d.reason.trim()
        ? d.reason.trim()
        : '调整结构';
    edits.push({
      ...e,
      reason: (before?.reason && before.reason !== reason
        ? `${before.reason}；${reason}`
        : reason
      ).slice(0, 500),
    });
  }
  return { edits, issues, reset };
}
export function projectRefinement(
  blocks: readonly Block[],
  run?: RefinementRun,
): Block[] {
  if (
    !run ||
    run.status !== 'applied' ||
    sourceSignature(blocks) !== sourceSignature(run.document.source)
  )
    return [...blocks];
  const selected = new Set(run.document.selected);
  const edits = new Map(
    run.document.edits.filter(e => selected.has(e.seq)).map(e => [e.seq, e]),
  );
  return blocks.map(b => {
    const e = edits.get(b.seq);
    return !e
      ? b
      : {
          ...b,
          text: e.text,
          type: e.type,
          level: e.level,
          latex: e.latex,
          html: e.html,
          chars: Array.from(e.text).length,
          refinement: {
            originalText: b.text,
            originalType: b.type,
            reason: e.reason,
            continuesFrom: e.continuesFrom,
            heading: e.heading ?? null,
            role: e.role ?? null,
          },
        };
  });
}
