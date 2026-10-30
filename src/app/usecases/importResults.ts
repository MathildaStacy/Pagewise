import {
  buildBlockMigration,
  buildMap,
  collectReferencedSeqs,
  migrateReferences,
} from '@core/map';
import type {
  Block,
  BlockInsert,
  BookPart,
  JsonObject,
  JsonValue,
  Section,
  SectionPart,
} from '@core/types';
import { createRepos, type Repos } from '@data/repos';
import type { Db } from '@data/db';
import type { Container } from '../container';
import { disposeContainerSessions } from '../study/registry';
import { disposeReaderRuntime } from '../readerRuntime';
import { bookDirectory, getImportRuntime, sourcePath } from './importRuntime';
import { getParseQueue } from './parseQueue';

export const referenceMovesKey = (bookId: string) =>
  `book.referenceMoves.${bookId}`;
export const parseWarningsKey = (bookId: string) =>
  `book.parseWarnings.${bookId}`;
export const loadParseWarnings = (c: Container, bookId: string) =>
  c.repos.settings.get<Record<string, string>>(parseWarningsKey(bookId), {});
export const loadEpubImportError = (c: Container, bookId: string) =>
  c.repos.settings.get<string | null>(`book.epubError.${bookId}`, null);
const allBlocks = (db: Db, bookId: string) =>
  db.all<Block>('SELECT * FROM block WHERE book_id=? ORDER BY seq', [bookId]);
async function priorBlocks(
  db: Db,
  repos: Repos,
  bookId: string,
): Promise<Block[]> {
  const preserved = await repos.settings.get<Block[]>(
    `reparse.blocks.${bookId}`,
    [],
  );
  const current = await allBlocks(db, bookId);
  return [
    ...new Map(
      [...preserved, ...current].map(block => [block.seq, block]),
    ).values(),
  ];
}
async function priorSections(repos: Repos, bookId: string): Promise<Section[]> {
  const preserved = await repos.settings.get<Section[]>(
    `reparse.sections.${bookId}`,
    [],
  );
  const current = await repos.sections.tree(bookId);
  return [
    ...new Map(
      [...preserved, ...current].map(section => [section.id, section]),
    ).values(),
  ];
}
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as JsonValue;
export function contiguousReadyPage(
  parts: readonly Pick<BookPart, 'page_from' | 'page_to' | 'stage'>[],
): number {
  let ready = 0;
  for (const part of [...parts].sort((a, b) => a.page_from - b.page_from)) {
    if (part.page_from > ready + 1 || part.stage !== 'done') break;
    ready = Math.max(ready, part.page_to);
  }
  return ready;
}
async function assignSections(
  db: Db,
  repos: Repos,
  bookId: string,
  sections: Section[],
  parts: SectionPart[],
) {
  await repos.sections.replaceAll(bookId, sections);
  await db.run('UPDATE block SET section_id=NULL WHERE book_id=?', [bookId]);
  for (const section of sections) {
    await repos.sections.setParts(
      bookId,
      section.id,
      parts.filter(p => p.section_id === section.id),
    );
    if (
      section.is_leaf &&
      section.block_from !== null &&
      section.block_to !== null
    )
      await db.run(
        'UPDATE block SET section_id=? WHERE book_id=? AND seq BETWEEN ? AND ?',
        [section.id, bookId, section.block_from, section.block_to],
      );
  }
}

