import type { Container } from './container';
export interface ReaderPageImage {
  uri: string;
  w: number;
  h: number;
}
export interface ReaderPdfInfo {
  pageCount: number;
  sizes: { w: number; h: number }[];
}
export interface ReaderPdfPort {
  sourcePath(bookId: string): Promise<string>;
  info(path: string): Promise<ReaderPdfInfo>;
  render(path: string, page: number, widthPx: number): Promise<ReaderPageImage>;
  close(path: string): Promise<void>;
}
export interface ReaderRuntime {
  info(bookId: string): Promise<ReaderPdfInfo>;
  render(
    bookId: string,
    page: number,
    widthPx: number,
  ): Promise<ReaderPageImage>;
  window(
    bookId: string,
    page: number,
    widthPx: number,
  ): Promise<{ page: number; image: ReaderPageImage }[]>;
  close(): Promise<void>;
}
const MAX_IMAGES = 7;
export function createReaderRuntime(port: ReaderPdfPort): ReaderRuntime {
  const sources = new Map<string, Promise<string>>();
  const infos = new Map<string, Promise<ReaderPdfInfo>>();
  const images = new Map<string, ReaderPageImage>();
  const pending = new Map<string, Promise<ReaderPageImage>>();
  const windows = new Map<string, number>();
  const source = (id: string) => {
    let value = sources.get(id);
    if (!value) {
      value = port.sourcePath(id).catch(error => {
        sources.delete(id);
        throw error;
      });
      sources.set(id, value);
    }
    return value;
  };
  const info = (id: string) => {
    let value = infos.get(id);
    if (!value) {
      value = source(id)
        .then(path => port.info(path))
        .catch(error => {
          infos.delete(id);
          throw error;
        });
      infos.set(id, value);
    }
    return value;
  };
  const render = (id: string, page: number, requested: number) => {
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isFinite(requested) ||
      requested <= 0
    )
      return Promise.reject(new Error('PDF 页码或尺寸无效'));
    const width = Math.min(1440, Math.max(1, Math.round(requested)));
    const key = JSON.stringify([id, page, width]);
    const cached = images.get(key);
    if (cached) {
      images.delete(key);
      images.set(key, cached);
      return Promise.resolve(cached);
    }
    let task = pending.get(key);
    if (!task) {
      task = (async () => {
        const metadata = await info(id);
        if (page > metadata.pageCount) throw new Error('PDF 页码超出范围');
        const image = await port.render(await source(id), page, width);
        if (!image.uri || image.w <= 0 || image.h <= 0)
          throw new Error('PDF 页面无法显示');
        images.set(key, image);
        while (images.size > MAX_IMAGES)
          images.delete(images.keys().next().value!);
        return image;
      })().finally(() => pending.delete(key));
      pending.set(key, task);
    }
    return task;
  };
  return {
    info,
    render,
    async window(id, page, width) {
      const revision = (windows.get(id) ?? 0) + 1;
      windows.set(id, revision);
      const metadata = await info(id);
      if (page < 1 || page > metadata.pageCount)
        throw new Error('PDF 页码超出范围');
      // Render the visible page first, then prefetch its nearest neighbours.
      const order = [page, page - 1, page + 1, page - 2, page + 2].filter(
        p => p >= 1 && p <= metadata.pageCount,
      );
      const result: { page: number; image: ReaderPageImage }[] = [];
      for (const p of order) {
        if (windows.get(id) !== revision) break;
        try {
          result.push({ page: p, image: await render(id, p, width) });
        } catch (error) {
          if (p === page) throw error;
        }
      }
      return result;
    },
    async close() {
      await Promise.allSettled([...pending.values()]);
      const paths = await Promise.allSettled([...sources.values()]);
      await Promise.allSettled(
        paths
          .filter(
            (p): p is PromiseFulfilledResult<string> =>
              p.status === 'fulfilled',
          )
          .map(p => port.close(p.value)),
      );
      sources.clear();
      infos.clear();
      images.clear();
    },
  };
}
const runtimes = new WeakMap<Container, ReaderRuntime>();
export function setReaderRuntime(c: Container, runtime: ReaderRuntime) {
  runtimes.set(c, runtime);
}
export async function disposeReaderRuntime(c: Container) {
  const runtime = runtimes.get(c);
  runtimes.delete(c);
  await runtime?.close();
}
export function getReaderRuntime(c: Container): ReaderRuntime {
  let runtime = runtimes.get(c);
  if (!runtime) {
    const native = () =>
      require('@platform/PdfPages') as typeof import('@platform/PdfPages');
    runtime = createReaderRuntime({
      async sourcePath(id) {
        const { bookFiles } =
          require('@platform/bookFiles') as typeof import('@platform/bookFiles');
        return `${bookFiles.documentDir}/books/${id}/source.pdf`;
      },
      async info(path) {
        return (await native()).PdfPages.info(path);
      },
      async render(path, page, width) {
        return (await native()).PdfPages.render(path, page, width);
      },
      async close(path) {
        await (await native()).PdfPages.close(path);
      },
    });
    runtimes.set(c, runtime);
  }
  return runtime;
}
