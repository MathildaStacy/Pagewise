import { createMineruClient } from '@services/mineru/client';
import {
  MineruError,
  type MineruFilesPort,
  type MineruRequest,
} from '@services/mineru/types';

const response = (
  data: unknown = {},
  code: string | number = 0,
  status = 200,
) => ({
  status,
  text: async () =>
    JSON.stringify({ code, msg: 'echoed token must never escape', data }),
});
const requestMock = (fn: MineruRequest) =>
  jest.fn<ReturnType<MineruRequest>, Parameters<MineruRequest>>(fn);
function filesPort(): jest.Mocked<MineruFilesPort> {
  return {
    put: jest.fn(async (_url, _path, opts) => {
      opts.onProgress(25, 100);
      opts.onProgress(100, 100);
      return { status: 200 };
    }),
    download: jest.fn(async (_url, _path, opts) => {
      opts.onProgress(100, 100);
      return { status: 200 };
    }),
    unzip: jest
      .fn<Promise<void>, Parameters<MineruFilesPort['unzip']>>()
      .mockResolvedValue(undefined),
    mkdir: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
    remove: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
  };
}
const file = { name: 'part.pdf', dataId: 'book:1', ocr: true };

it('uses the official payload and reads KeyStore again for every API call', async () => {
  let token = 'fixture-first-token';
  const getToken = jest.fn(async () => token);
  const request = requestMock(async url =>
    url.endsWith('/file-urls/batch')
      ? response({
          batch_id: 'batch-1',
          file_urls: ['https://upload.example.test/1'],
        })
      : response({ extract_result: [] }),
  );
  const c = createMineruClient({ getToken, files: filesPort(), request });
  expect(await c.requestUpload([file], 'vlm')).toEqual({
    batchId: 'batch-1',
    urls: ['https://upload.example.test/1'],
  });
  expect(JSON.parse(request.mock.calls[0][1].body!)).toEqual({
    files: [{ name: 'part.pdf', data_id: 'book:1', is_ocr: true }],
    model_version: 'vlm',
    enable_formula: true,
    enable_table: true,
    language: 'ch',
  });
  expect(request.mock.calls[0][1].headers.Authorization).toBe(
    'Bearer fixture-first-token',
  );
  token = 'fixture-updated-token';
  await c.query('batch /1');
  expect(getToken).toHaveBeenCalledTimes(2);
  expect(request.mock.calls[1][0]).toBe(
    'https://mineru.net/api/v4/extract-results/batch/batch%20%2F1',
  );
  expect(request.mock.calls[1][1].headers.Authorization).toBe(
    'Bearer fixture-updated-token',
  );
  expect(request.mock.calls[1][1].body).toBeUndefined();
});

it('streams a local file to the signed URL without Content-Type or Authorization', async () => {
  const files = filesPort();
  const getToken = jest.fn(async () => 'fixture-unused');
  const progress = jest.fn();
  const c = createMineruClient({ files, getToken });
  await c.upload(
    'https://signed.example.test/upload',
    '/tmp/part.pdf',
    progress,
    new AbortController().signal,
  );
  expect(files.put).toHaveBeenCalledWith(
    'https://signed.example.test/upload',
    '/tmp/part.pdf',
    expect.objectContaining({ headers: {}, onProgress: progress }),
  );
  expect(progress).toHaveBeenLastCalledWith(100, 100);
  expect(getToken).not.toHaveBeenCalled();
});

