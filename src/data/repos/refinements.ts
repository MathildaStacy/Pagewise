import {
  projectRefinement,
  type RefinementRun,
  type RefinementStatus,
} from '@core/refinement';
import type { Block } from '@core/types';
import type { Db } from '../db';

type Stored = Omit<RefinementRun, 'document' | 'config'> & {
  document_json: string;
  config_json: string | null;
};
const decode = (r: Stored): RefinementRun => {
  const { document_json, config_json, ...row } = r;
  return {
    ...row,
    document: JSON.parse(document_json),
    config: config_json ? JSON.parse(config_json) : null,
  };
};
export function createRefinementsRepo(db: Db) {
  const get = async (id: number) => {
    const r = await db.get<Stored>(
      'SELECT * FROM document_refinement WHERE id=?',
      [id],
    );
    return r ? decode(r) : undefined;
  };
  return {
    get,
    async applied(bookId: string, sectionId: string) {
      const r = await db.get<Stored>(
        "SELECT * FROM document_refinement WHERE book_id=? AND section_id=? AND status='applied' ORDER BY id DESC LIMIT 1",
        [bookId, sectionId],
      );
      return r ? decode(r) : undefined;
    },
    async latest(bookId: string, sectionId: string) {
      const r = await db.get<Stored>(
        'SELECT * FROM document_refinement WHERE book_id=? AND section_id=? ORDER BY id DESC LIMIT 1',
        [bookId, sectionId],
      );
      return r ? decode(r) : undefined;
    },
    async create(run: Omit<RefinementRun, 'id'>) {
      return db.transaction(async tx => {
        await tx.run(
          `INSERT INTO document_refinement(book_id,section_id,mode,status,completed,document_json,config_json,error,input_tokens,output_tokens,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            run.book_id,
            run.section_id,
            run.mode,
            run.status,
            run.completed,
            JSON.stringify(run.document),
            run.config ? JSON.stringify(run.config) : null,
            run.error,
            run.input_tokens,
            run.output_tokens,
            run.created_at,
            run.updated_at,
          ],
        );
        const row = await tx.get<{ id: number }>(
          'SELECT last_insert_rowid() AS id',
        );
        return { ...run, id: row!.id };
      });
    },
    async save(run: RefinementRun) {
      await db.run(
        `UPDATE document_refinement SET status=?,completed=?,document_json=?,error=?,input_tokens=?,output_tokens=?,updated_at=? WHERE id=?`,
        [
          run.status,
          run.completed,
          JSON.stringify(run.document),
          run.error,
          run.input_tokens,
          run.output_tokens,
          run.updated_at,
          run.id,
        ],
      );
    },
    async status(id: number, status: RefinementStatus, at: string) {
      await db.run(
        'UPDATE document_refinement SET status=?,updated_at=? WHERE id=?',
        [status, at, id],
      );
    },
    async project(blocks: readonly Block[]): Promise<Block[]> {
      const groups = new Map<string, Block[]>();
      for (const b of blocks) {
        if (b.section_id) {
          const key = JSON.stringify([b.book_id, b.section_id]);
          groups.set(key, [...(groups.get(key) ?? []), b]);
        }
      }
      const effective = new Map<number, Block>();
      for (const group of groups.values()) {
        const b = group[0];
        const row = await db.get<Stored>(
          `SELECT * FROM document_refinement WHERE book_id=? AND section_id=? AND status='applied' ORDER BY id DESC LIMIT 1`,
          [b.book_id, b.section_id],
        );
        if (!row) continue;
        const source = await db.all<Block>(
          'SELECT * FROM block WHERE book_id=? AND section_id=? ORDER BY seq',
          [b.book_id, b.section_id],
        );
        projectRefinement(source, decode(row)).forEach(value =>
          effective.set(value.id, value),
        );
      }
      return blocks.map(b => effective.get(b.id) ?? b);
    },
    async invalidate(bookId: string, at: string, from?: number, to?: number) {
      const rows = await db.all<Stored>(
        "SELECT * FROM document_refinement WHERE book_id=? AND status!='stale'",
        [bookId],
      );
      for (const row of rows) {
        if (
          from !== undefined &&
          !decode(row).document.source.some(
            b => b.page !== null && b.page >= from && b.page <= to!,
          )
        )
          continue;
        await db.run(
          "UPDATE document_refinement SET status='stale',updated_at=? WHERE id=?",
          [at, row.id],
        );
      }
    },
  };
}
