import { chapterNumber } from './map';
import type { Block } from './types';

const kinds: Record<string, string> = {
  图: 'figure',
  figure: 'figure',
  'fig.': 'figure',
  表: 'table',
  table: 'table',
  exhibit: 'exhibit',
  式: 'equation',
  公式: 'equation',
  equation: 'equation',
  'eq.': 'equation',
};
/**
 * One key for a numbered figure, table or equation, so a mention meets the block it names:
 * 图 3-2, 图3.2 and Figure 3.2 are all `figure 3.2`; 式（3.1） and \tag{3.1} are `equation 3.1`.
 */
export const labelKey = (word: string, number: string) =>
  `${kinds[word.toLowerCase()] ?? word.toLowerCase()} ${number.replace(
    /[-–]/gu,
    '.',
  )}`;

const number = String.raw`(\d+(?:[.\-–]\d+)*)`;
const equationNumber = String.raw`(\d+(?:\.\d+)*)`;
const chapter = String.raw`(?:第\s*([0-9一二三四五六七八九十百零〇]+)\s*章\s*(?:的|中|里)?\s*)?`;
const mentions = [
  new RegExp(
    String.raw`${chapter}(图|表|Figure|Fig\.|Table|Exhibit)\s*${number}`,
    'giu',
  ),
  new RegExp(
    String.raw`${chapter}(式|公式|Equation|Eq\.)\s*[（(]\s*${equationNumber}\s*[)）]`,
    'giu',
  ),
];
const captioned = new RegExp(
  String.raw`^\s*(图|表|Figure|Fig\.|Table|Exhibit)\s*${number}`,
  'iu',
);
const tagged = new RegExp(String.raw`\\tag\{\s*${equationNumber}\s*\}`, 'gu');
const trailing = new RegExp(
  String.raw`[（(]\s*${equationNumber}\s*[)）]\s*\$*\s*$`,
  'u',
);

export type LabelMention = {
  key: string;
  /** The chapter named before the label, as in 第 2 章式（2.5）. */
  chapter: string | null;
  /** The chapter a dotted number names: 4 for 图4.3, none for 表 2. */
  numbered: string | null;
};

/** Labels such as 表3.20, 图 3-2, 式（1.3）, Figure 4.1, Table 2 or 第 2 章式（2.5） mentioned in the text, once each. */
export function mentionedLabels(text: string): LabelMention[] {
  const found = new Map<string, LabelMention>();
  for (const pattern of mentions)
    for (const match of text.matchAll(pattern)) {
      const key = labelKey(match[2], match[3]);
      const named = match[1] ? String(chapterNumber(match[1])) : null;
      const parts = match[3].split(/[.\-–]/u);
      if (!found.has(`${named} ${key}`))
        found.set(`${named} ${key}`, {
          key,
          chapter: named,
          numbered: parts.length > 1 ? String(Number(parts[0])) : null,
        });
    }
  return [...found.values()];
}

/** Labels a block carries: captions, figures and tables open with theirs; an equation has \tag{3.1} or ends in (3.1). */
export function blockLabels(
  block: Pick<Block, 'type' | 'text' | 'latex'>,
): string[] {
  if (block.type === 'equation') {
    const source = block.latex ?? block.text;
    const numbers = [...source.matchAll(tagged)].map(match => match[1]);
    const end = trailing.exec(source);
    if (end) numbers.push(end[1]);
    return [...new Set(numbers.map(value => labelKey('式', value)))];
  }
  const match =
    (block.type === 'caption' ||
      block.type === 'image' ||
      block.type === 'table') &&
    captioned.exec(block.text);
  return match ? [labelKey(match[1], match[2])] : [];
}
