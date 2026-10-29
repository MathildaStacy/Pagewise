import type {
  LessonPlan,
  LessonPlanInsert,
  LessonStep,
  LessonStepStatus,
} from '@core/types';
import type { Db } from '../db';
import { parseJson, serializeJson } from './shared';
type PlanRow = Omit<LessonPlan, 'steps'> & { steps_json: string };
function decode(row: PlanRow): LessonPlan {
  const { steps_json, ...value } = row;
  return { ...value, steps: parseJson<LessonStep[]>(steps_json, []) };
}
export function createPlansRepo(db: Db) {
  const get = async (
    bookId: string,
    sectionId: string,
    part: number,
  ): Promise<LessonPlan | undefined> => {
    const row = await db.get<PlanRow>(
      'SELECT * FROM lesson_plan WHERE book_id = ? AND section_id = ? AND part_no = ?',
      [bookId, sectionId, part],
    );
    return row ? decode(row) : undefined;
  };
  return {
    get,
    async put(plan: LessonPlanInsert): Promise<LessonPlan> {
      return db.transaction(async tx => {
        await tx.run(
          'INSERT INTO lesson_plan (book_id,section_id,part_no,steps_json,source,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(book_id,section_id,part_no) DO UPDATE SET steps_json=excluded.steps_json,source=excluded.source,created_at=excluded.created_at',
          [
            plan.book_id,
            plan.section_id,
            plan.part_no,
            serializeJson(plan.steps),
            plan.source,
            plan.created_at,
          ],
        );
        return decode(
          (await tx.get<PlanRow>(
            'SELECT * FROM lesson_plan WHERE book_id = ? AND section_id = ? AND part_no = ?',
            [plan.book_id, plan.section_id, plan.part_no],
          ))!,
        );
      });
    },
    /** stepNo 使用持久化的 steps[].no，不将步号误当数组下标。 */
    async setStepStatus(
      bookId: string,
      sectionId: string,
      part: number,
      stepNo: number,
      status: LessonStepStatus,
    ): Promise<LessonPlan> {
      return db.transaction(async tx => {
        const row = await tx.get<PlanRow>(
          'SELECT * FROM lesson_plan WHERE book_id = ? AND section_id = ? AND part_no = ?',
          [bookId, sectionId, part],
        );
        if (!row) throw new Error('路线图不存在');
        const plan = decode(row);
        if (!plan.steps.some(step => step.no === stepNo))
          throw new Error('路线图中没有这一步');
        const steps = plan.steps.map(step =>
          step.no === stepNo ? { ...step, status } : step,
        );
        await tx.run(
          'UPDATE lesson_plan SET steps_json = ? WHERE book_id = ? AND section_id = ? AND part_no = ?',
          [serializeJson(steps), bookId, sectionId, part],
        );
        return { ...plan, steps };
      });
    },
  };
}
