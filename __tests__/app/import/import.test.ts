import type { Container } from '@app/container';
import { createTestClock, type TestClock } from '@app/clock';
import { createTestContainer } from '@app/testing';
import {
  confirmImportDraft,
  importBookFile,
  pickImportDraft,
  reparseBook,
} from '@app/usecases/importBooks';
import {
  clearParseCache,
  configureStorageRuntime,
  preservedReparseBlocks,
} from '@app/usecases/storage';
import {
  configureImportRuntime,
  type ImportRuntime,
} from '@app/usecases/importRuntime';
import {
  contiguousReadyPage,
  importPdfResult,
  rebuildLocalPdfMap,
  loadParseWarnings,
  referenceMovesKey,
} from '@app/usecases/importResults';
import { getParseQueue } from '@app/usecases/parseQueue';
import { getStudySession } from '@app/study/registry';
import { setReaderRuntime } from '@app/readerRuntime';
import type { BookPartInsert } from '@core/types';
import { MineruError } from '@services/mineru/types';

let c: Container, clock: TestClock, runtime: ImportRuntime;
const file = {
  uri: 'content://a.pdf',
  name: 'Book.pdf',
  mime: 'application/pdf',
};
const options = { model: 'vlm' as const, ocr: false, priorityFrom: 1 };
async function settle(check: () => Promise<boolean>) {
  for (let i = 0; i < 3000; i++) {
    if (await check()) return;
    await Promise.resolve();
  }
  throw new Error('queue did not settle');
}
async function book(id = 'book', pages = 4) {
  return c.repos.books.insert({
    id,
    sha256: id,
    title: id,
    format: 'pdf',
    pages,
    size_bytes: 1000,
    status: 'parsing',
    cover_color: '#3B4F7A',
    created_at: clock.now().toISOString(),
  });
}
async function part(patch: Partial<BookPartInsert> = {}) {
  return c.repos.parts.upsert({
    book_id: 'book',
    part_no: 1,
    page_from: 1,
    page_to: 4,
    stage: 'queued',
    updated_at: clock.now().toISOString(),
    ...patch,
  });
}
beforeEach(async () => {
  jest.useFakeTimers();
  clock = createTestClock();
  c = await createTestContainer({ clock });
  const paths = new Set<string>();
  runtime = {
    files: {
      documentDir: '/docs',
      cacheDir: '/cache',
      exists: jest.fn(async path => paths.has(path)),
      mkdir: jest.fn(async () => {}),
      move: jest.fn(async (from, to) => {
        paths.delete(from);
        paths.add(to);
      }),
      copy: jest.fn(async () => {}),
      remove: jest.fn(async path => {
        paths.delete(path);
      }),
      sha256: jest.fn(async () => 'same-sha'),
      copyFromUri: jest.fn(async (_uri, dest) => {
        paths.add(dest);
        return { size: 1000, name: file.name, mime: file.mime };
      }),
    },
    chooseFile: jest.fn(async () => file),
    pdf: {
      info: jest.fn(async () => ({
        pageCount: 4,
        sizes: Array.from({ length: 4 }, () => ({ w: 600, h: 800 })),
        title: 'Metadata title',
        author: 'Author',
      })),
      textLayer: jest.fn(async () => ({ withText: 4, sampled: 4 })),
      outline: jest.fn(async () => [
        { title: '第一章 基础', page: 1, level: 1 },
      ]),
      pageLabels: jest.fn(async () => ['i', '1', '2', '3']),
      split: jest.fn(async (_src, _from, _to, out) => {
        paths.add(out);
        return { sizeBytes: 500 };
      }),
      close: jest.fn(async () => {}),
    },
    mineru: {
      requestUpload: jest.fn(async () => ({
        batchId: 'batch',
        urls: ['signed'],
      })),
      upload: jest.fn(async () => {}),
      query: jest.fn(async () => [
        {
          fileName: 'part.pdf',
          state: 'done' as const,
          zipUrl: 'https://results.test/a.zip',
        },
      ]),
      download: jest.fn(async (_url, dir) => dir),
      test: jest.fn(async () => ({ ok: true, latencyMs: 1 })),
    },
    adapt: jest.fn(async () => ({
      blocks: [
        {
          seq: 1001,
          page: 1,
          type: 'title' as const,
          text: '第一章 基础',
          level: 1,
          bbox: null,
        },
        {
          seq: 1002,
          page: 1,
          type: 'text' as const,
          text: '学习正文'.repeat(100),
          bbox: null,
        },
      ],
      pageNumbers: [],
      pagesWithContent: [1, 2, 3, 4],
    })),
  };
  configureImportRuntime(c, runtime);
  configureStorageRuntime(c, {
    ...runtime.files,
    readText: async () => '',
    writeText: async () => {},
    dirSize: async () => 0,
    zip: async () => {},
    unzip: async () => {},
    pickBackup: async () => null,
    share: async () => {},
    saveDownloads: async path => path,
    openSnapshot: async () => c.db,
    replaceDatabase: async () => {},
    restart: async () => {},
  });
});
afterEach(async () => {
  await getParseQueue(c).dispose();
  await c.close();
  jest.useRealTimers();
});

test('file selection copies privately and persists real PDF metadata; repeated drafts deduplicate', async () => {
  const selected = await pickImportDraft(c);
  expect(selected?.kind).toBe('draft');
  if (selected?.kind !== 'draft') throw new Error('draft expected');
  const draft = await c.repos.drafts.get(selected.draftId);
  expect(draft).toMatchObject({
    file_path: expect.stringMatching(/^\/docs\/books\/_incoming\/.+\.pdf$/),
    info: {
      title: 'Metadata title',
      author: 'Author',
      pages: 4,
      has_text_layer: true,
    },
  });
  expect(runtime.pdf.textLayer).toHaveBeenCalledWith(
    draft!.file_path,
    [1, 2, 3, 4],
  );
  expect(await importBookFile(c, file)).toEqual(selected);
  expect(await c.repos.drafts.list()).toHaveLength(1);
  expect(runtime.files.remove).toHaveBeenCalled();
});
test('duplicate existing hash returns its book and removes incoming copy without parsing', async () => {
  await book();
  await c.repos.books.update('book', { sha256: 'same-sha' });
  jest.mocked(runtime.files.exists).mockResolvedValue(true);
  expect(await importBookFile(c, file)).toEqual({
    kind: 'duplicate',
    bookId: 'book',
  });
  expect(runtime.pdf.info).not.toHaveBeenCalled();
  expect(await c.repos.drafts.list()).toEqual([]);
});

