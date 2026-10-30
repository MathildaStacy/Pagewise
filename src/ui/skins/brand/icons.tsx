import { SvgXml } from 'react-native-svg';
import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import type { IconGlyphProps, IconMap } from '../../kit/skin';
import { createIconMap } from '../icons';
import { brandGlyphs } from './glyphs';
import { colorGlyphs, colorDefs } from '../win11/colorGlyphs';

export function createBrandIcons(kind: 'meta' | 'google' | 'win11'): IconMap {
  const fallback = createIconMap('paper');
  const aliases: Record<string, string> = {
    settingsDoc: 'doc',
    appearance: 'paint',
    bookOpen: 'bookopen',
    help: 'question',
    sync: 'retry',
    upload: 'export',
    arrowDown: 'chevDown',
  };
  return Object.fromEntries(
    Object.entries(fallback).map(([name, Fallback]) => {
      const Glyph = ({
        size = 22,
        color = 'black',
        filled,
        variant,
      }: IconGlyphProps) => {
        const id = useId().replace(/[^a-zA-Z0-9]/g, '');
        const key = aliases[name] ?? name;
        const colorful =
          colorGlyphs[
            {
              teach: 'listen',
              spark: 'ai',
              settings: 'gear',
              help: 'question',
              warning: 'warn',
            }[key] ?? key
          ];
        if (kind === 'win11' && variant === 'color' && colorful) {
          const xml =
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><defs>${colorDefs}</defs>${colorful[0]}</svg>`
              .replaceAll('id="g', `id="${id}g`)
              .replaceAll('url(#g', `url(#${id}g`);
          if (key === 'spark')
            return <SvgXml width={size} height={size} xml={xml} />;
          return (
            <View
              style={
                StyleSheet.create({
                  root: {
                    width: size,
                    height: size,
                    borderRadius: size * 0.3,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colorful[1],
                  },
                }).root
              }
            >
              <SvgXml width={size * 0.7} height={size * 0.7} xml={xml} />
            </View>
          );
        }
        const source =
          brandGlyphs[kind][filled ? `${key}F` : key] ?? brandGlyphs[kind][key];
        if (!source) return <Fallback size={size} color={color} />;
        const solid = source.includes('class="i f"');
        const xml = source
          .replace(
            '<svg ',
            `<svg fill="${solid ? color : 'none'}" stroke="${
              solid ? 'none' : color
            }" stroke-width="${
              kind === 'meta' ? 2.2 : kind === 'google' ? 2 : 1.5
            }" stroke-linecap="round" stroke-linejoin="round" `,
          )
          .replaceAll('currentColor', color);
        return <SvgXml width={size} height={size} xml={xml} />;
      };
      return [name, Glyph];
    }),
  ) as IconMap;
}
