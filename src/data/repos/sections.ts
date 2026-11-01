import type {
  Section,
  SectionInsert,
  SectionPart,
  SectionPatch,
} from '@core/types';
import type { Db } from '../db';
import {
  learningLeaves,
  learningScopeKey,
  type LearningScope,
} from '@core/learningScope';
import { createSettingsRepo } from './settings';
import {
  insertRow,
  parseJson,
  serializeJson,
  updateRow,
  type SqlValues,
} from './shared';

type SectionRow = Omit<Section, 'is_leaf' | 'flag_detail'> & {
  is_leaf: number;
  flag_detail_json: string | null;
};
const columns = [
  'book_id',
  'id',
  'parent_id',
  'level',
  'ord',
  'no',
  'title',
  'is_leaf',
  'block_from',
  'block_to',
  'page_from',
  'page_to',
  'chars',
  'parts',
  'status',
  'summary',
  'guide',
  'source',
  'flag',
  'flag_detail_json',
  'merged_into',
];
function fromRow(row: SectionRow): Section {
  const { is_leaf, flag_detail_json, ...section } = row;
  return {
    ...section,
    is_leaf: Boolean(is_leaf),
    flag_detail:
      flag_detail_json === null ? null : parseJson(flag_detail_json, null),
  };
}
const toRow = (section: Partial<Section>): SqlValues => ({
  book_id: section.book_id,
  id: section.id,
  parent_id: section.parent_id,
  level: section.level,
  ord: section.ord,
  no: section.no,
  title: section.title,
  is_leaf: section.is_leaf === undefined ? undefined : Number(section.is_leaf),
  block_from: section.block_from,
  block_to: section.block_to,
  page_from: section.page_from,
  page_to: section.page_to,
  chars: section.chars,
  parts: section.parts,
  status: section.status,
  summary: section.summary,
  guide: section.guide,
  source: section.source,
  flag: section.flag,
  flag_detail_json:
    section.flag_detail === undefined
      ? undefined
      : section.flag_detail === null
      ? null
      : serializeJson(section.flag_detail),
  merged_into: section.merged_into,
});

export function createSectionsRepo(db: Db) {
  const settings = createSettingsRepo(db);
  const scope = (bookId: string) =>
    settings.get<LearningScope>(learningScopeKey(bookId), {});
  const tree = async (bookId: string): Promise<Section[]> =>
    (
      await db.all<SectionRow>(
        'SELECT * FROM section WHERE book_id=? ORDER BY ord,id',
        [bookId],
      )
    ).map(fromRow);
  const selectedLeaves = async (bookId: string) => {
    const [sections, overrides, book] = await Promise.all([
      tree(bookId),
      scope(bookId),
      db.get<{ title: string }>('SELECT title FROM book WHERE id=?', [bookId]),
    ]);
    return learningLeaves(sections, overrides, book?.title);
  };
  const get = async (
    bookId: string,
    id: string,
  ): Promise<Section | undefined> => {
    const row = await db.get<SectionRow>(
      'SELECT * FROM section WHERE book_id=? AND id=?',
      [bookId, id],
    );
    return row && fromRow(row);
  };
  return {
    tree,
    learningScope: scope,
    learningLeaves: selectedLeaves,
    async setLearningScope(
      bookId: string,
      id: string,
      value: 'include' | 'exclude',
    ) {
      const overrides = await scope(bookId);
      await settings.set(learningScopeKey(bookId), {
        ...overrides,
        [id]: value,
      });
    },
    get,
    async replaceAll(
      bookId: string,
      sections: (Omit<SectionInsert, 'book_id'> & { book_id?: string })[],
    ): Promise<Section[]> {
      await db.transaction(async tx => {
        const old = (
          await tx.all<SectionRow>('SELECT * FROM section WHERE book_id=?', [
            bookId,
          ])
        ).map(fromRow);
        const oldById = new Map(old.map(section => [section.id, section]));
        const preserved = new Set(
          old
            .filter(section => section.source === 'manual')
            .map(section => section.id),
        );
        const incoming = new Set(sections.map(section => section.id));
        for (const section of old) {
          if (!incoming.has(section.id) && !preserved.has(section.id)) {
            await tx.run('DELETE FROM section WHERE book_id=? AND id=?', [
              bookId,
              section.id,
            ]);
          }
        }
        for (const section of sections) {
          if (preserved.has(section.id)) {
            continue;
          }
          const previous = oldById.get(section.id);
          const values = toRow({
            ...section,
            book_id: bookId,
            ...(previous
              ? {
                  status: previous.status,
                  summary: previous.summary ?? section.summary,
                  guide: previous.guide ?? section.guide,
                }
              : {}),
          });
          if (previous) {
            delete values.book_id;
            delete values.id;
            await updateRow(tx, 'section', columns, values, {
              book_id: bookId,
              id: section.id,
            });
          } else {
            await insertRow(tx, 'section', columns, values);
          }
        }
      });
      return (
        await db.all<SectionRow>(
          'SELECT * FROM section WHERE book_id=? ORDER BY ord,id',
          [bookId],
        )
      ).map(fromRow);
    },
    async update(
      bookId: string,
      id: string,
      patch: SectionPatch,
    ): Promise<Section | undefined> {
      const values = toRow(patch);
      delete values.book_id;
      delete values.id;
      await updateRow(db, 'section', columns, values, { book_id: bookId, id });
      return get(bookId, id);
    },
    async leaves(bookId: string): Promise<Section[]> {
      return (
        await db.all<SectionRow>(
          'SELECT * FROM section WHERE book_id=? AND is_leaf=1 ORDER BY ord,id',
          [bookId],
        )
      ).map(fromRow);
    },
    async nextLeaf(bookId: string, id: string): Promise<Section | undefined> {
      const current = await get(bookId, id);
      if (!current) {
        return undefined;
      }
      return (await selectedLeaves(bookId)).find(
        section => section.ord > current.ord,
      );
    },
    async parts(bookId: string, id: string): Promise<SectionPart[]> {
      return db.all<SectionPart>(
        'SELECT * FROM section_part WHERE book_id=? AND section_id=? ORDER BY part_no',
        [bookId, id],
      );
    },
    async setParts(
      bookId: string,
      id: string,
      parts: Omit<SectionPart, 'book_id' | 'section_id'>[],
    ): Promise<SectionPart[]> {
      await db.transaction(async tx => {
        await tx.run(
          'DELETE FROM section_part WHERE book_id=? AND section_id=?',
          [bookId, id],
        );
        for (const part of parts) {
          await tx.run(
            'INSERT INTO section_part(book_id,section_id,part_no,block_from,block_to,name) VALUES (?,?,?,?,?,?)',
            [
              bookId,
              id,
              part.part_no,
              part.block_from,
              part.block_to,
              part.name,
            ],
          );
        }
        await tx.run('UPDATE section SET parts=? WHERE book_id=? AND id=?', [
          Math.max(1, parts.length),
          bookId,
          id,
        ]);
      });
      return db.all<SectionPart>(
        'SELECT * FROM section_part WHERE book_id=? AND section_id=? ORDER BY part_no',
        [bookId, id],
      );
    },
  };
}
