import {
  ArrowLeft,
  MoreHorizontal,
  Search,
  Check,
  SkipForward,
  ChevronRight,
  Send,
  Square,
  Mic,
  Book,
  BookOpen,
  Headphones,
  GraduationCap,
  Sigma,
  Sparkles,
  Clock,
  GitBranch,
  Pin,
  Flag,
  Layers,
  StickyNote,
  User,
  Library,
  Plus,
  X,
  RefreshCw,
  Sun,
  Moon,
  Settings,
  Download,
  Upload,
  Trash2,
  Info,
  TriangleAlert,
  CircleHelp,
  ArrowDown,
  ExternalLink,
  ChevronLeft,
  House,
  Flame,
  ChartColumn,
  KeyRound,
  Rocket,
  Lightbulb,
  Grid2X2,
  List,
  Play,
  LockKeyhole,
} from 'lucide-react-native';
import { SvgXml } from 'react-native-svg';
import type { IconMap, IconGlyphProps } from '../kit/skin';

const glyphs = {
  play: Play,
  lock: LockKeyhole,
  home: House,
  fire: Flame,
  chart: ChartColumn,
  key: KeyRound,
  rocket: Rocket,
  bulb: Lightbulb,
  grid: Grid2X2,
  list: List,
  back: ArrowLeft,
  more: MoreHorizontal,
  search: Search,
  check: Check,
  skip: SkipForward,
  next: ChevronRight,
  send: Send,
  stop: Square,
  mic: Mic,
  book: Book,
  bookOpen: BookOpen,
  listen: Headphones,
  teach: GraduationCap,
  derive: Sigma,
  spark: Sparkles,
  clock: Clock,
  chev: ChevronRight,
  branch: GitBranch,
  pin: Pin,
  flag: Flag,
  cards: Layers,
  note: StickyNote,
  person: User,
  shelf: Library,
  add: Plus,
  close: X,
  sync: RefreshCw,
  sun: Sun,
  moon: Moon,
  settings: Settings,
  download: Download,
  upload: Upload,
  trash: Trash2,
  info: Info,
  warning: TriangleAlert,
  help: CircleHelp,
  arrowDown: ArrowDown,
  external: ExternalLink,
};
const prototypePaths: Record<string, string> = {
  back: '<path d="M15 4l-8 8 8 8"/>',
  more: '<circle cx="12" cy="12" r="9.5"/><circle cx="7.5" cy="12" r=".6" fill="currentColor"/><circle cx="12" cy="12" r=".6" fill="currentColor"/><circle cx="16.5" cy="12" r=".6" fill="currentColor"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  add: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  skip: '<path d="M5 6l7 6-7 6zM13 6l7 6-7 6"/>',
  next: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21"/>',
  send: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2.5"/>',
  book: '<path d="M4 5.5C6.5 4 9.5 4 12 5.5 14.5 4 17.5 4 20 5.5V19c-2.5-1.5-5.5-1.5-8 0-2.5-1.5-5.5-1.5-8 0z"/><path d="M12 5.5V19"/>',
  derive: '<path d="M17 5H7l6 7-6 7h10"/>',
  spark:
    '<path d="M4 5.5C6.5 4 9.5 4 12 5.5 14.5 4 17.5 4 20 5.5V19c-2.5-1.5-5.5-1.5-8 0-2.5-1.5-5.5-1.5-8 0z"/><path d="M12 5.5V19M15 9.5l1.2-1.2M15.5 13h1.7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  chevDown: '<path d="M5 9l7 7 7-7"/>',
  updown: '<path d="M8 9l4-4 4 4M8 15l4 4 4-4"/>',
  branch: '<path d="M6 3v10a5 5 0 005 5h7M14 14l4 4-4 4"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0C18.5 15.4 12 21 12 21z"/><circle cx="12" cy="10" r="2.3"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  question:
    '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.3a2.6 2.6 0 015 .9c0 1.7-2.5 2.2-2.5 3.8M12 17.2v.1"/>',
  shelf:
    '<rect x="4" y="4" width="4" height="16" rx="1"/><rect x="10" y="4" width="4" height="16" rx="1"/><path d="M15.6 5.4l3.5-.9 3 14.5-3.5.9z"/>',
  cards:
    '<rect x="3.5" y="7" width="13" height="13" rx="2.5"/><path d="M8 4h10a2.5 2.5 0 012.5 2.5V16"/>',
  note: '<path d="M6 3h8.5L19 7.5V21H6z"/><path d="M14 3v5h5M9 12.5h7M9 16.5h5"/>',
  person:
    '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>',
  doc: '<path d="M6 3h8.5L19 7.5V21H6z"/><path d="M14 3v5h5"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2.5"/><path d="M9.5 2.5v3M14.5 2.5v3M9.5 18.5v3M14.5 18.5v3M2.5 9.5h3M2.5 14.5h3M18.5 9.5h3M18.5 14.5h3"/>',
  sliders:
    '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  paint:
    '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 000 18z" fill="currentColor"/>',
  drive:
    '<rect x="3" y="13" width="18" height="7" rx="2"/><path d="M5 13l2.5-8h9L19 13M7 16.5h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.1"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  map: '<path d="M3 6l6-2.5 6 2.5 6-2.5V18l-6 2.5L9 18l-6 2.5z"/><path d="M9 3.5V18M15 6v14.5"/>',
  export:
    '<path d="M12 15V3M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v7.5h14V12"/>',
  trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>',
  cloud:
    '<path d="M7 18.5a4.5 4.5 0 01-.6-9A6 6 0 0118 9a4.8 4.8 0 01-1 9.5z"/>',
  teach: '<path d="M4 5.5h16v10H9l-5 4z"/><path d="M8.5 10.5h7"/>',
  bookopen:
    '<path d="M3 5.5c3-1.5 6-1.5 9 .5 3-2 6-2 9-.5V19c-3-1.5-6-1.5-9 .5-3-2-6-2-9-.5z"/>',
  retry:
    '<path d="M4 12a8 8 0 0113.7-5.6L20 9M20 4v5h-5M20 12a8 8 0 01-13.7 5.6L4 15M4 20v-5h5"/>',
  logo: '<path d="M4 5.5C6.5 4 9.5 4 12 5.5 14.5 4 17.5 4 20 5.5V19c-2.5-1.5-5.5-1.5-8 0-2.5-1.5-5.5-1.5-8 0z"/><path d="M12 5.5V19M15 9.5l1.2-1.2M15.5 13h1.7"/>',
  settingsDoc: '<path d="M6 3h8.5L19 7.5V21H6z"/><path d="M14 3v5h5"/>',
  appearance:
    '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 000 18z" fill="currentColor"/>',
  bookOpen:
    '<path d="M3 5.5c3-1.5 6-1.5 9 .5 3-2 6-2 9-.5V19c-3-1.5-6-1.5-9 .5-3-2-6-2-9-.5z"/>',
  sync: '<path d="M4 12a8 8 0 0113.7-5.6L20 9M20 4v5h-5M20 12a8 8 0 01-13.7 5.6L4 15M4 20v-5h5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.3a2.6 2.6 0 015 .9c0 1.7-2.5 2.2-2.5 3.8M12 17.2v.1"/>',
  warning: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  download:
    '<path d="M12 15V3M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v7.5h14V12"/>',
  upload:
    '<path d="M12 15V3M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v7.5h14V12"/>',
  settings:
    '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  external: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowDown: '<path d="M5 9l7 7 7-7"/>',
};

