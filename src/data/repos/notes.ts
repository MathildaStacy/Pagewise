import type {
  Highlight,
  HighlightInsert,
  Pin,
  PinInsert,
  Qa,
  QaInsert,
  SectionNote,
  Stuck,
  StuckInsert,
} from '@core/types';
import type { Db, SqlValue } from '../db';
import { insertRow, parseJson, serializeJson } from './shared';

type QaRow = Omit<Qa, 'message_ids'> & { message_ids_json: string };
type PinRow = Omit<Pin, 'message_ids'> & { message_ids_json: string };
function decodeQa(row: QaRow): Qa {
  const { message_ids_json, ...value } = row;
  return { ...value, message_ids: parseJson<number[]>(message_ids_json, []) };
}
function decodePin(row: PinRow): Pin {
  const { message_ids_json, ...value } = row;
  return { ...value, message_ids: parseJson<number[]>(message_ids_json, []) };
}
const qaColumns = [
  'id',
  'book_id',
  'section_id',
  'q',
  'a',
  'from_section',
  'detour_id',
  'message_ids_json',
  'created_at',
] as const;
const stuckColumns = [
  'id',
  'book_id',
  'section_id',
  'text',
  'source',
  'card_id',
  'resolved_at',
  'created_at',
] as const;
const highlightColumns = [
  'id',
  'book_id',
  'block_seq',
  'start',
  'end',
  'color',
  'note',
  'created_at',
] as const;
const pinColumns = [
  'id',
  'book_id',
  'block_seq',
  'section_id',
  'question',
  'answer_summary',
  'message_ids_json',
  'created_at',
] as const;
function sectionFilter(bookId: string, sectionId?: string) {
  return {
    where:
      sectionId === undefined
        ? 'book_id = ?'
        : 'book_id = ? AND section_id = ?',
    params: sectionId === undefined ? [bookId] : [bookId, sectionId],
  };
}

export function createNotesRepo(db: Db, now = () => new Date().toISOString()) {
  return {
    qa: {
      async add(input: QaInsert): Promise<Qa> {
        const { message_ids, ...values } = input;
        return db.transaction(async tx => {
          const id = await insertRow(tx, 'qa', qaColumns, {
            ...values,
            message_ids_json: serializeJson(message_ids),
          });
          return decodeQa(
            (await tx.get<QaRow>('SELECT * FROM qa WHERE id = ?', [id]))!,
          );
        });
      },
      async list(bookId: string, sectionId?: string): Promise<Qa[]> {
        const { where, params } = sectionFilter(bookId, sectionId);
        return (
          await db.all<QaRow>(
            `SELECT * FROM qa WHERE ${where} ORDER BY created_at ASC, id ASC`,
            params,
          )
        ).map(decodeQa);
      },
    },
    stuck: {
      async add(input: StuckInsert): Promise<Stuck> {
        return db.transaction(async tx => {
          const id = await insertRow(tx, 'stuck', stuckColumns, { ...input });
          return (await tx.get<Stuck>('SELECT * FROM stuck WHERE id = ?', [
            id,
          ]))!;
        });
      },
      /** 不传 resolved 时保留已掌握项，供笔记显示划掉的卡点。 */
      async list(
        bookId?: string,
        sectionId?: string,
        opts: { resolved?: boolean } = {},
      ): Promise<Stuck[]> {
        const where: string[] = [];
        const params: SqlValue[] = [];
        if (bookId !== undefined) {
          where.push('book_id = ?');
          params.push(bookId);
        }
        if (sectionId !== undefined) {
          where.push('section_id = ?');
          params.push(sectionId);
        }
        if (opts.resolved !== undefined)
          where.push(`resolved_at IS ${opts.resolved ? 'NOT ' : ''}NULL`);
        return db.all<Stuck>(
          `SELECT * FROM stuck${
            where.length ? ' WHERE ' + where.join(' AND ') : ''
          } ORDER BY created_at ASC, id ASC`,
          params,
        );
      },
      async resolve(id: number, at = now()): Promise<Stuck | undefined> {
        return db.transaction(async tx => {
          await tx.run('UPDATE stuck SET resolved_at = ? WHERE id = ?', [
            at,
            id,
          ]);
          return tx.get<Stuck>('SELECT * FROM stuck WHERE id = ?', [id]);
        });
      },
    },
    userText: {
      get: (bookId: string, sectionId: string) =>
        db.get<SectionNote>(
          'SELECT * FROM section_note WHERE book_id = ? AND section_id = ?',
          [bookId, sectionId],
        ),
      async set(
        bookId: string,
        sectionId: string,
        userText: string,
        at = now(),
      ): Promise<SectionNote> {
        return db.transaction(async tx => {
          await tx.run(
            'INSERT INTO section_note (book_id,section_id,user_text,updated_at) VALUES (?,?,?,?) ON CONFLICT(book_id,section_id) DO UPDATE SET user_text=excluded.user_text,updated_at=excluded.updated_at',
            [bookId, sectionId, userText, at],
          );
          return (await tx.get<SectionNote>(
            'SELECT * FROM section_note WHERE book_id = ? AND section_id = ?',
            [bookId, sectionId],
          ))!;
        });
      },
    },
    highlights: {
      /** SQL UNIQUE 不会把两组 NULL 当重复，因此先以 IS 查询，整个切换持有事务锁。 */
      async toggle(input: HighlightInsert): Promise<Highlight | null> {
        return db.transaction(async tx => {
          const params: SqlValue[] = [
            input.book_id,
            input.block_seq,
            input.start ?? null,
            input.end ?? null,
          ];
          const existing = await tx.get<Highlight>(
            'SELECT * FROM highlight WHERE book_id = ? AND block_seq = ? AND start IS ? AND end IS ? ORDER BY id LIMIT 1',
            params,
          );
          if (existing) {
            // 一并移除旧版本可能留下的整块重复记录。
            await tx.run(
              'DELETE FROM highlight WHERE book_id = ? AND block_seq = ? AND start IS ? AND end IS ?',
              params,
            );
            return null;
          }
          const id = await insertRow(tx, 'highlight', highlightColumns, {
            ...input,
          });
          return (await tx.get<Highlight>(
            'SELECT * FROM highlight WHERE id = ?',
            [id],
          ))!;
        });
      },
      list: (bookId: string) =>
        db.all<Highlight>(
          'SELECT * FROM highlight WHERE book_id = ? ORDER BY block_seq ASC, start ASC, id ASC',
          [bookId],
        ),
    },
    pins: {
      async add(input: PinInsert): Promise<Pin> {
        const { message_ids, ...values } = input;
        return db.transaction(async tx => {
          const id = await insertRow(tx, 'pin', pinColumns, {
            ...values,
            message_ids_json: serializeJson(message_ids),
          });
          return decodePin(
            (await tx.get<PinRow>('SELECT * FROM pin WHERE id = ?', [id]))!,
          );
        });
      },
      async list(bookId: string, sectionId?: string): Promise<Pin[]> {
        const { where, params } = sectionFilter(bookId, sectionId);
        return (
          await db.all<PinRow>(
            `SELECT * FROM pin WHERE ${where} ORDER BY block_seq ASC, id ASC`,
            params,
          )
        ).map(decodePin);
      },
    },
  };
}