/** Recompute derived PDF map data without reparsing or moving stable block references. */
export async function rebuildLocalPdfMap(
  c: Container,
  bookId: string,
): Promise<void> {
  const original = await c.repos.books.get(bookId);
  if (!original || original.format !== 'pdf')
    throw new Error('本地地图重建需要一本已导入的 PDF');
  await getParseQueue(c).dispose();
  await disposeContainerSessions(c);
  await disposeReaderRuntime(c);
  const status = await c.db.transaction(async tx => {
    const repos = createRepos(tx, () => c.clock.now().toISOString());
    const book = await repos.books.get(bookId);
    if (!book || book.format !== 'pdf')
      throw new Error('本地地图重建需要一本已导入的 PDF');
    const blocks = await allBlocks(tx, bookId);
    if (!blocks.length)
      throw new Error('没有已保存在本机的解析块，无法重建地图');
    const previous = await priorSections(repos, bookId);
    const info = await repos.settings.get<JsonObject>(
      `book.import.${bookId}`,
      {},
    );
    const pageNumbers = await repos.settings.get<
      { page: number; printed: number }[]
    >(`book.pageNumbers.${bookId}`, []);
    const map = buildMap(blocks, book.outline, previous, {
      bookId,
      pageLabels: Array.isArray(info.pageLabels)
        ? (info.pageLabels as string[])
        : null,
      pageNumbers,
    });
    const referenceQueries = [
      'SELECT section_id FROM message WHERE book_id=?',
      'SELECT section_id FROM qa WHERE book_id=?',
      'SELECT from_section AS section_id FROM qa WHERE book_id=?',
      'SELECT section_id FROM stuck WHERE book_id=?',
      'SELECT section_id FROM section_note WHERE book_id=?',
      'SELECT section_id FROM pin WHERE book_id=?',
      'SELECT section_id FROM card WHERE book_id=?',
      'SELECT section_id FROM lesson_plan WHERE book_id=?',
      'SELECT from_section AS section_id FROM detour WHERE book_id=?',
      'SELECT to_section AS section_id FROM detour WHERE book_id=?',
    ];
    const references = await tx.all<{ section_id: string | null }>(
      referenceQueries.join(' UNION '),
      referenceQueries.map(() => bookId),
    );
    const used = new Set(
      references.flatMap(row => (row.section_id ? [row.section_id] : [])),
    );
    const study = await repos.study.get(bookId);
    if (study?.main_section) used.add(study.main_section);
    for (const detour of study?.detours ?? []) used.add(detour.sectionId);
    for (const section of previous)
      if (
        section.source === 'manual' ||
        section.status !== 'new' ||
        section.summary !== null ||
        section.guide !== null
      )
        used.add(section.id);
    const next = new Map(map.sections.map(section => [section.id, section]));
    const oldParts = await tx.all<SectionPart>(
      'SELECT * FROM section_part WHERE book_id=? ORDER BY section_id,part_no',
      [bookId],
    );
    // Manual part boundaries belong to the user's map, just like the section itself.
    const manual = new Set(
      previous
        .filter(section => section.source === 'manual')
        .map(section => section.id),
    );
    map.parts = [
      ...map.parts.filter(part => !manual.has(part.section_id)),
      ...oldParts.filter(part => manual.has(part.section_id)),
    ];
    const partCuts = (parts: SectionPart[], id: string) =>
      JSON.stringify(
        parts
          .filter(part => part.section_id === id)
          .sort((a, b) => a.part_no - b.part_no)
          .map(part => [part.part_no, part.block_from, part.block_to]),
      );
    const unsafe = previous
      .filter(section => {
        if (!used.has(section.id)) return false;
        const target = next.get(section.id);
        return (
          !target ||
          target.is_leaf !== section.is_leaf ||
          target.merged_into !== section.merged_into ||
          partCuts(oldParts, section.id) !== partCuts(map.parts, section.id)
        );
      })
      .map(section => section.id);
    for (const section of map.sections)
      for (const target of [section.parent_id, section.merged_into])
        if (target && !next.has(target)) unsafe.push(target);
    if (unsafe.length)
      throw new Error(
        `无法安全重建地图：已使用章节或分段会变化（${[...new Set(unsafe)]
          .slice(0, 8)
          .join('、')}）。原地图与学习记录已保留。`,
      );
    await assignSections(tx, repos, bookId, map.sections, map.parts);
    await repos.books.update(bookId, { page_offset: map.pageOffset });
    await repos.settings.set(
      `book.pageOffsetReliable.${bookId}`,
      map.pageOffsetReliable,
    );
    return book.status;
  });
  c.events.emit('book.parse', { bookId, status });
}
async function moveReferences(
  db: Db,
  repos: Repos,
  bookId: string,
  old: Block[],
  current: Block[],
  from: number | null,
  to: number | null,
) {
  const inRange = (block: Block) =>
    from === null
      ? block.page === null
      : block.page !== null && block.page >= from && block.page <= to!;
  const affected = old.filter(inRange);
  if (!affected.length) return;
  const affectedSeqs = new Set(affected.map(block => block.seq));
  const sectionIds = await db.all<{ section_id: string }>(
    'SELECT DISTINCT section_id FROM message WHERE book_id=?',
    [bookId],
  );
  const messages = (
    await Promise.all(
      sectionIds.map(({ section_id }) =>
        repos.messages.thread(bookId, section_id, { limit: 2147483647 }),
      ),
    )
  )
    .flat()
    .filter(message =>
      collectReferencedSeqs({ messages: [message] }).some(seq =>
        affectedSeqs.has(seq),
      ),
    );
  const highlights = (await repos.notes.highlights.list(bookId)).filter(h =>
    affectedSeqs.has(h.block_seq),
  );
  const pins = (await repos.notes.pins.list(bookId)).filter(p =>
    affectedSeqs.has(p.block_seq),
  );
  const referenced = collectReferencedSeqs({ messages, highlights, pins });
  const migration = buildBlockMigration(
    affected,
    current.filter(inRange),
    referenced.filter(seq => affectedSeqs.has(seq)),
  );
  if (from === null) {
    const oldBySeq = new Map(affected.map(block => [block.seq, block])),
      currentBySeq = new Map(
        current.filter(inRange).map(block => [block.seq, block]),
      );
    // Empty-alt EPUB images have no text to match. Preserve only the identical local asset anchor.
    for (const seq of migration.unmatched) {
      const previous = oldBySeq.get(seq),
        next = currentBySeq.get(seq);
      if (
        previous?.type === 'image' &&
        !previous.text &&
        !previous.latex &&
        !previous.html &&
        previous.loc &&
        previous.image_path &&
        next?.type === 'image' &&
        next.loc === previous.loc &&
        next.image_path === previous.image_path &&
        next.text === previous.text &&
        next.latex === previous.latex &&
        next.html === previous.html
      ) {
        migration.mapping[seq] = seq;
        migration.matches.push({
          oldSeq: seq,
          newSeq: seq,
          similarity: 1,
          pageDelta: null,
        });
      }
    }
    migration.unmatched = migration.unmatched.filter(
      seq => migration.mapping[seq] === undefined,
    );
  }
  // References to pages outside this reparse are unchanged.
  for (const seq of referenced)
    if (!affectedSeqs.has(seq)) migration.mapping[seq] = seq;
  const moved = migrateReferences({ messages, highlights, pins }, migration);
  for (const message of moved.messages) {
    const missing = moved.moved.filter(
      value => value.kind === 'message' && value.id === message.id,
    );
    const rewrite = (text: string) =>
      missing.reduce(
        (value, ref) =>
          value.replace(
            new RegExp(`\\[\\[(?:b|q|fig):${ref.oldSeq}\\]\\]`, 'g'),
            '〔原文位置已变化〕',
          ),
        text,
      );
    let parts =
      message.parts?.map(part =>
        part &&
        typeof part === 'object' &&
        !Array.isArray(part) &&
        part.t === 'text' &&
        typeof part.text === 'string'
          ? { ...part, text: rewrite(part.text) }
          : part,
      ) ?? null;
    let content = rewrite(message.content);
    if (missing.length && !content.includes('原文位置已变化'))
      content += '\n\n〔原文位置已变化〕';
    if (
      missing.length &&
      parts?.length &&
      !JSON.stringify(parts).includes('原文位置已变化')
    )
      parts = [...parts, { t: 'text', text: '〔原文位置已变化〕' }];
    await repos.messages.update(message.id, {
      content,
      parts,
      raw: missing.length ? null : message.raw,
      quote_seq: message.quote_seq,
      allowed_refs: message.allowed_refs,
      unverified: message.unverified,
    });
  }
  // Remove affected annotations first so swapping refs cannot hit UNIQUE.
  for (const highlight of highlights)
    await db.run('DELETE FROM highlight WHERE id=?', [highlight.id]);
  for (const h of moved.highlights)
    await db.run(
      'INSERT INTO highlight (id,book_id,block_seq,start,end,color,note,created_at) VALUES (?,?,?,?,?,?,?,?)',
      [
        h.id,
        h.book_id,
        h.block_seq,
        h.start,
        h.end,
        h.color,
        h.note,
        h.created_at,
      ],
    );
  for (const pin of moved.pins) {
    const section = current.find(
      block => block.seq === pin.block_seq,
    )?.section_id;
    await db.run('UPDATE pin SET block_seq=?,section_id=? WHERE id=?', [
      pin.block_seq,
      section ?? pin.section_id,
      pin.id,
    ]);
  }
  const sections = await repos.sections.tree(bookId);
  const notes = new Map<string, string[]>();
  function append(sectionId: string | null | undefined, text: string) {
    const target =
      sections.find(s => s.id === sectionId)?.id ??
      sections.find(s => s.is_leaf)?.id ??
      sections[0]?.id;
    if (target) notes.set(target, [...(notes.get(target) ?? []), text]);
  }
  for (const highlight of moved.orphaned.highlights) {
    const block = old.find(b => b.seq === highlight.block_seq);
    append(
      block?.section_id,
      `原文位置已变化 · 高亮\n${block?.text ?? ''}${
        highlight.note ? `\n${highlight.note}` : ''
      }`,
    );
    await db.run('DELETE FROM highlight WHERE id=?', [highlight.id]);
  }
  for (const pin of moved.orphaned.pins) {
    append(
      pin.section_id,
      `原文位置已变化 · 原文问答\n问：${pin.question}\n答：${pin.answer_summary}`,
    );
    await db.run('DELETE FROM pin WHERE id=?', [pin.id]);
  }
  for (const [sectionId, additions] of notes) {
    const previous = await repos.notes.userText.get(bookId, sectionId);
    await repos.notes.userText.set(
      bookId,
      sectionId,
      [previous?.user_text, ...additions].filter(Boolean).join('\n\n'),
    );
  }
  if (moved.moved.length) {
    const previous = await repos.settings.get<JsonValue[]>(
      referenceMovesKey(bookId),
      [],
    );
    await repos.settings.set(referenceMovesKey(bookId), [
      ...previous,
      json({
        at: new Date().toISOString(),
        moved: moved.moved,
        orphaned: moved.orphaned,
        originalBlocks: affected.filter(b =>
          migration.unmatched.includes(b.seq),
        ),
      }),
    ]);
  }
}

