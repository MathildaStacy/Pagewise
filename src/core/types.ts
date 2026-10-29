/** Domain records mirror docs/dev/04-data.md; nullable SQL columns stay explicit. */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };
export type ISODateTime = string;
export type LocalDate = string;

type NullableKeys<T> = {
  [K in keyof T]-?: null extends T[K] ? K : never;
}[keyof T];
/** SQLite supplies declared defaults and NULL for omitted nullable columns. */
export type InsertRecord<T, Defaults extends keyof T = never> = Omit<
  T,
  NullableKeys<T> | Defaults
> &
  Partial<Pick<T, NullableKeys<T> | Defaults>>;

export type BookFormat = 'pdf' | 'epub';
export type BookStatus =
  | 'importing'
  | 'parsing'
  | 'paused'
  | 'ready'
  | 'failed';
export type ParseModel = 'vlm' | 'pipeline';
export interface OutlineEntry {
  title: string;
  page: number;
  level: number;
}
export interface Book {
  id: string;
  sha256: string;
  title: string;
  author: string;
  format: BookFormat;
  pages: number | null;
  size_bytes: number;
  has_text_layer: boolean | null;
  has_outline: boolean | null;
  outline: OutlineEntry[] | null;
  page_offset: number;
  cover_color: string;
  parse_model: ParseModel | null;
  ocr: boolean;
  priority_from: number;
  status: BookStatus;
  ready_to_page: number;
  tokens_total: number;
  created_at: ISODateTime;
  last_opened_at: ISODateTime | null;
}
export type BookInsert = InsertRecord<
  Book,
  | 'author'
  | 'page_offset'
  | 'ocr'
  | 'priority_from'
  | 'ready_to_page'
  | 'tokens_total'
>;
export type BookPatch = Partial<Omit<Book, 'id'>>;

export type PartStage =
  | 'queued'
  | 'splitting'
  | 'requesting'
  | 'uploading'
  | 'waiting'
  | 'running'
  | 'downloading'
  | 'importing'
  | 'done'
  | 'failed';
export interface BookPart {
  book_id: string;
  part_no: number;
  page_from: number;
  page_to: number;
  file_path: string | null;
  size_bytes: number | null;
  batch_id: string | null;
  data_id: string | null;
  stage: PartStage;
  extracted_pages: number | null;
  total_pages: number | null;
  error_code: string | null;
  error_msg: string | null;
  attempts: number;
  next_poll_at: ISODateTime | null;
  updated_at: ISODateTime;
}
export type BookPartInsert = InsertRecord<BookPart, 'attempts'>;
export type BookPartPatch = Partial<Omit<BookPart, 'book_id' | 'part_no'>>;

export type BlockType =
  | 'title'
  | 'text'
  | 'equation'
  | 'image'
  | 'table'
  | 'list'
  | 'code'
  | 'caption'
  | 'footnote';
export interface Block {
  id: number;
  book_id: string;
  seq: number;
  page: number | null;
  loc: string | null;
  x0: number | null;
  y0: number | null;
  x1: number | null;
  y1: number | null;
  type: BlockType;
  level: number | null;
  text: string;
  latex: string | null;
  html: string | null;
  image_path: string | null;
  section_id: string | null;
  chars: number;
}
export type BlockInsert = InsertRecord<Block, 'id' | 'text'>;
export type BlockPatch = Partial<Omit<Block, 'id' | 'book_id' | 'seq'>>;
export interface BlockSearchHit {
  book_id: string;
  seq: number;
  ref: `b${number}`;
  page: number | null;
  loc: string | null;
  section_id: string | null;
  text: string;
  snippet: string;
}

export type SectionStatus = 'new' | 'learning' | 'done';
export type SectionSource = 'auto' | 'bookmark' | 'manual';
export type SectionFlag = 'missing' | 'level' | 'merged' | 'split';
export interface Section {
  book_id: string;
  id: string;
  parent_id: string | null;
  level: 1 | 2 | 3;
  ord: number;
  no: string | null;
  title: string;
  is_leaf: boolean;
  block_from: number | null;
  block_to: number | null;
  page_from: number | null;
  page_to: number | null;
  chars: number;
  parts: number;
  status: SectionStatus;
  summary: string | null;
  guide: string | null;
  source: SectionSource;
  flag: SectionFlag | null;
  flag_detail: JsonValue | null;
  merged_into: string | null;
}
export type SectionInsert = InsertRecord<Section, 'chars' | 'parts' | 'status'>;
export type SectionPatch = Partial<Omit<Section, 'book_id' | 'id'>>;
export interface SectionPart {
  book_id: string;
  section_id: string;
  part_no: number;
  block_from: number;
  block_to: number;
  name: string;
}
export type SectionPartInsert = SectionPart;

export type LessonStepKind =
  | 'intuition'
  | 'definition'
  | 'derivation'
  | 'example'
  | 'check';
export type LessonStepStatus = 'todo' | 'current' | 'done' | 'skipped';
export interface LessonStep {
  no: number;
  title: string;
  kind: LessonStepKind;
  block_from: number;
  block_to: number;
  status: LessonStepStatus;
}
export interface LessonPlan {
  book_id: string;
  section_id: string;
  part_no: number;
  steps: LessonStep[];
  source: 'model' | 'fallback';
  created_at: ISODateTime;
}
export type LessonPlanInsert = LessonPlan;

