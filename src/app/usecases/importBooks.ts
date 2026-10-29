import type {
  Block,
  Book,
  JsonObject,
  OutlineEntry,
  ParseModel,
  Section,
} from '@core/types';
import { createRepos } from '@data/repos';
import { planPdfParts } from '@services/mineru/split';
import { MINERU_DAILY_PRIORITY_PAGES } from '@services/mineru/types';
import type { Container } from '../container';
import {
  bookDirectory,
  getImportRuntime,
  sourcePath,
  type IntakeFile,
} from './importRuntime';
import { getParseQueue } from './parseQueue';

export { configureImportRuntime } from './importRuntime';
export type { ImportRuntime, IntakeFile } from './importRuntime';
export const importPriorityPages = MINERU_DAILY_PRIORITY_PAGES;
export type ImportSelection =
  | { kind: 'draft'; draftId: string }
  | { kind: 'duplicate'; bookId: string; restored?: boolean };
export interface ImportOptions {
  model: ParseModel;
  ocr: boolean;
  priorityFrom: number;
}
export class ImportInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportInputError';
  }
}
let nextId = 0;
const newId = (c: Container) =>
  `${c.clock.now().getTime().toString(36)}-${(++nextId).toString(
    36,
  )}-${Math.random().toString(36).slice(2, 10)}`;
