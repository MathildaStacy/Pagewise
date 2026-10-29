export interface PageState {
  loading: boolean;
  error: string | null;
  toast: string | null;
}
export interface Cover {
  title: string;
  color: string;
}
export interface ShelfBook {
  id: string;
  title: string;
  author?: string;
  meta: string;
  cover: Cover;
  status: { tone: 'accent' | 'stuck' | 'bad' | 'muted'; text: string };
}
export interface ShelfState extends PageState {
  demo: boolean;
  continueCard: null | {
    bookId: string;
    kicker: string;
    title: string;
    meta: string;
    recap?: string;
    steps: { done: boolean }[];
    stepLabel: string;
  };
  books: ShelfBook[];
  empty: boolean;
  overlay:
    | null
    | {
        kind: 'import';
        recent: {
          key: string;
          name: string;
          meta: string;
          format: 'PDF' | 'EPUB';
        }[];
        note: string;
        busy: boolean;
      }
    | {
        kind: 'search';
        query: string;
        results: { id: string; title: string; meta: string }[];
      };
}
export interface ShelfIntents {
  refresh(): void;
  openContinue(): void;
  openBook(id: string): void;
  openImport(): void;
  openSearch(): void;
  setSearch(q: string): void;
  closeOverlay(): void;
  pickRecent(key: string): void;
  pickOther(): void;
}
export interface MapNode {
  id: string;
  label: string;
  level: 1 | 2 | 3;
  status: 'new' | 'learning' | 'done';
  current: boolean;
  pageLabel: string;
  tags: { tone: 'stuck'; label: string }[];
  flagged: boolean;
  expandable: boolean;
  expanded: boolean;
  children: MapNode[];
}
export interface MapChapter {
  id: string;
  no: string;
  title: string;
  meta: string;
  status: 'new' | 'learning' | 'done';
  current: boolean;
  expanded: boolean;
  children: MapNode[];
  leaf: boolean;
}
export interface SectionSheetState {
  id: string;
  title: string;
  subtitle: string;
  facts: { k: string; v: string }[];
  summary?: string;
  stuck: string[];
  actions: {
    key: 'read' | 'notes' | 'start';
    label: string;
    primary?: boolean;
  }[];
}
export interface SearchSheetState {
  kind: 'search';
  query: string;
  hint: string;
  results: {
    ref: string;
    title: string;
    snippet: { text: string; hit: boolean }[];
    page: string;
  }[];
  empty?: string;
  busy: boolean;
}
export interface BookMapState extends PageState {
  title: string;
  demo: boolean;
  check: { ok: boolean; text: string; sub?: string; tone: 'muted' | 'stuck' };
  chapters: MapChapter[];
  scrollToSectionId?: string;
  overlay:
    | null
    | ({ kind: 'section' } & SectionSheetState)
    | {
        kind: 'flag';
        id: string;
        title: string;
        body: string;
        confirm: string;
        cancel: string;
      }
    | {
        kind: 'changeMain';
        id: string;
        title: string;
        body: string;
        confirm: string;
        cancel: string;
      }
    | SearchSheetState;
}
export interface BookMapIntents {
  back(): void;
  refresh(): void;
  toggle(id: string): void;
  openSection(id: string): void;
  sectionAction(key: 'read' | 'notes' | 'start'): void;
  confirmFlag(): void;
  rejectFlag(): void;
  confirmStart(): void;
  openSearch(): void;
  setQuery(q: string): void;
  openResult(ref: string): void;
  closeOverlay(): void;
}
export interface ParseProgressState extends PageState {
  title: string;
  meta: string;
  cover: Cover | null;
  ready: boolean;
  footer: string;
  demo: boolean;
  parts: {
    number: number;
    label: string;
    statusText: string;
    tone: 'muted' | 'ok' | 'bad';
    progress: number;
    stages: { label: string; state: 'done' | 'current' | 'error' | 'todo' }[];
    error?: string;
    warning?: string;
  }[];
}
export interface ParseProgressIntents {
  back(): void;
  refresh(): void;
  retryPart(number: number, ocr?: boolean): void;
  retryBook?(): void;
  goUpdateToken(): void;
  openMap(): void;
}
export interface ImportSettingsState extends PageState {
  title: string;
  subtitle: string;
  fileName?: string;
  cover?: Cover;
  format: 'PDF' | 'EPUB';
  facts: { label: string; value: string }[];
  model: 'vlm' | 'pipeline';
  modelHint: string;
  ocr: boolean;
  priorityFrom: string;
  parts: string;
  quota: string;
  overQuota?: boolean;
  confirmUpload: boolean;
  canStart: boolean;
  overlay: boolean;
  demo: boolean;
}
export interface ImportSettingsIntents {
  back(): void;
  setModel(value: string): void;
  setOcr(value: boolean): void;
  setPriorityFrom(value: string): void;
  start(): void;
  confirm(): void;
  closeOverlay(): void;
}
