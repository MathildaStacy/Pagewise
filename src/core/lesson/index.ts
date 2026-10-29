import type {
  Block,
  LessonStep,
  LessonStepKind,
  LessonStepStatus,
} from '../types';

/** Pass only the actual blocks in this section part, including sparse PDF seq values. */
export type LessonBlock = Pick<Block, 'seq' | 'type' | 'text' | 'chars'>;
export type LessonPlanIssue =
  | 'empty-blocks'
  | 'invalid-blocks'
  | 'invalid-shape'
  | 'step-count'
  | 'title'
  | 'range'
  | 'coverage'
  | 'protected-group';
export interface LessonValidation {
  valid: boolean;
  steps: LessonStep[];
  repaired: boolean;
  reason?: LessonPlanIssue;
}
export interface ResolvedLessonPlan {
  steps: LessonStep[];
  source: 'model' | 'fallback';
  repaired: boolean;
  reason?: LessonPlanIssue;
}
const kinds: readonly LessonStepKind[] = [
  'intuition',
  'definition',
  'derivation',
  'example',
  'check',
];
const statuses: readonly LessonStepStatus[] = [
  'todo',
  'current',
  'done',
  'skipped',
];
const protectedTypes = new Set<Block['type']>([
  'equation',
  'image',
  'table',
  'code',
]);

function orderedBlocks(blocks: readonly LessonBlock[]): LessonBlock[] | null {
  const sorted = [...blocks].sort((a, b) => a.seq - b.seq);
  if (
    sorted.some(
      (block, index) =>
        !Number.isSafeInteger(block.seq) ||
        block.seq < 0 ||
        (index > 0 && block.seq === sorted[index - 1].seq),
    )
  )
    return null;
  return sorted;
}
/** A cut is the index of the first block in the following step. */
function safeCuts(blocks: readonly LessonBlock[]): number[] {
  const forbidden = new Set<number>();
  blocks.forEach((block, index) => {
    if (protectedTypes.has(block.type)) {
      // Preserve the preceding introduction and immediately following explanation/caption.
      forbidden.add(index);
      forbidden.add(index + 1);
    }
  });
  return blocks
    .map((_, index) => index)
    .filter(index => index > 0 && !forbidden.has(index));
}
/** Legal starts after the first block; shared by prompt guidance and validation. */
export function lessonPlanCuts(blocks: readonly LessonBlock[]): number[] {
  const ordered = orderedBlocks(blocks);
  return ordered ? safeCuts(ordered).map(index => ordered[index].seq) : [];
}
function fail(reason: LessonPlanIssue): LessonValidation {
  return { valid: false, steps: [], repaired: false, reason };
}
function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function parseSteps(input: unknown): LessonStep[] | null {
  let value = input;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  if (record(value)) value = value.steps;
  if (!Array.isArray(value)) return null;
  const result: LessonStep[] = [];
  let canonical = true;
  for (const [index, item] of value.entries()) {
    if (
      !record(item) ||
      typeof item.title !== 'string' ||
      !kinds.includes(item.kind as LessonStepKind)
    )
      return null;
    const stored = 'block_from' in item || 'block_to' in item;
    const from = stored ? item.block_from : item.from;
    const to = stored ? item.block_to : item.to;
    const status = item.status === undefined ? 'todo' : item.status;
    if (
      !Number.isSafeInteger(from) ||
      !Number.isSafeInteger(to) ||
      !statuses.includes(status as LessonStepStatus) ||
      (stored && item.no !== index) ||
      (!stored && item.no !== undefined && item.no !== index)
    )
      return null;
    result.push({
      no: index,
      title: item.title,
      kind: item.kind as LessonStepKind,
      block_from: from as number,
      block_to: to as number,
      status: status as LessonStepStatus,
    });
    if (!stored || item.status === undefined) canonical = false;
  }
  // A valid persisted plan retains the original array and object identities, statuses included.
  return canonical ? (value as LessonStep[]) : result;
}

