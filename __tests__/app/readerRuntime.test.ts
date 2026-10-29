import {
  createReaderRuntime,
  disposeReaderRuntime,
  getReaderRuntime,
  setReaderRuntime,
  type ReaderPdfPort,
} from '@app/readerRuntime';
import { createTestContainer } from '@app/testing';
import { PdfPages } from '@platform/PdfPages';
jest.mock('@platform/PdfPages', () => ({
  PdfPages: {
    info: jest.fn(async () => ({
      pageCount: 2,
      sizes: [
        { w: 600, h: 800 },
        { w: 600, h: 800 },
      ],
    })),
    render: jest.fn(async () => ({
      uri: 'file:///native.png',
      w: 600,
      h: 800,
    })),
    close: jest.fn(async () => {}),
  },
}));
jest.mock('@platform/bookFiles', () => ({
  bookFiles: { documentDir: '/documents' },
}));

function port(): jest.Mocked<ReaderPdfPort> {
  return {
    sourcePath: jest.fn(async (id: string) => '/books/' + id + '/source.pdf'),
    info: jest.fn(async (_path: string) => ({
      pageCount: 60,
      sizes: Array.from({ length: 60 }, () => ({ w: 600, h: 800 })),
    })),
    render: jest.fn(async (_path: string, page: number, width: number) => ({
      uri: 'file:///cache/' + page + '-' + width + '.png',
      w: width,
      h: (width / 3) * 4,
    })),
    close: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
  };
}
it('merges repeated renders, bounds raster width and keeps a seven-page LRU', async () => {
  const io = port(),
    runtime = createReaderRuntime(io);
  const same = await Promise.all([
    runtime.render('b', 3, 5000),
    runtime.render('b', 3, 5000),
  ]);
  expect(same[0]).toEqual(same[1]);
  expect(io.render).toHaveBeenCalledTimes(1);
  await runtime.render('b', 3, 5000);
  expect(io.render).toHaveBeenCalledTimes(1);
  expect(io.render).toHaveBeenCalledWith('/books/b/source.pdf', 3, 1440);
  for (let p = 4; p <= 10; p++) await runtime.render('b', p, 1440);
  await runtime.render('b', 3, 1440);
  expect(io.render).toHaveBeenCalledTimes(9);
  expect(io.info).toHaveBeenCalledTimes(1);
  await runtime.close();
  expect(io.close).toHaveBeenCalledWith('/books/b/source.pdf');
});
it('renders the visible page first and prefetches exactly its nearest two neighbours', async () => {
  const io = port(),
    runtime = createReaderRuntime(io);
  const result = await runtime.window('b', 30, 1080);
  expect(result.map(p => p.page)).toEqual([30, 29, 31, 28, 32]);
  expect(io.render.mock.calls.map(c => c[1])).toEqual([30, 29, 31, 28, 32]);
  expect((await runtime.window('b', 1, 1080)).map(p => p.page)).toEqual([
    1, 2, 3,
  ]);
  expect((await runtime.window('b', 60, 1080)).map(p => p.page)).toEqual([
    60, 59, 58,
  ]);
});
it('does not prefetch an obsolete scroll window after a newer viewport arrives', async () => {
  const io = port();
  let finish!: () => void;
  let began!: () => void;
  const started = new Promise<void>(resolve => {
    began = resolve;
  });
  io.render.mockImplementationOnce(async (_path, _page, width) => {
    await new Promise<void>(resolve => {
      finish = resolve;
      began();
    });
    return { uri: 'file:///1.png', w: width, h: width };
  });
  const runtime = createReaderRuntime(io);
  const old = runtime.window('b', 1, 600);
  await started;
  const current = runtime.window('b', 20, 600);
  await current;
  finish();
  await old;
  expect(io.render.mock.calls.map(c => c[1])).not.toContain(2);
});
it('keeps foreground errors visible, tolerates neighbour errors and allows retry', async () => {
  const io = port(),
    runtime = createReaderRuntime(io);
  io.render.mockRejectedValueOnce(new Error('render failed'));
  await expect(runtime.window('b', 4, 600)).rejects.toThrow('render failed');
  io.render.mockImplementation(async (_path, page, width) => {
    if (page === 3) throw new Error('bad neighbour');
    return { uri: 'file:///' + page, w: width, h: width };
  });
  expect((await runtime.window('b', 4, 600)).map(p => p.page)).toEqual([
    4, 5, 2, 6,
  ]);
  await expect(runtime.render('b', 61, 600)).rejects.toThrow('超出范围');
  await expect(runtime.render('b', 1, 0)).rejects.toThrow('尺寸');
});
it('injects a runtime per container and disposes its native source handles', async () => {
  const c = await createTestContainer();
  const io = port(),
    runtime = createReaderRuntime(io);
  setReaderRuntime(c, runtime);
  expect(getReaderRuntime(c)).toBe(runtime);
  await runtime.render('b', 1, 400);
  await disposeReaderRuntime(c);
  expect(io.close).toHaveBeenCalledTimes(1);
  await disposeReaderRuntime(c);
  await c.close();
});

it('retries metadata/source failures and rejects invalid render output', async () => {
  const io = port(),
    runtime = createReaderRuntime(io);
  io.sourcePath.mockRejectedValueOnce(
    new Error('source temporarily unavailable'),
  );
  await expect(runtime.info('b')).rejects.toThrow(
    'source temporarily unavailable',
  );
  expect((await runtime.info('b')).pageCount).toBe(60);
  io.render.mockResolvedValueOnce({ uri: '', w: 0, h: 0 });
  await expect(runtime.render('b', 1, 400)).rejects.toThrow('无法显示');
  expect((await runtime.render('b', 1, 400)).uri).toContain('/cache/');
});
it('binds the default native renderer through app composition and the imported book source path', async () => {
  const c = await createTestContainer();
  const runtime = getReaderRuntime(c);
  expect(getReaderRuntime(c)).toBe(runtime);
  expect((await runtime.info('imported')).pageCount).toBe(2);
  expect((await runtime.render('imported', 1, 600)).uri).toBe(
    'file:///native.png',
  );
  expect(PdfPages.render).toHaveBeenCalledWith(
    '/documents/books/imported/source.pdf',
    1,
    600,
  );
  await disposeReaderRuntime(c);
  expect(PdfPages.close).toHaveBeenCalledWith(
    '/documents/books/imported/source.pdf',
  );
  await c.close();
});
