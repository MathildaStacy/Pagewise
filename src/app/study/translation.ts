import type { Block } from '@core/types';

export interface TranslationChunk {
  source: string;
  translate: boolean;
}

/** 按原文顺序覆盖整节；代码和独立公式直接保留，不交给模型改写。 */
export function translationChunks(
  blocks: readonly Block[],
  limit = 6000,
): TranslationChunk[] {
  const chunks: TranslationChunk[] = [];
  let prose: string[] = [];
  const flush = () => {
    const source = prose.join('\n\n');
    prose = [];
    for (let offset = 0; offset < source.length; ) {
      let end = Math.min(source.length, offset + limit);
      if (end < source.length) {
        const boundary = source.lastIndexOf('\n', end - 1);
        if (boundary > offset + limit / 2) end = boundary + 1;
        // 不将一个 Unicode 字符的代理对拆到两次请求。
        if (/[\uD800-\uDBFF]/.test(source[end - 1])) end--;
      }
      chunks.push({ source: source.slice(offset, end), translate: true });
      offset = end;
    }
  };
  for (const block of blocks) {
    if (block.type === 'code' || block.type === 'equation') {
      flush();
      let source =
        block.type === 'equation' ? block.latex || block.text : block.text;
      if (!source.trim()) continue;
      if (block.type === 'equation') source = `$$\n${source}\n$$`;
      else if (!/^\s*(?:`{3,}|~{3,})/.test(source)) {
        const fence = '`'.repeat(
          Math.max(
            3,
            ...[...source.matchAll(/`+/g)].map(match => match[0].length + 1),
          ),
        );
        source = `${fence}\n${source}\n${fence}`;
      }
      chunks.push({ source, translate: false });
    } else if (block.text.trim()) {
      prose.push(
        block.type === 'title'
          ? '#'.repeat(Math.min(6, block.level ?? 2)) + ' ' + block.text
          : block.text,
      );
    }
  }
  flush();
  return chunks;
}
