import { useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import { skins } from '../skins';
import { baseComponents } from './base';
import { SkinContext } from './context';
import type { ComponentMap } from './contracts';
import type { Scheme, Tokens, TypeStyle } from './tokens';

export interface SkinProviderProps {
  skinId: 'paper' | 'glass';
  scheme: 'system' | Scheme;
  readingSize?: 's' | 'm' | 'l';
  fontScale?: number;
  blurEnabled?: boolean;
  reduceMotion?: boolean;
}
export function SkinProvider({
  skinId,
  scheme,
  readingSize = 'm',
  fontScale = 1,
  blurEnabled = true,
  reduceMotion,
  children,
}: PropsWithChildren<SkinProviderProps>) {
  const systemScheme = useColorScheme();
  const [systemReduceMotion, setSystemReduceMotion] = useState(false);
  const [reduceTransparency, setReduceTransparency] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (active) setSystemReduceMotion(value);
    });
    AccessibilityInfo.isReduceTransparencyEnabled().then(value => {
      if (active) setReduceTransparency(value);
    });
    const motion = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setSystemReduceMotion,
    );
    const transparency = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency,
    );
    return () => {
      active = false;
      motion.remove();
      transparency.remove();
    };
  }, []);
  const resolvedScheme =
    scheme === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : scheme;
  const value = useMemo(() => {
    const skin = skins[skinId];
    const original = skin.tokens[resolvedScheme];
    const size = readingSize === 's' ? 0.92 : readingSize === 'l' ? 1.125 : 1;
    const appleSizes = {
      aiBody: { s: 15, m: 17, l: 19 },
      bookBody: { s: 15, m: 17, l: 19.5 },
    };
    const type = { ...original.type };
    for (const [key, style] of Object.entries(type)) {
      if (typeof style === 'object' && 'fontSize' in style) {
        let readingFactor = 1;
        if (key === 'aiBody' || key === 'bookBody') {
          readingFactor =
            skinId === 'glass'
              ? appleSizes[key][readingSize] / style.fontSize
              : size;
        }
        const factor = fontScale * readingFactor;
        (type as unknown as Record<string, TypeStyle>)[key] = {
          ...style,
          fontSize: style.fontSize * factor,
          lineHeight: style.lineHeight * factor,
        };
      }
    }
    const tokens: Tokens = { ...original, type };
    return {
      skin,
      tokens,
      components: { ...baseComponents, ...skin.components } as ComponentMap,
      fontScale,
      reduceMotion: reduceMotion ?? systemReduceMotion,
      blurEnabled:
        blurEnabled && !reduceTransparency && original.capabilities.blur,
    };
  }, [
    skinId,
    resolvedScheme,
    readingSize,
    fontScale,
    reduceMotion,
    systemReduceMotion,
    blurEnabled,
    reduceTransparency,
  ]);
  return <SkinContext.Provider value={value}>{children}</SkinContext.Provider>;
}