/** A reparse replaces only its page range; blocks, map and learning references commit together. */
export async function importPdfResult(
  c: Container,
  part: BookPart,
  resultDirectory: string,
  signal?: AbortSignal,
): Promise<void> {
  const startedAt = Date.now();
  const milestone = (stage: string, count: number) =>
    c.log.debug('解析入库阶段', {
      stage,
      elapsedMs: Date.now() - startedAt,
      blocks: count,
    });
  const runtime = getImportRuntime(c),
    bookId = part.book_id;
  const info = await c.repos.settings.get<JsonObject>(
    `book.import.${bookId}`,
    {},
  );
  const sizes = Array.isArray(info.sizes)
    ? (info.sizes as unknown as { w: number; h: number }[])
    : [];
  const result = await runtime.adapt(
    resultDirectory,
    { pageFrom: part.page_from },
    sizes,
  );
  milestone('adapted', result.blocks.length);
  const images = `${bookDirectory(runtime, bookId)}/images`;
  const blocks: Omit<BlockInsert, 'book_id'>[] = [];
  await runtime.files.mkdir(images);
  let image = 0;
  for (const raw of result.blocks) {
    if (signal?.aborted) throw new Error('已停止');
    if (
      raw.page < part.page_from ||
      raw.page > part.page_to ||
      Math.floor(raw.seq / 1000) !== raw.page ||
      raw.seq % 1000 === 0
    )
      throw new Error('解析结果中的页码或段落序号不正确');
    let imagePath: string | null = null;
    if (raw.imageFile) {
      if (
        raw.imageFile.startsWith('/') ||
        raw.imageFile.split('/').includes('..')
      )
        throw new Error('解析结果中的图片路径不正确');
      const ext = /\.([a-z0-9]{1,8})$/iu.exec(raw.imageFile)?.[1] ?? 'png';
      imagePath = `images/p${raw.page}_${++image}.${ext}`;
      await runtime.files.copy(
        `${resultDirectory}/${raw.imageFile}`,
        `${bookDirectory(runtime, bookId)}/${imagePath}`,
      );
    }
    blocks.push({
      seq: raw.seq,
      page: raw.page,
      type: raw.type,
      level: raw.level ?? null,
      text: raw.text,
      latex: raw.latex ?? null,
      html: raw.html ?? null,
      image_path: imagePath,
      x0: raw.bbox?.[0] ?? null,
      y0: raw.bbox?.[1] ?? null,
      x1: raw.bbox?.[2] ?? null,
      y1: raw.bbox?.[3] ?? null,
      chars: Array.from(raw.text).length,
    });
  }
  milestone('copied', blocks.length);
  let status: 'parsing' | 'ready' = 'parsing';
  await c.db.transaction(async tx => {
    milestone('startTx', blocks.length);
    if (signal?.aborted) throw new Error('已停止');
    const repos = createRepos(tx, () => c.clock.now().toISOString());
    const book = await repos.books.get(bookId);
    if (!book) return;
    const old = await priorBlocks(tx, repos, bookId),
      previous = await priorSections(repos, bookId);
    await repos.blocks.deleteByPages(bookId, part.page_from, part.page_to);
    await repos.refinements.invalidate(
      bookId,
      c.clock.now().toISOString(),
      part.page_from,
      part.page_to,
    );
    await repos.blocks.insertMany(bookId, blocks);
    milestone('inserted', blocks.length);
    const current = await allBlocks(tx, bookId);
    const previousNumbers = await repos.settings.get<
      { page: number; printed: number }[]
    >(`book.pageNumbers.${bookId}`, []);
    const numbers = [
      ...previousNumbers.filter(
        n => n.page < part.page_from || n.page > part.page_to,
      ),
      ...result.pageNumbers,
    ];
    const map = buildMap(current, book.outline, previous, {
      bookId,
      pageLabels: Array.isArray(info.pageLabels)
        ? (info.pageLabels as string[])
        : null,
      pageNumbers: numbers,
    });
    milestone('mapbuilt', current.length);
    await assignSections(tx, repos, bookId, map.sections, map.parts);
    milestone('sectionsassigned', current.length);
    await moveReferences(
      tx,
      repos,
      bookId,
      old,
      await allBlocks(tx, bookId),
      part.page_from,
      part.page_to,
    );
    milestone('refs', current.length);
    const preserved = await repos.settings.get<Block[]>(
      `reparse.blocks.${bookId}`,
      [],
    );
    const remaining = preserved.filter(
      block =>
        block.page === null ||
        block.page < part.page_from ||
        block.page > part.page_to,
    );
    if (remaining.length)
      await repos.settings.set(`reparse.blocks.${bookId}`, remaining);
    else
      await tx.run('DELETE FROM setting WHERE key=?', [
        `reparse.blocks.${bookId}`,
      ]);
    await repos.settings.set(`book.pageNumbers.${bookId}`, numbers);
    await repos.settings.set(
      `book.pageOffsetReliable.${bookId}`,
      map.pageOffsetReliable,
    );
    const warnings = await repos.settings.get<Record<string, string>>(
      parseWarningsKey(bookId),
      {},
    );
    if (
      new Set(result.pagesWithContent).size /
        (part.page_to - part.page_from + 1) <
      0.8
    )
      warnings[String(part.part_no)] =
        '可能是扫描版，建议打开 OCR 重新解析这一片';
    else delete warnings[String(part.part_no)];
    await repos.settings.set(parseWarningsKey(bookId), warnings);
    await repos.parts.update(bookId, part.part_no, {
      stage: 'done',
      extracted_pages: part.page_to - part.page_from + 1,
      total_pages: part.page_to - part.page_from + 1,
      error_code: null,
      error_msg: null,
      next_poll_at: null,
    });
    const parts = await repos.parts.list(bookId);
    status = parts.every(p => p.stage === 'done') ? 'ready' : 'parsing';
    if (status === 'ready')
      await tx.run('DELETE FROM setting WHERE key=?', [
        `reparse.sections.${bookId}`,
      ]);
    await repos.books.update(bookId, {
      status,
      ready_to_page: contiguousReadyPage(parts),
      page_offset: map.pageOffset,
    });
    // A new block layout invalidates any plan prepared before those blocks changed.
    await tx.run(
      'DELETE FROM lesson_plan WHERE book_id=? AND section_id IN (SELECT id FROM section WHERE book_id=? AND page_from<=? AND page_to>=?)',
      [bookId, bookId, part.page_to, part.page_from],
    );
  });
  milestone('commit', blocks.length);
  c.events.emit('book.parse', { bookId, status });
}

