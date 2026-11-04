import type { Block, JsonValue, Section } from '@core/types';
import { pageLabel, pageRangeLabel, parseBlockRef } from '@core/ids';
import { formatBlocks } from '@core/context';
import { learningSelection } from '@core/learningScope';
import { evaluateArithmetic } from '@core/arithmetic';
import type { Container } from '../container';

export interface ReadToolResult {
  output: string;
  label: string;
  allowedRefs: number[];
  blocks: Block[];
  section?: Section;
  part?: number;
}
export function parseToolArgs(text: string): Record<string, unknown> {
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('工具参数必须是对象');
  return value as Record<string, unknown>;
}
function requiredString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`工具参数 ${key} 不能为空`);
  return value;
}
export async function executeReadTool(
  c: Container,
  bookId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<ReadToolResult> {
  if (name === 'calculate') return calculate(args);
  const book = await c.repos.books.get(bookId);
  const pageOffset = book?.page_offset ?? 0;
  const result = (
    output: string,
    label: string,
    blocks: Block[] = [],
  ): ReadToolResult => ({
    output,
    label,
    blocks,
    allowedRefs: blocks.map(block => block.seq),
  });
  if (name === 'load_section') {
    const id = requiredString(args, 'id'),
      section = await c.repos.sections.get(bookId, id);
    if (!section) {
      const nearest = (await c.repos.sections.leaves(bookId))
        .sort(
          (a, b) => distance(a.id, id) - distance(b.id, id) || a.ord - b.ord,
        )
        .slice(0, 3);
      return result(
        JSON.stringify({
          error: '小节不存在',
          nearest: nearest.map(s => ({ id: s.id, title: s.title })),
        }),
        `没有找到小节 ${id}`,
      );
    }
    let blocks = await c.repos.blocks.reading.bySection(bookId, id);
    const part =
      typeof args.part === 'number' &&
      Number.isInteger(args.part) &&
      args.part >= 0
        ? args.part
        : undefined;
    if (part !== undefined) {
      const range = (await c.repos.sections.parts(bookId, id)).find(
        p => p.part_no === part,
      );
      if (!range)
        return result(
          JSON.stringify({ error: '这一段不存在' }),
          `没有找到 ${id} 的这一段`,
        );
      blocks = blocks.filter(
        block => block.seq >= range.block_from && block.seq <= range.block_to,
      );
    }
    return {
      ...result(
        formatBlocks(blocks, pageOffset),
        `读取 ${id} ${section.title}${
          section.page_from != null
            ? `（${pageRangeLabel(
                book ?? { page_offset: 0 },
                section.page_from,
                section.page_to,
              )}）`
            : ''
        }`,
        blocks,
      ),
      section,
      part,
    };
  }
  if (name === 'search_book') {
    const query = requiredString(args, 'query');
    const [sections, scope] = await Promise.all([
      c.repos.sections.tree(bookId),
      c.repos.sections.learningScope(bookId),
    ]);
    const within =
      typeof args.chapter === 'string'
        ? chapterSection(sections, args.chapter)
        : undefined;
    const roles = learningSelection(sections, scope, book?.title);
    // Bibliography, index and contents pages repeat terms without explaining them.
    const hits = (
      await c.repos.blocks.search(bookId, query, 24, { within: within?.id })
    )
      .map((hit, index) => ({
        hit,
        index,
        reference:
          !!hit.section_id && roles.get(hit.section_id)?.role === 'reference',
      }))
      .sort(
        (a, b) =>
          Number(a.reference) - Number(b.reference) || a.index - b.index,
      )
      .slice(0, 8)
      .map(item => item.hit);
    const titles = new Map(
      sections.map(section => [section.id, section.title]),
    );
    const blocks = (
      await Promise.all(hits.map(hit => c.repos.blocks.get(bookId, hit.seq)))
    ).filter((block): block is Block => !!block);
    return result(
      JSON.stringify(
        hits.map(hit => ({
          id: hit.ref,
          page: hit.page != null ? hit.page - pageOffset : null,
          section: hit.section_id,
          section_title: hit.section_id
            ? titles.get(hit.section_id) ?? null
            : null,
          snippet: hit.snippet,
        })),
      ),
      `在${within ? ` ${within.id} ` : '全书'}搜索「${query}」· 找到 ${
        hits.length
      } 处`,
      blocks,
    );
  }
  if (name === 'get_blocks') {
    const ids = args.ids;
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 12)
      throw new Error('每次读取 1–12 个块');
    const refs = ids.map(ref =>
      typeof ref === 'string' ? parseBlockRef(ref) : null,
    );
    if (refs.some(ref => ref === null))
      throw new Error('请使用 b 加数字的块 ID');
    const blocks = await c.repos.blocks.reading.byRefs(
      bookId,
      refs as number[],
    );
    const found = new Set(blocks.map(block => block.seq));
    const missing = ids.filter((_, i) => !found.has(refs[i]!));
    return result(
      `${
        missing.length ? `${JSON.stringify({ missing })}\n` : ''
      }${formatBlocks(blocks, pageOffset)}`,
      `读取原文 · ${blocks.length} 段`,
      blocks,
    );
  }
  if (name === 'get_outline') {
    const [sections, scope] = await Promise.all([
      c.repos.sections.tree(bookId),
      c.repos.sections.learningScope(bookId),
    ]);
    const parent =
      typeof args.parent_id === 'string' && args.parent_id.trim()
        ? chapterSection(sections, args.parent_id)
        : undefined;
    if (typeof args.parent_id === 'string' && args.parent_id.trim() && !parent)
      return result(
        JSON.stringify({ error: '章节不存在' }),
        `没有找到 ${args.parent_id}`,
      );
    const ids = new Set(parent ? [parent.id] : sections.map(s => s.id));
    // Repeat until stable: sibling order alone does not put every parent first.
    for (let grew = !!parent; grew; ) {
      grew = false;
      for (const section of sections)
        if (
          section.parent_id &&
          ids.has(section.parent_id) &&
          !ids.has(section.id)
        ) {
          ids.add(section.id);
          grew = true;
        }
    }
    const listed = sections.filter(section => ids.has(section.id));
    const offset =
      typeof args.offset === 'number' &&
      Number.isInteger(args.offset) &&
      args.offset >= 0
        ? args.offset
        : 0;
    const roles = learningSelection(sections, scope, book?.title);
    const page = listed.slice(offset, offset + 50);
    return result(
      JSON.stringify({
        citable: false,
        source_kind: 'outline',
        sections: page.map(section => ({
          id: section.id,
          title: section.title,
          parent_id: section.parent_id,
          level: section.level,
          parts: section.parts,
          page:
            section.page_from === null ? null : section.page_from - pageOffset,
          ...(roles.get(section.id)?.role === 'reference'
            ? { reference: true }
            : {}),
        })),
        next_offset: offset + 50 < listed.length ? offset + 50 : null,
      }),
      `查看目录${parent ? ` ${parent.id}` : ''} · ${page.length} 节`,
    );
  }
  if (name === 'get_figure') {
    const ref = requiredString(args, 'id'),
      seq = parseBlockRef(ref),
      block = seq === null ? undefined : await c.repos.blocks.get(bookId, seq);
    if (!block || block.type !== 'image')
      return result(JSON.stringify({ error: '图片不存在' }), '没有找到这张图');
    return result(
      formatBlocks([block], pageOffset),
      `查看图片${
        block.page != null
          ? `（${pageLabel(book ?? { page_offset: 0 }, block.page)}）`
          : ''
      }`,
      [block],
    );
  }
  if (name === 'get_notes') {
    const id = requiredString(args, 'section_id');
    const [section, qa, stuck] = await Promise.all([
      c.repos.sections.get(bookId, id),
      c.repos.notes.qa.list(bookId, id),
      c.repos.notes.stuck.list(bookId, id),
    ]);
    return result(
      JSON.stringify({
        summary: section?.summary ?? null,
        qa: qa.map(item => ({ q: item.q, a: item.a })),
        stuck: stuck.map(item => ({
          text: item.text,
          resolved: !!item.resolved_at,
        })),
      }),
      `读取 ${id} 的学习记录`,
    );
  }
  return result(
    JSON.stringify({ error: '不支持的工具' }),
    `无法执行工具 ${name}`,
  );
}
/** Numbers for teaching examples; the result is never a book source. */
function calculate(args: Record<string, unknown>): ReadToolResult {
  const items = args.expressions;
  if (!Array.isArray(items) || !items.length || items.length > 12)
    throw new Error('每次核对 1–12 个表达式');
  const calculations = items.map((item: unknown) => {
    const value = jsonObject(item);
    if (
      !value ||
      typeof value.label !== 'string' ||
      typeof value.expression !== 'string'
    )
      throw new Error('每个表达式需要 label 和 expression');
    try {
      return {
        label: value.label,
        expression: value.expression,
        value: evaluateArithmetic(value.expression),
      };
    } catch (error) {
      return {
        label: value.label,
        expression: value.expression,
        error: error instanceof Error ? error.message : '计算失败',
      };
    }
  });
  const ascending = calculations
    .filter(
      (item): item is typeof item & { value: number } =>
        item.value !== undefined,
    )
    .sort((a, b) => a.value - b.value);
  // Ties are listed in full so a "pick the smallest" rule never hides an equal option.
  const extremum = (value: number | undefined) =>
    value === undefined
      ? null
      : {
          value,
          labels: ascending
            .filter(item => item.value === value)
            .map(item => item.label),
        };
  return {
    output: JSON.stringify({
      citable: false,
      source_kind: 'calculation',
      results: calculations,
      ascending: ascending.map(item => item.label),
      minimum: extremum(ascending[0]?.value),
      maximum: extremum(ascending.at(-1)?.value),
    }),
    label: `核对计算 · ${calculations.length} 个式子`,
    allowedRefs: [],
    blocks: [],
  };
}
export function jsonObject(value: unknown): Record<string, JsonValue> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, JsonValue>;
}

/** Accepts "3", "ch3", "第3章" or "3.5 动量因子"; an unknown chapter searches the whole book. */
function chapterSection(
  sections: readonly Section[],
  chapter: string,
): Section | undefined {
  const raw = chapter.trim();
  const id = raw
    .replace(/^(?:ch(?=\d)|第\s*)/iu, '')
    .match(/^[\p{L}\p{N}][\w.-]*/u)?.[0];
  return [raw, id, id && `ch${id}`]
    .filter((value): value is string => !!value)
    .map(value => sections.find(section => section.id === value))
    .find(Boolean);
}
function distance(left: string, right: string): number {
  let row = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 0; i < left.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < right.length; j++)
      next.push(
        Math.min(
          next[j] + 1,
          row[j + 1] + 1,
          row[j] + (left[i] === right[j] ? 0 : 1),
        ),
      );
    row = next;
  }
  return row[right.length];
}
