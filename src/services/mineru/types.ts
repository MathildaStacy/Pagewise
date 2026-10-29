import type { BlockType } from '@core/types';

export const MINERU_API_BASE = 'https://mineru.net/api/v4';
export const MINERU_MAX_PAGES = 200;
export const MINERU_MAX_BYTES = 200_000_000;
export const MINERU_TARGET_BYTES = 190_000_000;
export const MINERU_DAILY_PRIORITY_PAGES = 1000;
export type MineruModel = 'vlm' | 'pipeline';
export type MineruState =
  | 'waiting-file'
  | 'pending'
  | 'running'
  | 'converting'
  | 'done'
  | 'failed';
export type MineruFailureKind =
  | 'auth'
  | 'too_large'
  | 'queue_full'
  | 'daily_limit'
  | 'invalid_file'
  | 'service'
  | 'network'
  | 'timeout'
  | 'cancelled'
  | 'protocol';
const invalidFiles = new Set([
  '-60002',
  '-60003',
  '-60004',
  '-60011',
  '-60015',
  '-60020',
  '-60021',
]);
export function mineruFailureKind(code: string): MineruFailureKind {
  if (code === 'A0202' || code === 'A0211' || code === 'missing_token')
    return 'auth';
  if (code === '-60005' || code === '-60006') return 'too_large';
  if (code === '-60009') return 'queue_full';
  if (code === '-60018') return 'daily_limit';
  if (invalidFiles.has(code)) return 'invalid_file';
  if (
    code === 'network' ||
    code === 'timeout' ||
    code === 'cancelled' ||
    code === 'protocol'
  )
    return code;
  return 'service';
}
const messages: Record<MineruFailureKind, string> = {
  auth: 'MinerU Token 不对，请在「我的 → 解析服务」更新',
  too_large: '文件太大或页数超限，需要拆成更小的片',
  queue_full: 'MinerU 提交队列已满，60 秒后重试',
  daily_limit: '今天的解析任务数已到上限，明天再解析',
  invalid_file: 'MinerU 读不了这个文件，请检查格式后重试',
  service: 'MinerU 服务暂时不可用，请稍后重试',
  network: '连不上 MinerU，请检查网络后继续',
  timeout: 'MinerU 请求超时，请稍后继续',
  cancelled: '已停止',
  protocol: 'MinerU 返回了无法读取的结果，请重试',
};
/** Never retain a raw response body: providers may echo authentication headers. */
export class MineruError extends Error {
  readonly kind: MineruFailureKind;
  constructor(readonly code: string, readonly status?: number) {
    const kind = mineruFailureKind(code);
    super(
      code === 'A0211'
        ? 'MinerU Token 已过期，请在「我的 → 解析服务」更新'
        : code === 'missing_token'
        ? '请先在「我的 → 解析服务」填写 MinerU Token'
        : messages[kind],
    );
    this.name = 'MineruError';
    this.kind = kind;
  }
}
export interface MineruResult {
  fileName: string;
  dataId?: string;
  state: MineruState;
  progress?: { extractedPages: number; totalPages: number };
  zipUrl?: string;
  error?: MineruError;
}
export type TransferProgress = (sent: number, total: number) => void;
export interface RequestOptions {
  signal?: AbortSignal;
}
export interface MineruUploadFile {
  name: string;
  dataId: string;
  ocr: boolean;
}
export interface MineruClient {
  requestUpload(
    files: MineruUploadFile[],
    model: MineruModel,
    opts?: RequestOptions,
  ): Promise<{ batchId: string; urls: string[] }>;
  upload(
    url: string,
    filePath: string,
    onProgress: TransferProgress,
    signal: AbortSignal,
  ): Promise<void>;
  query(batchId: string, opts?: RequestOptions): Promise<MineruResult[]>;
  download(
    zipUrl: string,
    destDir: string,
    onProgress: TransferProgress,
    opts?: RequestOptions,
  ): Promise<string>;
  test(
    opts?: RequestOptions,
  ): Promise<{ ok: boolean; latencyMs: number; error?: MineruError }>;
}
export type MineruRequest = (
  url: string,
  init: {
    method: 'GET' | 'POST';
    headers: Record<string, string>;
    body?: string;
    signal: AbortSignal;
  },
) => Promise<{ status: number; text(): Promise<string> }>;
export interface TransferOptions {
  headers: Record<string, string>;
  signal: AbortSignal;
  onProgress: TransferProgress;
}
/** Device composition uses streaming file IO; tests never need native libraries. */
export interface MineruFilesPort {
  put(
    url: string,
    filePath: string,
    opts: TransferOptions,
  ): Promise<{ status: number }>;
  download(
    url: string,
    filePath: string,
    opts: TransferOptions,
  ): Promise<{ status: number }>;
  unzip(zipPath: string, destDir: string, signal?: AbortSignal): Promise<void>;
  mkdir(path: string): Promise<void>;
  remove(path: string): Promise<void>;
}
export interface PageSize {
  w: number;
  h: number;
}
export interface RawBlock {
  seq: number;
  page: number;
  bbox: [number, number, number, number] | null;
  type: BlockType;
  level?: number;
  text: string;
  latex?: string;
  html?: string;
  imageFile?: string;
  caption?: string;
}
export interface PrintedPageNumber {
  page: number;
  printed: number;
}
export interface AdaptedResult {
  blocks: RawBlock[];
  pageNumbers: PrintedPageNumber[];
  pagesWithContent: number[];
}
export type CoordinateSystem = 'auto' | 'relative' | 'normalized1000' | 'page';
export interface AdapterOptions {
  pageFrom: number;
  pageSizes?: readonly PageSize[];
  layout?: unknown;
  coordinateSystem?: CoordinateSystem;
}
export interface AdapterFilesPort {
  list(dir: string): Promise<string[]>;
  readText(path: string): Promise<string>;
}
export interface PageRange {
  pageFrom: number;
  pageTo: number;
}
export interface PlannedPart extends PageRange {
  estimatedBytes: number;
}
