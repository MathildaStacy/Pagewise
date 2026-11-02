/** Local results are separate from provider prompt-cache token accounting. */
export const m0005 = [
  `CREATE TABLE ai_task_cache (
    book_id TEXT NOT NULL REFERENCES book(id) ON DELETE CASCADE,
    task TEXT NOT NULL,
    scope TEXT NOT NULL,
    request_key TEXT NOT NULL,
    content TEXT NOT NULL,
    used_at TEXT NOT NULL,
    PRIMARY KEY(book_id, task, scope)
  )`,
  'CREATE INDEX ai_task_cache_used ON ai_task_cache(used_at)',
  'ALTER TABLE section_translation ADD COLUMN request_key TEXT',
];
