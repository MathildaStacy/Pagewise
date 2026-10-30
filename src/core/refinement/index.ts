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
export interface RefinementEdit {
  seq: number;
  text: string;
  type: BlockType;
  level: number | null;
  latex: string | null;
  html: string | null;
  continuesFrom: number | null;
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

export function ruleEdits(blocks: readonly Block[]): RefinementEdit[] {
  return blocks.flatMap(b => {
    if (
      !['text', 'title', 'caption', 'footnote'].includes(b.type) ||
      codeContent(b)
    )
      return [];
    const text = b.text
      .replace(/\u00ad/g, '')
      .replace(/([A-Za-z])-\s*\r?\n\s*(?=[A-Za-z])/g, '$1')
      .replace(
        /([^\r\n])\r?\n(?![ \t]*\r?\n)[ \t]*(?=([^\r\n]))/g,
        (_, left: string, right: string) =>
          /[\u3400-\u9fff]/u.test(left) && /[\u3400-\u9fff]/u.test(right)
            ? left
            : left + ' ',
      );
    return text === b.text
      ? []
      : [
          {
            seq: b.seq,
            text,
            type: b.type,
            level: b.level,
            latex: b.latex,
            html: b.html,
            continuesFrom: null,
            reason: '修复段内换行和行尾断词',
          },
        ];
  });
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('精修结果格式不正确，请重试');
  return value as Record<string, unknown>;
}
export function parseRefinement(
  text: string,
  blocks: readonly Block[],
  chunk: RefinementChunk,
  mode: RefinementMode,
): { edits: RefinementEdit[]; issues: RefinementIssue[] } {
  let data: Record<string, unknown>;
  try {
    data = record(
      JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')),
    );
  } catch {
    throw new Error('AI 没有返回完整的精修建议，请重试');
  }
  if (!Array.isArray(data.edits) || !Array.isArray(data.issues))
    throw new Error('精修结果缺少修改或疑点列表');
  const allowed = new Set(chunk.seqs),
    seen = new Set<number>();
  const issues: RefinementIssue[] = data.issues.map(value => {
    const row = record(value);
    if (
      typeof row.seq !== 'number' ||
      !allowed.has(row.seq) ||
      typeof row.reason !== 'string'
    )
      throw new Error('精修疑点指向了本批以外的原文');
    return { seq: row.seq, reason: row.reason.slice(0, 500) };
  });
  const edits: RefinementEdit[] = [];
  for (const value of data.edits) {
    const row = record(value),
      seq = row.seq;
    if (typeof seq !== 'number' || !allowed.has(seq) || seen.has(seq))
      throw new Error('精修修改含未知或重复的原文块');
    seen.add(seq);
    const b = blocks.find(block => block.seq === seq)!;
    if (
      !b ||
      codeContent(b) ||
      b.type === 'image' ||
      (mode === 'structure' && ['equation', 'table'].includes(b.type))
    )
      throw new Error('本模式不能修改代码、图片或受保护的公式表格');
    if (
      typeof row.text !== 'string' ||
      (!row.text.trim() && !['equation', 'table'].includes(b.type)) ||
      typeof row.reason !== 'string'
    )
      throw new Error('精修修改缺少正文或原因');
    const type = row.type ?? b.type;
    if (
      type !== b.type &&
      !(
        ['text', 'title'].includes(b.type) &&
        ['text', 'title'].includes(String(type))
      )
    )
      throw new Error('精修不能改变原文的内容类型');
    const level = type === 'title' ? row.level ?? b.level ?? 2 : null;
    if (
      level !== null &&
      (!Number.isInteger(level) || Number(level) < 1 || Number(level) > 6)
    )
      throw new Error('精修标题层级无效');
    const latex = row.latex === undefined ? b.latex : row.latex;
    const html = row.html === undefined ? b.html : row.html;
    if (
      (latex !== null && typeof latex !== 'string') ||
      (html !== null && typeof html !== 'string')
    )
      throw new Error('精修公式或表格格式无效');
    if (
      (b.type !== 'equation' && latex !== b.latex) ||
      (b.type !== 'table' && html !== b.html)
    )
      throw new Error('精修公式或表格与原文类型不符');
    if (
      (b.type === 'equation' && !String(latex ?? '').trim()) ||
      (b.type === 'table' && !String(html ?? '').trim())
    )
      throw new Error('精修不能清空公式或表格');
    const previous = blocks[blocks.findIndex(block => block.seq === seq) - 1];
    const continuesFrom = row.continuesFrom ?? null;
    if (
      continuesFrom !== null &&
      (continuesFrom !== previous?.seq ||
        b.type !== 'text' ||
        previous.type !== 'text')
    )
      throw new Error('续段只能连接相邻的正文块');
    if (
      mode === 'structure' &&
      (layoutCharacters(row.text) !== layoutCharacters(b.text) ||
        latex !== b.latex ||
        html !== b.html)
    ) {
      issues.push({
        seq,
        reason: '涉及原文改字，需要切换「原页复核」对照 PDF 校正',
      });
      continue;
    }
    if (
      row.text.length < b.text.length * 0.5 ||
      row.text.length > Math.max(b.text.length * 2, b.text.length + 100)
    ) {
      issues.push({ seq, reason: '修改幅度过大，保留原文，请核对原页' });
      continue;
    }
    if (
      row.text !== b.text ||
      type !== b.type ||
      level !== b.level ||
      latex !== b.latex ||
      html !== b.html ||
      continuesFrom !== null
    )
      edits.push({
        seq,
        text: row.text,
        type: type as BlockType,
        level: level as number | null,
        latex: latex as string | null,
        html: html as string | null,
        continuesFrom: continuesFrom as number | null,
        reason: row.reason.slice(0, 500),
      });
  }
  return { edits, issues };
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
          },
        };
  });
}
