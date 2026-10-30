export const m0004 = [
  `CREATE TABLE document_refinement (
    id INTEGER PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES book(id) ON DELETE CASCADE,
    section_id TEXT NOT NULL,
    mode TEXT NOT NULL,
    status TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    document_json TEXT NOT NULL,
    config_json TEXT,
    error TEXT,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  'CREATE INDEX refinement_section ON document_refinement(book_id, section_id, id)',
];
