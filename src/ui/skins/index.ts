import { defineSkin } from '../kit/skin';
import type { Tokens } from '../kit/tokens';
import { createIconMap } from './icons';
import { paperTokens } from './paper/tokens';
import { glassTokens } from './glass/tokens';
import { glassComponents } from './glass/components';

const navigationTheme = (t: Tokens) => ({
  dark: t.scheme === 'dark',
  colors: {
    primary: t.color.accent,
    background: t.color.bg,
    card: t.color.surface,
    text: t.color.ink,
    border: t.color.line,
    notification: t.color.bad,
  },
});
const statusBar = (t: Tokens) => ({
  style:
    t.scheme === 'dark'
      ? ('light-content' as const)
      : ('dark-content' as const),
  background: t.color.bg,
});
export const paper = defineSkin({
  id: 'paper',
  name: '纸感',
  tokens: paperTokens,
  icons: createIconMap('paper'),
  components: {},
  navigationTheme,
  statusBar,
});
export const glass = defineSkin({
  id: 'glass',
  name: '苹果风',
  tokens: glassTokens,
  icons: createIconMap('glass'),
  components: glassComponents,
  navigationTheme,
  statusBar,
});
export const skins = { paper, glass };
