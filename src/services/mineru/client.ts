import {
  MINERU_API_BASE,
  MineruError,
  type MineruClient,
  type MineruFilesPort,
  type MineruRequest,
  type MineruResult,
  type MineruState,
} from './types';
export { MineruError } from './types';

interface ClientOptions {
  getToken(): Promise<string | null>;
  files: MineruFilesPort;
  request?: MineruRequest;
  baseUrl?: string;
  timeoutMs?: number;
  transferTimeoutMs?: number;
  now?(): number;
}
const defaultRequest: MineruRequest = (url, init) => fetch(url, init);
const states = new Set<MineruState>([
  'waiting-file',
  'pending',
  'running',
  'converting',
  'done',
  'failed',
]);
type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
const text = (value: unknown) => (typeof value === 'string' ? value : '');
const natural = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : undefined;
const httpError = (status: number) =>
  new MineruError(
    status === 401 || status === 403
      ? 'A0202'
      : status === 408 || status === 504
      ? 'timeout'
      : 'http_' + status,
    status,
  );

async function cancellable<T>(
  signal: AbortSignal | undefined,
  timeout: number,
  task: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (signal?.aborted) throw new MineruError('cancelled');
  const controller = new AbortController();
  let timedOut = false;
  const stop = () => controller.abort();
  signal?.addEventListener('abort', stop);
  const timer = setTimeout(() => {
    timedOut = true;
    stop();
  }, timeout);
  let rejectAbort: () => void = () => {};
  const interrupted = new Promise<never>((_resolve, reject) => {
    rejectAbort = () =>
      reject(new MineruError(timedOut ? 'timeout' : 'cancelled'));
    controller.signal.addEventListener('abort', rejectAbort);
  });
  try {
    return await Promise.race([task(controller.signal), interrupted]);
  } catch (error) {
    if (controller.signal.aborted)
      throw new MineruError(timedOut ? 'timeout' : 'cancelled');
    if (error instanceof MineruError) throw error;
    throw new MineruError('network');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', stop);
    controller.signal.removeEventListener('abort', rejectAbort);
  }
}
function readResult(value: unknown): MineruResult {
  const row = object(value);
  if (
    !row ||
    !states.has(row.state as MineruState) ||
    !text(row.file_name) ||
    (row.state === 'done' && !text(row.full_zip_url))
  )
    throw new MineruError('protocol');
  const progress = object(row.extract_progress);
  const extractedPages = natural(progress?.extracted_pages);
  const totalPages = natural(progress?.total_pages);
  const code = row.err_code ?? row.code;
  const knownCode = /(?:A0202|A0211|-600\d{2}|-10001)/.exec(
    text(row.err_msg),
  )?.[0];
  return {
    fileName: text(row.file_name),
    ...(text(row.data_id) ? { dataId: text(row.data_id) } : {}),
    state: row.state as MineruState,
    ...(extractedPages !== undefined && totalPages !== undefined
      ? { progress: { extractedPages, totalPages } }
      : {}),
    ...(text(row.full_zip_url) ? { zipUrl: text(row.full_zip_url) } : {}),
    ...(row.state === 'failed'
      ? {
          error: new MineruError(
            code != null && String(code) !== '0'
              ? String(code)
              : knownCode ?? '-60010',
          ),
        }
      : {}),
  };
}