export async function importEpubResult(
  c: Container,
  bookId: string,
): Promise<void> {
  const runtime = getImportRuntime(c);
  if (!runtime.epub) throw new Error('EPUB 解析暂时不可用，请稍后重试');
  const result = await runtime.epub.parse(
    sourcePath(runtime, bookId, 'epub'),
    bookDirectory(runtime, bookId),
    bookId,
  );
  await c.db.transaction(async tx => {
    const repos = createRepos(tx, () => c.clock.now().toISOString());
    if (!(await repos.books.get(bookId))) return;
    const old = await priorBlocks(tx, repos, bookId);
    const previous = await priorSections(repos, bookId);
    const manual = previous.filter(section => section.source === 'manual');
    const sections = result.sections.map(section => {
      const oldSection = previous.find(value => value.id === section.id);
      return oldSection?.source === 'manual'
        ? oldSection
        : {
            ...section,
            status: oldSection?.status ?? section.status,
            summary: oldSection?.summary ?? section.summary,
            guide: oldSection?.guide ?? section.guide,
          };
    });
    sections.push(
      ...manual.filter(
        section => !sections.some(value => value.id === section.id),
      ),
    );
    await repos.refinements.invalidate(bookId, c.clock.now().toISOString());
    await tx.run('DELETE FROM block WHERE book_id=?', [bookId]);
    await repos.blocks.insertMany(
      bookId,
      result.blocks.map(({ book_id: _bookId, ...block }) => block),
    );
    await assignSections(tx, repos, bookId, sections, result.parts);
    await moveReferences(
      tx,
      repos,
      bookId,
      old,
      await allBlocks(tx, bookId),
      null,
      null,
    );
    await tx.run('DELETE FROM setting WHERE key IN (?,?)', [
      `reparse.blocks.${bookId}`,
      `reparse.sections.${bookId}`,
    ]);
    await repos.books.update(bookId, { status: 'ready' });
    await repos.settings.set(`book.epubError.${bookId}`, null);
    if (result.warnings?.length)
      await repos.settings.set(`book.epubWarnings.${bookId}`, result.warnings);
  });
  c.events.emit('book.parse', { bookId, status: 'ready' });
}
