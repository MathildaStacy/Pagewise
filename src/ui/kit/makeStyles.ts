import { useMemo } from 'react';
import {
  StyleSheet,
  type TextStyle,
  type ViewStyle,
  type ImageStyle,
} from 'react-native';
import type { Tokens } from './tokens';
import { useTokens } from './context';

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };
export const makeStyles =
  <T extends NamedStyles<T>>(create: (tokens: Tokens) => T) =>
  () => {
    const tokens = useTokens();
    return useMemo(() => StyleSheet.create(create(tokens)), [tokens]);
  };
