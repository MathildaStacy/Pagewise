import type { ImportDraft, ImportDraftInsert, JsonValue } from '@core/types';
import type { Db } from '../db';
import { parseJson, serializeJson } from './shared';

type DraftRow = Omit<ImportDraft, 'info'> & { info_json: string };
const decode = ({ info_json, ...row }: DraftRow): ImportDraft => ({
  ...row,
  info: parseJson<JsonValue>(info_json, null),
});

export function createDraftsRepo(db: Db) {
  return {
    async insert(input: ImportDraftInsert): Promise<ImportDraft> {
      const info = serializeJson(input.info);
      await db.run(
        'INSERT INTO import_draft (id, file_path, info_json, created_at) VALUES (?, ?, ?, ?)',
        [input.id, input.file_path, info, input.created_at],
      );
      return { ...input, info: parseJson<JsonValue>(info, null) };
    },
    async get(id: string): Promise<ImportDraft | null> {
      const row = await db.get<DraftRow>(
        'SELECT * FROM import_draft WHERE id = ?',
        [id],
      );
      return row ? decode(row) : null;
    },
    async list(): Promise<ImportDraft[]> {
      return (
        await db.all<DraftRow>(
          'SELECT * FROM import_draft ORDER BY created_at DESC, id',
        )
      ).map(decode);
    },
    async remove(id: string): Promise<void> {
      await db.run('DELETE FROM import_draft WHERE id = ?', [id]);
    },
  };
}

export type DraftsRepo = ReturnType<typeof createDraftsRepo>;
