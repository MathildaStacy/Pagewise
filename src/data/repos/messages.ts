import type { Message, MessageInsert, MessagePatch } from '@core/types';
import type { Db, SqlValue } from '../db';
import { insertRow, parseJson, serializeJson, updateRow } from './shared';

type MessageRow = Omit<
  Message,
  'parts' | 'raw' | 'allowed_refs' | 'usage' | 'in_context'
> & {
  parts_json: string | null;
  raw_json: string | null;
  allowed_refs_json: string | null;
  usage_json: string | null;
  in_context: number;
};
const columns = [
  'id',
  'book_id',
  'section_id',
  'part_no',
  'step_no',
  'kind',
  'intent',
  'content',
  'parts_json',
  'raw_json',
  'allowed_refs_json',
  'unverified',
  'detour_id',
  'quote_seq',
  'in_context',
  'usage_json',
  'created_at',
] as const;
function decode(row: MessageRow): Message {
  const {
    parts_json,
    raw_json,
    allowed_refs_json,
    usage_json,
    in_context,
    ...value
  } = row;
  return {
    ...value,
    parts: parseJson<Message['parts']>(parts_json, null),
    raw: parseJson<Message['raw']>(raw_json, null),
    allowed_refs: parseJson<Message['allowed_refs']>(allowed_refs_json, null),
    usage: parseJson<Message['usage']>(usage_json, null),
    in_context: !!in_context,
  };
}
const json = (value: unknown) => (value == null ? null : serializeJson(value));
export interface MessageThreadOptions {
  limit?: number;
  before_id?: number;
  after_id?: number;
  in_context?: boolean;
  /** undefined 查全部岔路；null 只查主线。 */
  detour_id?: number | null;
  part_no?: number | null;
}

export function createMessagesRepo(db: Db) {
  return {
    /** 始终按阅读顺序升序返回；默认取最新200条。after_id 用于向后追加。 */
    async thread(
      bookId: string,
      sectionId: string,
      opts: MessageThreadOptions = {},
    ): Promise<Message[]> {
      const where = ['book_id = ?', 'section_id = ?'];
      const params: SqlValue[] = [bookId, sectionId];
      if (opts.before_id !== undefined) {
        where.push('id < ?');
        params.push(opts.before_id);
      }
      if (opts.after_id !== undefined) {
        where.push('id > ?');
        params.push(opts.after_id);
      }
      if (opts.in_context !== undefined) {
        where.push('in_context = ?');
        params.push(opts.in_context ? 1 : 0);
      }
      if (opts.detour_id !== undefined) {
        where.push('detour_id IS ?');
        params.push(opts.detour_id);
      }
      if (opts.part_no !== undefined) {
        where.push('part_no IS ?');
        params.push(opts.part_no);
      }
      const forward = opts.after_id !== undefined;
      params.push(Math.max(0, Math.trunc(opts.limit ?? 200)));
      const rows = await db.all<MessageRow>(
        `SELECT * FROM message WHERE ${where.join(' AND ')} ORDER BY id ${
          forward ? 'ASC' : 'DESC'
        } LIMIT ?`,
        params,
      );
      return (forward ? rows : rows.reverse()).map(decode);
    },
    async append(input: MessageInsert): Promise<Message> {
      const { parts, raw, allowed_refs, usage, in_context, ...values } = input;
      return db.transaction(async tx => {
        const id = await insertRow(tx, 'message', columns, {
          ...values,
          parts_json: json(parts),
          raw_json: json(raw),
          allowed_refs_json: json(allowed_refs),
          usage_json: json(usage),
          in_context: in_context === undefined ? 1 : in_context ? 1 : 0,
        });
        return decode(
          (await tx.get<MessageRow>('SELECT * FROM message WHERE id = ?', [
            id,
          ]))!,
        );
      });
    },
    async update(
      id: number,
      patch: MessagePatch,
    ): Promise<Message | undefined> {
      const values: Record<string, SqlValue | undefined> = {
        part_no: patch.part_no,
        step_no: patch.step_no,
        kind: patch.kind,
        intent: patch.intent,
        content: patch.content,
        unverified: patch.unverified,
        detour_id: patch.detour_id,
        quote_seq: patch.quote_seq,
        created_at: patch.created_at,
        parts_json: patch.parts === undefined ? undefined : json(patch.parts),
        raw_json: patch.raw === undefined ? undefined : json(patch.raw),
        allowed_refs_json:
          patch.allowed_refs === undefined
            ? undefined
            : json(patch.allowed_refs),
        usage_json: patch.usage === undefined ? undefined : json(patch.usage),
        in_context:
          patch.in_context === undefined ? undefined : patch.in_context ? 1 : 0,
      };
      return db.transaction(async tx => {
        await updateRow(tx, 'message', columns, values, { id });
        const row = await tx.get<MessageRow>(
          'SELECT * FROM message WHERE id = ?',
          [id],
        );
        return row ? decode(row) : undefined;
      });
    },
    async markOutOfContext(ids: readonly number[]): Promise<void> {
      if (!ids.length) return;
      await db.transaction(async tx => {
        for (let offset = 0; offset < ids.length; offset += 500) {
          const batch = ids.slice(offset, offset + 500);
          await tx.run(
            `UPDATE message SET in_context = 0 WHERE id IN (${batch
              .map(() => '?')
              .join(',')})`,
            batch,
          );
        }
      });
    },
  };
}
