import type { ComponentMap } from '../contracts';
import * as controls from './controls';
import * as content from './content';
import * as overlays from './overlays';

export const baseComponents: ComponentMap = {
  ...controls,
  ...content,
  ...overlays,
};
