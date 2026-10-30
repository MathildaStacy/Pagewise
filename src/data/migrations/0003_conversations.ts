/** 保留旧版每节的消息，升级为该小节的第一个独立对话。 */
export const m0003 = [
  `CREATE TABLE study_conversation (
    id INTEGER PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES book(id) ON DELETE CASCADE,
    section_id TEXT NOT NULL,
    title TEXT NOT NULL,
    checkpoint_json TEXT,
    config_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  'CREATE INDEX conversation_section ON study_conversation(book_id, section_id, updated_at, id)',
  'ALTER TABLE message ADD COLUMN conversation_id INTEGER REFERENCES study_conversation(id) ON DELETE CASCADE',
  `INSERT INTO study_conversation(book_id, section_id, title, created_at, updated_at)
   SELECT book_id, section_id, '原有对话', MIN(created_at), MAX(created_at)
   FROM message GROUP BY book_id, section_id`,
  `UPDATE message SET conversation_id = (
    SELECT id FROM study_conversation c WHERE c.book_id = message.book_id AND c.section_id = message.section_id
  )`,
  'CREATE INDEX message_conversation ON message(conversation_id, id)',
  'ALTER TABLE study_state ADD COLUMN conversation_id INTEGER REFERENCES study_conversation(id) ON DELETE SET NULL',
  `CREATE TABLE section_translation (
    book_id TEXT NOT NULL REFERENCES book(id) ON DELETE CASCADE,
    section_id TEXT NOT NULL,
    source_text TEXT NOT NULL,
    content TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(book_id, section_id)
  )`,
];