test('a restored database missing its original accepts the same SHA into its existing book directory', async () => {
  await book();
  await c.repos.books.update('book', { sha256: 'same-sha', status: 'ready' });
  const before = await c.repos.books.get('book');
  await c.repos.settings.set('backup.missingOriginals', [
    { id: 'book', sha256: 'same-sha' },
    { id: 'other', sha256: 'other-sha' },
  ]);
  expect(await importBookFile(c, file)).toEqual({
    kind: 'duplicate',
    bookId: 'book',
    restored: true,
  });
  expect(runtime.files.move).toHaveBeenCalledWith(
    expect.stringMatching(/_incoming\/.+\.pdf$/),
    '/docs/books/book/source.pdf',
  );
  expect(await runtime.files.exists('/docs/books/book/source.pdf')).toBe(true);
  expect(await c.repos.settings.get('backup.missingOriginals', [])).toEqual([
    { id: 'other', sha256: 'other-sha' },
  ]);
  expect(await c.repos.books.list()).toHaveLength(1);
  expect(await c.repos.books.get('book')).toEqual(before);
  expect(runtime.pdf.info).not.toHaveBeenCalled();
  expect(runtime.mineru.requestUpload).not.toHaveBeenCalled();
});

test('source restore failure retains the missing-original marker and existing learning records', async () => {
  await book();
  await c.repos.books.update('book', { sha256: 'same-sha' });
  await c.repos.settings.set('backup.missingOriginals', [
    { id: 'book', sha256: 'same-sha' },
  ]);
  jest.mocked(runtime.files.move).mockRejectedValueOnce(new Error('no space'));
  await expect(importBookFile(c, file)).rejects.toThrow('no space');
  expect(await c.repos.settings.get('backup.missingOriginals', [])).toEqual([
    { id: 'book', sha256: 'same-sha' },
  ]);
  expect(await c.repos.books.get('book')).toBeDefined();
});

