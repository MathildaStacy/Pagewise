import type {
  DetourFrame,
  StudyState,
  StudyStateInsert,
  StudyStatePatch,
} from '@core/types';
import type { Db, SqlValue } from '../db';
import { parseJson, serializeJson, updateRow } from './shared';
type StudyRow = Omit<StudyState, 'detours'> & { detours_json: string };
const columns = [
  'book_id',
  'main_section',
  'main_part',
  'main_step',
  'phase',
  'detours_json',
  'mode',
  'reader_view',
  'read_anchor',
  'resume_shown_at',
  'last_active_at',
] as const;
function decode(row: StudyRow): StudyState {
  const { detours_json, ...value } = row;
  return { ...value, detours: parseJson<DetourFrame[]>(detours_json, []) };
}
export function createStudyRepo(db: Db) {
  return {
    async get(bookId: string): Promise<StudyState | undefined> {
      const row = await db.get<StudyRow>(
        'SELECT * FROM study_state WHERE book_id = ?',
        [bookId],
      );
      return row ? decode(row) : undefined;
    },
    async put(input: StudyStateInsert): Promise<StudyState> {
      const state: StudyState = {
        book_id: input.book_id,
        main_section: input.main_section ?? null,
        main_part: input.main_part ?? 0,
        main_step: input.main_step ?? 0,
        phase: input.phase ?? 'idle',
        detours: input.detours ?? [],
        mode: input.mode ?? 'listen',
        reader_view: input.reader_view ?? 'orig',
        read_anchor: input.read_anchor ?? null,
        resume_shown_at: input.resume_shown_at ?? null,
        last_active_at: input.last_active_at ?? null,
      };
      return db.transaction(async tx => {
        await tx.run(
          'INSERT INTO study_state (book_id,main_section,main_part,main_step,phase,detours_json,mode,reader_view,read_anchor,resume_shown_at,last_active_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(book_id) DO UPDATE SET main_section=excluded.main_section,main_part=excluded.main_part,main_step=excluded.main_step,phase=excluded.phase,detours_json=excluded.detours_json,mode=excluded.mode,reader_view=excluded.reader_view,read_anchor=excluded.read_anchor,resume_shown_at=excluded.resume_shown_at,last_active_at=excluded.last_active_at',
          [
            state.book_id,
            state.main_section,
            state.main_part,
            state.main_step,
            state.phase,
            serializeJson(state.detours),
            state.mode,
            state.reader_view,
            state.read_anchor,
            state.resume_shown_at,
            state.last_active_at,
          ],
        );
        return decode(
          (await tx.get<StudyRow>(
            'SELECT * FROM study_state WHERE book_id = ?',
            [state.book_id],
          ))!,
        );
      });
    },
    async patch(
      bookId: string,
      patch: StudyStatePatch,
    ): Promise<StudyState | undefined> {
      const { detours, ...other } = patch;
      const values: Record<string, SqlValue | undefined> = {
        ...other,
        detours_json:
          detours === undefined ? undefined : serializeJson(detours),
      };
      return db.transaction(async tx => {
        await updateRow(tx, 'study_state', columns, values, {
          book_id: bookId,
        });
        const row = await tx.get<StudyRow>(
          'SELECT * FROM study_state WHERE book_id = ?',
          [bookId],
        );
        return row ? decode(row) : undefined;
      });
    },
  };
}
