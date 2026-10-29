import type { BookPart, BookPartInsert, BookPartPatch } from '@core/types';
import type { Db, SqlValue } from '../db';
import { updateRow, type SqlValues } from './shared';

const columns = [
  'book_id',
  'part_no',
  'page_from',
  'page_to',
  'file_path',
  'size_bytes',
  'batch_id',
  'data_id',
  'stage',
  'extracted_pages',
  'total_pages',
  'error_code',
  'error_msg',
  'attempts',
  'next_poll_at',
  'updated_at',
];
const toRow = (part: Partial<BookPart>): SqlValues => ({
  book_id: part.book_id,
  part_no: part.part_no,
  page_from: part.page_from,
  page_to: part.page_to,
  file_path: part.file_path,
  size_bytes: part.size_bytes,
  batch_id: part.batch_id,
  data_id: part.data_id,
  stage: part.stage,
  extracted_pages: part.extracted_pages,
  total_pages: part.total_pages,
  error_code: part.error_code,
  error_msg: part.error_msg,
  attempts: part.attempts,
  next_poll_at: part.next_poll_at,
  updated_at: part.updated_at,
});

export function createPartsRepo(
  db: Db,
  now: () => string = () => new Date().toISOString(),
) {
  const get = (bookId: string, partNo: number) =>
    db.get<BookPart>('SELECT * FROM book_part WHERE book_id=? AND part_no=?', [
      bookId,
      partNo,
    ]);
  return {
    async list(bookId: string): Promise<BookPart[]> {
      return db.all<BookPart>(
        'SELECT * FROM book_part WHERE book_id=? ORDER BY part_no',
        [bookId],
      );
    },
    get,
    async upsert(part: BookPartInsert): Promise<BookPart> {
      const values = toRow({ ...part, updated_at: part.updated_at ?? now() });
      const fields = Object.keys(values).filter(
        key => values[key] !== undefined,
      );
      const mutable = fields.filter(
        key => key !== 'book_id' && key !== 'part_no',
      );
      await db.run(
        `INSERT INTO book_part (${fields.join(',')}) VALUES (${fields
          .map(() => '?')
          .join(',')}) ON CONFLICT(book_id,part_no) DO UPDATE SET ${mutable
          .map(key => `${key}=excluded.${key}`)
          .join(',')}`,
        fields.map(key => values[key] as SqlValue),
      );
      return (await get(part.book_id, part.part_no))!;
    },
    async update(
      bookId: string,
      partNo: number,
      patch: BookPartPatch,
    ): Promise<BookPart | undefined> {
      const values = toRow({ ...patch, updated_at: patch.updated_at ?? now() });
      delete values.book_id;
      delete values.part_no;
      await updateRow(db, 'book_part', columns, values, {
        book_id: bookId,
        part_no: partNo,
      });
      return get(bookId, partNo);
    },
    async pending(): Promise<BookPart[]> {
      return db.all<BookPart>(
        "SELECT * FROM book_part WHERE stage!='done' ORDER BY updated_at,book_id,part_no",
      );
    },
  };
}
