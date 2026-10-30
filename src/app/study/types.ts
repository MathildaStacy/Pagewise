import type { StoreApi } from 'zustand/vanilla';
import type {
  Block,
  Book,
  DetourFrame,
  JsonValue,
  LessonPlan,
  Message,
  Section,
  SectionPart,
  StudyPhase,
} from '@core/types';
import type { LayerEstimate } from '@core/context';
import type { Usage } from '@services/ai/types';
import type { TeachPrefs } from '../usecases/settings';

export type QuickKey =
  | 'next'
  | 'skip'
  | 'alt'
  | 'example'
  | 'derive'
  | 'quiz'
  | 'nextPart'
  | 'nextSection'
  | 'reteachSection'
  | 'source'
  | 'backMain'
  | 'detourSource'
  | 'reviewOk'
  | 'reviewAgain';
export interface StudyOpenOptions {
  mode?: 'read' | 'listen';
  sectionId?: string;
  blockRef?: string;
  question?: string;
  stuckId?: number;
  /** Independent Reader entry can show another section without moving the main pointer. */
  preserveMain?: boolean;
  autoStart?: boolean;
}
export interface StudyStreaming {
  entryId: string;
  text: string;
  allowedRefs: number[];
  detourId: number | null;
}
export interface StudyState {
  bookId: string;
  book: Book | null;
  section: Section | null;
  sections: Section[];
  blocks: Block[];
  partBlocks: Block[];
  parts: SectionPart[];
  plan: LessonPlan | null;
  main: { sectionId: string; part: number; step: number };
  phase: StudyPhase;
  detours: DetourFrame[];
  mode: 'read' | 'listen';
  readerView: 'orig' | 'flow';
  readerSectionId: string | null;
  readAnchor: number | null;
  flashRef: number | null;
  messages: Message[];
  streaming: StudyStreaming | null;
  busy: boolean;
  loading: boolean;
  pendingQuote: number | null;
  tools: { id: string; text: string; running: boolean; detour: boolean }[];
  error: string | null;
  notice: string | null;
  context: LayerEstimate[];
  lastUsage: Usage | null;
  unverifiedStreak: number;
  scrollToStep: number | null;
  prefs: TeachPrefs;
  stuckCandidates: string[];
  draft: SectionDraft | null;
  /** 由流式条目落库而来的消息沿用原列表 key，避免重新挂载。 */
  streamKeys: Record<number, string>;
}
export interface QuizCard {
  kind: 'quiz';
  question: string;
  options: string[];
  answer: number;
  explain: string;
  final: boolean;
  picked: number | null;
  /** The user may ask for help or skip without claiming to have answered correctly. */
  deferred?: boolean;
  toolCall?: { id: string; name: string };
}
export interface ProposalCard {
  kind: 'proposal';
  type: 'mark_stuck' | 'advance_progress';
  title: string;
  body: string;
  state: 'pending' | 'accepted' | 'dismissed';
  text?: string;
  to?: 'next_step' | 'next_part' | 'section_done';
  toolCall?: { id: string; name: string };
}
export type StudyCard =
  | QuizCard
  | ProposalCard
  | { kind: 'divider'; text: string; tone: 'main' | 'detour' }
  | {
      kind: 'stepHeader';
      step: number;
      label: string;
      title: string;
      pages: string;
    }
  | {
      kind: 'resume';
      title: string;
      lines: string[];
      hasStuck: boolean;
      stuckId?: number;
    }
  | {
      kind: 'fold';
      title: string;
      summary: string;
      count: number;
      messageIds: number[];
      detourIds: number[];
      sectionId: string;
    }
  | { kind: 'done'; title: string; text: string }
  | { kind: 'partSummary'; part: number; summary: string }
  | { kind: 'tools'; text: string };
export interface SectionDraft {
  id: string;
  bookId: string;
  sectionId: string;
  summary: string;
  stuck: { id: string; text: string; checked: boolean }[];
  cards: {
    id: string;
    front: string;
    back: string;
    checked: boolean;
    fromDetour: boolean;
  }[];
  detours: { q: string; where: string }[];
  nextSection: Section | null;
  error?: string;
}
export interface FinishSectionInput {
  bookId: string;
  sectionId: string;
  summary: string;
  stuck: readonly { text: string; checked: boolean }[];
  cards: readonly {
    front: string;
    back: string;
    checked: boolean;
    fromDetour?: boolean;
  }[];
}
export interface StudySessionApi {
  store: StoreApi<StudyState>;
  open(options?: StudyOpenOptions): Promise<void>;
  act(key: QuickKey): Promise<void>;
  send(text: string): Promise<void>;
  retry(): Promise<void>;
  stop(): void;
  setMode(mode: 'read' | 'listen', anchor?: number): Promise<void>;
  setReaderView(view: 'orig' | 'flow'): Promise<void>;
  reportAnchor(seq: number): void;
  jumpStep(index: number): Promise<void>;
  backMain(rebase?: boolean): Promise<void>;
  answerQuiz(messageId: number, index: number): Promise<void>;
  deferQuiz?(messageId: number): Promise<void>;
  resolveProposal(messageId: number, accept: boolean): Promise<void>;
  resume(action: 'go' | 'review'): Promise<void>;
  setQuote(seq: number | null): void;
  finishDraft(): Promise<SectionDraft | null>;
  saveDraft(input: FinishSectionInput): Promise<Section | null>;
  explainBlock(
    seq: number,
    kind: 'explain' | 'translate',
    signal?: AbortSignal,
  ): Promise<string>;
  generateGuide(): Promise<string>;
  clearNotice(): void;
  dispose(): Promise<void>;
}
export function parseStudyCard(content: string): StudyCard | null {
  try {
    const value: unknown = JSON.parse(content);
    return value && typeof value === 'object' && 'kind' in value
      ? (value as StudyCard)
      : null;
  } catch {
    return null;
  }
}
export function asJson(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}