test('a draft confirmed after a matching backup book appears restores its original instead of discarding the file', async () => {
  const selected = await importBookFile(c, file);
  if (selected.kind !== 'draft') throw new Error('draft expected');
  await book();
  await c.repos.books.update('book', { sha256: 'same-sha' });
  await c.repos.settings.set('backup.missingOriginals', [
    { id: 'book', sha256: 'same-sha' },
  ]);
  expect(await confirmImportDraft(c, selected.draftId, options)).toBe('book');
  expect(await runtime.files.exists('/docs/books/book/source.pdf')).toBe(true);
  expect(await c.repos.settings.get('backup.missingOriginals', [])).toEqual([]);
  expect(await c.repos.drafts.list()).toEqual([]);
});
test('metadata failure cleans the copy and closes native PDF', async () => {
  jest
    .mocked(runtime.pdf.outline)
    .mockRejectedValueOnce(new Error('broken PDF'));
  await expect(importBookFile(c, file)).rejects.toThrow('broken PDF');
  expect(runtime.pdf.close).toHaveBeenCalledTimes(1);
  expect(runtime.files.remove).toHaveBeenCalled();
  expect(await c.repos.drafts.list()).toEqual([]);
});
test('confirm moves canonical source, creates prioritized parts and completes queue', async () => {
  const selected = await importBookFile(c, file);
  if (selected.kind !== 'draft') throw new Error('draft expected');
  const id = await confirmImportDraft(c, selected.draftId, options);
  await settle(
    async () => (await c.repos.parts.get(id, 1))?.stage === 'waiting',
  );
  expect(runtime.files.move).toHaveBeenCalledWith(
    expect.any(String),
    `/docs/books/${id}/source.pdf`,
  );
  expect(await c.repos.drafts.list()).toEqual([]);
  expect(await c.repos.settings.get('mineru', {})).toMatchObject({
    usedToday: { date: clock.today(), pages: 4 },
  });
  clock.advance(2000);
  await jest.advanceTimersByTimeAsync(2000);
  await settle(async () => (await c.repos.books.get(id))?.status === 'ready');
  expect(await c.repos.books.get(id)).toMatchObject({
    ready_to_page: 4,
    page_offset: 1,
  });
  expect(await c.repos.sections.tree(id)).not.toHaveLength(0);
  expect(await c.repos.blocks.get(id, 1001)).toMatchObject({
    section_id: expect.any(String),
  });
});
test('process restart re-requests uploading URL, while accepted batch network failure only polls', async () => {
  await book();
  await part({ stage: 'uploading', batch_id: 'stale', file_path: '/missing' });
  await getParseQueue(c).resume();
  await settle(
    async () => (await c.repos.parts.get('book', 1))?.stage === 'waiting',
  );
  expect(runtime.mineru.requestUpload).toHaveBeenCalledTimes(1);
  getParseQueue(c).pause();
  await getParseQueue(c).dispose();
  await c.repos.parts.update('book', 1, {
    stage: 'running',
    batch_id: 'kept',
    next_poll_at: null,
  });
  jest
    .mocked(runtime.mineru.query)
    .mockRejectedValueOnce(new MineruError('network'));
  await getParseQueue(c).resume();
  await settle(
    async () => (await c.repos.parts.get('book', 1))?.error_code === 'network',
  );
  expect(await c.repos.parts.get('book', 1)).toMatchObject({
    batch_id: 'kept',
    stage: 'waiting',
  });
  clock.advance(3000);
  await jest.advanceTimersByTimeAsync(3000);
  await settle(
    async () => (await c.repos.parts.get('book', 1))?.stage === 'done',
  );
  expect(runtime.mineru.requestUpload).toHaveBeenCalledTimes(1);
  expect(runtime.mineru.query).toHaveBeenLastCalledWith(
    'kept',
    expect.any(Object),
  );
});
test('auth expiry pauses all work, persists expiry and resumes accepted batch after token update', async () => {
  await book();
  await part({ stage: 'running', batch_id: 'kept' });
  jest
    .mocked(runtime.mineru.query)
    .mockRejectedValueOnce(new MineruError('A0211'));
  await getParseQueue(c).resume();
  await settle(
    async () =>
      (
        await c.repos.settings.get<{ expired?: boolean }>('mineru', {})
      ).expired === true,
  );
  expect(await c.repos.settings.get('mineru', {})).toMatchObject({
    expired: true,
    tokenExpiresOn: clock.today(),
  });
  clock.advance(60000);
  await jest.advanceTimersByTimeAsync(60000);
  expect(runtime.mineru.query).toHaveBeenCalledTimes(1);
  await getParseQueue(c).resume();
  await settle(
    async () => (await c.repos.parts.get('book', 1))?.stage === 'done',
  );
  expect(runtime.mineru.requestUpload).not.toHaveBeenCalled();
});
test('oversized actual split bisects before requesting, and priority ranges are uploaded first', async () => {
  await book();
  await part();
  jest
    .mocked(runtime.pdf.split)
    .mockResolvedValueOnce({ sizeBytes: 191000000 });
  await getParseQueue(c).resume();
  await settle(async () =>
    (await c.repos.parts.list('book')).every(p => p.stage === 'waiting'),
  );
  expect(
    (await c.repos.parts.list('book')).map(p => [p.page_from, p.page_to]),
  ).toEqual([
    [1, 2],
    [3, 4],
  ]);
  expect(runtime.mineru.requestUpload).toHaveBeenCalledTimes(2);
});
test('queue limits simultaneous upload to one and polling to three', async () => {
  await book('book', 20);
  for (let i = 1; i <= 5; i++)
    await part({
      part_no: i,
      page_from: i,
      page_to: i,
      stage: 'running',
      batch_id: `b${i}`,
    });
  const releases: (() => void)[] = [];
  jest.mocked(runtime.mineru.query).mockImplementation(async () => {
    await new Promise<void>(resolve => releases.push(resolve));
    return [{ fileName: 'part', state: 'pending' }];
  });
  await getParseQueue(c).resume();
  await settle(async () => releases.length === 3);
  expect(runtime.mineru.query).toHaveBeenCalledTimes(3);
  getParseQueue(c).pause();
  releases.forEach(release => release());
  await getParseQueue(c).dispose();
  jest.mocked(runtime.mineru.query).mockReset();
  for (const p of await c.repos.parts.list('book'))
    await c.repos.parts.update('book', p.part_no, {
      stage: 'queued',
      batch_id: null,
    });
  let finish: (() => void) | undefined;
  jest.mocked(runtime.mineru.upload).mockImplementation(async () => {
    await new Promise<void>(resolve => {
      finish = resolve;
    });
  });
  await getParseQueue(c).resume();
  await settle(async () => Boolean(finish));
  expect(runtime.mineru.upload).toHaveBeenCalledTimes(1);
  getParseQueue(c).pause();
  finish!();
});
test('background aborts requests without changing batch or polling again', async () => {
  await book();
  await part({ stage: 'running', batch_id: 'kept' });
  let signal: AbortSignal | undefined;
  jest.mocked(runtime.mineru.query).mockImplementation(async (_batch, opts) => {
    signal = opts?.signal;
    await new Promise<void>((_resolve, reject) =>
      signal?.addEventListener('abort', () =>
        reject(new MineruError('cancelled')),
      ),
    );
    return [];
  });
  await getParseQueue(c).resume();
  await settle(async () => Boolean(signal));
  getParseQueue(c).pause();
  await getParseQueue(c).dispose();
  expect(signal?.aborted).toBe(true);
  expect(await c.repos.parts.get('book', 1)).toMatchObject({
    stage: 'running',
    batch_id: 'kept',
  });
});
test('ready page is contiguous while priority-only completed blocks remain learnable', async () => {
  expect(
    contiguousReadyPage([
      { page_from: 1, page_to: 2, stage: 'done' },
      { page_from: 3, page_to: 4, stage: 'waiting' },
      { page_from: 5, page_to: 6, stage: 'done' },
    ]),
  ).toBe(2);
  await book();
  const p = await part({ page_from: 3, page_to: 4 });
  jest.mocked(runtime.adapt).mockResolvedValueOnce({
    blocks: [
      { seq: 3001, page: 3, type: 'text', text: '优先章节正文', bbox: null },
    ],
    pageNumbers: [],
    pagesWithContent: [3],
  });
  await importPdfResult(c, p, '/result');
  expect(await c.repos.books.get('book')).toMatchObject({ ready_to_page: 0 });
  expect(await c.repos.blocks.get('book', 3001)).toBeDefined();
  expect(await loadParseWarnings(c, 'book')).toEqual({
    '1': expect.stringContaining('扫描版'),
  });
});
test('reparse migrates citations and highlights; unmatched annotations become visible notes instead of reused seq', async () => {
  await book();
  const p = await part();
  await importPdfResult(c, p, '/result');
  const section = (await c.repos.sections.tree('book'))[0];
  const text = (await c.repos.blocks.get('book', 1002))!.text;
  const timestamp = clock.now().toISOString();
  const message = await c.repos.messages.append({
    book_id: 'book',
    section_id: section.id,
    kind: 'assistant',
    content: '原文 [[b:1002]]',
    allowed_refs: [1002],
    created_at: timestamp,
  });
  await c.repos.notes.highlights.toggle({
    book_id: 'book',
    block_seq: 1002,
    start: 0,
    end: 2,
    created_at: timestamp,
  });
  jest.mocked(runtime.adapt).mockResolvedValueOnce({
    blocks: [
      {
        seq: 1001,
        page: 1,
        type: 'title',
        text: '第一章 基础',
        level: 1,
        bbox: null,
      },
      { seq: 1003, page: 1, type: 'text', text, bbox: null },
    ],
    pageNumbers: [],
    pagesWithContent: [1, 2, 3, 4],
  });
  await importPdfResult(c, p, '/result');
  expect(
    (await c.repos.messages.thread('book', section.id)).find(
      m => m.id === message.id,
    ),
  ).toMatchObject({ content: '原文 [[b:1003]]', allowed_refs: [1003] });
  expect(await c.repos.notes.highlights.list('book')).toMatchObject([
    { block_seq: 1003 },
  ]);
  jest.mocked(runtime.adapt).mockResolvedValueOnce({
    blocks: [
      {
        seq: 1003,
        page: 1,
        type: 'text',
        text: '完全不同的新段落',
        bbox: null,
      },
    ],
    pageNumbers: [],
    pagesWithContent: [1, 2, 3, 4],
  });
  await importPdfResult(c, p, '/result');
  expect(await c.repos.notes.highlights.list('book')).toEqual([]);
  const current = (await c.repos.sections.tree('book'))[0];
  expect(
    (await c.repos.notes.userText.get('book', current.id))?.user_text,
  ).toContain('原文位置已变化');
  expect(
    await c.repos.settings.get(referenceMovesKey('book'), []),
  ).not.toHaveLength(0);
  const rows = await c.db.all<{ content: string; allowed_refs_json: string }>(
    'SELECT content,allowed_refs_json FROM message WHERE id=?',
    [message.id],
  );
  expect(rows[0]).toEqual({
    content: '原文 〔原文位置已变化〕',
    allowed_refs_json: JSON.stringify({ version: 1, data: [] }),
  });
});
test('invalid adapted seq rolls back the existing book content and part state', async () => {
  await book();
  const p = await part();
  await importPdfResult(c, p, '/result');
  jest.mocked(runtime.adapt).mockResolvedValueOnce({
    blocks: [{ seq: 1000, page: 1, type: 'text', text: 'bad', bbox: null }],
    pageNumbers: [],
    pagesWithContent: [],
  });
  await expect(importPdfResult(c, p, '/result')).rejects.toThrow('序号');
  expect(await c.repos.blocks.get('book', 1002)).toBeDefined();
  expect((await c.repos.parts.get('book', 1))?.stage).toBe('done');
});

