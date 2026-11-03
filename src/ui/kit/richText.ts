import type { RichDoc, RichInline } from './contracts';

export function copyableText(doc: RichDoc): string {
  const inline = (nodes: RichInline[]): string =>
    nodes
      .map(node =>
        node.t === 'text' || node.t === 'code'
          ? node.v
          : node.t === 'b'
          ? inline(node.c)
          : node.t === 'math'
          ? `$${node.tex}$`
          : node.t === 'cite'
          ? `[${node.label ?? `b${node.ref}`}]`
          : '（未核实）',
      )
      .join('');
  return doc
    .map(block =>
      block.t === 'p' || block.t === 'check'
        ? inline(block.c)
        : block.t === 'list'
        ? block.items
            .map(
              (item, index) =>
                `${
                  block.ordered ? `${(block.start ?? 1) + index}.` : '•'
                } ${inline(item)}`,
            )
            .join('\n')
        : block.t === 'math'
        ? `$$${block.tex}$$`
        : block.t === 'table'
        ? block.rows.map(row => row.map(inline).join('\t')).join('\n')
        : block.t === 'code'
        ? block.text
        : block.t === 'aux'
        ? copyableText(block.body)
        : block.t === 'visual'
        ? `${block.data.title}\n${block.data.description}`
        : block.text ?? block.label ?? `[b${block.ref}]`,
    )
    .join('\n\n');
}
