import type { Block, BlockInsert, BlockSearchHit } from '@core/types';
import type { Db, SqlValue } from '../db';

const columns = [
  'id',
  'book_id',
  'seq',
  'page',
  'loc',
  'x0',
  'y0',
  'x1',
  'y1',
  'type',
  'level',
  'text',
  'latex',
  'html',
  'image_path',
  'section_id',
  'chars',
];
const values = (
  bookId: string,
  block: Omit<BlockInsert, 'book_id'>,
): SqlValue[] => [
  block.id ?? null,
  bookId,
  block.seq,
  block.page ?? null,
  block.loc ?? null,
  block.x0 ?? null,
  block.y0 ?? null,
  block.x1 ?? null,
  block.y1 ?? null,
  block.type,
  block.level ?? null,
  block.text ?? '',
  block.latex ?? null,
  block.html ?? null,
  block.image_path ?? null,
  block.section_id ?? null,
  block.chars,
];

/** The query is a literal phrase, never an FTS expression or LIKE wildcard. */
function snippet(text: string, query: string): string {
  const chars = Array.from(text);
  const lower = chars.map(char => char.toLocaleLowerCase());
  const wanted = Array.from(query.toLocaleLowerCase());
  let found = -1;
  for (let index = 0; index <= lower.length - wanted.length; index++) {
    if (wanted.every((char, offset) => lower[index + offset] === char)) {
      found = index;
      break;
    }
  }
  if (found < 0) {
    return chars.slice(0, 48).join('');
  }
  const start = Math.max(0, found - 18);
  const end = Math.min(chars.length, found + wanted.length + 30);
  return `${start ? '…' : ''}${chars.slice(start, end).join('')}${
    end < chars.length ? '…' : ''
  }`;
}

export function createBlocksRepo(db: Db) {
  return {
    async insertMany(
      bookId: string,
      blocks: Omit<BlockInsert, 'book_id'>[],
    ): Promise<void> {
      await db.transaction(async tx => {
        for (let start = 0; start < blocks.length; start += 1000) {
          for (const block of blocks.slice(start, start + 1000)) {
            await tx.run(
              `INSERT INTO block (${columns.join(',')}) VALUES (${columns
                .map(() => '?')
                .join(',')})`,
              values(bookId, block),
            );
          }
        }
      });
    },
    async range(bookId: string, from: number, to: number): Promise<Block[]> {
      return db.all<Block>(
        'SELECT * FROM block WHERE book_id=? AND seq BETWEEN ? AND ? ORDER BY seq',
        [bookId, from, to],
      );
    },
    async byPage(bookId: string, page: number): Promise<Block[]> {
      return db.all<Block>(
        'SELECT * FROM block WHERE book_id=? AND page=? ORDER BY seq',
        [bookId, page],
      );
    },
    async bySection(bookId: string, sectionId: string): Promise<Block[]> {
      return db.all<Block>(
        'SELECT * FROM block WHERE book_id=? AND section_id=? ORDER BY seq',
        [bookId, sectionId],
      );
    },
    async get(bookId: string, seq: number): Promise<Block | undefined> {
      return db.get<Block>('SELECT * FROM block WHERE book_id=? AND seq=?', [
        bookId,
        seq,
      ]);
    },
    async deleteByPages(
      bookId: string,
      from: number,
      to: number,
    ): Promise<void> {
      await db.run(
        'DELETE FROM block WHERE book_id=? AND page BETWEEN ? AND ?',
        [bookId, from, to],
      );
    },
    async search(
      bookId: string,
      query: string,
      limit = 8,
    ): Promise<BlockSearchHit[]> {
      const q = query.replace(/\s/gu, '');
      const count = Math.max(0, Math.floor(limit));
      if (!q || count === 0) {
        return [];
      }
      const rows =
        Array.from(q).length >= 3
          ? await db.all<Block>(
              'SELECT b.* FROM block_fts JOIN block b ON b.id=block_fts.rowid WHERE block_fts MATCH ? AND block_fts.book_id=? ORDER BY rank,b.seq LIMIT ?',
              [`"${q.replace(/"/g, '""')}"`, bookId, count],
            )
          : await db.all<Block>(
              "SELECT * FROM block WHERE book_id=? AND text LIKE ? ESCAPE '\\' ORDER BY seq LIMIT ?",
              [bookId, `%${q.replace(/[\\%_]/g, '\\$&')}%`, count],
            );
      return rows.map(block => ({
        book_id: block.book_id,
        seq: block.seq,
        ref: `b${block.seq}`,
        page: block.page,
        loc: block.loc,
        section_id: block.section_id,
        text: block.text,
        snippet: snippet(
          block.latex ? `${block.text} ${block.latex}` : block.text,
          q,
        ),
      }));
    },
    async clearParsed(bookId: string): Promise<void> {
      await db.transaction(async tx => {
        await tx.run('DELETE FROM block WHERE book_id=?', [bookId]);
        await tx.run('DELETE FROM section_part WHERE book_id=?', [bookId]);
        await tx.run('DELETE FROM lesson_plan WHERE book_id=?', [bookId]);
      });
    },
  };
}
