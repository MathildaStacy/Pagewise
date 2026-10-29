export interface AppearanceState {
  error: string | null;
  skin: 'paper' | 'glass';
  scheme: 'system' | 'light' | 'dark';
  readingSize: 's' | 'm' | 'l';
  skinOptions: { key: string; label: string }[];
  schemeOptions: { key: string; label: string }[];
  sizeOptions: { key: string; label: string }[];
}
export interface AppearanceIntents {
  setSkin(value: string): void;
  setScheme(value: string): void;
  setSize(value: string): void;
  back(): void;
}
