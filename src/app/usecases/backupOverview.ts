import { validateManifest, type BackupManifest } from '@services/backup';
import { SCHEMA_VERSION } from '@data/migrations';
import type { Container } from '../container';
import { storageRuntime } from './storage';
let previewSerial = 0;

export interface BackupExportRecord {
  createdAt: string;
  books: number;
  originals: number;
}
export interface BackupPreview {
  path: string;
  manifest: BackupManifest;
}
export const readLastBackup = (c: Container) =>
  c.repos.settings.get<BackupExportRecord | null>('backup.lastExport', null);

/** Read the chosen archive's manifest before asking to replace any learning data. */
export async function chooseBackupPreview(
  c: Container,
): Promise<BackupPreview | null> {
  const io = storageRuntime(c);
  const path = await io.pickBackup();
  if (!path) return null;
  const working = `${io.cacheDir}/backup-preview-${c.clock
    .now()
    .getTime()}-${++previewSerial}`;
  const archive = `${working}.zip`;
  let accepted = false;
  await io.mkdir(working);
  try {
    // The document picker reuses its cache path. Keep the preview and restore
    // tied to the same bytes even if a later selection overwrites that cache.
    await io.copy(path, archive);
    await io.unzip(archive, working);
    const manifest = validateManifest(
      JSON.parse(await io.readText(`${working}/manifest.json`)),
      SCHEMA_VERSION,
    );
    accepted = true;
    return { path: archive, manifest };
  } finally {
    await io.remove(working);
    if (!accepted) await io.remove(archive);
  }
}

export async function discardBackupPreview(
  c: Container,
  preview: BackupPreview,
) {
  try {
    await storageRuntime(c).remove(preview.path);
  } catch {
    c.log.warn('清理备份预览缓存失败');
  }
}
