/** Adapted from AShareSim/src/data/migrations/index.ts (GPL-3.0-only). */
import type { Db } from '../db';
import { m0001 } from './0001_init';
import { m0002 } from './0002_card_suspension';
import { m0003 } from './0003_conversations';
import { m0004 } from './0004_document_refinement';
/** 按顺序排列；下标 + 1 就是存在 PRAGMA user_version 里的版本号。 */
export const migrations: string[][] = [m0001, m0002, m0003, m0004];

export const SCHEMA_VERSION = migrations.length;

/**
 * 把数据库升级到迁移列表的最新版本。每个迁移和版本号在同一个事务里，失败时停在上一个版本。
 * 默认使用正式 migrations（T3 首个版本）；steps 允许测试或自定义迁移使用独立列表。
 */
export async function migrate(
  db: Db,
  steps: readonly (readonly string[])[] = migrations,
): Promise<{ from: number; to: number }> {
  const target = steps.length;
  await db.run('PRAGMA foreign_keys = ON');
  const row = await db.get<{ user_version: number }>('PRAGMA user_version');
  const from = Number(row?.user_version ?? 0);
  if (from > target) {
    throw new Error(`数据库版本 ${from} 比这个 App 支持的版本（${target}）新`);
  }
  for (let v = from; v < target; v++) {
    await db.transaction(async tx => {
      for (const sql of steps[v]) {
        await tx.run(sql);
      }
      await tx.run(`PRAGMA user_version = ${v + 1}`);
    });
  }
  return { from, to: target };
}
