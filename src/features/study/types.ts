import type { ComposerQuote, PageOrigProps, RichDoc } from '@ui/kit';
import type { StudyOpenOptions } from '@app/study/types';

export interface StudyEntryOptions extends StudyOpenOptions {
  /** Fill the editable composer and wait for the user to send. */
  draftQuestion?: string;
}

export type QuickKey =
  | 'next'
  | 'nextPart'
  | 'nextSection'
  | 'alt'
  | 'example'
  | 'derive'
  | 'skip'
  | 'quiz'
  | 'source'
  | 'backMain'
  | 'detourSource'
  | 'reviewOk'
  | 'reviewAgain'
  | 'reteachSection';
export type Rect = { x: number; y: number; w: number; h: number };
export type StepState = 'done' | 'current' | 'skipped' | 'todo';
export type BlockMenuKey =
  | 'explain'
  | 'translate'
  | 'ask'
  | 'startHere'
  | 'highlight'
  | 'unhighlight'
  | 'note';
export type ThreadItem =
  | {
      kind: 'history';
      id: string;
      label: string;
      expanded: boolean;
      items: ThreadItem[];
    }
  | { kind: 'divider'; id: string; text: string; tone: 'main' | 'detour' }
  | {
      kind: 'stepHeader';
      id: string;
      step: number;
      label: string;
      title: string;
      pages: string;
    }
  | { kind: 'user'; id: string; text: string; quote?: string; detour: boolean }
  | {
      kind: 'ai';
      id: string;
      doc: RichDoc;
      streaming: boolean;
      detour: boolean;
    }
  | {
      kind: 'tools';
      id: string;
      lines: { text: string; running: boolean }[];
      detour: boolean;
    }
  | {
      kind: 'resume';
      id: string;
      title: string;
      lines: string[];
      actions: { key: 'go' | 'review'; label: string; primary?: boolean }[];
    }
  | {
      kind: 'fold';
      id: string;
      title: string;
      count: string;
      expanded: boolean;
      items: ThreadItem[];
    }
  | { kind: 'detourRun'; id: string; items: ThreadItem[] }
  | {
      kind: 'quiz';
      id: string;
      title: string;
      question: string;
      options: { label: string; state: 'idle' | 'right' | 'wrong' | 'muted' }[];
      locked: boolean;
      explain?: string;
    }
  | {
      kind: 'proposal';
      id: string;
      title: string;
      body: string;
      state: 'pending' | 'accepted' | 'dismissed';
      resultText?: string;
      actions: { key: 'accept' | 'dismiss'; label: string }[];
    }
  | { kind: 'done'; id: string; title: string; text: string }
  | { kind: 'typing'; id: string }
  | { kind: 'error'; id: string; text: string; retry: boolean };
export interface ReaderBlock {
  kind: 'block';
  ref: string;
  seq: number;
  type: string;
  doc: RichDoc;
  page: string;
  marks: ('heard' | 'now' | 'highlight' | 'selected' | 'flash')[];
  pin?: { id: string; label: string };
  uri?: string;
  table?: string[][];
}
export type ReaderItem =
  | ReaderBlock
  | { kind: 'pageBreak'; page: string; id: string };