/** Validate model {steps:[{title,kind,from,to}]} or stored LessonStep[]. Repairs only protected cuts. */
export function validateLessonPlan(
  input: unknown,
  partBlocks: readonly LessonBlock[],
): LessonValidation {
  if (!partBlocks.length) return fail('empty-blocks');
  const blocks = orderedBlocks(partBlocks);
  if (!blocks) return fail('invalid-blocks');
  const steps = parseSteps(input);
  if (!steps) return fail('invalid-shape');
  const cuts = safeCuts(blocks);
  const minimum = Math.min(2, cuts.length + 1);
  if (steps.length < minimum || steps.length > 5) return fail('step-count');
  if (
    steps.some(step => !step.title.trim() || Array.from(step.title).length > 24)
  )
    return fail('title');
  const indices = new Map(blocks.map((block, index) => [block.seq, index]));
  const ranges = steps.map(step => ({
    from: indices.get(step.block_from),
    to: indices.get(step.block_to),
  }));
  if (
    ranges.some(
      r => r.from === undefined || r.to === undefined || r.from > r.to,
    )
  )
    return fail('range');
  if (
    ranges[0].from !== 0 ||
    ranges[ranges.length - 1].to !== blocks.length - 1 ||
    ranges.some(
      (range, index) => index > 0 && ranges[index - 1].to! + 1 !== range.from,
    )
  )
    return fail('coverage');
  const originalCuts = ranges.slice(1).map(range => range.from!);
  if (originalCuts.every(cut => cuts.includes(cut)))
    return { valid: true, steps, repaired: false };
  const moved = originalCuts.map(cut => cuts.find(safe => safe >= cut));
  if (
    moved.some(
      (cut, index) =>
        cut === undefined || (index > 0 && cut <= moved[index - 1]!),
    )
  )
    return fail('protected-group');
  const starts = [0, ...(moved as number[])];
  const repaired = steps.map((step, index) => ({
    ...step,
    block_from: blocks[starts[index]].seq,
    block_to: blocks[(starts[index + 1] ?? blocks.length) - 1].seq,
  }));
  return { valid: true, steps: repaired, repaired: true };
}

function weightPrefix(blocks: readonly LessonBlock[]): number[] {
  const prefix = [0];
  for (const block of blocks)
    prefix.push(
      prefix[prefix.length - 1] +
        Math.max(1, block.chars || Array.from(block.text).length),
    );
  return prefix;
}
function balancedCuts(
  candidates: readonly number[],
  count: number,
  prefix: readonly number[],
): number[] {
  const chosen: number[] = [];
  let cursor = 0;
  for (let step = 1; step < count; step++) {
    const target = (prefix[prefix.length - 1] * step) / count;
    const last = candidates.length - (count - step);
    let best = cursor;
    for (let index = cursor + 1; index <= last; index++) {
      if (
        Math.abs(prefix[candidates[index]] - target) <
        Math.abs(prefix[candidates[best]] - target)
      )
        best = index;
    }
    chosen.push(candidates[best]);
    cursor = best + 1;
  }
  return chosen;
}

/** At most five steps, preserving protected groups. Indivisible parts necessarily have one step. */
export function fallbackLessonPlan(
  partBlocks: readonly LessonBlock[],
): LessonStep[] {
  const blocks = orderedBlocks(partBlocks);
  if (!blocks?.length) return [];
  const cuts = safeCuts(blocks);
  const prefix = weightPrefix(blocks);
  const titleCuts = [
    ...new Set(
      blocks.flatMap((block, index) => {
        if (block.type !== 'title' || index === 0) return [];
        const safe = cuts.find(cut => cut >= index);
        return safe === undefined ? [] : [safe];
      }),
    ),
  ];
  const wanted = Math.min(
    cuts.length + 1,
    Math.max(
      2,
      Math.min(
        5,
        Math.round(blocks.reduce((sum, block) => sum + block.chars, 0) / 800),
      ),
    ),
  );
  const boundaries = titleCuts.length
    ? balancedCuts(titleCuts, Math.min(5, titleCuts.length + 1), prefix)
    : balancedCuts(cuts, wanted, prefix);
  const starts = [0, ...boundaries];
  return starts.map((start, index) => ({
    no: index,
    title:
      Array.from(blocks[start].text.trim()).slice(0, 16).join('') ||
      '第 ' + (index + 1) + ' 步',
    kind: index === 0 ? 'intuition' : 'definition',
    block_from: blocks[start].seq,
    block_to: blocks[(starts[index + 1] ?? blocks.length) - 1].seq,
    status: 'todo',
  }));
}

/** The source field is ready for lesson_plan persistence; reason explains a fallback to callers. */
export function resolveLessonPlan(
  input: unknown,
  blocks: readonly LessonBlock[],
): ResolvedLessonPlan {
  const result = validateLessonPlan(input, blocks);
  return result.valid
    ? { steps: result.steps, source: 'model', repaired: result.repaired }
    : {
        steps: fallbackLessonPlan(blocks),
        source: 'fallback',
        repaired: false,
        reason: result.reason,
      };
}
