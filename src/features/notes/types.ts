import type { RichDoc } from '@ui/kit';

export interface NoteSearchState {
  query: string;
  busy: boolean;
  results: {
    id: string;
    bookId: string;
    sectionId: string;
    kind: string;
    where: string;
    excerpt: string;
  }[];
  hasMore: boolean;
  error?: string;
}
export interface NotesState {
  books: {
    id: string;
    title: string;
    cover: { title: string; color: string };
    meta: string;
    hasNotes: boolean;
  }[];
  loading: boolean;
  error?: string;
  search?: NoteSearchState;
}
export interface NotesIntents {
  openBook(id: string): void;
  retry(): void;
  setSearchQuery?(query: string): void;
  retrySearch?(): void;
  openSearchResult?(id: string): void;
}
export interface NotesBookState {
  title: string;
  chapters: {
    title: string;
    sections: {
      id: string;
      label: string;
      status?: 'learning' | 'done';
      summary?: string;
      tags: { tone: 'default' | 'stuck' | 'detour'; label: string }[];
    }[];
  }[];
  overlay: null | {
    kind: 'export';
    format: 'md' | 'anki';
    tree: string;
    desc: string;
    strip: boolean;
    stripHint: string;
    busy: boolean;
  };
  loading: boolean;
  error?: string;
  notice?: string;
}
export interface NotesBookIntents {
  back(): void;
  openSection(id: string): void;
  openExport(): void;
  setFormat(value: string): void;
  setStrip(value: boolean): void;
  closeOverlay(): void;
  exportNow(): void;
  retry(): void;
}
export interface NoteDetailState {
  title: string;
  subtitle: string;
  canOpenSource: boolean;
  summary?: string;
  qa: { id?: string; q: string; a: string; messageIds?: number[] }[];
  detourQa: {
    id?: string;
    from: string;
    q: string;
    a: string;
    messageIds?: number[];
  }[];
  stuck: { text: string; resolved: boolean }[];
  highlights: { ref: string; text: string; page: string }[];
  pins: { ref: string; q: string; page: string }[];
  userText: string;
  loading: boolean;
  saveStatus: string;
  error?: string;
  conversation?: NoteConversationState | null;
}
export interface NoteConversationState {
  title: string;
  loading: boolean;
  error?: string;
  missing?: boolean;
  messages: {
    id: string;
    role: 'user' | 'assistant';
    doc: RichDoc;
    detour: boolean;
  }[];
}
export interface NoteDetailIntents {
  back(): void;
  openSource(): void;
  openHighlight(ref: string): void;
  setUserText(value: string): void;
  retry(): void;
  openConversation?(id: string): void;
  closeConversation?(): void;
  retryConversation?(): void;
  openConversationSource?(ref: number): void;
}
