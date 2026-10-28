import type { ViewStyle } from 'react-native';

export type Scheme = 'light' | 'dark';

export interface ColorTokens {
  bg: string;
  surface: string;
  surfaceAlt: string;
  paper: string;
  paperInk: string;
  pressed: string;
  line: string;
  scrim: string;
  ink: string;
  ink2: string;
  ink3: string;
  onAccent: string;
  accent: string;
  accentBg: string;
  accentInk: string;
  detour: string;
  detourBg: string;
  stuck: string;
  stuckBg: string;
  stuckInk: string;
  ok: string;
  okBg: string;
  bad: string;
  badBg: string;
  badInk: string;
  highlight: string;
  pin: string;
  pinBg: string;
  derive: string;
  deriveBg: string;
  example: string;
  exampleBg: string;
  stepDone: string;
  stepCur: string;
  stepTodo: string;
  glass: string;
  glassStrong: string;
  glassLine: string;
}

export interface TypeStyle {
  fontFamily?: string;
  fontSize: number;
  lineHeight: number;
  fontWeight: '400' | '500' | '600' | '700';
  letterSpacing?: number;
}

export interface TypeTokens {
  largeTitle: TypeStyle;
  title: TypeStyle;
  headline: TypeStyle;
  body: TypeStyle;
  aiBody: TypeStyle;
  bookBody: TypeStyle;
  bookOrig: TypeStyle;
  label: TypeStyle;
  caption: TypeStyle;
  micro: TypeStyle;
  num: { fontFamily?: string; fontVariant: ['tabular-nums'] };
  serifFamily: string;
  sansFamily: string;
}

export interface ShapeTokens {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  sheet: number;
  pill: 999;
}

export interface SpaceTokens {
  pageX: number;
  gap: number;
  rowY: number;
  sectionGap: number;
}

export type ShadowStyle = Pick<
  ViewStyle,
  | 'shadowColor'
  | 'shadowOffset'
  | 'shadowOpacity'
  | 'shadowRadius'
  | 'elevation'
>;

export interface ElevationTokens {
  card: ShadowStyle;
  pop: ShadowStyle;
  fab: ShadowStyle;
}

export interface MotionTokens {
  fast: number;
  normal: number;
  slow: number;
  easing: [number, number, number, number];
  spring: { damping: number; stiffness: number; mass: number };
  pressScale: number;
}

export interface Tokens {
  scheme: Scheme;
  color: ColorTokens;
  type: TypeTokens;
  shape: ShapeTokens;
  space: SpaceTokens;
  elevation: ElevationTokens;
  motion: MotionTokens;
  capabilities: { blur: boolean; haptics: boolean };
}
