import type { BlockInsert, Section, SectionPart } from '@core/types';
export interface EpubIo {
  unzip(source: string, destination: string): Promise<void>;
  readText(path: string): Promise<string>;
  mkdir(path: string): Promise<void>;
  copyFile(source: string, destination: string): Promise<void>;
}
export interface EpubManifestItem {
  id: string;
  path: string;
  mediaType: string;
  properties: string[];
}
export interface EpubSpineItem {
  idref: string;
  linear: boolean;
}
export interface EpubTocEntry {
  title: string;
  path: string | null;
  anchor: string | null;
  level: number;
  children: EpubTocEntry[];
}
export interface EpubInspection {
  title: string;
  author: string;
  language: string;
  identifier: string;
  rootPath: string;
  opfPath: string;
  manifest: EpubManifestItem[];
  spine: EpubSpineItem[];
  toc: EpubTocEntry[];
  coverPath: string | null;
}
export interface EpubWarning {
  code:
    | 'missing_toc_anchor'
    | 'missing_image'
    | 'unsupported_resource'
    | 'empty_spine_item';
  path: string;
}
export interface EpubParseResult {
  title: string;
  author: string;
  language: string;
  identifier: string;
  blocks: BlockInsert[];
  sections: Section[];
  parts: SectionPart[];
  toc: EpubTocEntry[];
  warnings: EpubWarning[];
}
export interface EpubParser {
  /** destination is the book directory; archive entries are extracted beneath destination/epub. */
  inspect(source: string, destination: string): Promise<EpubInspection>;
  parse(
    source: string,
    destination: string,
    bookId: string,
  ): Promise<EpubParseResult>;
}
export class EpubError extends Error {
  constructor(
    readonly code:
      | 'invalid_archive'
      | 'invalid_metadata'
      | 'invalid_path'
      | 'unreadable_spine',
    message: string,
  ) {
    super(message);
    this.name = 'EpubError';
  }
}