it('normalizes parsing states, page progress and failed error codes', async () => {
  const request = requestMock(async () =>
    response({
      extract_result: [
        ...['waiting-file', 'pending', 'running', 'converting'].map(state => ({
          file_name: state + '.pdf',
          state,
          data_id: 'id-' + state,
          extract_progress: { extracted_pages: 3, total_pages: 8 },
        })),
        {
          file_name: 'done.pdf',
          state: 'done',
          full_zip_url: 'https://results.example.test/full.zip',
        },
        {
          file_name: 'failed.pdf',
          state: 'failed',
          err_code: -60005,
          err_msg: 'too large fixture-secret',
        },
        {
          file_name: 'failed2.pdf',
          state: 'failed',
          err_msg: 'A0211 expired fixture-secret',
        },
      ],
    }),
  );
  const c = createMineruClient({
    getToken: async () => 'fixture-secret',
    files: filesPort(),
    request,
  });
  const result = await c.query('b');
  expect(result.slice(0, 4).map(r => r.state)).toEqual([
    'waiting-file',
    'pending',
    'running',
    'converting',
  ]);
  expect(result[2]).toMatchObject({
    dataId: 'id-running',
    progress: { extractedPages: 3, totalPages: 8 },
  });
  expect(result[4].zipUrl).toContain('full.zip');
  expect(result[5].error).toMatchObject({ code: '-60005', kind: 'too_large' });
  expect(result[6].error).toMatchObject({ code: 'A0211', kind: 'auth' });
  expect(String(result[5].error)).not.toContain('fixture-secret');
});

it.each([
  ['A0202', 'auth'],
  ['A0211', 'auth'],
  ['-60005', 'too_large'],
  ['-60006', 'too_large'],
  ['-60009', 'queue_full'],
  ['-60018', 'daily_limit'],
  ...['-60002', '-60003', '-60004', '-60011', '-60015', '-60020', '-60021'].map(
    code => [code, 'invalid_file'],
  ),
  ...['-60007', '-60008', '-60010', '-10001'].map(code => [code, 'service']),
])(
  'preserves official code %s and maps queue policy %s',
  async (code, kind) => {
    const c = createMineruClient({
      getToken: async () => 'fixture-secret',
      files: filesPort(),
      request: async () => response({}, code),
    });
    await expect(c.query('batch')).rejects.toMatchObject({ code, kind });
  },
);

it('blocks a missing token before network IO and keeps network errors secret-free', async () => {
  const request = requestMock(async () => {
    throw new Error('fixture-private-token');
  });
  const c = createMineruClient({
    getToken: async () => null,
    files: filesPort(),
    request,
  });
  await expect(c.query('batch')).rejects.toMatchObject({
    code: 'missing_token',
    kind: 'auth',
  });
  expect(request).not.toHaveBeenCalled();
  const second = createMineruClient({
    getToken: async () => 'fixture-private-token',
    files: filesPort(),
    request,
  });
  await expect(second.query('batch')).rejects.toEqual(
    new MineruError('network'),
  );
});

it('distinguishes HTTP auth errors, malformed results and invalid upload batches', async () => {
  const request = requestMock(async () => ({
    status: 401,
    text: async () => '<html>fixture-private-token</html>',
  }));
  const c = createMineruClient({
    getToken: async () => 'fixture-private-token',
    files: filesPort(),
    request,
  });
  await expect(c.query('batch')).rejects.toMatchObject({
    code: 'A0202',
    status: 401,
  });
  request.mockResolvedValue(
    response({
      extract_result: [{ state: 'done', file_name: 'missing-url.pdf' }],
    }),
  );
  await expect(c.query('batch')).rejects.toMatchObject({ code: 'protocol' });
  request.mockResolvedValue(response({ batch_id: 'b', file_urls: [] }));
  await expect(c.requestUpload([file], 'pipeline')).rejects.toMatchObject({
    code: 'protocol',
  });
  request.mockClear();
  await expect(c.requestUpload([], 'pipeline')).rejects.toMatchObject({
    code: 'protocol',
  });
  await expect(
    c.requestUpload(
      Array.from({ length: 51 }, () => file),
      'pipeline',
    ),
  ).rejects.toMatchObject({ code: 'protocol' });
  expect(request).not.toHaveBeenCalled();
});

