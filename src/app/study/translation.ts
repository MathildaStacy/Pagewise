import { displayTex } from '@core/markup';
import type { Block } from '@core/types';

export interface TranslationChunk {
  source: string;
  translate: boolean;
}

export interface TranslationPassage {
  id: string;
  block: Block;
  source: string;
  translate: boolean;
}

export interface TranslationProgress extends TranslationPassage {
  answer: string | null;
  complete: boolean;
}

/** Alignment is owned by the source, never inferred from the model's paragraphs. */
export function translationPassages(
  blocks: readonly Block[],
): TranslationPassage[] {
  return blocks.flatMap(block => {
    if (block.type === 'table') {
      const source = block.html || block.text;
      return [
        { id: `${block.seq}:0`, block, source, translate: !!source.trim() },
      ];
    }
    if (
      block.type === 'image' &&
      (block.refinement?.visual || !block.text.trim())
    ) {
      return [
        { id: `${block.seq}:0`, block, source: block.text, translate: false },
      ];
    }
    // Keep the heading level in the source block instead of asking the model to recreate it.
    const chunks = translationChunks([
      { ...block, type: block.type === 'title' ? 'text' : block.type },
    ]);
    return chunks.map((chunk, index) => ({
      ...chunk,
      id: `${block.seq}:${index}`,
      block: chunks.length === 1 ? block : { ...block, text: chunk.source },
    }));
  });
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
      if (block.type === 'equation') source = `$$\n${displayTex(source)}\n$$`;
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
