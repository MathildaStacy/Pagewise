import type { Section } from './types';

export type LearningScope = Record<string, 'include' | 'exclude'>;
export type ContentRole = 'body' | 'optional' | 'reference';
export const learningScopeKey = (bookId: string) =>
  `book.learningScope.${bookId}`;
const normalized = (text: string) =>
  text
    .normalize('NFKC')
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .toLocaleLowerCase()
    .replace(/[’‘]/gu, "'")
    .replace(/\s+/gu, ' ')
    .trim();
const reference =
  /^(?:cover|title page|copyright(?:\s*page)?|contents|table of contents|list of (?:figures|tables)|index|subject index|author index|bibliography|references(?: bibliography)?|bibliographical and historical notes|historical notes|further reading|glossary|封面|封底|书名|扉页|版权(?:页|信息)?|内容简介|书前内容|目录|目次|图表目录|索引|注释|参考文献|参考书目|术语表)$/iu;
const optional =
  /^(?:preface(?: to .*)?|foreword|acknowledg(?:e)?ments|dedication|epigraph|preamble|praise for .+|contributors|about (?:the )?(?:authors?|editors?|reviewers?)|前言|序言|序|推荐序|致谢|献词|译者序|作者简介|编者简介|o'reilly media,?\s*inc\.介绍)$/iu;

/** Conservative title rules: ordinary chapters (including Introduction and exercises) stay in. */
export function sectionRole(section: Section, bookTitle = ''): ContentRole {
  const title = normalized(section.title);
  if (
    reference.test(title) ||
    /^the (?:full )?project gutenberg.*licen[cs]e$/iu.test(title) ||
    (!section.parent_id &&
      section.chars < 200 &&
      (title === normalized(bookTitle) || /\bedition\s+[\d.]+$/iu.test(title)))
  )
    return 'reference';
  if (
    optional.test(title) ||
    (!section.parent_id &&
      (/^[A-Z]$/u.test(section.no ?? '') ||
        /^(?:appendix\b|附录)/iu.test(title)))
  )
    return 'optional';
  return 'body';
}

export function learningSelection(
  sections: Section[],
  overrides: LearningScope = {},
  bookTitle = '',
): Map<string, { role: ContentRole; included: boolean }> {
  const byId = new Map(sections.map(section => [section.id, section]));
  const firstChapter = sections.find(section => section.no === '1');
  const bookName = normalized(bookTitle);
  const frontMatter = new Map<string, ContentRole>();
  if (firstChapter) {
    const covers = sections.filter(
      section =>
        /^(?:cover|title page|封面|扉页|书名)$/iu.test(
          normalized(section.title),
        ) &&
        section.ord < firstChapter.ord &&
        section.page_from !== null &&
        section.page_from === section.page_to,
    );
    for (const section of sections) {
      const title = normalized(section.title);
      if (section.parent_id || section.no || section.ord >= firstChapter.ord)
        continue;
      if (
        section.is_leaf &&
        section.chars < 2000 &&
        section.page_from === 1 &&
        (section.page_to ?? Infinity) <= 2 &&
        sections.some(
          next =>
            next.ord > section.ord &&
            next.ord < firstChapter.ord &&
            (next.page_from ?? Infinity) <= 5 &&
            /^(?:preface|前言|contents|目录)$/iu.test(normalized(next.title)),
        )
      ) {
        frontMatter.set(section.id, 'reference');
        continue;
      }
      // An empty Cover bookmark can coexist with a populated title on that same page.
      if (
        section.is_leaf &&
        section.chars < 2000 &&
        covers.some(
          cover =>
            section.page_from === cover.page_from &&
            section.page_to === cover.page_to,
        )
      ) {
        frontMatter.set(section.id, 'reference');
        continue;
      }
      if (
        title.length < 5 ||
        !(bookName === title || bookName.startsWith(`${title} `))
      )
        continue;
      // Some PDFs group the title page and preface under the shortened book title.
      // Require both its position before chapter 1 and evidence of front matter.
      if (section.is_leaf && section.chars < 2000)
        frontMatter.set(section.id, 'reference');
      else if (
        sections.some(
          child =>
            child.parent_id === section.id &&
            sectionRole(child, bookTitle) !== 'body',
        )
      )
        frontMatter.set(section.id, 'optional');
    }
  }
  const result = new Map<string, { role: ContentRole; included: boolean }>();
  const visit = (
    section: Section,
    ancestors = new Set<string>(),
  ): { role: ContentRole; included: boolean } => {
    const cached = result.get(section.id);
    if (cached) return cached;
    const own = frontMatter.get(section.id) ?? sectionRole(section, bookTitle);
    ancestors.add(section.id);
    const parent = section.parent_id ? byId.get(section.parent_id) : undefined;
    const inherited =
      parent && !ancestors.has(parent.id)
        ? visit(parent, ancestors)
        : undefined;
    const role = inherited && inherited.role !== 'body' ? inherited.role : own;
    const included = overrides[section.id]
      ? overrides[section.id] === 'include'
      : inherited && (overrides[parent!.id] || inherited.role !== 'body')
      ? inherited.included
      : role === 'body' && (inherited?.included ?? true);
    const value = { role, included };
    result.set(section.id, value);
    return value;
  };
  sections.forEach(section => visit(section));
  return result;
}

export function learningLeaves(
  sections: Section[],
  scope: LearningScope = {},
  title = '',
) {
  const selection = learningSelection(sections, scope, title);
  return sections.filter(
    section =>
      section.is_leaf &&
      section.block_from !== null &&
      selection.get(section.id)?.included,
  );
}

export const roleLabel: Record<ContentRole, string> = {
  body: '正文',
  optional: '选读',
  reference: '资料',
};