it('downloads, unpacks and removes the temporary zip using signed requests', async () => {
  const files = filesPort();
  const c = createMineruClient({ getToken: async () => null, files });
  const progress = jest.fn();
  expect(
    await c.download(
      'https://results.example.test/zip',
      '/result/book/part',
      progress,
    ),
  ).toBe('/result/book/part');
  expect(files.mkdir).toHaveBeenCalledWith('/result/book/part');
  expect(files.download).toHaveBeenCalledWith(
    'https://results.example.test/zip',
    '/result/book/part.zip',
    expect.objectContaining({ headers: {}, onProgress: progress }),
  );
  expect(files.unzip).toHaveBeenCalledWith(
    '/result/book/part.zip',
    '/result/book/part',
    expect.anything(),
  );
  expect(files.remove).toHaveBeenCalledWith('/result/book/part.zip');
});

it('cleans the temporary archive after HTTP and unzip failures', async () => {
  const files = filesPort();
  const c = createMineruClient({ getToken: async () => null, files });
  files.download.mockResolvedValueOnce({ status: 503 });
  await expect(
    c.download('https://result', '/r', () => {}),
  ).rejects.toMatchObject({ kind: 'service' });
  expect(files.unzip).not.toHaveBeenCalled();
  expect(files.remove).toHaveBeenCalledWith('/r.zip');
  files.unzip.mockRejectedValueOnce(new Error('bad zip'));
  await expect(
    c.download('https://result', '/r', () => {}),
  ).rejects.toMatchObject({ code: 'protocol' });
  expect(files.remove).toHaveBeenCalledTimes(2);
});

it('cancels before API/transfer IO and aborts an in-flight transfer', async () => {
  const files = filesPort();
  const request = requestMock(async () => response({}));
  const c = createMineruClient({
    getToken: async () => 'fixture',
    files,
    request,
  });
  const stopped = new AbortController();
  stopped.abort();
  await expect(c.query('b', { signal: stopped.signal })).rejects.toMatchObject({
    code: 'cancelled',
  });
  await expect(
    c.upload('u', 'p', () => {}, stopped.signal),
  ).rejects.toMatchObject({ code: 'cancelled' });
  expect(request).not.toHaveBeenCalled();
  expect(files.put).not.toHaveBeenCalled();
  let ready!: () => void;
  const started = new Promise<void>(resolve => {
    ready = resolve;
  });
  files.put.mockImplementation(
    async (_u, _p, opts) =>
      new Promise((_resolve, reject) => {
        opts.signal.addEventListener('abort', () =>
          reject(new Error('stopped')),
        );
        ready();
      }),
  );
  const active = new AbortController();
  const pending = c.upload('u', 'p', () => {}, active.signal);
  await started;
  active.abort();
  await expect(pending).rejects.toMatchObject({ code: 'cancelled' });
});

it('enforces a timeout even if the transport never completes', async () => {
  jest.useFakeTimers();
  try {
    const request = requestMock(async () => new Promise(() => {}));
    const c = createMineruClient({
      getToken: async () => 'fixture',
      files: filesPort(),
      request,
      timeoutMs: 100,
    });
    const pending = c.query('b').catch(error => error);
    await jest.advanceTimersByTimeAsync(100);
    expect(await pending).toMatchObject({ code: 'timeout' });
  } finally {
    jest.useRealTimers();
  }
});

it('tests authentication with the verified missing-batch code and rejects service failures', async () => {
  let clock = 10;
  const request = requestMock(async () => {
    clock += 182;
    return response({}, -60012);
  });
  const c = createMineruClient({
    getToken: async () => 'fixture',
    files: filesPort(),
    request,
    now: () => clock,
  });
  expect(await c.test()).toEqual({ ok: true, latencyMs: 182 });
  expect(request.mock.calls[0][0]).toContain(
    '00000000-0000-4000-8000-000000000000',
  );
  request.mockResolvedValue(response({}, 'A0211'));
  expect(await c.test()).toMatchObject({
    ok: false,
    error: { code: 'A0211', kind: 'auth' },
  });
  request.mockResolvedValue(response({}, -60012, 503));
  expect(await c.test()).toMatchObject({ ok: false });
  request.mockResolvedValue({ status: 200, text: async () => 'not json' });
  expect(await c.test()).toMatchObject({
    ok: false,
    error: { code: 'protocol' },
  });
});