test('daily API limit pauses until the next local day without resubmitting an accepted batch', async () => {
  await book();
  await part({ stage: 'running', batch_id: 'existing' });
  jest
    .mocked(runtime.mineru.query)
    .mockRejectedValueOnce(new MineruError('-60018'));
  await getParseQueue(c).resume();
  await settle(
    async () =>
      (await c.repos.settings.get('parseQueue.dailyLimitDate', null)) ===
      clock.today(),
  );
  await getParseQueue(c).resume();
  expect(runtime.mineru.query).toHaveBeenCalledTimes(1);
  clock.advance(86400000);
  await getParseQueue(c).resume();
  await settle(
    async () => (await c.repos.parts.get('book', 1))?.stage === 'done',
  );
  expect(runtime.mineru.requestUpload).not.toHaveBeenCalled();
});
test('queue-full retries at 60 seconds and stops after five retries', async () => {
  jest.setSystemTime(clock.now());
  // Queue deadlines and timer callbacks must observe the same advancing clock.
  const appNow = jest.spyOn(clock, 'now').mockImplementation(() => new Date());
  try {
    await book();
    await part();
    jest
      .mocked(runtime.mineru.requestUpload)
      .mockRejectedValue(new MineruError('-60009'));
    const retryScheduled = (attempts: number) =>
      settle(async () => {
        const current = await c.repos.parts.get('book', 1);
        return (
          current?.attempts === attempts &&
          current.stage === 'requesting' &&
          current.error_code === '-60009' &&
          current.next_poll_at === new Date(Date.now() + 60000).toISOString()
        );
      });
    await getParseQueue(c).resume();
    await retryScheduled(1);
    await jest.advanceTimersByTimeAsync(59999);
    expect(runtime.mineru.requestUpload).toHaveBeenCalledTimes(1);
    for (let retry = 1; retry <= 5; retry++) {
      await jest.advanceTimersByTimeAsync(retry === 1 ? 1 : 60000);
      if (retry < 5) await retryScheduled(retry + 1);
      else
        await settle(
          async () => (await c.repos.parts.get('book', 1))?.stage === 'failed',
        );
      expect(runtime.mineru.requestUpload).toHaveBeenCalledTimes(retry + 1);
    }
    expect(await c.repos.parts.get('book', 1)).toMatchObject({
      attempts: 6,
      stage: 'failed',
      next_poll_at: null,
    });
  } finally {
    appNow.mockRestore();
  }
});
test('service errors retry three times with exponential backoff and then require manual retry', async () => {
  await book();
  await part();
  jest
    .mocked(runtime.mineru.requestUpload)
    .mockRejectedValue(new MineruError('-10001'));
  await getParseQueue(c).resume();
  await settle(
    async () => (await c.repos.parts.get('book', 1))?.attempts === 1,
  );
  for (const delay of [2000, 4000, 8000]) {
    clock.advance(delay);
    await jest.advanceTimersByTimeAsync(delay);
  }
  await settle(
    async () => (await c.repos.parts.get('book', 1))?.stage === 'failed',
  );
  expect(runtime.mineru.requestUpload).toHaveBeenCalledTimes(4);
});
test('invalid file repeated manual failures advise checking the file and OCR retry sets per-part option', async () => {
  await book();
  await part();
  jest
    .mocked(runtime.mineru.requestUpload)
    .mockRejectedValue(new MineruError('-60004'));
  await getParseQueue(c).resume();
  await settle(
    async () => (await c.repos.parts.get('book', 1))?.stage === 'failed',
  );
  await getParseQueue(c).retry('book', 1, { ocr: true });
  await settle(
    async () => (await c.repos.parts.get('book', 1))?.attempts === 2,
  );
  expect((await c.repos.parts.get('book', 1))?.error_msg).toContain(
    '已连续失败',
  );
  expect(runtime.mineru.requestUpload).toHaveBeenLastCalledWith(
    [expect.objectContaining({ ocr: true })],
    'vlm',
    expect.any(Object),
  );
});
test('waiting poll backs off from two seconds while running uses five seconds', async () => {
  await book();
  await part({ stage: 'waiting', batch_id: 'batch' });
  jest
    .mocked(runtime.mineru.query)
    .mockResolvedValue([{ fileName: 'part', state: 'pending' }]);
  await getParseQueue(c).resume();
  await settle(
    async () =>
      (await c.repos.parts.get('book', 1))?.next_poll_at ===
      new Date(clock.now().getTime() + 2000).toISOString(),
  );
  clock.advance(2000);
  await jest.advanceTimersByTimeAsync(2000);
  expect((await c.repos.parts.get('book', 1))?.next_poll_at).toBe(
    new Date(clock.now().getTime() + 3000).toISOString(),
  );
  jest.mocked(runtime.mineru.query).mockResolvedValue([
    {
      fileName: 'part',
      state: 'running',
      progress: { extractedPages: 1, totalPages: 4 },
    },
  ]);
  clock.advance(3000);
  await jest.advanceTimersByTimeAsync(3000);
  expect(await c.repos.parts.get('book', 1)).toMatchObject({
    stage: 'running',
    extracted_pages: 1,
    total_pages: 4,
    next_poll_at: new Date(clock.now().getTime() + 5000).toISOString(),
  });
});
test('EPUB stays importing until the local parser commits and never calls MinerU', async () => {
  let complete!: (value: { blocks: []; sections: []; parts: [] }) => void;
  runtime.epub = {
    inspect: jest.fn(async () => ({ title: 'Local EPUB', author: 'Writer' })),
    parse: jest.fn(
      async () =>
        new Promise(resolve => {
          complete = resolve;
        }),
    ),
  };
  const selected = await importBookFile(c, {
    uri: 'content://book.epub',
    name: 'book.epub',
    mime: 'application/epub+zip',
  });
  if (selected.kind !== 'draft') throw new Error('draft expected');
  const id = await confirmImportDraft(c, selected.draftId, options);
  await settle(async () => Boolean(complete));
  expect((await c.repos.books.get(id))?.status).toBe('importing');
  complete({ blocks: [], sections: [], parts: [] });
  await settle(async () => (await c.repos.books.get(id))?.status === 'ready');
  expect(runtime.mineru.requestUpload).not.toHaveBeenCalled();
});
test('dispose while resume is pending waits before the database can close', async () => {
  await book();
  await part();
  const queue = getParseQueue(c);
  const resuming = queue.resume();
  await queue.dispose();
  await resuming;
  expect(runtime.mineru.requestUpload).not.toHaveBeenCalled();
});

