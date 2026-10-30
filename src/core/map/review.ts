import type { JsonValue, Section } from '../types';

const object = (value: JsonValue | undefined) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : null;

/** Older imports already adopted bookmark levels but still flagged plain typography differences. */
export function mapSectionForReview(section: Section): Section {
  if (
    section.source !== 'auto' ||
    section.no !== null ||
    section.flag !== 'level' ||
    !Array.isArray(section.flag_detail)
  )
    return section;
  const flags = section.flag_detail.filter(value => {
    const flag = object(value),
      detail = object(flag?.detail);
    return !(
      flag?.kind === 'level' &&
      detail &&
      detail.reason === undefined &&
      typeof detail.recognized === 'number' &&
      [1, 2, 3].includes(detail.recognized) &&
      detail.recognized !== detail.outline &&
      section.level === detail.outline
    );
  });
  if (flags.length === section.flag_detail.length) return section;
  const kind = object(flags.at(-1))?.kind;
  if (kind && !['missing', 'level', 'merged', 'split'].includes(String(kind)))
    return section;
  return {
    ...section,
    flag: (kind as Section['flag']) ?? null,
    flag_detail: flags.length ? flags : null,
  };
}