export function createMineruClient(options: ClientOptions): MineruClient {
  const request = options.request ?? defaultRequest;
  const base = (options.baseUrl ?? MINERU_API_BASE).replace(/\/+$/, '');
  const now = options.now ?? Date.now;
  async function api(
    path: string,
    method: 'GET' | 'POST',
    payload: unknown,
    signal?: AbortSignal,
  ): Promise<JsonObject> {
    return cancellable(signal, options.timeoutMs ?? 45_000, async active => {
      // Only this invocation owns the token; subsequent requests read KeyStore again.
      const token = (await options.getToken())?.trim();
      if (active.aborted) throw new MineruError('cancelled');
      if (!token) throw new MineruError('missing_token');
      const response = await request(base + path, {
        method,
        signal: active,
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        ...(method === 'POST' ? { body: JSON.stringify(payload) } : {}),
      });
      let json: JsonObject | null;
      try {
        json = object(JSON.parse(await response.text()));
      } catch {
        json = null;
      }
      if (json?.code != null && String(json.code) !== '0')
        throw new MineruError(String(json.code), response.status);
      if (response.status < 200 || response.status >= 300)
        throw httpError(response.status);
      if (!json || json.code == null || !object(json.data))
        throw new MineruError('protocol');
      return object(json.data)!;
    });
  }
  return {
    async requestUpload(files, model, opts = {}) {
      if (
        !files.length ||
        files.length > 50 ||
        files.some(f => !f.name.trim() || !f.dataId.trim()) ||
        (model !== 'vlm' && model !== 'pipeline')
      )
        throw new MineruError('protocol');
      const data = await api(
        '/file-urls/batch',
        'POST',
        {
          files: files.map(f => ({
            name: f.name,
            data_id: f.dataId,
            is_ocr: f.ocr,
          })),
          model_version: model,
          enable_formula: true,
          enable_table: true,
          language: 'ch',
        },
        opts.signal,
      );
      if (
        !text(data.batch_id) ||
        !Array.isArray(data.file_urls) ||
        data.file_urls.length !== files.length ||
        data.file_urls.some(url => !text(url))
      )
        throw new MineruError('protocol');
      return { batchId: text(data.batch_id), urls: data.file_urls as string[] };
    },
    async upload(url, filePath, onProgress, signal) {
      await cancellable(
        signal,
        options.transferTimeoutMs ?? 600_000,
        async active => {
          const response = await options.files.put(url, filePath, {
            headers: {},
            signal: active,
            onProgress,
          });
          if (response.status < 200 || response.status >= 300)
            throw httpError(response.status);
        },
      );
    },
    async query(batchId, opts = {}) {
      if (!batchId.trim()) throw new MineruError('protocol');
      const data = await api(
        '/extract-results/batch/' + encodeURIComponent(batchId),
        'GET',
        undefined,
        opts.signal,
      );
      if (!Array.isArray(data.extract_result))
        throw new MineruError('protocol');
      return data.extract_result.map(readResult);
    },
    async download(zipUrl, destDir, onProgress, opts = {}) {
      const zipPath = destDir.replace(/\/+$/, '') + '.zip';
      try {
        await cancellable(
          opts.signal,
          options.transferTimeoutMs ?? 600_000,
          async active => {
            await options.files.mkdir(destDir);
            if (active.aborted) throw new MineruError('cancelled');
            const response = await options.files.download(zipUrl, zipPath, {
              headers: {},
              signal: active,
              onProgress,
            });
            if (response.status < 200 || response.status >= 300)
              throw httpError(response.status);
            try {
              await options.files.unzip(zipPath, destDir, active);
            } catch (error) {
              if (active.aborted) throw error;
              throw new MineruError('protocol');
            }
          },
        );
        return destDir;
      } finally {
        // The downloaded archive is temporary, the unpacked result is retained for import.
        await options.files.remove(zipPath).catch(() => {});
      }
    },
    async test(opts = {}) {
      const start = now();
      try {
        await api(
          '/extract-results/batch/00000000-0000-4000-8000-000000000000',
          'GET',
          undefined,
          opts.signal,
        );
        return { ok: true, latencyMs: Math.max(0, now() - start) };
      } catch (error) {
        const failure =
          error instanceof MineruError ? error : new MineruError('network');
        // Verified against the official API: an authenticated missing-batch query
        // returns HTTP 200 / -60012 / "task not found or expire".
        if (failure.code === '-60012' && failure.status === 200)
          return { ok: true, latencyMs: Math.max(0, now() - start) };
        return {
          ok: false,
          latencyMs: Math.max(0, now() - start),
          error: failure,
        };
      }
    },
  };
}