test('database import failure rolls back page replacement, map and completion together', async () => {
  await book();
  const p = await part();
  await importPdfResult(c, p, '/result');
  const old = await c.repos.blocks.get('book', 1002);
  const duplicate = {
    seq: 1001,
    page: 1,
    type: 'text' as const,
    text: 'duplicate seq',
    bbox: null,
  };
  jest.mocked(runtime.adapt).mockResolvedValueOnce({
    blocks: [duplicate, duplicate],
    pageNumbers: [],
    pagesWithContent: [1],
  });
  await expect(importPdfResult(c, p, '/result')).rejects.toThrow();
  expect(await c.repos.blocks.get('book', 1002)).toEqual(old);
  expect((await c.repos.parts.get('book', 1))?.stage).toBe('done');
  expect((await c.repos.sections.tree('book'))[0].title).toBe('基础');
});

test('reparse preserves manual map edits and remaps swapped highlights without UNIQUE conflicts', async () => {
  await book();
  const p = await part();
  await importPdfResult(c, p, '/result');
  const section = (await c.repos.sections.tree('book'))[0];
  await c.repos.sections.update('book', section.id, {
    source: 'manual',
    title: '手动标题',
    status: 'done',
  });
  const timestamp = clock.now().toISOString();
  await c.repos.blocks.insertMany('book', [
    {
      seq: 1003,
      page: 1,
      type: 'text',
      text: '另一段独立文字',
      chars: 8,
      section_id: section.id,
    },
  ]);
  const firstHighlight = await c.repos.notes.highlights.toggle({
    book_id: 'book',
    block_seq: 1002,
    start: 0,
    end: 2,
    created_at: timestamp,
  });
  const secondHighlight = await c.repos.notes.highlights.toggle({
    book_id: 'book',
    block_seq: 1003,
    start: 0,
    end: 2,
    created_at: timestamp,
  });
  const a = (await c.repos.blocks.get('book', 1002))!.text;
  const b = (await c.repos.blocks.get('book', 1003))!.text;
  jest.mocked(runtime.adapt).mockResolvedValueOnce({
    blocks: [
      {
        seq: 1001,
        page: 1,
        type: 'title',
        text: '第一章 基础',
        level: 1,
        bbox: null,
      },
      { seq: 1002, page: 1, type: 'text', text: b, bbox: null },
      { seq: 1003, page: 1, type: 'text', text: a, bbox: null },
    ],
    pageNumbers: [],
    pagesWithContent: [1, 2, 3, 4],
  });
  await importPdfResult(c, p, '/result');
  expect(await c.repos.sections.get('book', section.id)).toMatchObject({
    title: '手动标题',
    source: 'manual',
    status: 'done',
  });
  const migrated = await c.repos.notes.highlights.list('book');
  expect(migrated.find(h => h.id === firstHighlight!.id)?.block_seq).toBe(1003);
  expect(migrated.find(h => h.id === secondHighlight!.id)?.block_seq).toBe(
    1002,
  );
});

test('result images copy into the canonical book directory and retain portable relative paths', async () => {
  await book();
  const p = await part();
  jest.mocked(runtime.adapt).mockResolvedValueOnce({
    blocks: [
      {
        seq: 1001,
        page: 1,
        type: 'image',
        text: '图一',
        imageFile: 'images/original.jpg',
        bbox: [0.1, 0.2, 0.8, 0.9],
      },
    ],
    pageNumbers: [],
    pagesWithContent: [1, 2, 3, 4],
  });
  await importPdfResult(c, p, '/result');
  expect(runtime.files.copy).toHaveBeenCalledWith(
    '/result/images/original.jpg',
    '/docs/books/book/images/p1_1.jpg',
  );
  expect(await c.repos.blocks.get('book', 1001)).toMatchObject({
    image_path: 'images/p1_1.jpg',
    x0: 0.1,
    y1: 0.9,
  });
});

