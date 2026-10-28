import { createStore } from 'zustand/vanilla';

export interface Appearance {
  skin: 'paper' | 'glass';
  scheme: 'system' | 'light' | 'dark';
  readingSize: 's' | 'm' | 'l';
}
/** T2 内存配置；T3 通过 setting 仓库加载并持久化。 */
export const appearanceStore = createStore<Appearance>(() => ({
  skin: 'paper',
  scheme: 'system',
  readingSize: 'm',
}));
export function setAppearance(patch: Partial<Appearance>): void {
  appearanceStore.setState(patch);
}
