import { createContext, useContext } from 'react';
import type { ComponentMap } from './contracts';
import type { Skin } from './skin';
import type { Tokens } from './tokens';

export interface SkinContextValue {
  skin: Skin;
  tokens: Tokens;
  components: ComponentMap;
  fontScale: number;
  reduceMotion: boolean;
  blurEnabled: boolean;
}
export const SkinContext = createContext<SkinContextValue | null>(null);
export function useSkin(): SkinContextValue {
  const value = useContext(SkinContext);
  if (!value) throw new Error('请在 SkinProvider 内使用设计系统');
  return value;
}
export const useTokens = (): Tokens => useSkin().tokens;
