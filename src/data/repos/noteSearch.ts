import type { Db } from '../db';

export type NoteSearchKind = 'summary' | 'qa' | 'user' | 'stuck';
export interface NoteSearchHit {
  book_id: string;
  book_title: string;
  section_id: string;
  section_no: string | null;
  section_title: string;
  kind: NoteSearchKind;
  item_id: number;
  excerpt: string;
}

/** Searches learning records only; book text and full notes never leave SQLite. */
export function createNoteSearchRepo(db: Db) {
  return {
    async search(query: string, limit = 40) {
      const term = query.trim();
      const count = Number.isFinite(limit)
        ? Math.max(0, Math.min(60, Math.trunc(limit)))
        : 40;
      if (!term || !count) return { hits: [], hasMore: false };
      const hits = await db.all<NoteSearchHit>(
        `WITH entries AS (
          SELECT book_id,id AS section_id,'summary' AS kind,0 AS item_id,summary AS content
          FROM section WHERE summary IS NOT NULL AND summary <> ''
          UNION ALL
          SELECT book_id,section_id,'qa',id,q || char(10) || a FROM qa
          UNION ALL
          SELECT book_id,section_id,'user',0,user_text FROM section_note WHERE user_text <> ''
          UNION ALL
          SELECT book_id,section_id,'stuck',id,text FROM stuck
        )
        SELECT e.book_id,b.title AS book_title,e.section_id,s.no AS section_no,
          s.title AS section_title,e.kind,e.item_id,
          substr(e.content,MAX(1,instr(lower(e.content),lower(?))-32),180) AS excerpt
        FROM entries e
        JOIN book b ON b.id=e.book_id
        JOIN section s ON s.book_id=e.book_id AND s.id=e.section_id
        WHERE instr(lower(e.content),lower(?)) > 0
        ORDER BY b.title COLLATE NOCASE,b.id,s.ord,e.kind,e.item_id
        LIMIT ?`,
        [term, term, count + 1],
      );
      return { hits: hits.slice(0, count), hasMore: hits.length > count };
    },
  };
}
