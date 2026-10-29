import { createElement } from 'react';
import { View } from 'react-native';
import type { IconName } from './contracts';
import { useSkin } from './context';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  label?: string;
}
export function Icon({ name, size = 22, color, label }: IconProps) {
  const { skin, tokens } = useSkin();
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={label ?? name}
      accessible={!!label}
      accessibilityState={{}}
    >
      {createElement(skin.icons[name], {
        size,
        color: color ?? tokens.color.ink2,
      })}
    </View>
  );
}
