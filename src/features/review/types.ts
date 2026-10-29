export type Rating = 'again' | 'hard' | 'good';
export interface ReviewState {
  hero: { due: number; stuck: number; total: number };
  boxes: { label: string; count: number; ratio: number }[];
  start: { enabled: boolean; label: string };
  stuckList: { id: string; text: string; where: string; resolved: boolean }[];
  loading: boolean;
  error?: string;
}
export interface ReviewIntents {
  start(): void;
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
}
export interface ReviewSessionIntents {
  flip(): void;
  rate(k: Rating): void;
  openSource(): void;
  askAi(): void;
  done(): void;
  retry(): void;
  back(): void;
}
