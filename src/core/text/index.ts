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
