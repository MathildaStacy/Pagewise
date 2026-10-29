import type { BookPart, BookPartPatch } from '@core/types';
import { createRepos } from '@data/repos';
import { bisectPart } from '@services/mineru/split';
import { MINERU_TARGET_BYTES, MineruError } from '@services/mineru/types';
import type { Container } from '../container';
import { getImportRuntime, sourcePath } from './importRuntime';
import { importEpubResult, importPdfResult } from './importResults';

export interface ParseQueue {
  resume(): Promise<void>;
  pause(): void;
  retry(
    bookId: string,
    partNo: number,
    options?: { ocr?: boolean },
  ): Promise<void>;
  dispose(): Promise<void>;
}
const queues = new WeakMap<Container, ParseQueue>();
const keyOf = (part: BookPart) => `${part.book_id}:${part.part_no}`;
const polling = (part: BookPart) =>
  Boolean(part.batch_id) &&
  !['requesting', 'uploading', 'queued', 'splitting'].includes(part.stage);
const cancelled = (signal: AbortSignal) => {
  if (signal.aborted) throw new MineruError('cancelled');
};
export function getParseQueue(c: Container): ParseQueue {
  let queue = queues.get(c);
  if (!queue) {
    queue = createParseQueue(c);
    queues.set(c, queue);
  }
  return queue;
}
function createParseQueue(c: Container): ParseQueue {
  let enabled = false,
    disposed = false,
    pumping = false,
    repump = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let epoch = 0;
  let lifecycle = Promise.resolve();
  let pumpComplete = Promise.resolve();
  const retrying = new Set<string>();
  const active = new Map<
    string,
    {
      kind: 'upload' | 'poll';
      controller: AbortController;
      promise: Promise<void>;
    }
  >();
  const intervals = new Map<string, number>();
  const now = () => c.clock.now().getTime();
  const isoAfter = (ms: number) => new Date(now() + ms).toISOString();
  const notify = async (bookId: string) => {
    const book = await c.repos.books.get(bookId);
    if (book) c.events.emit('book.parse', { bookId, status: book.status });
  };
  const update = async (part: BookPart, patch: BookPartPatch) => {
    await c.repos.parts.update(part.book_id, part.part_no, patch);
    await notify(part.book_id);
    Object.assign(part, patch);
  };
  function clearTimer() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }
  function pause() {
    epoch++;
    enabled = false;
    clearTimer();
    for (const worker of active.values()) worker.controller.abort();
  }
  function wake() {
    pump().catch(() => {
      c.log.error('解析队列未能读取状态');
      pause();
    });
  }
  async function splitAgain(part: BookPart, signal: AbortSignal) {
    const [left, right] = bisectPart({
      pageFrom: part.page_from,
      pageTo: part.page_to,
    });
    const runtime = getImportRuntime(c);
    if (part.file_path) await runtime.files.remove(part.file_path);
    cancelled(signal);
    await c.db.transaction(async tx => {
      const repos = createRepos(tx, () => c.clock.now().toISOString());
      const parts = await repos.parts.list(part.book_id);
      await repos.parts.update(part.book_id, part.part_no, {
        page_to: left.pageTo,
        stage: 'queued',
        file_path: null,
        size_bytes: null,
        batch_id: null,
        data_id: null,
        error_code: null,
        error_msg: null,
        attempts: 0,
        next_poll_at: null,
      });
      await repos.parts.upsert({
        book_id: part.book_id,
        part_no: Math.max(...parts.map(p => p.part_no)) + 1,
        page_from: right.pageFrom,
        page_to: right.pageTo,
        stage: 'queued',
        updated_at: c.clock.now().toISOString(),
      });
    });
    await notify(part.book_id);
  }
  async function submitted(part: BookPart) {
    const patch: BookPartPatch = {
      stage: 'waiting',
      file_path: null,
      attempts: 0,
      next_poll_at: isoAfter(2000),
      error_code: null,
      error_msg: null,
      extracted_pages: null,
      total_pages: null,
    };
    await c.db.transaction(async tx => {
      const repos = createRepos(tx);
      const settings = await repos.settings.get<Record<string, unknown>>(
        'mineru',
        {},
      );
      const used = settings.usedToday as
        | { date: string; pages: number }
        | undefined;
      const date = c.clock.today();
      await repos.settings.set('mineru', {
        ...settings,
        usedToday: {
          date,
          pages:
            (used?.date === date ? used.pages : 0) +
            part.page_to -
            part.page_from +
            1,
        },
      });
      await repos.parts.update(part.book_id, part.part_no, patch);
    });
    Object.assign(part, patch);
    await notify(part.book_id);
  }
  async function upload(part: BookPart, signal: AbortSignal) {
    const runtime = getImportRuntime(c),
      book = await c.repos.books.get(part.book_id);
    if (!book) return;
    cancelled(signal);
    let file = part.file_path;
    if (!file || !(await runtime.files.exists(file))) {
      await update(part, {
        stage: 'splitting',
        error_code: null,
        error_msg: null,
      });
      const dir = `${runtime.files.cacheDir}/parse/${part.book_id}`;
      await runtime.files.mkdir(dir);
      file = `${dir}/${part.page_from}-${part.page_to}.pdf`;
      const size = await runtime.pdf.split(
        sourcePath(runtime, book.id),
        part.page_from,
        part.page_to,
        file,
      );
      cancelled(signal);
      await update(part, { file_path: file, size_bytes: size.sizeBytes });
      if (size.sizeBytes > MINERU_TARGET_BYTES) {
        await splitAgain(part, signal);
        return;
      }
    }
    cancelled(signal);
    await update(part, { stage: 'requesting', batch_id: null, data_id: null });
    const dataId = `${part.book_id}-${part.part_no}`;
    const ocrParts = await c.repos.settings.get<Record<string, boolean>>(
      `book.ocrParts.${part.book_id}`,
      {},
    );
    const request = await runtime.mineru.requestUpload(
      [
        {
          name: `${dataId}.pdf`,
          dataId,
          ocr: ocrParts[String(part.part_no)] ?? book.ocr,
        },
      ],
      book.parse_model ?? 'vlm',
      { signal },
    );
    cancelled(signal);
    if (!request.urls[0]) throw new MineruError('protocol');
    await update(part, {
      stage: 'uploading',
      batch_id: request.batchId,
      data_id: dataId,
      extracted_pages: 0,
      total_pages: part.size_bytes,
    });
    let progressWrite = Promise.resolve();
    let lastProgress = -1;
    try {
      await runtime.mineru.upload(
        request.urls[0],
        file,
        (sent, total) => {
          const progress = total > 0 ? Math.floor((sent / total) * 100) : 0;
          if (progress <= lastProgress || signal.aborted) return;
          lastProgress = progress;
          progressWrite = progressWrite.then(async () => {
            if (!signal.aborted)
              await update(part, { extracted_pages: sent, total_pages: total });
          });
        },
        signal,
      );
    } finally {
      await progressWrite;
    }
    cancelled(signal);
    await submitted(part);
    await runtime.files.remove(file);
  }
  async function poll(part: BookPart, signal: AbortSignal) {
    const runtime = getImportRuntime(c);
    const results = await runtime.mineru.query(part.batch_id!, { signal });
    cancelled(signal);
    const result =
      results.find(r => r.dataId === part.data_id) ??
      (results.length === 1 ? results[0] : undefined);
    if (!result) throw new MineruError('protocol');
    if (result.state === 'failed')
      throw result.error ?? new MineruError('-60008');
    if (result.state === 'done') {
      if (!result.zipUrl) throw new MineruError('protocol');
      await update(part, {
        stage: 'downloading',
        error_code: null,
        error_msg: null,
      });
      const dir = `${runtime.files.cacheDir}/parse/${part.book_id}/result-${part.part_no}`;
      try {
        const extracted = await runtime.mineru.download(
          result.zipUrl,
          dir,
          () => {},
          { signal },
        );
        cancelled(signal);
        await update(part, { stage: 'importing' });
        await importPdfResult(c, part, extracted, signal);
        intervals.delete(keyOf(part));
      } finally {
        await runtime.files.remove(dir);
      }
      return;
    }
    const running = result.state === 'running' || result.state === 'converting';
    const delay = running
      ? 5000
      : Math.min(30000, intervals.get(keyOf(part)) ?? 2000);
    intervals.set(keyOf(part), Math.min(30000, delay * 1.5));
    await update(part, {
      stage: running ? 'running' : 'waiting',
      extracted_pages: result.progress?.extractedPages ?? null,
      total_pages: result.progress?.totalPages ?? null,
      next_poll_at: isoAfter(delay),
      error_code: null,
      error_msg: null,
    });
  }
  async function failed(part: BookPart, value: unknown, signal: AbortSignal) {
    if (signal.aborted) return;
    const error =
      value instanceof MineruError ? value : new MineruError('protocol');
    if (error.kind === 'cancelled') return;
    if (error.kind === 'too_large') {
      try {
        await splitAgain(part, signal);
        return;
      } catch (splitError) {
        if (signal.aborted) return;
        if (!(splitError instanceof MineruError)) throw splitError;
      }
    }
    const attempts = part.attempts + 1;
    let patch: BookPartPatch = {
      attempts,
      error_code: error.code,
      error_msg: error.message,
    };
    if (error.kind === 'auth' || error.kind === 'daily_limit') {
      pause();
      patch = {
        ...patch,
        stage: part.batch_id ? 'waiting' : 'requesting',
        next_poll_at: null,
      };
      await update(part, patch);
      await c.repos.books.update(part.book_id, { status: 'paused' });
      if (error.code === 'A0211') {
        const settings = await c.repos.settings.get<Record<string, unknown>>(
          'mineru',
          {},
        );
        await c.repos.settings.set('mineru', {
          ...settings,
          tokenExpiresOn: c.clock.today(),
          expired: true,
        });
      }
      if (error.kind === 'daily_limit')
        await c.repos.settings.set(
          'parseQueue.dailyLimitDate',
          c.clock.today(),
        );
      await notify(part.book_id);
      return;
    }
    if (error.kind === 'network' || error.kind === 'timeout')
      patch = {
        ...patch,
        stage: part.batch_id ? 'waiting' : 'requesting',
        next_poll_at: isoAfter(
          Math.min(30000, 2000 * 1.5 ** Math.min(attempts, 8)),
        ),
      };
    else if (error.kind === 'queue_full' && attempts <= 5)
      patch = {
        ...patch,
        stage: 'requesting',
        batch_id: null,
        next_poll_at: isoAfter(60000),
      };
    else if (error.kind === 'service' && attempts <= 3)
      patch = {
        ...patch,
        stage: 'requesting',
        batch_id: null,
        next_poll_at: isoAfter(2000 * 2 ** (attempts - 1)),
      };
    else
      patch = {
        ...patch,
        stage: 'failed',
        next_poll_at: null,
        error_msg:
          error.message +
          (error.kind === 'invalid_file' && attempts >= 2
            ? '；已连续失败，请检查原文件'
            : ''),
      };
    await update(part, patch);
    if (patch.stage === 'failed') {
      await c.repos.books.update(part.book_id, { status: 'paused' });
      await notify(part.book_id);
    }
  }
  function launch(part: BookPart) {
    const key = keyOf(part),
      kind = polling(part) ? 'poll' : 'upload';
    const controller = new AbortController();
    const promise = Promise.resolve()
      .then(() =>
        kind === 'poll'
          ? poll(part, controller.signal)
          : upload(part, controller.signal),
      )
      .catch(error => failed(part, error, controller.signal))
      .catch(() => {
        c.log.error('解析队列未能保存状态');
        pause();
      })
      .finally(() => {
        active.delete(key);
        if (enabled) wake();
      });
    active.set(key, { kind, controller, promise });
  }
  async function pump() {
    if (!enabled || disposed) return;
    if (pumping) {
      repump = true;
      return;
    }
    pumping = true;
    let finishPump!: () => void;
    pumpComplete = new Promise<void>(resolve => {
      finishPump = resolve;
    });
    clearTimer();
    try {
      const books = await c.repos.books.list();
      const priority = new Map(
        books.map((book, index) => [
          book.id,
          { index, from: book.priority_from },
        ]),
      );
      const parts = (await c.repos.parts.pending())
        .filter(p => p.stage !== 'failed')
        .sort((a, b) => {
          const ap = priority.get(a.book_id),
            bp = priority.get(b.book_id);
          const range = (p: BookPart, from = 1) =>
            p.page_to >= from ? p.page_from : 1000000000 + p.page_from;
          return (
            (ap?.index ?? 0) - (bp?.index ?? 0) ||
            range(a, ap?.from) - range(b, bp?.from)
          );
        });
      if (!enabled || disposed) return;
      let uploads = [...active.values()].filter(
        a => a.kind === 'upload',
      ).length;
      let polls = [...active.values()].filter(a => a.kind === 'poll').length;
      let next = Infinity;
      for (const part of parts) {
        if (active.has(keyOf(part)) || retrying.has(keyOf(part))) continue;
        const due = part.next_poll_at ? Date.parse(part.next_poll_at) : 0;
        if (due > now()) {
          next = Math.min(next, due);
          continue;
        }
        if (polling(part)) {
          if (polls < 3) {
            polls++;
            launch(part);
          }
        } else if (uploads < 1) {
          uploads++;
          launch(part);
        }
      }
      // EPUB runs entirely locally and keeps its importing status until the transaction succeeds.
      for (const book of books.filter(
        b => b.format === 'epub' && b.status === 'importing',
      )) {
        const key = `epub:${book.id}`;
        if (active.has(key)) continue;
        const controller = new AbortController();
        const promise = importEpubResult(c, book.id)
          .catch(async () => {
            await c.repos.settings.set(
              `book.epubError.${book.id}`,
              'EPUB 没能完成解析，请检查文件后重试',
            );
            await c.repos.books.update(book.id, { status: 'failed' });
            await notify(book.id);
          })
          .finally(() => {
            active.delete(key);
          });
        active.set(key, { kind: 'poll', controller, promise });
      }
      if (Number.isFinite(next))
        timer = setTimeout(() => {
          timer = undefined;
          wake();
        }, Math.max(1, next - now()));
    } finally {
      pumping = false;
      finishPump();
      if (repump && enabled) {
        repump = false;
        wake();
      }
    }
  }
  const queue: ParseQueue = {
    resume() {
      const startEpoch = epoch;
      const work = async () => {
        if (disposed || c.mode === 'demo') return;
        getImportRuntime(c);
        const limitedOn = await c.repos.settings.get<string | null>(
          'parseQueue.dailyLimitDate',
          null,
        );
        if (limitedOn === c.clock.today()) return;
        if (disposed || epoch !== startEpoch) return;
        enabled = true;
        const parts = (await c.repos.parts.pending()).filter(
          p => p.stage !== 'failed',
        );
        for (const part of parts) {
          if (!enabled || disposed || epoch !== startEpoch) return;
          if (active.has(keyOf(part))) continue;
          if (['requesting', 'uploading'].includes(part.stage))
            await c.repos.parts.update(part.book_id, part.part_no, {
              stage: 'requesting',
              batch_id: null,
              data_id: null,
            });
          if (
            part.error_code === 'A0202' ||
            part.error_code === 'A0211' ||
            part.error_code === 'missing_token' ||
            part.error_code === '-60018'
          )
            await c.repos.parts.update(part.book_id, part.part_no, {
              error_code: null,
              error_msg: null,
              next_poll_at: null,
            });
          await c.repos.books.update(part.book_id, { status: 'parsing' });
        }
        await pump();
      };
      lifecycle = lifecycle.then(work, work);
      return lifecycle;
    },
    pause,
    async retry(bookId, partNo, options = {}) {
      if (disposed) return;
      const book = await c.repos.books.get(bookId);
      if (book?.format === 'epub') {
        await c.repos.settings.set(`book.epubError.${bookId}`, null);
        await c.repos.books.update(bookId, { status: 'importing' });
        await notify(bookId);
        await queue.resume();
        return;
      }
      const key = `${bookId}:${partNo}`;
      retrying.add(key);
      try {
        const worker = active.get(`${bookId}:${partNo}`);
        if (worker) {
          worker.controller.abort();
          await worker.promise;
        }
        const part = await c.repos.parts.get(bookId, partNo);
        if (!part) throw new Error('找不到这一片');
        if (options.ocr) {
          const ocrParts = await c.repos.settings.get<Record<string, boolean>>(
            `book.ocrParts.${bookId}`,
            {},
          );
          await c.repos.settings.set(`book.ocrParts.${bookId}`, {
            ...ocrParts,
            [String(partNo)]: true,
          });
        }
        await c.repos.parts.update(bookId, partNo, {
          stage: 'queued',
          batch_id: null,
          data_id: null,
          error_code: null,
          error_msg: null,
          next_poll_at: null,
        });
        await c.repos.books.update(bookId, { status: 'parsing' });
        await notify(bookId);
      } finally {
        retrying.delete(key);
      }
      await queue.resume();
    },
    async dispose() {
      disposed = true;
      pause();
      await lifecycle.catch(() => {});
      await pumpComplete;
      await Promise.all([...active.values()].map(value => value.promise));
      queues.delete(c);
    },
  };
  return queue;
}
