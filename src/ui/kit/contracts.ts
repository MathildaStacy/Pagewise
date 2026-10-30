import type { ComponentType, ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export const iconNames = [
  'back',
  'more',
  'search',
  'check',
  'skip',
  'next',
  'play',
  'lock',
  'send',
  'stop',
  'mic',
  'book',
  'bookOpen',
  'listen',
  'teach',
  'derive',
  'spark',
  'clock',
  'chev',
  'branch',
  'pin',
  'flag',
  'cards',
  'note',
  'person',
  'shelf',
  'add',
  'close',
  'sync',
  'sun',
  'moon',
  'settings',
  'download',
  'upload',
  'trash',
  'info',
  'warning',
  'help',
  'arrowDown',
  'external',
  'settingsDoc',
  'cpu',
  'sliders',
  'appearance',
  'drive',
  'logo',
  'updown',
  'home',
  'fire',
  'chart',
  'key',
  'rocket',
  'bulb',
  'grid',
  'list',
] as const;
export type IconName = (typeof iconNames)[number];
export type Tone =
  | 'neutral'
  | 'accent'
  | 'detour'
  | 'stuck'
  | 'ok'
  | 'bad'
  | 'muted'
  | 'warn'
  | 'main'
  | 'derive'
  | 'example'
  | 'pin';
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'detour'
  | 'danger'
  | 'text';
export interface Action {
  key: string;
  label: string;
  kind?: ButtonVariant;
  onPress?(): void;
}
export interface ScreenProps {
  scroll?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}
export interface AppBarProps {
  title: string;
  subtitle?: string;
  variant: 'root' | 'push';
  onBack?(): void;
  backLabel?: string;
  right?: ReactNode;
  scrollY?: number;
  part?: 'all' | 'navigation' | 'largeTitle';
}
export interface TabBarProps {
  items: {
    key: string;
    label: string;
    icon: IconName;
    badge?: number | string;
  }[];
  active: string;
  onSelect(key: string): void;
}
export interface SegmentedProps {
  options: { key: string; label: string }[];
  value: string;
  onChange(value: string): void;
  accessibilityLabel?: string;
}
export interface ModeSwitchProps {
  value: 'read' | 'listen';
  onChange(value: 'read' | 'listen'): void;
}
export interface SwitchProps {
  value: boolean;
  onChange(value: boolean): void;
  accessibilityLabel: string;
  disabled?: boolean;
}
export interface ButtonProps {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'block';
  icon?: IconName;
  disabled?: boolean;
  onPress(): void;
  children?: ReactNode;
  label?: string;
  accessibilityLabel?: string;
}
export interface IconButtonProps {
  icon: IconName;
  variant?: 'root' | 'push';
  onPress(): void;
  label: string;
  badge?: number | string;
  disabled?: boolean;
}
export interface QuickActionsProps {
  items: {
    key: string;
    label: string;
    kind?: 'primary' | 'detour';
    icon?: IconName;
  }[];
  onPress(key: string): void;
}
export interface ComposerQuote {
  label: string;
  page?: string;
  excerpt?: string;
}
export interface ComposerProps {
  value: string;
  focusRequest?: number;
  onChange(value: string): void;
  placeholder: string;
  onSend(): void;
  sendDisabled: boolean;
  quote?: ComposerQuote & { onClear(): void };
  micAvailable: boolean;
  onMic?(): void;
  onAdd?(): void;
  busy?: boolean;
  onStop?(): void;
}
export interface StepProgressProps {
  steps: { title: string; state: 'done' | 'current' | 'skipped' | 'todo' }[];
  label: string;
  onPressStep(index: number): void;
  onPressBar(): void;
  right?: ReactNode;
}
export interface DetourBannerProps {
  title: string;
  onBack(): void;
  backLabel: string;
}
export interface ListSectionProps {
  plain?: boolean;
  title?: string;
  subtitle?: string;
  note?: string;
  children?: ReactNode;
}
export interface RowProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  chevron?: boolean;
  onPress?(): void;
  tone?: Tone;
}
export interface FieldProps {
  label: string;
  value: string;
  onChange(value: string): void;
  secure?: boolean;
  multiline?: boolean;
  placeholder?: string;
  error?: string;
  keyboardType?: 'default' | 'numeric' | 'url' | 'email-address';
}
export interface NoteProps {
  tone: 'neutral' | 'accent' | 'warn' | 'bad';
  variant?: 'ai';
  icon?: IconName;
  children?: ReactNode;
}
export interface TagProps {
  tone?: Tone;
  label: string;
}
export interface ProgressBarProps {
  value: number;
  tone?: Tone;
}
export interface StageStripProps {
  stages: { label: string; state: 'done' | 'current' | 'error' | 'todo' }[];
}
export interface CoverProps {
  title: string;
  color: string;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg';
  width?: number;
}
export interface StatusDotProps {
  tone: Tone;
}
export interface SectionStatusIconProps {
  status: 'new' | 'learning' | 'done';
}
export interface CheckRowProps {
  tone?: 'accent' | 'stuck';
  checked: boolean;
  title: string;
  subtitle?: string;
  tag?: string;
  onToggle(): void;
}
export interface SheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose(): void;
  actions?: {
    label: string;
    kind: ButtonVariant;
    disabled?: boolean;
    onPress(): void;
  }[];
  detent?: 'auto' | 'half' | 'full';
  children?: ReactNode;
}
export interface DialogProps {
  visible: boolean;
  title: string;
  body: ReactNode;
  confirm: string;
  cancel?: string;
  danger?: boolean;
  onConfirm(): void;
  onCancel(): void;
}
export interface ToastProps {
  message: string;
  tone?: 'default' | 'ok' | 'detour' | 'bad';
}
export interface SelectionMenuProps {
  anchor: { x: number; y: number; w: number; h: number };
  items: { key: string; label: string }[];
  onSelect(key: string): void;
  onDismiss(): void;
  visible?: boolean;
}
export interface FabProps {
  label: string;
  icon: IconName;
  onPress(): void;
}
export interface GlassProps {
  strength: 'regular' | 'strong';
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  blurEnabled?: boolean;
}
export interface EmptyProps {
  title?: string;
  body: string;
  action?: ReactNode;
}

