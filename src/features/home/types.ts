import type {
  ShelfState,
  ShelfIntents,
  ConversationSummary,
} from '../library/types';
import type { RichDoc } from '@ui/kit';
import type {
  AiOptionsState,
  ConversationConfig,
} from '@features/settings/types';
export interface HomeState {
  conversations?: ConversationSummary[];
  loading: boolean;
  error: string | null;
  demo: boolean;
  date: string;
  greeting: string;
  due: number;
  goal: number;
  reminder: boolean;
  shelf: ShelfState;
  books: {
    id: string;
    title: string;
    cover: { title: string; color: string; subtitle?: string };
    status: string;
    progress: number;
    progressLabel: string;
  }[];
  stuck: {
    id: number;
    bookId: string;
    sectionId: string;
    title: string;
    subtitle: string;
    solved: boolean;
  }[];
  stats: {
    streak: number;
    best: number;
    today: number;
    week: number[];
    month: number[];
    totals: { sections: number; cards: number; asks: number; detours: number };
  };
}
export interface HomeIntents {
  openConversation?(id: number): void;
  refresh(): void;
  ask(): void;
  me(): void;
  review(): void;
  stats(): void;
  shelf(): void;
  openBook(id: string): void;
  openContinue(mode: 'read' | 'listen'): void;
  openStuck(id: number): void;
  setup(page: 'MeAI' | 'MeMineru' | 'Welcome'): void;
  goal(value: string): void;
  reminder(value: boolean): void;
}
export type ImportIntents = ShelfIntents;
export interface AskHit {
  bookId: string;
  bookTitle: string;
  cover: { title: string; color: string };
  ref: string;
  sectionId: string;
  section: string;
  page: string;
  text: string;
}
export interface AskState {
  sources?: { url: string; title: string }[];
  aiOptions?: AiOptionsState;
  query: string;
  scope: string;
  books: { id: string; title: string }[];
  asked: string;
  answer: string;
  busy: boolean;
  done: boolean;
  tools: string[];
  hits: AskHit[];
  error: string | null;
  toast: string | null;
  demo: boolean;
  recent: string[];
  doc: RichDoc;
}
export interface AskIntents {
  openSource?(url: string): void;
  setAiOptions?(patch: Partial<ConversationConfig>): void;
  back(): void;
  query(value: string): void;
  scope(value: string): void;
  ask(value?: string): void;
  stop(): void;
  openHit(index: number): void;
  continue(): void;
  save(): void;
  clearToast(): void;
}
export interface WelcomeState {
  step: number;
  provider: string;
  key: string;
  baseUrl: string;
  model: string;
  token: string;
  expiry: string;
  busy: boolean;
  tested: boolean;
  notice: string | null;
  error: string | null;
  prefs: {
    intuitionFirst: boolean;
    length: '短' | '中' | '长';
    quizAtEnd: boolean;
    bilingual: boolean;
    extra: string;
  };
}
export interface WelcomeIntents {
  back(): void;
  skip(): void;
  next(): void;
  test(): void;
  provider(value: string): void;
  field(
    key: 'key' | 'baseUrl' | 'model' | 'token' | 'expiry',
    value: string,
  ): void;
  pref(
    key: 'intuitionFirst' | 'quizAtEnd' | 'bilingual' | 'length' | 'extra',
    value: boolean | string,
  ): void;
}
