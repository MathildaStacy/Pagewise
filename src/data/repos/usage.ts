import type { AiUsage, AiUsageInsert } from '@core/types';
import type { Db } from '../db';
import { insertRow } from './shared';

export interface UsageTotals {
  input: number;
  output: number;
  cache_read: number;
  cache_write: number;
  /** 四个归一化分项互斥：未缓存输入 + 缓存读取 + 缓存写入 + 输出。 */
  total: number;
  count: number;
}
export interface UsageByBook extends UsageTotals {
  book_id: string | null;
}
export interface UsageByModel extends UsageTotals {
  purpose: string;
  provider_id: string;
  model: string;
}
export interface UsageMonth {
  /** 统一返回 YYYY-MM，入参也接受 YYYYMM。 */
  month: string;
  groups: UsageByModel[];
  totals: UsageTotals;
}

type UsageRow = Omit<AiUsage, 'cache_reported'> & { cache_reported: number };
const columns = [
  'id',
  'book_id',
  'provider_id',
  'model',
  'purpose',
  'input',
  'cache_read',
  'cache_write',
  'output',
  'cache_reported',
  'at',
] as const;
const aggregate =
  'SUM(input) AS input, SUM(output) AS output, SUM(cache_read) AS cache_read, ' +
  'SUM(cache_write) AS cache_write, SUM(input + cache_read + cache_write + output) AS total, COUNT(*) AS count';

function monthBounds(value: string) {
  const matched = /^(\d{4})-?(0[1-9]|1[0-2])$/.exec(value);
  if (!matched) {
    throw new Error('月份需要使用 YYYYMM 或 YYYY-MM');
  }
  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const key = `${matched[1]}-${matched[2]}`;
  const next =
    month === 12
      ? `${String(year + 1).padStart(4, '0')}-01`
      : `${matched[1]}-${String(month + 1).padStart(2, '0')}`;
  return {
    key,
    from: `${key}-01T00:00:00.000Z`,
    to: `${next}-01T00:00:00.000Z`,
  };
}

export function createUsageRepo(db: Db) {
  return {
    async add(input: AiUsageInsert): Promise<AiUsage> {
      return db.transaction(async tx => {
        const id = await insertRow(tx, 'ai_usage', columns, {
          ...input,
          book_id: input.book_id ?? null,
          cache_reported: Number(input.cache_reported),
        });
        if (input.book_id != null) {
          await tx.run(
            'UPDATE book SET tokens_total = tokens_total + ? WHERE id = ?',
            [
              input.input + input.cache_read + input.cache_write + input.output,
              input.book_id,
            ],
          );
        }
        const row = await tx.get<UsageRow>(
          'SELECT * FROM ai_usage WHERE id = ?',
          [id],
        );
        if (!row) {
          throw new Error('新增的用量记录不存在');
        }
        return { ...row, cache_reported: Boolean(row.cache_reported) };
      });
    },
    byBook(): Promise<UsageByBook[]> {
      return db.all<UsageByBook>(
        `SELECT book_id, ${aggregate} FROM ai_usage GROUP BY book_id ORDER BY book_id`,
      );
    },
    async month(yyyymm: string): Promise<UsageMonth> {
      const { key, from, to } = monthBounds(yyyymm);
      const groups = await db.all<UsageByModel>(
        `SELECT purpose, provider_id, model, ${aggregate} FROM ai_usage WHERE at >= ? AND at < ? GROUP BY purpose, provider_id, model ORDER BY purpose, provider_id, model`,
        [from, to],
      );
      const totals = groups.reduce<UsageTotals>(
        (sum, group) => ({
          input: sum.input + group.input,
          output: sum.output + group.output,
          cache_read: sum.cache_read + group.cache_read,
          cache_write: sum.cache_write + group.cache_write,
          total: sum.total + group.total,
          count: sum.count + group.count,
        }),
        {
          input: 0,
          output: 0,
          cache_read: 0,
          cache_write: 0,
          total: 0,
          count: 0,
        },
      );
      return { month: key, groups, totals };
    },
  };
}

export type UsageRepo = ReturnType<typeof createUsageRepo>;
