export interface BackupBook {
  id: string;
  title: string;
  sha256: string;
  format: 'pdf' | 'epub';
  originalIncluded: boolean;
  /** Relative image assets referenced by the saved parsed blocks. Older backups omit this. */
  imageFiles?: string[];
}
export interface BackupManifest {
  format: 'pagewise-backup';
  version: 1;
  schemaVersion: number;
  appVersion: string;
  createdAt: string;
  books: BackupBook[];
}
export interface SnapshotDb {
  all<T = Record<string, unknown>>(
    sql: string,
    params?: (string | number | null)[],
  ): Promise<T[]>;
  get<T = Record<string, unknown>>(
    sql: string,
    params?: (string | number | null)[],
  ): Promise<T | undefined>;
  run(sql: string, params?: (string | number | null)[]): Promise<unknown>;
  transaction<T>(work: (tx: SnapshotDb) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export interface StorageIO {
  cacheDir: string;
  documentDir: string;
  mkdir(path: string): Promise<unknown>;
  readText(path: string): Promise<string>;
  writeText(path: string, text: string): Promise<unknown>;
  copy(source: string, destination: string): Promise<unknown>;
  remove(path: string): Promise<unknown>;
  dirSize(path: string): Promise<number>;
  exists(path: string): Promise<boolean>;
  zip(sourceDir: string, destination: string): Promise<unknown>;
  unzip(source: string, destination: string): Promise<unknown>;
  pickBackup(): Promise<string | null>;
  share(path: string, mime: string): Promise<unknown>;
  saveDownloads(path: string, name: string, mime: string): Promise<string>;
  openSnapshot(path: string): Promise<SnapshotDb>;
  /** Called after the active container has closed; replace must retain its own rollback copy. */
  replaceDatabase(path: string): Promise<void>;
  restart(): Promise<void>;
}
export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}