const locks = new WeakMap<Container, Promise<unknown>>();
function serial<T>(c: Container, work: () => Promise<T>): Promise<T> {
  const result = (locks.get(c) ?? Promise.resolve()).then(work, work);
  locks.set(
    c,
    result.catch(() => {}),
  );
  return result;
}
const object = (value: unknown): JsonObject =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
const coverColors = [
  '#3B4F7A',
  '#7A3B3B',
  '#3B7A5C',
  '#8A5A1E',
  '#4A6A2E',
  '#9A3E2B',
  '#655080',
  '#39727A',
];
export function importCoverColor(title: string): string {
  let hash = 0;
  for (const char of title)
    hash = (hash * 31 + char.codePointAt(0)!) % 4294967296;
  return coverColors[hash % coverColors.length];
}
function formatOf(file: IntakeFile): 'pdf' | 'epub' {
  if (file.mime === 'application/epub+zip' || /\.epub$/iu.test(file.name ?? ''))
    return 'epub';
  if (file.mime === 'application/pdf' || /\.pdf$/iu.test(file.name ?? ''))
    return 'pdf';
  throw new Error('请选择 PDF 或 EPUB 文件');
}
export function describeImportParts(
  pages: number,
  size: number,
  priorityFrom: number,
): string {
  return planPdfParts({ pageCount: pages, sizeBytes: size, priorityFrom })
    .map(part => `p.${part.pageFrom}–${part.pageTo}`)
    .join('、');
}
export async function listImportDrafts(c: Container) {
  return (await c.repos.drafts.list()).map(draft => {
    const info = object(draft.info);
    return {
      key: draft.id,
      name: String(info.name ?? info.title ?? '待导入的书'),
      meta: [
        `${(Number(info.size_bytes ?? 0) / 1024 / 1024).toFixed(1)} MB`,
        Number(info.pages) > 0 ? `${info.pages} 页` : null,
      ]
        .filter(Boolean)
        .join(' · '),
      format: info.format === 'epub' ? ('EPUB' as const) : ('PDF' as const),
    };
  });
}
export async function pickImportDraft(
  c: Container,
): Promise<ImportSelection | null> {
  const file = await getImportRuntime(c).chooseFile();
  return file ? importBookFile(c, file) : null;
}
/** Restored databases may contain the book and its learning records without its source. */
async function restoreOriginal(
  c: Container,
  book: Book,
  incoming: string,
): Promise<boolean> {
  const runtime = getImportRuntime(c),
    source = sourcePath(runtime, book.id, book.format);
  const missing = await c.repos.settings.get<{ id: string; sha256: string }[]>(
    'backup.missingOriginals',
    [],
  );
  const marked = missing.some(
    item => item.id === book.id && item.sha256 === book.sha256,
  );
  const exists = await runtime.files.exists(source);
  if (exists && !marked) return false;
  if (!exists || (await runtime.files.sha256(source)) !== book.sha256) {
    await runtime.files.mkdir(bookDirectory(runtime, book.id));
    if (exists) await runtime.files.remove(source);
    await runtime.files.move(incoming, source);
  }
  await c.db.transaction(async tx => {
    const repos = createRepos(tx);
    const current = await repos.settings.get<{ id: string; sha256: string }[]>(
      'backup.missingOriginals',
      [],
    );
    await repos.settings.set(
      'backup.missingOriginals',
      current.filter(
        item => item.id !== book.id || item.sha256 !== book.sha256,
      ),
    );
  });
  c.events.emit('book.parse', { bookId: book.id, status: book.status });
  return true;
}
/** Copy first: permissions on shared content URIs may end when the source app closes. */
export function importBookFile(
  c: Container,
  file: IntakeFile,
): Promise<ImportSelection> {
  return serial(c, async () => {
    const runtime = getImportRuntime(c),
      { files, pdf } = runtime;
    const format = formatOf(file),
      id = newId(c);
    const incoming = `${files.documentDir}/books/_incoming`;
    const path = `${incoming}/${id}.${format}`;
    const metadataDirectory = `${incoming}/${id}-metadata`;
    await files.mkdir(incoming);
    let retained = false;
    try {
      const copied = await files.copyFromUri(file.uri, path);
      if (!Number.isSafeInteger(copied.size) || copied.size <= 0)
        throw new Error('文件是空的，请重新选择');
      const sha256 = await files.sha256(path);
      const existing = await c.repos.books.bySha(sha256);
      if (existing) {
        const restored = await restoreOriginal(c, existing, path);
        return {
          kind: 'duplicate',
          bookId: existing.id,
          ...(restored ? { restored: true } : {}),
        };
      }
      for (const draft of await c.repos.drafts.list())
        if (object(draft.info).sha256 === sha256)
          return { kind: 'draft', draftId: draft.id };
      const name = copied.name ?? file.name ?? `未命名.${format}`;
      const info: JsonObject = {
        format,
        name,
        sha256,
        size_bytes: copied.size,
        title: name.replace(/\.(pdf|epub)$/iu, ''),
        author: '',
      };
      if (format === 'pdf') {
        try {
          const metadata = await pdf.info(path);
          if (metadata.pageCount < 1) throw new Error('PDF 没有可读取的页面');
          const samples = [
            ...new Set(
              Array.from(
                { length: Math.min(5, metadata.pageCount) },
                (_, i) =>
                  Math.round(
                    (i * (metadata.pageCount - 1)) /
                      Math.max(1, Math.min(5, metadata.pageCount) - 1),
                  ) + 1,
              ),
            ),
          ];
          const [layer, outline, labels] = await Promise.all([
            pdf.textLayer(path, samples),
            pdf.outline(path),
            pdf.pageLabels(path),
          ]);
          Object.assign(info, {
            title: metadata.title?.trim() || info.title,
            author: metadata.author?.trim() ?? '',
            pages: metadata.pageCount,
            sizes: metadata.sizes,
            has_text_layer:
              layer.sampled > 0 && layer.withText / layer.sampled >= 0.8,
            has_outline: outline.length > 0,
            outline,
            pageLabels: labels,
          });
        } finally {
          await pdf.close(path);
        }
      } else {
        if (!runtime.epub) throw new Error('EPUB 解析暂时不可用，请稍后重试');
        const metadata = await runtime.epub.inspect(path, metadataDirectory);
        Object.assign(info, {
          title: metadata.title || info.title,
          author: metadata.author,
          pages: null,
          has_text_layer: null,
          has_outline: true,
          metadataDirectory,
        });
      }
      await c.repos.drafts.insert({
        id,
        file_path: path,
        info,
        created_at: c.clock.now().toISOString(),
      });
      retained = true;
      return { kind: 'draft', draftId: id };
    } finally {
      if (!retained) {
        await files.remove(path);
        await files.remove(metadataDirectory);
      }
    }
  });
}
export function confirmImportDraft(
  c: Container,
  draftId: string,
  options: ImportOptions,
): Promise<string> {
  return serial(c, async () => {
    const runtime = getImportRuntime(c),
      { files } = runtime;
    const draft = await c.repos.drafts.get(draftId);
    if (!draft) throw new Error('找不到导入的文件，请返回书架重新选择');
    const info = object(draft.info),
      format = info.format === 'epub' ? 'epub' : 'pdf';
    const existing = await c.repos.books.bySha(String(info.sha256));
    if (existing) {
      await restoreOriginal(c, existing, draft.file_path);
      await c.repos.drafts.remove(draftId);
      await files.remove(draft.file_path);
      return existing.id;
    }
    if (format === 'epub' && !runtime.epub)
      throw new Error('EPUB 解析暂时不可用，请稍后重试');
    const pages = Number(info.pages),
      size = Number(info.size_bytes);
    const planned =
      format === 'pdf'
        ? planPdfParts({
            pageCount: pages,
            sizeBytes: size,
            priorityFrom: options.priorityFrom,
          })
        : [];
    const id = newId(c),
      directory = bookDirectory(runtime, id),
      source = sourcePath(runtime, id, format);
    await files.mkdir(directory);
    await files.move(draft.file_path, source);
    try {
      await c.db.transaction(async tx => {
        const repos = createRepos(tx, () => c.clock.now().toISOString());
        await repos.books.insert({
          id,
          sha256: String(info.sha256),
          title: String(info.title),
          author: String(info.author ?? ''),
          format,
          pages: format === 'pdf' ? pages : null,
          size_bytes: size,
          has_text_layer:
            format === 'pdf' ? Boolean(info.has_text_layer) : null,
          has_outline: Boolean(info.has_outline),
          outline: (info.outline ?? null) as unknown as OutlineEntry[] | null,
          cover_color: importCoverColor(String(info.title)),
          parse_model: format === 'pdf' ? options.model : null,
          ocr: options.ocr,
          priority_from: options.priorityFrom,
          status: format === 'pdf' ? 'parsing' : 'importing',
          created_at: c.clock.now().toISOString(),
        });
        await repos.settings.set(`book.import.${id}`, info);
        for (const [index, part] of planned.entries())
          await repos.parts.upsert({
            book_id: id,
            part_no: index + 1,
            page_from: part.pageFrom,
            page_to: part.pageTo,
            stage: 'queued',
            updated_at: c.clock.now().toISOString(),
          });
        await repos.drafts.remove(draftId);
      });
    } catch (error) {
      await files.move(source, draft.file_path);
      throw error;
    }
    if (typeof info.metadataDirectory === 'string')
      await files.remove(info.metadataDirectory);
    c.events.emit('book.parse', {
      bookId: id,
      status: format === 'pdf' ? 'parsing' : 'importing',
    });
    getParseQueue(c)
      .resume()
      .catch(() => c.log.error('解析队列未能启动'));
    return id;
  });
}

