import type { ComponentType } from 'react';
import type { ComponentMap, IconName } from './contracts';
import type { Scheme, Tokens } from './tokens';

export interface IconGlyphProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  filled?: boolean;
  variant?: 'line' | 'color';
}
export type IconMap = Record<IconName, ComponentType<IconGlyphProps>>;
export type SkinId = 'paper' | 'glass' | 'meta' | 'google' | 'win11';
export interface Skin {
  id: SkinId;
  name: string;
  tokens: Record<Scheme, Tokens>;
  icons: IconMap;
  components: Partial<ComponentMap>;
  navigationTheme(tokens: Tokens): {
    dark: boolean;
    colors: {
      primary: string;
      background: string;
      card: string;
      text: string;
      border: string;
      notification: string;
    };
  };
  statusBar(tokens: Tokens): {
    style: 'light-content' | 'dark-content';
    background: string;
  };
}
export const defineSkin = (skin: Skin) => skin;
