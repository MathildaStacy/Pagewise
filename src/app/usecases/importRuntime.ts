import type {
  BlockInsert,
  OutlineEntry,
  Section,
  SectionPart,
} from '@core/types';
import type {
  AdaptedResult,
  MineruClient,
  PageSize,
} from '@services/mineru/types';
import type { Container } from '../container';

export interface IntakeFile {
  uri: string;
  name: string | null;
  mime: string | null;
}
export interface ImportFiles {
  documentDir: string;
  cacheDir: string;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
  copy(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
  sha256(path: string): Promise<string>;
  copyFromUri(
    uri: string,
    dest: string,
  ): Promise<{
    size: number;
    name: string | null;
    mime: string | null;
  }>;
}
export interface EpubImportPort {
  inspect(
    source: string,
    bookDirectory: string,
  ): Promise<{
    title: string;
    author: string;
  }>;
  parse(
    source: string,
    bookDirectory: string,
    bookId: string,
  ): Promise<{
    blocks: BlockInsert[];
    sections: Section[];
    parts: SectionPart[];
    warnings?: string[];
  }>;
}
/** All native and network dependencies are supplied by device composition or tests. */
export interface ImportRuntime {
  files: ImportFiles;
  chooseFile(): Promise<IntakeFile | null>;
  pdf: {
    render(
      path: string,
      page: number,
      widthPx: number,
    ): Promise<{ uri: string; w: number; h: number }>;
    info(path: string): Promise<{
      pageCount: number;
      sizes: PageSize[];
      title: string | null;
      author: string | null;
    }>;
    textLayer(
      path: string,
      pages: number[],
    ): Promise<{ withText: number; sampled: number }>;
    outline(path: string): Promise<OutlineEntry[]>;
    pageLabels(path: string): Promise<string[] | null>;
    split(
      path: string,
      from: number,
      to: number,
      out: string,
    ): Promise<{ sizeBytes: number }>;
    close(path: string): Promise<void>;
  };
  mineru: MineruClient;
  adapt(
    dir: string,
    part: { pageFrom: number },
    sizes: PageSize[],
  ): Promise<AdaptedResult>;
  epub?: EpubImportPort;
}
const runtimes = new WeakMap<Container, ImportRuntime>();
export function configureImportRuntime(
  c: Container,
  runtime: ImportRuntime,
): void {
  runtimes.set(c, runtime);
}
export function getImportRuntime(c: Container): ImportRuntime {
  const runtime = runtimes.get(c);
  if (!runtime) throw new Error('文件导入暂时不可用，请重新打开 Pagewise');
  return runtime;
}
export const bookDirectory = (runtime: ImportRuntime, bookId: string) =>
  `${runtime.files.documentDir}/books/${bookId}`;
export const sourcePath = (
  runtime: ImportRuntime,
  bookId: string,
  format = 'pdf',
) => `${bookDirectory(runtime, bookId)}/source.${format}`;
