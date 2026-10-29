import type { MathCache } from '@core/types';
import type { Db } from '../db';

export type MathCachePut = Omit<MathCache, 'used_at'> &
  Partial<Pick<MathCache, 'used_at'>>;

export function createMathRepo(
  db: Db,
  now: () => string = () => new Date().toISOString(),
) {
  return {
    async get(key: string): Promise<MathCache | null> {
      return (
        (await db.get<MathCache>('SELECT * FROM math_cache WHERE key = ?', [
          key,
        ])) ?? null
      );
    },
    async put(input: MathCachePut): Promise<MathCache> {
      const entry = { ...input, used_at: input.used_at ?? now() };
      await db.run(
        'INSERT INTO math_cache (key, svg, width, height, baseline, used_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET svg = excluded.svg, width = excluded.width, height = excluded.height, baseline = excluded.baseline, used_at = excluded.used_at',
        [
          entry.key,
          entry.svg,
          entry.width,
          entry.height,
          entry.baseline,
          entry.used_at,
        ],
      );
      return entry;
    },
    async touch(key: string): Promise<void> {
      await db.run('UPDATE math_cache SET used_at = ? WHERE key = ?', [
        now(),
        key,
      ]);
    },
    async prune(maxRows = 5000): Promise<number> {
      if (!Number.isInteger(maxRows) || maxRows < 0) {
        throw new Error('缓存上限需要是非负整数');
      }
      const result = await db.run(
        'DELETE FROM math_cache WHERE key IN (SELECT key FROM math_cache ORDER BY used_at DESC, key ASC LIMIT -1 OFFSET ?)',
        [maxRows],
      );
      return result.changes;
    },
  };
}

export type MathRepo = ReturnType<typeof createMathRepo>;
