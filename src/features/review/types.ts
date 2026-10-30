export type Rating = 'again' | 'hard' | 'good';
export interface CardEditorState {
  front: string;
  back: string;
  saving: boolean;
  error?: string;
}
export interface CardEditorIntents {
  setFront(value: string): void;
  setBack(value: string): void;
  save(): void;
  close(): void;
}
export interface CardManagementState {
  open: boolean;
  filter: 'all' | 'suspended';
  total: number;
  suspended: number;
  cards: {
    id: string;
    front: string;
    back: string;
    source: string;
    suspended: boolean;
  }[];
  loading: boolean;
  busy: boolean;
  error?: string;
  editor?: CardEditorState;
}
export interface CardManagementIntents {
  open(): void;
  close(): void;
  setFilter(filter: 'all' | 'suspended'): void;
  edit(id: string): void;
  toggleSuspended(id: string): void;
  retry(): void;
  editor: CardEditorIntents;
}
export interface ReviewState {
  hero: { due: number; stuck: number; total: number };
  boxes: { label: string; count: number; ratio: number }[];
  start: { enabled: boolean; label: string };
  quickStart?: { enabled: boolean; label: string };
  management?: CardManagementState;
  stuckList: { id: string; text: string; where: string; resolved: boolean }[];
  loading: boolean;
  error?: string;
}
export interface ReviewIntents {
  start(): void;
  startQuick?(): void;
  management?: CardManagementIntents;
  reteach(id: string): void;
  markResolved(id: string): void;
  retry(): void;
}
export interface ReviewSessionState {
  title: string;
  card: null | {
    source: string;
    box: string;
    front: string;
    back?: string;
    flipped: boolean;
    tip: string;
    canOpenSource: boolean;
  };
  rate: null | { key: Rating; label: string; sub: string }[];
  finished: null | { title: string; text: string };
  loading: boolean;
  busy: boolean;
  error?: string;
  editor?: CardEditorState;
  notice?: string;
}
export interface ReviewSessionIntents {
  flip(): void;
  rate(k: Rating): void;
  openSource(): void;
  askAi(): void;
  done(): void;
  retry(): void;
  back(): void;
  editCard?(): void;
  suspendCard?(): void;
  undoSuspend?(): void;
  editor?: CardEditorIntents;
}
