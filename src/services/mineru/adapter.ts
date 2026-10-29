import {
  MineruError,
  type AdaptedResult,
  type AdapterFilesPort,
  type AdapterOptions,
  type CoordinateSystem,
  type PageSize,
  type RawBlock,
} from './types';
export type { RawBlock, AdaptedResult } from './types';
type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordValue)
    : null;
const string = (value: unknown) => (typeof value === 'string' ? value : '');
const array = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const plain = (html: string) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
function textOf(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  const row = object(value);
  if (!row) return '';
  return (
    string(row.text || row.content).trim() ||
    array(row.lines)
      .map(line =>
        array(object(line)?.spans)
          .map(span => textOf(span))
          .join(''),
      )
      .join('\n')
      .trim()
  );
}
function relativePath(value: unknown): string | undefined {
  const path = string(value).replace(/^\.\//, '').replace(/\\/g, '/');
  if (!path) return undefined;
  if (
    path.startsWith('/') ||
    path.includes(':') ||
    path.split('/').some(p => p === '..')
  )
    throw new MineruError('protocol');
  return path;
}
function pageSize(value: unknown): PageSize | undefined {
  const row = object(value);
  const pair = array(row?.page_size ?? row?.size);
  const w = pair[0] ?? row?.width ?? row?.page_width;
  const h = pair[1] ?? row?.height ?? row?.page_height;
  return finite(w) && finite(h) && w > 0 && h > 0 ? { w, h } : undefined;
}
function box(value: unknown): [number, number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(finite))
    return null;
  return value as [number, number, number, number];
}
function coordinate(value: unknown): CoordinateSystem | undefined {
  if (value === 'relative' || value === '0-1') return 'relative';
  if (value === 'normalized1000' || value === '0-1000') return 'normalized1000';
  if (
    value === 'page' ||
    value === 'points' ||
    value === 'pixels' ||
    value === 'pt' ||
    value === 'pixel'
  )
    return 'page';
  return undefined;
}
function layoutPages(layout: unknown): RecordValue[] {
  const root = object(layout);
  return array(root?.pdf_info ?? root?.pages)
    .map(object)
    .filter((v): v is RecordValue => Boolean(v));
}
const compact = (value: string) => value.replace(/\s+/g, '');
function normalizeBox(
  row: RecordValue,
  idx: number,
  options: AdapterOptions,
  pages: RecordValue[],
): RawBlock['bbox'] {
  const raw = box(row.bbox);
  if (!raw) return null;
  const page = pages.find((p, i) => (p.page_idx ?? i) === idx);
  const size =
    pageSize(page) ??
    options.pageSizes?.[options.pageFrom + idx - 1] ??
    options.pageSizes?.[idx];
  const root = object(options.layout);
  let system =
    coordinate(row.coordinate_system ?? row.bbox_format) ??
    coordinate(page?.coordinate_system) ??
    coordinate(root?.coordinate_system ?? root?.bbox_format) ??
    options.coordinateSystem ??
    'auto';
  if (system === 'auto') {
    if (raw.every(n => n >= 0 && n <= 1)) system = 'relative';
    else {
      // Official content_list coordinates use 0..1000. Older pipeline output
      // sometimes retains the layout's PDF coordinates; match its source block.
      system = 'normalized1000';
      const source = array(page?.para_blocks ?? page?.preproc_blocks)
        .map(object)
        .find(
          candidate =>
            candidate &&
            textOf(row) &&
            compact(textOf(candidate)) === compact(textOf(row)),
        );
      const sourceBox = box(source?.bbox);
      if (
        sourceBox &&
        size &&
        raw.every((n, i) => Math.abs(n - sourceBox[i]) < 1)
      )
        system = 'page';
    }
  }
  if (system === 'page' && !size) return null;
  const x =
    system === 'relative' ? 1 : system === 'normalized1000' ? 1000 : size!.w;
  const y =
    system === 'relative' ? 1 : system === 'normalized1000' ? 1000 : size!.h;
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  const normalized: RawBlock['bbox'] = [
    clamp(Math.min(raw[0], raw[2]) / x),
    clamp(Math.min(raw[1], raw[3]) / y),
    clamp(Math.max(raw[0], raw[2]) / x),
    clamp(Math.max(raw[1], raw[3]) / y),
  ];
  return normalized[2] > normalized[0] && normalized[3] > normalized[1]
    ? normalized
    : null;
}
function captions(value: unknown): string[] {
  return (Array.isArray(value) ? value : [value]).map(textOf).filter(Boolean);
}
function printedNumber(value: unknown): number | undefined {
  const text = textOf(value);
  const match = /^(?:[-—–]\s*)?(\d{1,6})(?:\s*[-—–])?$/.exec(text);
  return match && Number(match[1]) > 0 ? Number(match[1]) : undefined;
}
function mergeBoxes(
  a: RawBlock['bbox'],
  b: RawBlock['bbox'],
): RawBlock['bbox'] {
  return a && b
    ? [
        Math.min(a[0], b[0]),
        Math.min(a[1], b[1]),
        Math.max(a[2], b[2]),
        Math.max(a[3], b[3]),
      ]
    : null;
}

