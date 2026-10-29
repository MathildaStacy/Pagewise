import type { Block, JsonValue, Section } from '@core/types';
import { parseBlockRef } from '@core/ids';
import { formatBlocks } from '@core/context';
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
    let blocks = await c.repos.blocks.bySection(bookId, id);
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
            ? `（p.${section.page_from - pageOffset}–${
                (section.page_to ?? section.page_from) - pageOffset
              }）`
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
    let hits = await c.repos.blocks.search(bookId, query, 8);
    if (typeof args.chapter === 'string') {
      const chapter = args.chapter;
      hits = hits.filter(hit => hit.section_id?.startsWith(chapter));
    }
    const blocks = (
      await Promise.all(hits.map(hit => c.repos.blocks.get(bookId, hit.seq)))
    ).filter((block): block is Block => !!block);
    return result(
      JSON.stringify(
        hits.map(hit => ({
          id: hit.ref,
          page: hit.page != null ? hit.page - pageOffset : null,
          section: hit.section_id,
          snippet: hit.snippet,
        })),
      ),
      `在全书搜索「${query}」· 找到 ${hits.length} 处`,
      blocks,
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
      `查看图片${block.page != null ? `（p.${block.page - pageOffset}）` : ''}`,
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
export function jsonObject(value: unknown): Record<string, JsonValue> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, JsonValue>;
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
