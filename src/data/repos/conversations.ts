import type {
  ConversationListItem,
  StudyConversation,
  JsonValue,
} from '@core/types';
import type { Db, SqlValue } from '../db';
import { lastInsertId, parseJson, serializeJson } from './shared';

type Row = Omit<StudyConversation, 'checkpoint' | 'config'> & {
  checkpoint_json: string | null;
  config_json: string | null;
};
function decode<T extends Row>(row: T) {
  const { checkpoint_json, config_json, ...rest } = row;
  return {
    ...rest,
    checkpoint: parseJson<JsonValue | null>(checkpoint_json, null),
    config: parseJson<JsonValue | null>(config_json, null),
  };
}
export function createConversationsRepo(db: Db, now: () => string) {
  async function get(id: number): Promise<StudyConversation | undefined> {
    const row = await db.get<Row>(
      'SELECT * FROM study_conversation WHERE id = ?',
      [id],
    );
    return row ? decode(row) : undefined;
  }
  async function create(bookId: string, sectionId: string, title = '新对话') {
    return db.transaction(async tx => {
      const at = now();
      await tx.run(
        'INSERT INTO study_conversation(book_id, section_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [bookId, sectionId, title, at, at],
      );
      return (await createConversationsRepo(tx, now).get(
        await lastInsertId(tx),
      ))!;
    });
  }
  return {
    get,
    create,
    async list(
      bookId?: string,
      sectionId?: string,
    ): Promise<ConversationListItem[]> {
      const where: string[] = [],
        params: SqlValue[] = [];
      if (bookId !== undefined) {
        where.push('c.book_id = ?');
        params.push(bookId);
      }
      if (sectionId !== undefined) {
        where.push('c.section_id = ?');
        params.push(sectionId);
      }
      const rows = await db.all<
        Row & Omit<ConversationListItem, keyof StudyConversation>
      >(
        `
        SELECT c.*, b.title AS book_title,
          COALESCE(s.no || ' ', '') || COALESCE(s.title, c.section_id) AS section_title,
          (SELECT COUNT(*) FROM message m WHERE m.conversation_id = c.id AND m.kind IN ('user', 'assistant')) AS message_count,
          COALESCE((SELECT content FROM message m WHERE m.conversation_id = c.id AND m.kind IN ('user', 'assistant') ORDER BY id DESC LIMIT 1), '') AS preview
        FROM study_conversation c JOIN book b ON b.id = c.book_id
        LEFT JOIN section s ON s.book_id = c.book_id AND s.id = c.section_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY c.updated_at DESC, c.id DESC`,
        params,
      );
      return rows.map(row => decode(row));
    },
    async ensure(bookId: string, sectionId: string) {
      return db.transaction(async tx => {
        const repo = createConversationsRepo(tx, now);
        const latest = (await repo.list(bookId, sectionId))[0];
        const conversation = latest ?? (await repo.create(bookId, sectionId));
        // Demo 种子和旧版导入记录也通过这个入口归入首个对话。
        await tx.run(
          'UPDATE message SET conversation_id = ? WHERE book_id = ? AND section_id = ? AND conversation_id IS NULL',
          [conversation.id, bookId, sectionId],
        );
        return conversation;
      });
    },
    async update(
      id: number,
      patch: { title?: string; checkpoint?: JsonValue; config?: JsonValue },
    ) {
      const fields = ['updated_at = ?'],
        params: SqlValue[] = [now()];
      if (patch.title !== undefined) {
        fields.push('title = ?');
        params.push(patch.title);
      }
      if (patch.checkpoint !== undefined) {
        fields.push('checkpoint_json = ?');
        params.push(serializeJson(patch.checkpoint));
      }
      if (patch.config !== undefined) {
        fields.push('config_json = ?');
        params.push(serializeJson(patch.config));
      }
      params.push(id);
      await db.run(
        `UPDATE study_conversation SET ${fields.join(', ')} WHERE id = ?`,
        params,
      );
    },
  };
}