/** The persisted JSON stack retains the engine's published camelCase payload. */
export interface DetourFrame {
  sectionId: string;
  detourId: number;
  reviewStuckId?: number;
}
export type StudyPhase = 'idle' | 'planning' | 'teaching' | 'quiz' | 'ready';
export interface StudyState {
  book_id: string;
  main_section: string | null;
  main_part: number;
  main_step: number;
  phase: StudyPhase;
  detours: DetourFrame[];
  mode: 'listen' | 'read';
  reader_view: 'orig' | 'flow';
  read_anchor: number | null;
  resume_shown_at: ISODateTime | null;
  last_active_at: ISODateTime | null;
}
export type StudyStateInsert = InsertRecord<
  StudyState,
  'main_part' | 'main_step' | 'phase' | 'detours' | 'mode' | 'reader_view'
>;
export type StudyStatePatch = Partial<Omit<StudyState, 'book_id'>>;
export interface Detour {
  id: number;
  book_id: string;
  from_section: string;
  to_section: string;
  depth: number;
  title: string | null;
  stuck_id: number | null;
  started_at: ISODateTime;
  ended_at: ISODateTime | null;
}
export type DetourInsert = InsertRecord<Detour, 'id'>;

export type MessageKind = 'user' | 'assistant' | 'tool' | 'card';
export interface Message {
  id: number;
  book_id: string;
  section_id: string;
  part_no: number | null;
  step_no: number | null;
  kind: MessageKind;
  intent: string | null;
  content: string;
  parts: JsonValue[] | null;
  raw: JsonValue | null;
  allowed_refs: number[] | null;
  unverified: number;
  detour_id: number | null;
  quote_seq: number | null;
  in_context: boolean;
  usage: JsonValue | null;
  created_at: ISODateTime;
}
export type MessageInsert = InsertRecord<
  Message,
  'id' | 'unverified' | 'in_context'
>;
export type MessagePatch = Partial<
  Omit<Message, 'id' | 'book_id' | 'section_id'>
>;
export interface Qa {
  id: number;
  book_id: string;
  section_id: string;
  q: string;
  a: string;
  from_section: string | null;
  detour_id: number | null;
  message_ids: number[];
  created_at: ISODateTime;
}
export type QA = Qa;
export type QaInsert = InsertRecord<Qa, 'id'>;
export type QAInsert = QaInsert;
export interface Stuck {
  id: number;
  book_id: string;
  section_id: string;
  text: string;
  source: 'ai' | 'quiz' | 'card' | 'user' | 'section_end';
  card_id: number | null;
  resolved_at: ISODateTime | null;
  created_at: ISODateTime;
}
export type StuckInsert = InsertRecord<Stuck, 'id'>;
export interface SectionNote {
  book_id: string;
  section_id: string;
  user_text: string;
  updated_at: ISODateTime;
}
export type SectionNoteInsert = InsertRecord<SectionNote, 'user_text'>;
export interface Highlight {
  id: number;
  book_id: string;
  block_seq: number;
  start: number | null;
  end: number | null;
  color: string;
  note: string | null;
  created_at: ISODateTime;
}
export type HighlightInsert = InsertRecord<Highlight, 'id' | 'color'>;
export interface Pin {
  id: number;
  book_id: string;
  block_seq: number;
  section_id: string;
  question: string;
  answer_summary: string;
  message_ids: number[];
  created_at: ISODateTime;
}
export type PinInsert = InsertRecord<Pin, 'id'>;

export type CardBox = 1 | 2 | 3 | 4 | 5;
export type CardRating = 'again' | 'hard' | 'good';
export interface Card {
  id: number;
  book_id: string;
  section_id: string;
  front: string;
  back: string;
  box: CardBox;
  due_on: LocalDate;
  origin: 'section_end' | 'detour' | 'manual';
  created_at: ISODateTime;
}
export type CardInsert = InsertRecord<Card, 'id' | 'box'>;
export interface ReviewLog {
  id: number;
  card_id: number;
  rated: CardRating;
  box_from: number;
  box_to: number;
  at: ISODateTime;
}
export type ReviewLogInsert = InsertRecord<ReviewLog, 'id'>;
export interface AiUsage {
  id: number;
  book_id: string | null;
  provider_id: string;
  model: string;
  purpose: string;
  input: number;
  cache_read: number;
  cache_write: number;
  output: number;
  cache_reported: boolean;
  at: ISODateTime;
}
export type AiUsageInsert = InsertRecord<AiUsage, 'id'>;
export interface Setting<T = JsonValue> {
  key: string;
  value: T;
}
export interface MathCache {
  key: string;
  svg: string;
  width: number;
  height: number;
  baseline: number;
  used_at: ISODateTime;
}
export type MathCacheInsert = MathCache;
export interface ImportDraft {
  id: string;
  file_path: string;
  info: JsonValue;
  created_at: ISODateTime;
}
export type ImportDraftInsert = ImportDraft;
