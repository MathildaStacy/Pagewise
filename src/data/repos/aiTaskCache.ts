import type { Db } from '../db';

export interface TaskCacheAddress {
  bookId: string;
  task: string;
  scope: string;
  requestKey: string;
}

export function createAiTaskCacheRepo(db: Db, now: () => string) {
  return {
    async get(entry: TaskCacheAddress): Promise<string | null> {
      return db.transaction(async tx => {
        const args = [entry.bookId, entry.task, entry.scope, entry.requestKey];
        const row = await tx.get<{ content: string }>(
          'SELECT content FROM ai_task_cache WHERE book_id=? AND task=? AND scope=? AND request_key=?',
          args,
        );
        if (!row) return null;
        await tx.run(
          'UPDATE ai_task_cache SET used_at=? WHERE book_id=? AND task=? AND scope=? AND request_key=?',
          [now(), ...args],
        );
        return row.content;
      });
    },
    async put(entry: TaskCacheAddress, content: string): Promise<void> {
      await db.transaction(async tx => {
        await tx.run(
          'INSERT INTO ai_task_cache(book_id,task,scope,request_key,content,used_at) VALUES (?,?,?,?,?,?) ON CONFLICT(book_id,task,scope) DO UPDATE SET request_key=excluded.request_key,content=excluded.content,used_at=excluded.used_at',
          [
            entry.bookId,
            entry.task,
            entry.scope,
            entry.requestKey,
            content,
            now(),
          ],
        );
        await tx.run(
          'DELETE FROM ai_task_cache WHERE rowid IN (SELECT rowid FROM ai_task_cache ORDER BY used_at DESC,rowid DESC LIMIT -1 OFFSET 500)',
        );
      });
    },
    async getSection(
      bookId: string,
      sectionId: string,
      requestKey: string,
    ): Promise<string | null> {
      const row = await db.get<{ content: string }>(
        'SELECT content FROM section_translation WHERE book_id=? AND section_id=? AND request_key=?',
        [bookId, sectionId, requestKey],
      );
      return row?.content ?? null;
    },
    async clearScopePrefix(
      bookId: string,
      task: string,
      prefix: string,
    ): Promise<void> {
      await db.run(
        'DELETE FROM ai_task_cache WHERE book_id=? AND task=? AND substr(scope,1,length(?))=?',
        [bookId, task, prefix, prefix],
      );
    },
    async putSection(
      bookId: string,
      sectionId: string,
      requestKey: string,
      source: string,
      content: string,
    ): Promise<void> {
      await db.run(
        'INSERT INTO section_translation(book_id,section_id,source_text,content,updated_at,request_key) VALUES (?,?,?,?,?,?) ON CONFLICT(book_id,section_id) DO UPDATE SET source_text=excluded.source_text,content=excluded.content,updated_at=excluded.updated_at,request_key=excluded.request_key',
        [bookId, sectionId, source, content, now(), requestKey],
      );
    },
  };
}
