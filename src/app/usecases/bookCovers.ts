import type { Book } from '@core/types';
import type { Container } from '../container';
import {
  bookDirectory,
  getImportRuntime,
  sourcePath,
  type ImportRuntime,
} from './importRuntime';

export type BookWithCover = Book & { coverUri?: string };

const pending = new WeakMap<
  Container,
  Map<string, Promise<string | undefined>>
>();

async function pdfCover(c: Container, book: Book): Promise<string | undefined> {
  let runtime: ImportRuntime;
  try {
    runtime = getImportRuntime(c);
  } catch {
    return undefined;
  }
  const { files, pdf } = runtime;
  const cover = `${bookDirectory(runtime, book.id)}/cover.png`;
  const source = sourcePath(runtime, book.id);
  try {
    if (!(await files.exists(cover))) {
      if (!(await files.exists(source))) return undefined;
      try {
        const image = await pdf.render(source, 1, 360);
        // Native page renders live in a disposable cache; the cover belongs to the book.
        await files.copy(
          decodeURIComponent(image.uri.replace(/^file:\/\//, '')),
          cover,
        );
      } finally {
        await pdf.close(source);
      }
    }
    return `file://${cover}`;
  } catch {
    c.log.warn('PDF 封面生成失败', { bookId: book.id });
    return undefined;
  }
}

/** Existing imports acquire a cover on first display without reparsing or uploading. */
export async function withBookCover(
  c: Container,
  book: Book,
): Promise<BookWithCover> {
  if (book.format !== 'pdf' || c.mode === 'demo') return book;
  const books =
    pending.get(c) ?? new Map<string, Promise<string | undefined>>();
  pending.set(c, books);
  let task = books.get(book.id);
  if (!task) {
    task = pdfCover(c, book).finally(() => books.delete(book.id));
    books.set(book.id, task);
  }
  const coverUri = await task;
  return coverUri ? { ...book, coverUri } : book;
}