export interface ReaderOriginalPage {
  page: number;
  label: string;
  image: { uri: string; w: number; h: number } | null;
  size: { w: number; h: number };
  blocks: (PageOrigProps['blocks'][number] & { pinId?: string })[];
}
export interface ReaderState {
  view: 'orig' | 'flow';
  hint: string;
  loading: boolean;
  error: string | null;
  guide: {
    oneLine: string;
    full?: string;
    expanded: boolean;
    loading: boolean;
  } | null;
  items: ReaderItem[];
  original?: {
    available: boolean;
    reason?: string;
    pages: ReaderOriginalPage[];
    error?: string;
    loading: boolean;
  };
  scrollTo?: { ref: string; flash: boolean; token: number };
  readEnd: { visible: boolean; label: string; hint: string };
  selection: null | {
    ref: string;
    anchor: Rect;
    items: { key: BlockMenuKey; label: string }[];
  };
}
export type StudyOverlay =
  | {
      kind: 'menu';
      title?: string;
      rows: { key: string; title: string; sub: string }[];
    }
  | {
      kind: 'roadmap';
      title: string;
      steps: {
        title: string;
        pages: string;
        state: StepState;
        kindLabel: string;
      }[];
    }
  | { kind: 'jumpStep'; index: number; title: string; body: string }
  | {
      kind: 'context';
      layers: {
        name: string;
        detail: string;
        tokens: string;
        value: number;
        cached: boolean;
      }[];
      total: string;
      lastActual?: string;
      note: string;
    }
  | {
      kind: 'peek';
      seq: number;
      title: string;
      subtitle: string;
      blocks: { ref: string; doc: RichDoc; target: boolean }[];
      detour: boolean;
    }
  | { kind: 'figure'; uri: string; caption: string; page: string }
  | {
      kind: 'explain' | 'translate';
      seq: number;
      quote: RichDoc;
      answer: RichDoc | null;
      streaming: boolean;
      subtitle: string;
      error?: string;
    }
  | {
      kind: 'pin';
      seq: number;
      title: string;
      answer: RichDoc;
      subtitle: string;
    }
  | {
      kind: 'note';
      seq: number;
      quote: RichDoc;
      value: string;
      subtitle: string;
    }
  | { kind: 'switchMain'; body: string; rebase?: boolean }
  | { kind: 'table'; rows: string[][]; caption: string };
export interface StudyState {
  header: {
    title: string;
    subtitle: string;
    readSubtitle?: string;
    backLabel: string;
  };
  mode: 'listen' | 'read';
  loading: boolean;
  toast: string | null;
  listen: {
    progress: { label: string; steps: { title: string; state: StepState }[] };
    detour: null | { title: string; backLabel: string };
    thread: ThreadItem[];
    scroll: { toEndToken: number; toItemId?: string; toItemToken?: number };
    quickActions: {
      key: QuickKey;
      label: string;
      kind?: 'primary' | 'detour';
    }[];
    composer: {
      value: string;
      focusRequest?: number;
      placeholder: string;
      canSend: boolean;
      streaming: boolean;
      quote: ComposerQuote | null;
    };
    busy: boolean;
  };
  read: ReaderState;
  overlay: StudyOverlay | null;
}
export interface StudyIntents {
  back(): void;
  setMode(mode: 'listen' | 'read'): void;
  openMenu(): void;
  openAdd?(): void;
  menuSelect(key: string): void;
  quick(key: string): void;
  setText(text: string): void;
  send(): void;
  stop(): void;
  clearQuote(): void;
  pressStep(index: number): void;
  openRoadmap(): void;
  openContext(): void;
  pressCite(ref: number): void;
  pressFigure(ref: number): void;
  pressTable(ref: string): void;
  toggleFold(id: string): void;
  toggleHistory(): void;
  answerQuiz(id: string, index: number): void;
  resolveProposal(id: string, accept: boolean): void;
  resumeAction(key: string): void;
  retry(id?: string): void;
  setView(view: 'orig' | 'flow'): void;
  requestPage?(page: number, widthPx: number): void;
  toggleGuide(): void;
  pressBlock(ref: string, anchor: Rect): void;
  menuAction(key: string): void;
  reportAnchor(ref: string): void;
  pressPin(id: string): void;
  finishReading(): void;
  overlayAction(key: string): void;
  setNoteText(text: string): void;
  closeOverlay(): void;
}
export interface ReaderScreenState {
  header: StudyState['header'];
  read: ReaderState;
  overlay: StudyOverlay | null;
  toast: string | null;
}
export interface SectionDoneState {
  hero: { kicker: string; title: string; stats: string };
  summary: { value: string; hint: string };
  stuck: { id: string; text: string; checked: boolean }[];
  cards: {
    id: string;
    front: string;
    back: string;
    checked: boolean;
    fromDetour: boolean;
  }[];
  detours: { q: string; where: string }[];
  next: null | { label: string; hint: string };
  loading: boolean;
  error?: string;
  saving: boolean;
  toast: string | null;
  editing: null | { id: string; front: string; back: string };
}
export interface SectionDoneIntents {
  back(): void;
  setSummary(text: string): void;
  toggleStuck(id: string): void;
  toggleCard(id: string): void;
  openEditCard(id: string): void;
  setEditFront(text: string): void;
  setEditBack(text: string): void;
  closeEditCard(): void;
  saveEditCard(): void;
  editCard(id: string, front: string, back: string): void;
  retry(): void;
  save(): void;
}
