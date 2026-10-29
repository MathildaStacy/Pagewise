import type { Db, SqlValue } from '../db';

export type SqlValues = Record<string, SqlValue | undefined>;

/** Version 1 wraps JSON payloads; legacy unwrapped rows remain readable. */
export function serializeJson(value: unknown): string {
  if (value === undefined) {
    throw new Error('不能序列化 undefined；省略字段或显式传 null');
  }
  return JSON.stringify({ version: 1, data: value });
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (value == null) {
    return fallback;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      Object.hasOwn(parsed, 'version')
    ) {
      const envelope = parsed as { version?: unknown; data?: T };
      return envelope.version === 1 && Object.hasOwn(envelope, 'data')
        ? (envelope.data as T)
        : fallback;
    }
    return parsed as T;
  } catch {
    // Corrupt or future payloads use the caller's domain-specific fallback.
    return fallback;
  }
}

function identifier(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new Error(`非法 SQL 标识符：${name}`);
  }
  return `"${name}"`;
}

function entries(
  columns: readonly string[],
  values: SqlValues,
): [string, SqlValue][] {
  return Object.entries(values).flatMap(([column, value]) => {
    if (!columns.includes(column)) {
      throw new Error(`未知数据列：${column}`);
    }
    return value === undefined ? [] : [[column, value]];
  });
}

export async function lastInsertId(db: Db): Promise<number> {
  const row = await db.get<{ id: number }>('SELECT last_insert_rowid() AS id');
  if (!row) {
    throw new Error('没有可读取的新增记录 ID');
  }
  return row.id;
}

/** Insert and read last_insert_rowid under the same transaction lock. */
export async function insertRow(
  db: Db,
  table: string,
  columns: readonly string[],
  values: SqlValues,
): Promise<number> {
  const fields = entries(columns, values);
  const sql = fields.length
    ? `INSERT INTO ${identifier(table)} (${fields
        .map(([key]) => identifier(key))
        .join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`
    : `INSERT INTO ${identifier(table)} DEFAULT VALUES`;
  return db.transaction(async tx => {
    await tx.run(
      sql,
      fields.map(([, value]) => value),
    );
    return lastInsertId(tx);
  });
}

/** Columns are an explicit table whitelist; values and predicates are bound. */
export async function updateRow(
  db: Db,
  table: string,
  columns: readonly string[],
  values: SqlValues,
  where: Record<string, SqlValue>,
): Promise<{ changes: number }> {
  const fields = entries(columns, values);
  const predicate = entries(columns, where);
  if (!predicate.length) {
    throw new Error('更新必须指定记录条件');
  }
  if (!fields.length) {
    return { changes: 0 };
  }
  const sql = `UPDATE ${identifier(table)} SET ${fields
    .map(([key]) => `${identifier(key)} = ?`)
    .join(', ')} WHERE ${predicate
    .map(
      ([key, value]) =>
        `${identifier(key)} ${value === null ? 'IS NULL' : '= ?'}`,
    )
    .join(' AND ')}`;
  return db.run(sql, [
    ...fields.map(([, value]) => value),
    ...predicate
      .filter(([, value]) => value !== null)
      .map(([, value]) => value),
  ]);
}
