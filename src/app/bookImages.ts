import type { Block } from '@core/types';
import type { Container } from './container';
import { bookDirectory, getImportRuntime } from './usecases/importRuntime';

export function resolveBookImageUri(path: string, directory: string) {
  if (/^[a-z][a-z\d+.-]*:/i.test(path)) return path;
  if (path.startsWith('/')) return `file://${path}`;
  return `file://${directory}/${path.replace(/^\.\//, '')}`;
}

/** Stored paths stay portable; only the screen-facing copy gains a device URI. */
export function resolveStudyBlockImage(
  c: Container,
  bookId: string,
  block: Block,
): Block {
  const path = block.image_path;
  if (!path) return block;
  if (/^[a-z][a-z\d+.-]*:/i.test(path)) return block;
  const uri = path.startsWith('/')
    ? `file://${path}`
    : c.mode === 'demo'
    ? path
    : resolveBookImageUri(path, bookDirectory(getImportRuntime(c), bookId));
  return uri === path ? block : { ...block, image_path: uri };
}
