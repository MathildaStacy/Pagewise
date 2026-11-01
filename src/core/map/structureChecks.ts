import type { Section } from '../types';

export interface StructureIssue {
  id: string;
  message: string;
  sectionId: string;
}

/** Numbering is a reason to inspect the source, never permission to invent a heading. */
export function structureIssues(sections: Section[]): StructureIssue[] {
  const groups = new Map<string, Section[]>();
  for (const section of sections) {
    if (!section.no || !/^(?:\d+|[A-Z])(?:\.\d+)+$/u.test(section.no)) continue;
    const prefix = section.no.slice(0, section.no.lastIndexOf('.'));
    const key = `${section.parent_id ?? ''}:${prefix}`;
    groups.set(key, [...(groups.get(key) ?? []), section]);
  }
  const issues: StructureIssue[] = [];
  for (const values of groups.values()) {
    let previous = 0;
    const seen = new Set<number>();
    for (const section of values.sort((a, b) => a.ord - b.ord)) {
      const prefix = section.no!.slice(0, section.no!.lastIndexOf('.'));
      const number = Number(section.no!.split('.').at(-1));
      const source =
        sections
          .filter(
            s =>
              s.is_leaf &&
              s.block_from !== null &&
              s.ord < section.ord &&
              s.parent_id === section.parent_id,
          )
          .at(-1) ?? section;
      if (seen.has(number)) {
        issues.push({
          id: `duplicate:${section.id}`,
          message: `${section.no} 编号重复，请核对原书是否也重复`,
          sectionId: section.id,
        });
      } else if (number > previous + 1) {
        const missing =
          number === previous + 2
            ? `${prefix}.${previous + 1}`
            : `${prefix}.${previous + 1}–${prefix}.${number - 1}`;
        issues.push({
          id: `gap:${section.id}`,
          message: `${missing} 可能缺失，请对照相邻原文`,
          sectionId: source.id,
        });
      }
      seen.add(number);
      previous = Math.max(previous, number);
    }
  }
  return issues;
}
