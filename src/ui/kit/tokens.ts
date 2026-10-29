import type { ViewStyle } from 'react-native';

export type Scheme = 'light' | 'dark';

export interface ColorTokens {
  bg: string;
  surface: string;
  surfaceAlt: string;
  surfaceFill: string;
  header: string;
  editor: string;
  fieldBorder: string;
  switchOff: string;
  mapFlagBg: string;
  proposalBorder: string;
  thumb: string;
  paper: string;
  paperInk: string;
  readerPageLabel: string;
  readerPageRule: string;
  pressed: string;
  line: string;
  scrim: string;
  ink: string;
  ink2: string;
  ink3: string;
  onAccent: string;
  accent: string;
  accentEnd: string;
  brandStart: string;
  brandEnd: string;
  continueStart: string;
  continueMid: string;
  continueEnd: string;
  continueOverlay: string;
  continueInk: string;
  accentBg: string;
  accentInk: string;
  detour: string;
  detourBg: string;
  stuck: string;
  stuckBg: string;
  stuckInk: string;
  ok: string;
  okInk: string;
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
  continueTitle: TypeStyle;
  bookTitle: TypeStyle;
  fileTitle: TypeStyle;
  mapTitle: TypeStyle;
  parsePartTitle: TypeStyle;
  factValue: TypeStyle;
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
  flashcard: ShadowStyle;
  segment: ShadowStyle;
}

export interface RevealTokens {
  /** 新字从模糊到清晰的时长（毫秒）。 */
  fadeMs: number;
  /** 新字初始的模糊半径（像素），0 表示只做透明度渐显。 */
  blur: number;
  /** 最低与最高吐字速度（可见字符/秒）；超过上限的积压可以用「显示全部」跳过。 */
  minRate: number;
  maxRate: number;
  /** 目标落后网络的时长，越大越平滑、越不跟手。 */
  lagMs: number;
}

export interface MotionTokens {
  fast: number;
  normal: number;
  slow: number;
  easing: [number, number, number, number];
  spring: { damping: number; stiffness: number; mass: number };
  pressScale: number;
  reveal: RevealTokens;
}

export interface Tokens {
  settingsIcons: {
    parser: string;
    ai: string;
    preferences: string;
    appearance: string;
    storage: string;
    about: string;
  };

  scheme: Scheme;
  layout: { groupedLists: boolean; flashcards: 'expand' | 'flip' };
  color: ColorTokens;
  type: TypeTokens;
  shape: ShapeTokens;
  space: SpaceTokens;
  elevation: ElevationTokens;
  motion: MotionTokens;
  capabilities: { blur: boolean; haptics: boolean };
}