const paperTabPaths: Record<string, string> = {
  shelf:
    '<path d="M4 4h4v16H4zM10 4h4v16h-4z"/><path d="M15 5.5l3.6-1 3 14.6-3.6 1z"/>',
  cards:
    '<rect x="4" y="7" width="13" height="13" rx="2"/><path d="M8 4h10a2 2 0 012 2v11"/>',
  note: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 16h5"/>',
  person:
    '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>',
};

export function createIconMap(kind: 'paper' | 'glass'): IconMap {
  return Object.fromEntries(
    Object.entries({
      ...glyphs,
      settingsDoc: Book,
      cpu: Settings,
      sliders: Settings,
      appearance: Sun,
      drive: Book,
      logo: BookOpen,
      updown: ChevronRight,
    }).map(([name, Glyph]) => {
      const Impl = name === 'back' && kind === 'glass' ? ChevronLeft : Glyph;
      const Icon = (props: IconGlyphProps) =>
        (kind === 'glass' && prototypePaths[name]) ||
        (kind === 'paper' && paperTabPaths[name]) ||
        !glyphs[name as keyof typeof glyphs] ? (
          <SvgXml
            width={props.size}
            height={props.size}
            xml={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${
              props.color
            }" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${(
              (kind === 'paper' ? paperTabPaths[name] : undefined) ??
              prototypePaths[name] ??
              ''
            ).replaceAll('currentColor', props.color ?? 'black')}</svg>`}
          />
        ) : (
          <Impl {...props} strokeWidth={1.7} />
        );
      return [name, Icon];
    }),
  ) as IconMap;
}