test('actual clear-cache then explicit reparse consumes preserved blocks to migrate all learning references', async () => {
  await book();
  const p = await part();
  await importPdfResult(c, p, '/result');
  await runtime.files.move('/chosen.pdf', '/docs/books/book/source.pdf');
  const originalText = (await c.repos.blocks.get('book', 1002))!.text;
  const section = (await c.repos.sections.tree('book'))[0];
  await c.repos.sections.update('book', section.id, {
    source: 'manual',
    title: '我的手动目录',
    status: 'done',
    summary: '我的学习总结',
  });
  const at = clock.now().toISOString();
  const message = await c.repos.messages.append({
    book_id: 'book',
    section_id: section.id,
    kind: 'assistant',
    content: '学习引用 [[b:1002]]',
    allowed_refs: [1002],
    quote_seq: 1002,
    created_at: at,
  });
  await c.repos.notes.highlights.toggle({
    book_id: 'book',
    block_seq: 1002,
    created_at: at,
  });
  await c.repos.notes.pins.add({
    book_id: 'book',
    section_id: section.id,
    block_seq: 1002,
    question: '这是为什么？',
    answer_summary: '保留原文问答',
    message_ids: [message.id],
    created_at: at,
  });
  await c.repos.notes.userText.set('book', section.id, '我写的笔记');
  await c.repos.cards.addMany([
    {
      book_id: 'book',
      section_id: section.id,
      front: '复习题',
      back: '复习答案',
      due_on: clock.today(),
      origin: 'manual',
      created_at: at,
    },
  ]);
  await clearParseCache(c, 'book');
  expect(await c.repos.blocks.get('book', 1002)).toBeUndefined();
  expect(
    (await preservedReparseBlocks(c, 'book')).some(block => block.seq === 1002),
  ).toBe(true);
  await getParseQueue(c).resume();
  expect(runtime.mineru.requestUpload).not.toHaveBeenCalled();
  jest.mocked(runtime.adapt).mockResolvedValueOnce({
    blocks: [
      {
        seq: 1001,
        page: 1,
        type: 'title',
        level: 1,
        text: '第一章 基础',
        bbox: null,
      },
      {
        seq: 1002,
        page: 1,
        type: 'text',
        text: '新增的另一段内容',
        bbox: null,
      },
      { seq: 1003, page: 1, type: 'text', text: originalText, bbox: null },
    ],
    pageNumbers: [],
    pagesWithContent: [1, 2, 3, 4],
  });
  await reparseBook(c, 'book');
  await settle(
    async () => (await c.repos.parts.get('book', 1))?.stage === 'waiting',
  );
  expect(await c.repos.sections.get('book', section.id)).toMatchObject({
    source: 'manual',
    title: '我的手动目录',
    status: 'done',
  });
  clock.advance(2000);
  await jest.advanceTimersByTimeAsync(2000);
  await settle(
    async () => (await c.repos.books.get('book'))?.status === 'ready',
  );
  expect(
    (await c.repos.messages.thread('book', section.id)).find(
      value => value.id === message.id,
    ),
  ).toMatchObject({
    content: '学习引用 [[b:1003]]',
    allowed_refs: [1003],
    quote_seq: 1003,
  });
  expect(await c.repos.notes.highlights.list('book')).toMatchObject([
    { block_seq: 1003 },
  ]);
  expect(await c.repos.notes.pins.list('book')).toMatchObject([
    { block_seq: 1003, answer_summary: '保留原文问答' },
  ]);
  expect(
    (await c.repos.notes.userText.get('book', section.id))?.user_text,
  ).toBe('我写的笔记');
  expect(await c.repos.cards.due(clock.today())).toHaveLength(1);
  expect(await c.repos.sections.get('book', section.id)).toMatchObject({
    title: '我的手动目录',
    summary: '我的学习总结',
    status: 'done',
  });
  expect(await c.repos.settings.get(`reparse.blocks.book`, null)).toBeNull();
});

test('explicit reparse without original retains snapshots and learning records and never uploads', async () => {
  await book();
  const p = await part();
  await importPdfResult(c, p, '/result');
  await clearParseCache(c, 'book');
  const before = await preservedReparseBlocks(c, 'book');
  await expect(reparseBook(c, 'book')).rejects.toThrow('补回原文件');
  expect(await preservedReparseBlocks(c, 'book')).toEqual(before);
  expect(runtime.mineru.requestUpload).not.toHaveBeenCalled();
});

test('multi-part reparse keeps pending snapshots and learned chapter metadata until their results commit', async () => {
  await book('book', 400);
  const first = await part({ page_to: 200 });
  const second = await part({ part_no: 2, page_from: 201, page_to: 400 });
  const a = '第一章的已学正文。'.repeat(50),
    b = '第二章的已学正文。'.repeat(50);
  const adapted = (
    page: number,
    chapter: string,
    seq: number,
    text: string,
  ) => ({
    blocks: [
      {
        seq: page * 1000 + 1,
        page,
        type: 'title' as const,
        text: chapter,
        level: 1,
        bbox: null,
      },
      { seq, page, type: 'text' as const, text, bbox: null },
    ],
    pageNumbers: [],
    pagesWithContent: [page],
  });
  jest
    .mocked(runtime.adapt)
    .mockResolvedValueOnce(adapted(1, '第一章 基础', 1002, a));
  await importPdfResult(c, first, '/first');
  jest
    .mocked(runtime.adapt)
    .mockResolvedValueOnce(adapted(201, '第二章 后续', 201002, b));
  await importPdfResult(c, second, '/second');
  await runtime.files.move('/chosen', '/docs/books/book/source.pdf');
  await c.repos.sections.update('book', 'ch2', {
    status: 'done',
    summary: '已学第二章的总结',
  });
  const at = clock.now().toISOString();
  const message = await c.repos.messages.append({
    book_id: 'book',
    section_id: 'ch2',
    kind: 'assistant',
    content: '第二章 [[b:201002]]',
    allowed_refs: [201002],
    created_at: at,
  });
  await clearParseCache(c, 'book');
  await reparseBook(c, 'book');
  await getParseQueue(c).dispose();
  const [newFirst, newSecond] = await c.repos.parts.list('book');
  const duplicate = {
    seq: 1001,
    page: 1,
    type: 'text' as const,
    text: a,
    bbox: null,
  };
  jest.mocked(runtime.adapt).mockResolvedValueOnce({
    blocks: [duplicate, duplicate],
    pageNumbers: [],
    pagesWithContent: [1],
  });
  await expect(importPdfResult(c, newFirst, '/broken')).rejects.toThrow();
  expect(await preservedReparseBlocks(c, 'book')).toHaveLength(4);
  jest
    .mocked(runtime.adapt)
    .mockResolvedValueOnce(adapted(1, '第一章 基础', 1003, a));
  await importPdfResult(c, newFirst, '/first');
  expect(
    (await preservedReparseBlocks(c, 'book')).map(block => block.page),
  ).toEqual([201, 201]);
  expect(
    (await c.repos.messages.thread('book', 'ch2')).find(
      value => value.id === message.id,
    )?.content,
  ).toBe('第二章 [[b:201002]]');
  jest
    .mocked(runtime.adapt)
    .mockResolvedValueOnce(adapted(201, '第二章 后续', 201003, b));
  await importPdfResult(c, newSecond, '/second');
  expect(await c.repos.sections.get('book', 'ch2')).toMatchObject({
    status: 'done',
    summary: '已学第二章的总结',
  });
  expect(
    (await c.repos.messages.thread('book', 'ch2')).find(
      value => value.id === message.id,
    ),
  ).toMatchObject({ content: '第二章 [[b:201003]]', allowed_refs: [201003] });
  expect(await c.repos.settings.get('reparse.blocks.book', null)).toBeNull();
  expect(await c.repos.settings.get('reparse.sections.book', null)).toBeNull();
});

