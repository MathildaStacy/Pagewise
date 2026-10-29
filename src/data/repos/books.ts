import type { Book, BookInsert, BookPatch } from '@core/types';
import type { Db } from '../db';
import {
  insertRow,
  parseJson,
  serializeJson,
  updateRow,
  type SqlValues,
} from './shared';

type BookRow = Omit<
  Book,
  'has_text_layer' | 'has_outline' | 'outline' | 'ocr'
> & {
  has_text_layer: number | null;
  has_outline: number | null;
  outline_json: string | null;
  ocr: number;
};
const columns = [
  'id',
  'sha256',
  'title',
  'author',
  'format',
  'pages',
  'size_bytes',
  'has_text_layer',
  'has_outline',
  'outline_json',
  'page_offset',
  'cover_color',
  'parse_model',
  'ocr',
  'priority_from',
  'status',
  'ready_to_page',
  'tokens_total',
  'created_at',
  'last_opened_at',
];

function fromRow(row: BookRow): Book {
  const { has_text_layer, has_outline, outline_json, ocr, ...record } = row;
  return {
    ...record,
    has_text_layer: has_text_layer === null ? null : Boolean(has_text_layer),
    has_outline: has_outline === null ? null : Boolean(has_outline),
    outline: outline_json === null ? null : parseJson(outline_json, null),
    ocr: Boolean(ocr),
  };
}

function toRow(book: Partial<Book>): SqlValues {
  return {
    id: book.id,
    sha256: book.sha256,
    title: book.title,
    author: book.author,
    format: book.format,
    pages: book.pages,
    size_bytes: book.size_bytes,
    has_text_layer:
      book.has_text_layer === undefined
        ? undefined
        : book.has_text_layer === null
        ? null
        : Number(book.has_text_layer),
    has_outline:
      book.has_outline === undefined
        ? undefined
        : book.has_outline === null
        ? null
        : Number(book.has_outline),
    outline_json:
      book.outline === undefined
        ? undefined
        : book.outline === null
        ? null
        : serializeJson(book.outline),
    page_offset: book.page_offset,
    cover_color: book.cover_color,
    parse_model: book.parse_model,
    ocr: book.ocr === undefined ? undefined : Number(book.ocr),
    priority_from: book.priority_from,
    status: book.status,
    ready_to_page: book.ready_to_page,
    tokens_total: book.tokens_total,
    created_at: book.created_at,
    last_opened_at: book.last_opened_at,
  };
}

export function createBooksRepo(
  db: Db,
  now: () => string = () => new Date().toISOString(),
) {
  const get = async (id: string): Promise<Book | undefined> => {
    const row = await db.get<BookRow>('SELECT * FROM book WHERE id=?', [id]);
    return row && fromRow(row);
  };
  return {
    async list(): Promise<Book[]> {
      return (
        await db.all<BookRow>(
          'SELECT * FROM book ORDER BY COALESCE(last_opened_at,created_at) DESC,id',
        )
      ).map(fromRow);
    },
    get,
    async bySha(sha: string): Promise<Book | undefined> {
      const row = await db.get<BookRow>('SELECT * FROM book WHERE sha256=?', [
        sha,
      ]);
      return row && fromRow(row);
    },
    async insert(book: BookInsert): Promise<Book> {
      await insertRow(
        db,
        'book',
        columns,
        toRow({ ...book, created_at: book.created_at ?? now() }),
      );
      return (await get(book.id))!;
    },
    async update(id: string, patch: BookPatch): Promise<Book | undefined> {
      const values = toRow(patch);
      delete values.id;
      await updateRow(db, 'book', columns, values, { id });
      return get(id);
    },
    async touchOpened(id: string): Promise<Book | undefined> {
      await updateRow(db, 'book', columns, { last_opened_at: now() }, { id });
      return get(id);
    },
    async remove(id: string): Promise<void> {
      await db.transaction(async tx => {
        // Several learning tables deliberately have no FK in the published schema.
        // Messages must be deleted before the detours they may reference.
        for (const table of [
          'message',
          'qa',
          'stuck',
          'section_note',
          'highlight',
          'pin',
          'card',
          'lesson_plan',
          'section_part',
          'study_state',
          'detour',
          'book_part',
          'block',
          'section',
          'ai_usage',
        ]) {
          await tx.run(`DELETE FROM ${table} WHERE book_id=?`, [id]);
        }
        await tx.run('DELETE FROM book WHERE id=?', [id]);
      });
    },
  };
}
