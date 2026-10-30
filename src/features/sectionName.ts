import type { Section } from '@core/types';

/** Imported headings can already contain their separately stored section number. */
export function sectionName(section: Pick<Section, 'no' | 'title'>): string {
  const no = section.no?.trim(),
    title = section.title.trim();
  if (!no || title === no) return title;
  if (title.startsWith(no) && /^\s/u.test(title.slice(no.length))) return title;
  return `${no} ${title}`;
}