async function storedLearning() {
  const records: Record<string, unknown[]> = {};
  for (const table of [
    'message',
    'card',
    'highlight',
    'pin',
    'study_state',
    'section_note',
    'qa',
    'stuck',
    'detour',
    'lesson_plan',
  ])
    records[table] = await c.db.all(
      `SELECT * FROM ${table} WHERE book_id=? ORDER BY rowid`,
      ['book'],
    );
  return records;
}
async function addObsoleteSection() {
  const sections = await c.repos.sections.tree('book');
  await c.repos.sections.replaceAll('book', [
    ...sections,
    {
      ...sections[0],
      id: 'legacy-address',
      ord: 999,
      no: null,
      title: '旧算法误识别的版权地址',
      source: 'auto',
      status: 'new',
      summary: null,
      guide: null,
    },
  ]);
}
test('local PDF map rebuild removes unused false headings while preserving learned, manual and stable-reference data offline', async () => {
  await book('book', 6);
  await c.repos.books.update('book', {
    outline: [
      { title: '第一章 基础', page: 1, level: 1 },
      { title: '第二章 后续', page: 2, level: 1 },
    ],
  });
  const p = await part();
  jest.mocked(runtime.adapt).mockResolvedValueOnce({
    blocks: [
      {
        seq: 1001,
        page: 1,
        type: 'title',
        text: '第一章 基础',
        level: 1,
        bbox: null,
      },
      {
        seq: 1002,
        page: 1,
        type: 'text',
        text: '第一章已学习正文。'.repeat(80),
        bbox: null,
      },
      {
        seq: 2001,
        page: 2,
        type: 'title',
        text: '第二章 后续',
        level: 1,
        bbox: null,
      },
      {
        seq: 2002,
        page: 2,
        type: 'text',
        text: '第二章已学习正文。'.repeat(80),
        bbox: null,
      },
    ],
    pageNumbers: [
      { page: 1, printed: 1 },
      { page: 2, printed: 2 },
    ],
    pagesWithContent: [1, 2, 3, 4],
  });
  await importPdfResult(c, p, '/result');
  await part({
    part_no: 2,
    page_from: 5,
    page_to: 6,
    stage: 'failed',
    batch_id: 'saved-batch',
    error_code: 'A0202',
    error_msg: '已保存的错误',
  });
  await c.repos.books.update('book', {
    status: 'paused',
    ready_to_page: 4,
    tokens_total: 321,
    page_offset: 0,
  });
  await c.repos.settings.set('book.import.book', {
    pageLabels: ['i', '1', '2', '3', '4', '5'],
    sizes: [],
  });
  await addObsoleteSection();
  await c.repos.sections.update('book', 'ch1', {
    source: 'manual',
    title: '我的手动目录',
    status: 'done',
    summary: '第一章总结',
    guide: '第一章导读',
  });
  await c.repos.sections.update('book', 'ch2', {
    status: 'learning',
    summary: '第二章总结',
    guide: '第二章导读',
  });
  const at = clock.now().toISOString();
  const message = await c.repos.messages.append({
    book_id: 'book',
    section_id: 'ch1',
    kind: 'assistant',
    content: '稳定引用 [[b:1002]]',
    parts: [{ t: 'text', text: '稳定引用 [[b:1002]]' }],
    allowed_refs: [1002],
    quote_seq: 1002,
    created_at: at,
  });
  await c.repos.notes.highlights.toggle({
    book_id: 'book',
    block_seq: 1002,
    start: 0,
    end: 2,
    note: '高亮笔记',
    created_at: at,
  });
  await c.repos.notes.pins.add({
    book_id: 'book',
    section_id: 'ch1',
    block_seq: 1002,
    question: '为什么？',
    answer_summary: '问答便签',
    message_ids: [message.id],
    created_at: at,
  });
  await c.repos.notes.userText.set('book', 'ch1', '我的手动笔记');
  await c.repos.cards.addMany([
    {
      book_id: 'book',
      section_id: 'ch1',
      front: '复习题',
      back: '答案',
      due_on: clock.today(),
      origin: 'manual',
      created_at: at,
    },
  ]);
  await c.repos.notes.qa.add({
    book_id: 'book',
    section_id: 'ch1',
    q: '原文问题',
    a: '回答',
    from_section: 'ch2',
    detour_id: null,
    message_ids: [message.id],
    created_at: at,
  });
  await c.repos.notes.stuck.add({
    book_id: 'book',
    section_id: 'ch2',
    text: '已有卡点',
    source: 'user',
    card_id: null,
    resolved_at: null,
    created_at: at,
  });
  const detour = await c.repos.detours.start({
    book_id: 'book',
    from_section: 'ch2',
    to_section: 'ch1',
    depth: 1,
    title: null,
    stuck_id: null,
    started_at: at,
    ended_at: null,
  });
  await c.repos.plans.put({
    book_id: 'book',
    section_id: 'ch2',
    part_no: 0,
    steps: [
      {
        no: 1,
        title: '已有步骤',
        kind: 'intuition',
        block_from: 2001,
        block_to: 2002,
        status: 'current',
      },
    ],
    source: 'model',
    created_at: at,
  });
  await c.repos.study.put({
    book_id: 'book',
    main_section: 'ch2',
    main_part: 0,
    main_step: 1,
    phase: 'quiz',
    detours: [{ sectionId: 'ch1', detourId: detour.id }],
    mode: 'read',
    reader_view: 'flow',
    read_anchor: 2002,
    resume_shown_at: at,
    last_active_at: at,
  });
  const learning = await storedLearning(),
    blocks = await c.db.all(
      'SELECT * FROM block WHERE book_id=? ORDER BY seq',
      ['book'],
    ),
    beforeBook = await c.repos.books.get('book'),
    beforeParts = await c.repos.parts.list('book'),
    manual = await c.repos.sections.get('book', 'ch1');
  const session = getStudySession(c, 'book');
  const dispose = jest.spyOn(session, 'dispose');
  const queue = getParseQueue(c),
    stopQueue = jest.spyOn(queue, 'dispose');
  let finishReader!: () => void;
  const close = jest.fn(
    () =>
      new Promise<void>(resolve => {
        finishReader = resolve;
      }),
  );
  setReaderRuntime(c, {
    info: jest.fn(),
    render: jest.fn(),
    window: jest.fn(),
    close,
  });
  jest.clearAllMocks();
  const pending = rebuildLocalPdfMap(c, 'book');
  await settle(async () => close.mock.calls.length === 1);
  expect(dispose).toHaveBeenCalledTimes(1);
  expect(stopQueue).toHaveBeenCalledTimes(1);
  expect(await c.repos.sections.get('book', 'legacy-address')).toBeDefined();
  finishReader();
  await pending;
  expect(await c.repos.sections.get('book', 'legacy-address')).toBeUndefined();
  expect(await c.repos.sections.get('book', 'ch1')).toEqual(manual);
  expect(await c.repos.sections.get('book', 'ch2')).toMatchObject({
    status: 'learning',
    summary: '第二章总结',
    guide: '第二章导读',
  });
  expect(await storedLearning()).toEqual(learning);
  expect(
    await c.db.all('SELECT * FROM block WHERE book_id=? ORDER BY seq', [
      'book',
    ]),
  ).toEqual(blocks);
  expect(await c.repos.parts.list('book')).toEqual(beforeParts);
  expect(await c.repos.books.get('book')).toEqual({
    ...beforeBook,
    page_offset: 1,
  });
  expect(
    await c.repos.settings.get('book.pageOffsetReliable.book', false),
  ).toBe(true);
  expect(getStudySession(c, 'book')).not.toBe(session);
  expect(getParseQueue(c)).not.toBe(queue);
  for (const fn of [
    ...Object.values(runtime.mineru),
    ...Object.values(runtime.pdf),
    ...Object.values(runtime.files),
    runtime.adapt,
  ])
    if (typeof fn === 'function') expect(fn).not.toHaveBeenCalled();
});