// UI 的结构契约；VM 负责将领域引用解析成页码、文字和图片，kit 不读取仓库。
export type RichInline =
  /** fade: 0 刚吐出（模糊）→ 1 已清晰；缺省即清晰。仅由逐字呈现产生。 */
  | { t: 'text'; v: string; fade?: number }
  | { t: 'code'; v: string }
  | { t: 'b'; c: RichInline[] }
  | { t: 'math'; tex: string }
  | {
      t: 'cite';
      ref: number;
      verified: boolean;
      detour: boolean;
      label?: string;
    }
  | { t: 'unverified' };
export type RichBlock =
  | { t: 'p'; c: RichInline[] }
  | { t: 'math'; tex: string }
  | { t: 'list'; ordered: boolean; items: RichInline[][] }
  | {
      t: 'quote' | 'figure';
      ref: number;
      verified: boolean;
      label?: string;
      text?: string;
      uri?: string;
    }
  | { t: 'aux'; kind: 'derive' | 'example'; body: RichBlock[]; open: boolean }
  | { t: 'check'; c: RichInline[] }
  | { t: 'code'; text: string; language?: string };
export type RichDoc = RichBlock[];
export interface RichViewProps {
  doc: RichDoc;
  typography?: 'dialogQuote' | 'sheetQuote';
  onCite?(ref: number): void;
  onFigure?(ref: number): void;
}
export interface MathViewProps {
  tex: string;
  display?: boolean;
  svg?: string;
  width?: number;
  height?: number;
}
export interface CiteChipProps {
  label: string;
  tone: 'main' | 'detour';
  onPress(): void;
  verified?: boolean;
}
export interface FigureViewProps {
  uri: string;
  caption: string;
  onPress?(): void;
}
export interface UserBubbleProps {
  text: string;
  quote?: string;
  detour?: boolean;
}
export interface AiMessageProps extends RichViewProps {
  streaming?: boolean;
  detour?: boolean;
}
export interface ToolStepsProps {
  lines: { text: string; running: boolean }[];
  detour?: boolean;
}
export interface StepHeaderProps {
  step: number;
  label: string;
  title: string;
  pages: string;
}
export interface SourceCardProps {
  label: string;
  doc?: RichDoc;
  text?: string;
  onPress?(): void;
}
export interface AuxBlockProps {
  kind: 'derive' | 'example';
  children?: ReactNode;
  open?: boolean;
}
export interface CheckCardProps {
  children?: ReactNode;
  text?: string;
}
export interface ResumeCardProps {
  title: string;
  lines: string[];
  actions: { key: string; label: string; primary?: boolean }[];
  onAction(key: string): void;
}
export interface FoldCardProps {
  title: string;
  count: string;
  expanded: boolean;
  onToggle(): void;
  children?: ReactNode;
}
export interface QuizCardProps {
  title: string;
  question: string;
  options: { label: string; state: 'idle' | 'right' | 'wrong' | 'muted' }[];
  locked: boolean;
  onPick(index: number): void;
}
export interface ProposalCardProps {
  title: string;
  body: string;
  state: 'pending' | 'accepted' | 'dismissed';
  resultText?: string;
  actions: { key: string; label: string }[];
  onAction(key: string): void;
}
export interface DoneCardProps {
  title: string;
  text: string;
  onPress?(): void;
}
export interface SysDividerProps {
  text: string;
  tone?: 'main' | 'detour';
}
export interface RevealSkipProps {
  /** 立即显示全部尚未吐出的内容。 */
  onPress(): void;
  label?: string;
}
export interface TypingProps {
  label?: string;
}
export interface PageOrigProps {
  uri: string;
  width: number;
  height: number;
  blocks: {
    ref: number;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    state?: 'current' | 'done' | 'highlight' | 'selected' | 'flash';
    marks?: ('heard' | 'now' | 'highlight' | 'selected' | 'flash')[];
    pin?: boolean;
    pinLabel?: string;
    label?: string;
    selectable?: boolean;
  }[];
  onBlock?(
    ref: number,
    rect?: { x: number; y: number; w: number; h: number },
  ): void;
  onPin?(ref: number): void;
}
export interface BlockViewProps {
  doc?: RichDoc;
  text?: string;
  current?: boolean;
  done?: boolean;
  highlighted?: boolean;
  onPress?(): void;
  children?: ReactNode;
}
export interface PinChipProps {
  label: string;
  onPress(): void;
}
export interface GuideBarProps {
  title: string;
  body?: string;
  expanded: boolean;
  onToggle(): void;
}
export interface ReadEndProps {
  label: string;
  hint?: string;
  onPress(): void;
}
export interface FlashCardProps {
  front: string;
  back: string;
  flipped: boolean;
  onFlip(): void;
}
export interface RateBarProps {
  onRate(rating: 'again' | 'hard' | 'good'): void;
  disabled?: boolean;
}
export interface BoxChartProps {
  boxes: number[];
}
export interface StackBarProps {
  layers: { value: number; tone?: Tone }[];
}
export interface LayerRowProps {
  name: string;
  detail: string;
  tokens: string;
  cached: boolean;
  color?: string;
}

