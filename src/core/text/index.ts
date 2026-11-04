import type { JsonValue } from '../types';

const cjk =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

export function countCharacters(text: string): number {
  return Array.from(text).length;
}
export function countCjkCharacters(text: string): number {
  let count = 0;
  for (const character of text) if (cjk.test(character)) count++;
  return count;
}
const han = /\p{Script=Han}/u,
  otherCjk = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
/**
 * Whether prose is written in Chinese. Han characters are compared with Latin words,
 * so English terms, names and formulas inside Chinese text do not flip the result;
 * kana or Hangul alongside the Han characters mark Japanese or Korean instead.
 */
export function isChineseText(text: string): boolean {
  let hanCount = 0,
    otherCount = 0;
  for (const character of text) {
    if (han.test(character)) hanCount++;
    else if (otherCjk.test(character)) otherCount++;
  }
  const words = text.match(/\p{Script=Latin}+/gu)?.length ?? 0;
  return hanCount > words && otherCount * 10 < hanCount;
}
/** A budget estimate, never a substitute for the provider's reported usage. */
export function estimateTokens(text: string): number {
  let cjkCount = 0,
    otherCount = 0;
  for (const character of text) {
    if (cjk.test(character)) cjkCount++;
    else otherCount++;
  }
  return Math.ceil(cjkCount + otherCount / 3.5);
}
export function truncateText(
  text: string,
  limit: number,
  suffix = '…',
): string {
  const chars = Array.from(text);
  const max = Math.max(0, Math.trunc(limit));
  return chars.length <= max ? text : chars.slice(0, max).join('') + suffix;
}
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
/** Object key order cannot change the cached prefix; array order remains meaningful. */
export function stableStringify(value: JsonValue): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value))
    return '[' + value.map(stableStringify).join(',') + ']';
  return (
    '{' +
    Object.keys(value)
      .sort()
      .map(key => JSON.stringify(key) + ':' + stableStringify(value[key]))
      .join(',') +
    '}'
  );
}

const abbreviation =
  /(?:\bal|\bFig|\bEq|\be\.g|\bi\.e|\bvs|\bcf|\bNo|\bpp|\bDr|\bMr|\bMs|\bSt|\bInc|\bLtd|\b[A-Z])\.$/u;
/**
 * Sentences for picking one to ask about. Chinese and English full stops end a sentence;
 * math between $ signs, closing quotes and abbreviations such as "et al." stay intact.
 */
export function splitSentences(text: string): string[] {
  const pieces: string[] = [];
  let start = 0,
    math = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '$') math = !math;
    if (math) continue;
    let end = -1;
    if ('。！？!?'.includes(char)) end = i + 1;
    else if (
      char === '.' &&
      /\s/u.test(text[i + 1] ?? '') &&
      /[A-Z“"(\p{Script=Han}]/u.test(text[i + 2] ?? '') &&
      !abbreviation.test(text.slice(Math.max(start, i - 6), i + 1))
    )
      end = i + 1;
    if (end < 0) continue;
    while (end < text.length && /[”’」』)）"'\]]/u.test(text[end])) end++;
    pieces.push(text.slice(start, end).trim());
    start = end;
    i = end - 1;
  }
  pieces.push(text.slice(start).trim());
  return pieces.filter(Boolean).reduce<string[]>((list, piece) => {
    const last = list.at(-1);
    if (last !== undefined && countCharacters(piece) < 8)
      list[list.length - 1] = /[\x21-\x7e]$/.test(last)
        ? `${last} ${piece}`
        : last + piece;
    else list.push(piece);
    return list;
  }, []);
}