export function adaptContentList(
  content: unknown,
  options: AdapterOptions,
): AdaptedResult {
  if (
    !Number.isInteger(options.pageFrom) ||
    options.pageFrom < 1 ||
    !Array.isArray(content)
  )
    throw new MineruError('protocol');
  const pages = layoutPages(options.layout);
  const rows = content
    .map((value, order) => {
      const row = object(value);
      if (!row || !Number.isInteger(row.page_idx) || Number(row.page_idx) < 0)
        throw new MineruError('protocol');
      return { row, order, idx: Number(row.page_idx) };
    })
    .sort((a, b) => a.idx - b.idx || a.order - b.order);
  const blocks: RawBlock[] = [];
  const pageNumbers: AdaptedResult['pageNumbers'] = [];
  let visual: RawBlock | undefined;
  const addNumber = (value: unknown, page: number) => {
    const printed = printedNumber(value);
    if (
      printed !== undefined &&
      !pageNumbers.some(n => n.page === page && n.printed === printed)
    )
      pageNumbers.push({ page, printed });
  };
  for (const { row, idx } of rows) {
    const page = options.pageFrom + idx;
    const type = string(row.type).toLowerCase();
    if (['page_number', 'page_num', 'page-number'].includes(type)) {
      addNumber(row, page);
      continue;
    }
    if (['header', 'footer', 'page_header', 'page_footer'].includes(type))
      continue;
    const rawText = textOf(row);
    const base = {
      seq: 0,
      page,
      bbox: normalizeBox(row, idx, options, pages),
      text: rawText,
    };
    let block: RawBlock;
    const level = finite(row.text_level)
      ? row.text_level
      : finite(row.level)
      ? row.level
      : 0;
    if (type === 'title' || (type === 'text' && level > 0))
      block = {
        ...base,
        type: 'title',
        ...(level > 0 ? { level: Math.floor(level) } : {}),
      };
    else if (
      type === 'equation' ||
      type === 'interline_equation' ||
      row.text_format === 'latex'
    )
      block = {
        ...base,
        type: 'equation',
        latex: string(row.latex) || rawText,
      };
    else if (type === 'text') block = { ...base, type: 'text' };
    else if (type === 'image' || type === 'chart')
      block = { ...base, type: 'image', imageFile: relativePath(row.img_path) };
    else if (type === 'table')
      block = {
        ...base,
        type: 'table',
        html: string(row.table_body),
        text: rawText || plain(string(row.table_body)),
        imageFile: relativePath(row.img_path),
      };
    else if (type === 'code')
      block = { ...base, type: 'code', text: string(row.code_body) || rawText };
    else if (type === 'list' || type === 'list_item')
      block = {
        ...base,
        type: 'list',
        text:
          array(row.list_items).map(textOf).filter(Boolean).join('\n') ||
          rawText,
      };
    else if (['caption', 'image_caption', 'table_caption'].includes(type))
      block = { ...base, type: 'caption' };
    else if (['footnote', 'image_footnote', 'table_footnote'].includes(type))
      block = { ...base, type: 'footnote' };
    else continue;
    if (
      !block.text.trim() &&
      !block.latex?.trim() &&
      !block.html?.trim() &&
      !block.imageFile
    )
      continue;
    const previous = blocks.at(-1);
    if (
      type === 'list_item' &&
      previous?.type === 'list' &&
      previous.page === page
    ) {
      previous.text += '\n' + block.text;
      previous.bbox = mergeBoxes(previous.bbox, block.bbox);
      continue;
    }
    if (block.type === 'caption' && visual?.page === page)
      visual.caption = [visual.caption, block.text].filter(Boolean).join('\n');
    blocks.push(block);
    if (block.type === 'image' || block.type === 'table') {
      visual = block;
      const caption = captions(
        type === 'chart'
          ? row.chart_caption
          : block.type === 'image'
          ? row.image_caption
          : row.table_caption,
      );
      if (caption.length) {
        block.caption = caption.join('\n');
        for (const text of caption)
          blocks.push({ seq: 0, page, bbox: null, type: 'caption', text });
      }
      for (const text of captions(
        type === 'chart'
          ? row.chart_footnote
          : block.type === 'image'
          ? row.image_footnote
          : row.table_footnote,
      ))
        blocks.push({ seq: 0, page, bbox: null, type: 'footnote', text });
    }
  }
  // Page numbers can be omitted from content_list but remain in the middle layout.
  pages.forEach((page, index) => {
    for (const value of array(page.discarded_blocks)) {
      const row = object(value);
      if (
        row &&
        ['page_number', 'page_num', 'page-number'].includes(string(row.type))
      )
        addNumber(row, options.pageFrom + Number(page.page_idx ?? index));
    }
  });
  const perPage = new Map<number, number>();
  for (const block of blocks) {
    const ordinal = (perPage.get(block.page) ?? 0) + 1;
    if (ordinal >= 1000) throw new MineruError('protocol');
    perPage.set(block.page, ordinal);
    block.seq = block.page * 1000 + ordinal;
  }
  return {
    blocks,
    pageNumbers: pageNumbers.sort((a, b) => a.page - b.page),
    pagesWithContent: [...perPage.keys()],
  };
}

