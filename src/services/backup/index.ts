import type { JsonValue } from '@core/types';
import { BackupError, type BackupManifest, type SnapshotDb } from './types';
export * from './types';
export function validateManifest(
  value: unknown,
  currentSchema: number,
): BackupManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BackupError('备份清单无效');
  const manifest = value as Partial<BackupManifest>;
  if (
    manifest.format !== 'pagewise-backup' ||
    manifest.version !== 1 ||
    !Number.isSafeInteger(manifest.schemaVersion) ||
    manifest.schemaVersion! < 1 ||
    manifest.schemaVersion! > currentSchema
  )
    throw new BackupError('备份版本不受支持，请先升级 Pagewise');
  if (
    typeof manifest.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(manifest.createdAt)) ||
    typeof manifest.appVersion !== 'string' ||
    !Array.isArray(manifest.books)
  )
    throw new BackupError('备份清单不完整');
  const ids = new Set<string>();
  for (const book of manifest.books) {
    if (
      !book ||
      typeof book.id !== 'string' ||
      !/^[a-zA-Z0-9_-]+$/.test(book.id) ||
      ids.has(book.id) ||
      typeof book.title !== 'string' ||
      typeof book.sha256 !== 'string' ||
      !book.sha256 ||
      !['pdf', 'epub'].includes(book.format) ||
      typeof book.originalIncluded !== 'boolean'
    )
      throw new BackupError('备份中的书籍信息无效');
    if (
      book.imageFiles !== undefined &&
      (!Array.isArray(book.imageFiles) ||
        book.imageFiles.some(
          file =>
            typeof file !== 'string' ||
            !/^images\/(?:[^/\\]+\/)*[^/\\]+$/.test(file) ||
            file.split('/').some(part => part === '.' || part === '..'),
        ) ||
        new Set(book.imageFiles).size !== book.imageFiles.length)
    )
      throw new BackupError('备份中的图片清单无效');
    ids.add(book.id);
  }
  return manifest as BackupManifest;
}
const secretKey = (key: string) =>
  /(?:^|[._-])(?:api[_-]?key|key|token|secret|password|authorization|credential)(?:$|[._-])/i.test(
    key,
  ) || /^(?:apiKey|accessToken|refreshToken|privateKey)$/i.test(key);
function sanitize(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !secretKey(key))
        .map(([key, item]) => [
          key,
          /^(?:keyTail|tokenTail)$/i.test(key) ? '' : sanitize(item),
        ]),
    );
  return value;
}
export function sanitizeSetting(key: string, value: string): string | null {
  if (secretKey(key)) return null;
  let parsed: JsonValue;
  try {
    parsed = JSON.parse(value) as JsonValue;
  } catch {
    return null;
  }
  const cleaned = sanitize(parsed),
    serialized = JSON.stringify(cleaned);
  // Credentials in an unexpected string value are discarded rather than copied to a backup.
  if (
    /(?:sk-[A-Za-z0-9_-]{12,}|mnr_[A-Za-z0-9_-]{8,}|Bearer\s+\S+|-----BEGIN (?:RSA )?PRIVATE KEY-----)/i.test(
      serialized,
    )
  )
    return null;
  return serialized;
}
export async function sanitizeSnapshot(db: SnapshotDb): Promise<void> {
  await db.transaction(async tx => {
    for (const row of await tx.all<{ key: string; value: string }>(
      'SELECT key,value FROM setting',
    )) {
      const value = sanitizeSetting(row.key, row.value);
      if (value === null)
        await tx.run('DELETE FROM setting WHERE key=?', [row.key]);
      else if (value !== row.value)
        await tx.run('UPDATE setting SET value=? WHERE key=?', [
          value,
          row.key,
        ]);
    }
  });
  const remaining = await db.all<{ key: string; value: string }>(
    'SELECT key,value FROM setting',
  );
  if (remaining.some(row => sanitizeSetting(row.key, row.value) !== row.value))
    throw new BackupError('备份配置校验失败');
}