export interface KitProps {
  Screen: ScreenProps;
  AppBar: AppBarProps;
  TabBar: TabBarProps;
  ModeSwitch: ModeSwitchProps;
  Segmented: SegmentedProps;
  Switch: SwitchProps;
  Button: ButtonProps;
  IconButton: IconButtonProps;
  QuickActions: QuickActionsProps;
  Composer: ComposerProps;
  StepProgress: StepProgressProps;
  DetourBanner: DetourBannerProps;
  ListSection: ListSectionProps;
  Row: RowProps;
  Field: FieldProps;
  Note: NoteProps;
  Tag: TagProps;
  ProgressBar: ProgressBarProps;
  StageStrip: StageStripProps;
  Cover: CoverProps;
  StatusDot: StatusDotProps;
  SectionStatusIcon: SectionStatusIconProps;
  CheckRow: CheckRowProps;
  Sheet: SheetProps;
  Dialog: DialogProps;
  Toast: ToastProps;
  SelectionMenu: SelectionMenuProps;
  Fab: FabProps;
  Glass: GlassProps;
  Empty: EmptyProps;
  RichView: RichViewProps;
  MathView: MathViewProps;
  CiteChip: CiteChipProps;
  FigureView: FigureViewProps;
  UserBubble: UserBubbleProps;
  AiMessage: AiMessageProps;
  ToolSteps: ToolStepsProps;
  StepHeader: StepHeaderProps;
  SourceCard: SourceCardProps;
  AuxBlock: AuxBlockProps;
  CheckCard: CheckCardProps;
  ResumeCard: ResumeCardProps;
  FoldCard: FoldCardProps;
  QuizCard: QuizCardProps;
  ProposalCard: ProposalCardProps;
  DoneCard: DoneCardProps;
  SysDivider: SysDividerProps;
  Typing: TypingProps;
  RevealSkip: RevealSkipProps;
  PageOrig: PageOrigProps;
  BlockView: BlockViewProps;
  PinChip: PinChipProps;
  GuideBar: GuideBarProps;
  ReadEnd: ReadEndProps;
  FlashCard: FlashCardProps;
  RateBar: RateBarProps;
  BoxChart: BoxChartProps;
  StackBar: StackBarProps;
  LayerRow: LayerRowProps;
}
export type ComponentMap = {
  [K in keyof KitProps]: ComponentType<KitProps[K]>;
};
