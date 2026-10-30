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

/** Semantic presentation differences owned by the design system. */
export function usePresentation() {
  const { tokens, skin, reduceMotion } = useSkin();
  return {
    ...tokens.layout,
    reduceMotion,
    brand: tokens.brand,
    isPaper: skin.id === 'paper',
    floatingChrome: skin.id === 'glass' || skin.id === 'win11',
  };
}
