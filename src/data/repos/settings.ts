import type { Db } from '../db';
import { parseJson, serializeJson } from './shared';

/** 只保存非敏感设置；凭据由应用层通过 KeyStore 管理。 */
export function createSettingsRepo(db: Db) {
  return {
    async get<T>(key: string, fallback: T): Promise<T> {
      const row = await db.get<{ value: string }>(
        'SELECT value FROM setting WHERE key = ?',
        [key],
      );
      return parseJson(row?.value, fallback);
    },
    async set<T>(key: string, value: T): Promise<void> {
      await db.run(
        'INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [key, serializeJson(value)],
      );
    },
  };
}

export type SettingsRepo = ReturnType<typeof createSettingsRepo>;
