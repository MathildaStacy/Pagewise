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
const validPdfPage = (page: number | null): page is number =>
  page !== null && Number.isSafeInteger(page) && page >= 1;
const printedPage = (book: PageLabelBook, pdfPage: number): string | null => {
  const label = (book.page_labels ?? book.pageLabels)?.[pdfPage - 1]?.trim();
  if (label) return label;
  const inferred = pdfPage - book.page_offset;
  return inferred > 0 ? String(inferred) : null;
};
/** Exact PDF labels win; front matter without a printed label uses its physical PDF page. */
export function pageLabel(
  book: PageLabelBook,
  pdfPage: number | null,
  loc?: string | null,
): string {
  if (pdfPage === null || book.format === 'epub')
    return loc?.trim() || '无页码';
  if (!validPdfPage(pdfPage)) return '无页码';
  const label = printedPage(book, pdfPage);
  return label ? `p.${label}` : `PDF 第 ${pdfPage} 页`;
}

/** Keep a range in one coordinate system when it crosses unlabeled front matter. */
export function pageRangeLabel(
  book: PageLabelBook,
  pageFrom: number | null,
  pageTo: number | null,
): string {
  const from = pageLabel(book, pageFrom);
  if (
    book.format === 'epub' ||
    !validPdfPage(pageFrom) ||
    !validPdfPage(pageTo) ||
    pageTo <= pageFrom
  )
    return from;
  if (!printedPage(book, pageFrom) || !printedPage(book, pageTo))
    return `PDF 第 ${pageFrom}–${pageTo} 页`;
  return `${from}–${pageLabel(book, pageTo).replace(/^p\./, '')}`;
}
