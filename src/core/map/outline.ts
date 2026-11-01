import { tocPages } from '../layout';
import type { Block } from '../types';
import type { OutlineItem } from './types';

export const cleanOutlineTitle = (title: string) =>
  title.replace(/[\p{Cc}\p{Cf}]/gu, '').trim();

/** Some scanned books bookmark every printed page instead of their chapters. */
export function prepareOutline(
  outline: readonly OutlineItem[] | null,
  blocks: readonly Block[],
): OutlineItem[] {
  const items = (outline ?? []).map(item => ({
    ...item,
    title: cleanOutlineTitle(item.title),
  }));
  const numeric = items.filter(item => /^\d+$/.test(item.title));
  const offsets = new Map<number, number>();
  for (const item of numeric) {
    const offset = item.page - Number(item.title);
    offsets.set(offset, (offsets.get(offset) ?? 0) + 1);
  }
  const best = [...offsets].sort((a, b) => b[1] - a[1])[0];
  if (!best || best[1] < 20 || best[1] < items.length * 0.7) return items;
  const pageRun = numeric.filter(
    item => item.page - Number(item.title) === best[0],
  );
  const span =
    Math.max(...pageRun.map(i => i.page)) -
    Math.min(...pageRun.map(i => i.page)) +
    1;
  if (pageRun.length / span < 0.7) return items;
  const kept = items.filter(item => !pageRun.includes(item));
  // Recover only explicit chapter lines on a contents page. Their printed page is anchored
  // by the dense page bookmarks, so even a chapter title missed by OCR has a real destination.
  const toc = tocPages(blocks);
  const pageSet = new Set(pageRun.map(item => item.page));
  for (const block of blocks) {
    if (!toc.has(block.page ?? -1)) continue;
    for (const line of block.text.split('\n')) {
      const match = /^(第\s*\d+\s*章\s*.+?)\s*[/／]\s*(\d+)\s*$/.exec(
        line.trim(),
      );
      if (!match) continue;
      const page = Number(match[2]) + best[0];
      if (
        pageSet.has(page) &&
        !kept.some(item => item.page === page && item.title === match[1])
      )
        kept.push({ title: match[1].trim(), page, level: 1 });
    }
  }
  return kept.sort((a, b) => a.page - b.page || a.level - b.level);
}
