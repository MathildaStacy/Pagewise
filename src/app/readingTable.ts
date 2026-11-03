import { DomUtils, parseDocument } from 'htmlparser2';
import type { AnyNode } from 'domhandler';

export interface BookCell {
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  text: string;
  header: boolean;
}
export interface BookTableData {
  cells: BookCell[];
  rows: number;
  columns: number;
}

function cellText(node: AnyNode): string {
  if (node.type === 'text') return node.data;
  if (!DomUtils.isTag(node)) return '';
  const text = node.children.map(cellText).join('');
  if (node.name === 'br') return '\n';
  if (node.name === 'sup' || node.name === 'sub')
    return '<' + node.name + '>' + text + '</' + node.name + '>';
  if (node.name === 'b' || node.name === 'strong') return '**' + text + '**';
  return text;
}

/** Preserve the original grid, including cells occupied by earlier rowspans. No book content is executed. */
export function parseBookTable(
  text: string,
  html?: string | null,
): BookTableData | null {
  const source = html
    ? DomUtils.findAll(n => n.name === 'tr', parseDocument(html).children).map(
        tr =>
          tr.children
            .filter(n => DomUtils.isTag(n) && /^(td|th)$/.test(n.name))
            .map(n => {
              if (!DomUtils.isTag(n)) throw new Error('Expected table cell');
              const span = (key: string) =>
                Math.max(1, Math.min(100, parseInt(n.attribs[key], 10) || 1));
              return {
                text: n.children.map(cellText).join('').trim(),
                rowSpan: span('rowspan'),
                colSpan: span('colspan'),
                header: n.name === 'th',
              };
            }),
      )
    : text
        .trim()
        .split('\n')
        .filter(
          line => /^\s*\|/.test(line) && !/^\s*\|?[\s:|-]+\|\s*$/.test(line),
        )
        .map(line =>
          line
            .trim()
            .replace(/^\||\|$/g, '')
            .split('|')
            .map(value => ({
              text: value.trim(),
              rowSpan: 1,
              colSpan: 1,
              header: false,
            })),
        );
  if (!source.length) return null;
  const occupied = new Set<string>();
  const cells: BookCell[] = [];
  let columns = 0;
  source.forEach((row, r) => {
    let col = 0;
    for (const cell of row) {
      while (
        Array.from({ length: cell.colSpan }, (_, c) =>
          occupied.has(r + ':' + (col + c)),
        ).some(Boolean)
      )
        col++;
      const rowSpan = Math.min(cell.rowSpan, source.length - r);
      cells.push({
        ...cell,
        row: r,
        col,
        rowSpan,
        header: cell.header || r === 0,
      });
      for (let y = r; y < r + rowSpan; y++) {
        for (let x = col; x < col + cell.colSpan; x++)
          occupied.add(y + ':' + x);
      }
      col += cell.colSpan;
      columns = Math.max(columns, col);
    }
  });
  return cells.length ? { cells, rows: source.length, columns } : null;
}
