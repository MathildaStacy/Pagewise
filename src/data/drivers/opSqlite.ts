/** Adapted from AShareSim/src/data/drivers/opSqlite.ts (GPL-3.0-only). */
import { open } from '@op-engineering/op-sqlite';
import { createDb, type Db, type Row, type SqlValue } from '../db';

/** 打开手机上的 App 数据库。 */
export function openDeviceDb(name = 'pagewise.db', location?: string): Db {
  const conn = open({ name, ...(location ? { location } : {}) });
  try {
    conn.executeSync('PRAGMA foreign_keys = ON');
    conn.executeSync('PRAGMA journal_mode = WAL');
    conn.executeSync('PRAGMA synchronous = NORMAL');
  } catch (error) {
    conn.close();
    throw error;
  }
  return createDb({
    async query(sql: string, params: SqlValue[]) {
      const res = await conn.execute(sql, params);
      return {
        rows: (res.rows ?? []) as Row[],
        changes: res.rowsAffected ?? 0,
      };
    },
    async close() {
      conn.close();
    },
  });
}