/** list() returns paths relative to dir, including nested files. */
export function createMineruAdapter(files: AdapterFilesPort) {
  return {
    async adapt(
      dir: string,
      part: { pageFrom: number },
      pageSizes: readonly PageSize[],
      options: { coordinateSystem?: CoordinateSystem } = {},
    ): Promise<AdaptedResult> {
      const names = (await files.list(dir)).map(name =>
        name.startsWith(dir + '/') ? name.slice(dir.length + 1) : name,
      );
      const lists = names.filter(name =>
        /(?:^|\/)(?:.*_)?content_list\.json$/.test(name),
      );
      if (lists.length !== 1) throw new MineruError('protocol');
      const contentPath = relativePath(lists[0])!;
      const prefix = contentPath.includes('/')
        ? contentPath.slice(0, contentPath.lastIndexOf('/') + 1)
        : '';
      const layoutPath = names.includes(prefix + 'layout.json')
        ? prefix + 'layout.json'
        : names.includes('layout.json')
        ? 'layout.json'
        : undefined;
      let content: unknown, layout: unknown;
      try {
        content = JSON.parse(await files.readText(dir + '/' + contentPath));
        layout = layoutPath
          ? JSON.parse(await files.readText(dir + '/' + layoutPath))
          : undefined;
      } catch {
        throw new MineruError('protocol');
      }
      const result = adaptContentList(content, {
        pageFrom: part.pageFrom,
        pageSizes,
        layout,
        ...options,
      });
      result.blocks.forEach(block => {
        if (block.imageFile) block.imageFile = prefix + block.imageFile;
      });
      return result;
    },
  };
}
