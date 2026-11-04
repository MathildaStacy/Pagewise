import type { Block, BlockInsert, BlockSearchHit } from '@core/types';
import type { Db, SqlValue } from '../db';
import { createRefinementsRepo } from './refinements';

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

/**
 * Whitespace separates literal terms; a single Han character joins its neighbour,
 * so OCR-style spacing such as "启 发" still reads as one word.
 */
export function searchTerms(query: string): string[] {
  const terms: string[] = [];
  let previous = '';
  for (const part of query.trim().split(/\s+/u).filter(Boolean)) {
    const last = terms.at(-1);
    if (
      last &&
      /\p{Script=Han}$/u.test(last) &&
      /^\p{Script=Han}/u.test(part) &&
      (Array.from(part).length === 1 || Array.from(previous).length === 1)
    )
      terms[terms.length - 1] = last + part;
    else terms.push(part);
    previous = part;
  }
  return [...new Set(terms)].slice(0, 6);
}
function occurrences(text: string, term: string): number {
  let count = 0;
  for (let at = text.indexOf(term); at >= 0; at = text.indexOf(term, at + 1))
    count++;
  return count;
}

/** Each term is a literal phrase, never an FTS expression or LIKE wildcard. */
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
  const project = createRefinementsRepo(db).project;
  return {
    /** Reading projections never replace the source rows used by PDF geometry, highlights and reparsing. */
    reading: {
      async bySection(bookId: string, sectionId: string): Promise<Block[]> {
        return project(
          await db.all<Block>(
            'SELECT * FROM block WHERE book_id=? AND section_id=? ORDER BY seq',
            [bookId, sectionId],
          ),
        );
      },
      async range(bookId: string, from: number, to: number): Promise<Block[]> {
        return project(
          await db.all<Block>(
            'SELECT * FROM block WHERE book_id=? AND seq BETWEEN ? AND ? ORDER BY seq',
            [bookId, from, to],
          ),
        );
      },
      async get(bookId: string, seq: number): Promise<Block | undefined> {
        const row = await db.get<Block>(
          'SELECT * FROM block WHERE book_id=? AND seq=?',
          [bookId, seq],
        );
        return row ? (await project([row]))[0] : undefined;
      },
    },
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
    /**
     * Blocks matching more of the terms rank first, then by occurrences; headings get a small boost.
     * `within` limits results to a section and its descendants.
     */
    async search(
      bookId: string,
      query: string,
      limit = 8,
      options: { within?: string } = {},
    ): Promise<BlockSearchHit[]> {
      const terms = searchTerms(query);
      const count = Math.max(0, Math.floor(limit));
      if (!terms.length || count === 0) {
        return [];
      }
      const scope = options.within
        ? {
            sql: ' AND b.section_id IN (WITH RECURSIVE sub(id) AS (SELECT id FROM section WHERE book_id=? AND id=? UNION SELECT s.id FROM section s JOIN sub ON s.parent_id=sub.id WHERE s.book_id=?) SELECT id FROM sub)',
            args: [bookId, options.within, bookId],
          }
        : { sql: '', args: [] };
      const pool = Math.max(50, count * 5);
      const found = new Map<number, { block: Block; terms: string[] }>();
      for (const term of terms) {
        const rows =
          Array.from(term).length >= 3
            ? await db.all<Block>(
                `SELECT b.* FROM block_fts JOIN block b ON b.id=block_fts.rowid WHERE block_fts MATCH ? AND block_fts.book_id=?${scope.sql} ORDER BY rank,b.seq LIMIT ?`,
                [`"${term.replace(/"/g, '""')}"`, bookId, ...scope.args, pool],
              )
            : await db.all<Block>(
                `SELECT b.* FROM block b WHERE b.book_id=? AND b.text LIKE ? ESCAPE '\\'${scope.sql} ORDER BY (length(b.text)-length(replace(lower(b.text),lower(?),'')))/length(?) DESC,b.seq LIMIT ?`,
                [
                  bookId,
                  `%${term.replace(/[\\%_]/g, '\\$&')}%`,
                  ...scope.args,
                  term,
                  term,
                  pool,
                ],
              );
        for (const block of rows) {
          const match = found.get(block.seq) ?? { block, terms: [] };
          match.terms.push(term);
          found.set(block.seq, match);
        }
      }
      const needed = Math.max(1, Math.ceil(terms.length / 2));
      const scored = [...found.values()]
        .filter(match => match.terms.length >= needed)
        .map(match => {
          const text = `${match.block.text} ${
            match.block.latex ?? ''
          }`.toLocaleLowerCase();
          const hits = match.terms.reduce(
            (sum, term) =>
              sum + Math.min(5, occurrences(text, term.toLocaleLowerCase())),
            0,
          );
          return {
            ...match,
            score:
              match.terms.length * 100 +
              hits +
              (match.block.type === 'title' ? 10 : 0),
          };
        })
        .sort((a, b) => b.score - a.score || a.block.seq - b.block.seq);
      return scored.slice(0, count).map(({ block, terms: matched }) => ({
        book_id: block.book_id,
        seq: block.seq,
        ref: `b${block.seq}`,
        page: block.page,
        loc: block.loc,
        section_id: block.section_id,
        text: block.text,
        snippet: snippet(
          block.latex ? `${block.text} ${block.latex}` : block.text,
          matched[0],
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