test.each(['summary', 'card', 'progress'] as const)(
  'local map rebuild rejects removing a legacy section with %s instead of orphaning data',
  async kind => {
    await book();
    await importPdfResult(c, await part(), '/result');
    await addObsoleteSection();
    if (kind === 'summary')
      await c.repos.sections.update('book', 'legacy-address', {
        status: 'done',
        summary: '不可丢失的总结',
      });
    if (kind === 'card')
      await c.repos.cards.addMany([
        {
          book_id: 'book',
          section_id: 'legacy-address',
          front: '旧小节的问题',
          back: '答案',
          due_on: clock.today(),
          origin: 'manual',
          created_at: clock.now().toISOString(),
        },
      ]);
    if (kind === 'progress')
      await c.repos.study.put({
        book_id: 'book',
        main_section: 'legacy-address',
        main_part: 0,
        main_step: 1,
        read_anchor: 1002,
      });
    const sections = await c.repos.sections.tree('book'),
      learning = await storedLearning(),
      blocks = await c.db.all(
        'SELECT * FROM block WHERE book_id=? ORDER BY seq',
        ['book'],
      ),
      parts = await c.repos.parts.list('book'),
      original = await c.repos.books.get('book');
    await expect(rebuildLocalPdfMap(c, 'book')).rejects.toThrow(
      'legacy-address',
    );
    expect(await c.repos.sections.tree('book')).toEqual(sections);
    expect(await storedLearning()).toEqual(learning);
    expect(
      await c.db.all('SELECT * FROM block WHERE book_id=? ORDER BY seq', [
        'book',
      ]),
    ).toEqual(blocks);
    expect(await c.repos.parts.list('book')).toEqual(parts);
    expect(await c.repos.books.get('book')).toEqual(original);
  },
);

test('local map rebuild rolls back section replacement when the derived book update fails', async () => {
  await book();
  await importPdfResult(c, await part(), '/result');
  await addObsoleteSection();
  await c.repos.settings.set('book.pageNumbers.book', [
    { page: 1, printed: 10 },
  ]);
  const sections = await c.repos.sections.tree('book'),
    blocks = await c.db.all(
      'SELECT * FROM block WHERE book_id=? ORDER BY seq',
      ['book'],
    );
  await c.db.run(
    "CREATE TRIGGER fail_local_map BEFORE UPDATE OF page_offset ON book BEGIN SELECT RAISE(ABORT,'injected map failure'); END",
  );
  await expect(rebuildLocalPdfMap(c, 'book')).rejects.toThrow(
    'injected map failure',
  );
  expect(await c.repos.sections.tree('book')).toEqual(sections);
  expect(
    await c.db.all('SELECT * FROM block WHERE book_id=? ORDER BY seq', [
      'book',
    ]),
  ).toEqual(blocks);
});

test('local map rebuild rejects changing a learned part boundary and keeps the saved lesson progress', async () => {
  await book();
  await importPdfResult(c, await part(), '/result');
  await c.repos.sections.update('book', 'ch1', { status: 'learning' });
  await c.repos.sections.setParts('book', 'ch1', [
    { part_no: 0, block_from: 1001, block_to: 1001, name: '原有分段' },
  ]);
  await c.repos.study.put({
    book_id: 'book',
    main_section: 'ch1',
    main_part: 0,
    main_step: 1,
    read_anchor: 1002,
  });
  const previous = await c.repos.sections.parts('book', 'ch1'),
    progress = await c.repos.study.get('book');
  await expect(rebuildLocalPdfMap(c, 'book')).rejects.toThrow('ch1');
  expect(await c.repos.sections.parts('book', 'ch1')).toEqual(previous);
  expect(await c.repos.study.get('book')).toEqual(progress);
});

test('local map rebuild uses stored printed-page samples when PDF page labels are absent', async () => {
  await book();
  await importPdfResult(c, await part(), '/result');
  await c.repos.settings.set('book.pageNumbers.book', [
    { page: 1, printed: 10 },
  ]);
  await rebuildLocalPdfMap(c, 'book');
  expect((await c.repos.books.get('book'))?.page_offset).toBe(-9);
  expect(
    await c.repos.settings.get('book.pageOffsetReliable.book', false),
  ).toBe(true);
});