/** Explicitly authorized reparse. Foreground resume alone never recreates cleared data. */
export function reparseBook(c: Container, bookId: string): Promise<void> {
  return serial(c, async () => {
    const runtime = getImportRuntime(c),
      book = await c.repos.books.get(bookId);
    if (!book) throw new ImportInputError('这本书已经不在书架上了');
    if (!(await runtime.files.exists(sourcePath(runtime, bookId, book.format))))
      throw new ImportInputError(
        '原文件不在本机，请先从书架重新选择同一本 PDF 或 EPUB 补回原文件',
      );
    const planned =
      book.format === 'pdf'
        ? planPdfParts({
            pageCount: book.pages ?? 0,
            sizeBytes: book.size_bytes,
            priorityFrom: book.priority_from,
          })
        : [];
    await getParseQueue(c).dispose();
    await c.db.transaction(async tx => {
      const repos = createRepos(tx, () => c.clock.now().toISOString());
      const previous = await repos.settings.get<Block[]>(
        `reparse.blocks.${bookId}`,
        [],
      );
      const current = await tx.all<Block>(
        'SELECT * FROM block WHERE book_id=? ORDER BY seq',
        [bookId],
      );
      const blocks = [
        ...new Map(
          [...previous, ...current].map(block => [block.seq, block]),
        ).values(),
      ];
      if (blocks.length)
        await repos.settings.set(`reparse.blocks.${bookId}`, blocks);
      const previousSections = await repos.settings.get<Section[]>(
        `reparse.sections.${bookId}`,
        [],
      );
      const currentSections = await repos.sections.tree(bookId);
      await repos.settings.set(`reparse.sections.${bookId}`, [
        ...new Map(
          [...previousSections, ...currentSections].map(section => [
            section.id,
            section,
          ]),
        ).values(),
      ]);
      await tx.run('DELETE FROM book_part WHERE book_id=?', [bookId]);
      for (const [index, part] of planned.entries())
        await repos.parts.upsert({
          book_id: bookId,
          part_no: index + 1,
          page_from: part.pageFrom,
          page_to: part.pageTo,
          stage: 'queued',
          updated_at: c.clock.now().toISOString(),
        });
      await repos.books.update(bookId, {
        status: book.format === 'pdf' ? 'parsing' : 'importing',
        ready_to_page: 0,
      });
    });
    await runtime.files.remove(`${runtime.files.cacheDir}/parse/${bookId}`);
    c.events.emit('book.parse', {
      bookId,
      status: book.format === 'pdf' ? 'parsing' : 'importing',
    });
    await getParseQueue(c).resume();
  });
}
