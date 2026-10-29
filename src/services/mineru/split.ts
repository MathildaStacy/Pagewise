import {
  MINERU_MAX_PAGES,
  MINERU_TARGET_BYTES,
  MineruError,
  type PageRange,
  type PlannedPart,
} from './types';
const positiveInt = (value: number) => Number.isSafeInteger(value) && value > 0;
function checkRange(part: PageRange) {
  if (
    !positiveInt(part.pageFrom) ||
    !positiveInt(part.pageTo) ||
    part.pageTo < part.pageFrom
  )
    throw new MineruError('protocol');
}
/** Page ranges stay in source order; only execution order rotates around priorityFrom. */
export function planPdfParts(input: {
  pageCount: number;
  sizeBytes: number;
  priorityFrom?: number;
}): PlannedPart[] {
  const { pageCount, sizeBytes, priorityFrom = 1 } = input;
  if (
    !positiveInt(pageCount) ||
    !positiveInt(sizeBytes) ||
    !positiveInt(priorityFrom) ||
    priorityFrom > pageCount
  )
    throw new MineruError('protocol');
  const bySize = Math.floor((MINERU_TARGET_BYTES / sizeBytes) * pageCount);
  if (bySize < 1) throw new MineruError('-60005');
  const chunk = Math.min(MINERU_MAX_PAGES, bySize);
  const parts: PlannedPart[] = [];
  for (let pageFrom = 1; pageFrom <= pageCount; pageFrom += chunk) {
    const pageTo = Math.min(pageFrom + chunk - 1, pageCount);
    parts.push({
      pageFrom,
      pageTo,
      estimatedBytes: Math.ceil(
        (sizeBytes * (pageTo - pageFrom + 1)) / pageCount,
      ),
    });
  }
  const pivot = parts.findIndex(
    part => priorityFrom >= part.pageFrom && priorityFrom <= part.pageTo,
  );
  return [...parts.slice(pivot), ...parts.slice(0, pivot)];
}
/** Used both after an actual-size check and for MinerU -60005 / -60006. */
export function bisectPart(part: PageRange): [PageRange, PageRange] {
  checkRange(part);
  if (part.pageFrom === part.pageTo) throw new MineruError('-60005');
  const middle = Math.floor((part.pageFrom + part.pageTo) / 2);
  return [
    { pageFrom: part.pageFrom, pageTo: middle },
    { pageFrom: middle + 1, pageTo: part.pageTo },
  ];
}
export interface SplitPort {
  split(
    source: string,
    from: number,
    to: number,
    outPath: string,
  ): Promise<{ sizeBytes: number }>;
  remove(path: string): Promise<void>;
}
export interface MaterializedPart extends PageRange {
  path: string;
  sizeBytes: number;
}
export async function splitPdfPart(
  source: string,
  part: PageRange,
  options: {
    io: SplitPort;
    pathFor(part: PageRange): string;
    signal?: AbortSignal;
  },
): Promise<MaterializedPart[]> {
  checkRange(part);
  const completed: MaterializedPart[] = [];
  const ensureActive = () => {
    if (options.signal?.aborted) throw new MineruError('cancelled');
  };
  async function run(range: PageRange): Promise<void> {
    ensureActive();
    if (range.pageTo - range.pageFrom + 1 > MINERU_MAX_PAGES) {
      for (const half of bisectPart(range)) await run(half);
      return;
    }
    const path = options.pathFor(range);
    if (!path || path === source) throw new MineruError('protocol');
    let retain = false;
    try {
      const { sizeBytes } = await options.io.split(
        source,
        range.pageFrom,
        range.pageTo,
        path,
      );
      ensureActive();
      if (!positiveInt(sizeBytes)) throw new MineruError('protocol');
      if (sizeBytes > MINERU_TARGET_BYTES) {
        for (const half of bisectPart(range)) await run(half);
      } else {
        completed.push({ ...range, path, sizeBytes });
        retain = true;
      }
    } finally {
      if (!retain) await options.io.remove(path);
    }
  }
  try {
    await run(part);
    return completed;
  } catch (error) {
    await Promise.all(completed.map(value => options.io.remove(value.path)));
    throw error;
  }
}
