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
}
export interface NotesIntents {
  openBook(id: string): void;
  retry(): void;
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
  qa: { q: string; a: string }[];
  detourQa: { from: string; q: string; a: string }[];
  stuck: { text: string; resolved: boolean }[];
  highlights: { ref: string; text: string; page: string }[];
  pins: { ref: string; q: string; page: string }[];
  userText: string;
  loading: boolean;
  saveStatus: string;
  error?: string;
}
export interface NoteDetailIntents {
  back(): void;
  openSource(): void;
  openHighlight(ref: string): void;
  setUserText(value: string): void;
  retry(): void;
}
