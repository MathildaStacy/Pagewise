import type {
  AppearanceState,
  AppearanceIntents,
} from '@features/appearance/types';
export interface GalleryState extends AppearanceState {
  fontScale: number;
  previewPageUri: string;
  mode: 'read' | 'listen';
  overlay: 'sheet' | 'dialog' | 'selection' | null;
  composer: string;
  field: string;
  switchOn: boolean;
  checked: boolean;
  step: number;
  flipped: boolean;
  guideOpen: boolean;
  foldOpen: boolean;
  picked: number | null;
  proposal: 'pending' | 'accepted' | 'dismissed';
  toast: string | null;
}
export interface GalleryIntents extends AppearanceIntents {
  appearance(): void;
  setScale(value: string): void;
  setMode(value: 'read' | 'listen'): void;
  openOverlay(value: GalleryState['overlay']): void;
  closeOverlay(): void;
  setComposer(value: string): void;
  setField(value: string): void;
  setSwitch(value: boolean): void;
  toggleChecked(): void;
  jumpStep(index: number): void;
  flip(): void;
  toggleGuide(): void;
  toggleFold(): void;
  pick(index: number): void;
  propose(key: string): void;
  notify(message: string): void;
}
