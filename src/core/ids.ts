/** Database block sequences are non-negative safe integers; serialized refs are canonical. */
export type BlockRef = `b${number}`;
export function blockRef(seq: number): BlockRef {
  if (!Number.isSafeInteger(seq) || seq < 0)
    throw new Error('内容块序号必须是非负安全整数');
  return `b${seq}`;
}
export function parseBlockRef(value: string): number | null {
  if (!/^b\d+$/.test(value)) return null;
  const seq = Number(value.slice(1));
  return Number.isSafeInteger(seq) ? seq : null;
}
export function isBlockRef(value: string): value is BlockRef {
  return parseBlockRef(value) !== null;
}

export interface PageLabelBook {
  page_offset: number;
  format?: 'pdf' | 'epub';
  page_labels?: readonly string[] | null;
  pageLabels?: readonly string[] | null;
}
/** Use exact PDF labels when available, then the inferred printed-page offset. */
export function pageLabel(
  book: PageLabelBook,
  pdfPage: number | null,
  loc?: string | null,
): string {
  if (pdfPage === null || book.format === 'epub')
    return loc?.trim() || '无页码';
  if (!Number.isSafeInteger(pdfPage) || pdfPage < 1) return '无页码';
  const label = (book.page_labels ?? book.pageLabels)?.[pdfPage - 1]?.trim();
  return `p.${label || pdfPage - book.page_offset}`;
}
