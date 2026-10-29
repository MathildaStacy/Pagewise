import type {
  Block,
  Highlight,
  Message,
  OutlineEntry,
  Pin,
  Section,
  SectionFlag,
  SectionPart,
} from '../types';
export type OutlineItem = OutlineEntry;
export interface PageNumberSample {
  page: number;
  label?: string | number;
  printed?: number;
}
export interface MapOptions {
  bookId?: string;
  pageLabels?: readonly string[] | null;
  /** Page-number detections retained by the adapter before footer blocks are discarded. */
  pageNumbers?: readonly PageNumberSample[];
}
export interface MapFlag {
  sectionId: string;
  kind: SectionFlag;
  detail: Record<string, unknown>;
}
export interface MapResult {
  sections: Section[];
  parts: SectionPart[];
  flags: MapFlag[];
  pageOffset: number;
  pageLabels: readonly string[] | null;
  pageOffsetReliable: boolean;
}
export interface BlockMatch {
  oldSeq: number;
  newSeq: number;
  similarity: number;
  pageDelta: number | null;
}
export interface BlockMigration {
  matches: BlockMatch[];
  mapping: Record<number, number>;
  unmatched: number[];
}
export interface ReferencedRecords {
  messages?: readonly Message[];
  highlights?: readonly Highlight[];
  pins?: readonly Pin[];
}
export interface MovedReference {
  kind: 'message' | 'highlight' | 'pin';
  id: number;
  oldSeq: number;
  label: '原文位置已变化';
}
export interface MigratedReferences {
  messages: Message[];
  highlights: Highlight[];
  pins: Pin[];
  orphaned: { highlights: Highlight[]; pins: Pin[] };
  moved: MovedReference[];
}
export type MapBlock = Block;
