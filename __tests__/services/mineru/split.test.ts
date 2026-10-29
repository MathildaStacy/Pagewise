import {
  bisectPart,
  planPdfParts,
  splitPdfPart,
  type SplitPort,
} from '@services/mineru/split';
import { MINERU_MAX_PAGES, MINERU_TARGET_BYTES } from '@services/mineru/types';

it('plans at most 200 pages and rotates the priority slice before following and previous slices', () => {
  const parts = planPdfParts({
    pageCount: 1136,
    sizeBytes: 300_000_000,
    priorityFrom: 300,
  });
  expect(parts.map(p => [p.pageFrom, p.pageTo])).toEqual([
    [201, 400],
    [401, 600],
    [601, 800],
    [801, 1000],
    [1001, 1136],
    [1, 200],
  ]);
  expect(
    parts.every(
      p =>
        p.pageTo - p.pageFrom + 1 <= MINERU_MAX_PAGES &&
        p.estimatedBytes <= MINERU_TARGET_BYTES,
    ),
  ).toBe(true);
});

it('uses estimated byte limits before page limits and preserves every source page exactly once', () => {
  const parts = planPdfParts({
    pageCount: 400,
    sizeBytes: 760_000_000,
    priorityFrom: 250,
  });
  expect(parts.map(p => [p.pageFrom, p.pageTo, p.estimatedBytes])).toEqual([
    [201, 300, 190_000_000],
    [301, 400, 190_000_000],
    [1, 100, 190_000_000],
    [101, 200, 190_000_000],
  ]);
  const all = parts.flatMap(p =>
    Array.from({ length: p.pageTo - p.pageFrom + 1 }, (_, i) => p.pageFrom + i),
  );
  expect([...new Set(all)].sort((a, b) => a - b)).toEqual(
    Array.from({ length: 400 }, (_, i) => i + 1),
  );
  expect(planPdfParts({ pageCount: 200, sizeBytes: 190_000_000 })).toEqual([
    { pageFrom: 1, pageTo: 200, estimatedBytes: 190_000_000 },
  ]);
});

it('bisects only the failed part with stable bounds and refuses an indivisible oversized page', () => {
  expect(bisectPart({ pageFrom: 201, pageTo: 400 })).toEqual([
    { pageFrom: 201, pageTo: 300 },
    { pageFrom: 301, pageTo: 400 },
  ]);
  expect(bisectPart({ pageFrom: 1, pageTo: 3 })).toEqual([
    { pageFrom: 1, pageTo: 2 },
    { pageFrom: 3, pageTo: 3 },
  ]);
  expect(() => bisectPart({ pageFrom: 1, pageTo: 1 })).toThrow('文件太大');
});

it('recursively checks actual split sizes, removes oversized intermediates and retains only uploadable files', async () => {
  const io: jest.Mocked<SplitPort> = {
    split: jest.fn<
      ReturnType<SplitPort['split']>,
      Parameters<SplitPort['split']>
    >(async (_source, from, to) => ({
      sizeBytes: to - from + 1 > 2 ? 240_000_000 : 80_000_000,
    })),
    remove: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
  };
  const result = await splitPdfPart(
    '/book.pdf',
    { pageFrom: 1, pageTo: 8 },
    { io, pathFor: p => `/part-${p.pageFrom}-${p.pageTo}.pdf` },
  );
  expect(result.map(p => [p.pageFrom, p.pageTo, p.sizeBytes])).toEqual([
    [1, 2, 80_000_000],
    [3, 4, 80_000_000],
    [5, 6, 80_000_000],
    [7, 8, 80_000_000],
  ]);
  expect(io.remove.mock.calls.map(c => c[0]).sort()).toEqual([
    '/part-1-4.pdf',
    '/part-1-8.pdf',
    '/part-5-8.pdf',
  ]);
});

it('cleans all temporary outputs on failure or cancellation and never overwrites the original', async () => {
  const io: jest.Mocked<SplitPort> = {
    split: jest.fn<
      ReturnType<SplitPort['split']>,
      Parameters<SplitPort['split']>
    >(async () => ({ sizeBytes: 200_000_000 })),
    remove: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
  };
  await expect(
    splitPdfPart(
      '/book.pdf',
      { pageFrom: 1, pageTo: 1 },
      { io, pathFor: () => '/part.pdf' },
    ),
  ).rejects.toMatchObject({ code: '-60005' });
  expect(io.remove).toHaveBeenCalledWith('/part.pdf');
  io.split.mockClear();
  await expect(
    splitPdfPart(
      '/book.pdf',
      { pageFrom: 1, pageTo: 1 },
      { io, pathFor: () => '/book.pdf' },
    ),
  ).rejects.toMatchObject({ code: 'protocol' });
  expect(io.split).not.toHaveBeenCalled();
  const controller = new AbortController();
  io.split.mockImplementation(async () => {
    controller.abort();
    return { sizeBytes: 100 };
  });
  await expect(
    splitPdfPart(
      '/book.pdf',
      { pageFrom: 1, pageTo: 2 },
      { io, pathFor: () => '/cancel.pdf', signal: controller.signal },
    ),
  ).rejects.toMatchObject({ code: 'cancelled' });
  expect(io.remove).toHaveBeenCalledWith('/cancel.pdf');
});

it.each([
  { pageCount: 0, sizeBytes: 1 },
  { pageCount: 1, sizeBytes: 0 },
  { pageCount: 1.5, sizeBytes: 20 },
  { pageCount: 2, sizeBytes: 20, priorityFrom: 3 },
  { pageCount: 2, sizeBytes: 20, priorityFrom: 0 },
])('rejects impossible ranges and sizes %j', input => {
  expect(() => planPdfParts(input)).toThrow();
});
