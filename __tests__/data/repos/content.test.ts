import type { BlockInsert, BookInsert, SectionInsert } from '@core/types';
import type { Db } from '@data/db';
import { openMemoryDb } from '@data/drivers/nodeSqlite';
import { migrate } from '@data/migrations';
import { createBooksRepo } from '@data/repos/books';
import { createPartsRepo } from '@data/repos/parts';
import { createBlocksRepo } from '@data/repos/blocks';
import { createSectionsRepo } from '@data/repos/sections';
import { lastInsertId, serializeJson } from '@data/repos/shared';

const at = '2026-10-29T08:00:00.000Z';
const later = '2026-10-30T08:00:00.000Z';
const bookInput = (
  id: string,
  patch: Partial<BookInsert> = {},
): BookInsert => ({
  id,
  sha256: `sha-${id}`,
  title: `示意书籍 ${id}`,
  format: 'pdf',
  size_bytes: 100,
  cover_color: '#2F5AA8',
  status: 'ready',
  created_at: at,
  ...patch,
});
const sectionInput = (
  id: string,
  ord: number,
  patch: Partial<SectionInsert> = {},
): Omit<SectionInsert, 'book_id'> => ({
  id,
  ord,
  title: `示意小节 ${id}`,
  level: 3,
  is_leaf: true,
  source: 'auto',
  ...patch,
});
const blockInput = (
  seq: number,
  text = `示意块 ${seq}`,
  patch: Partial<Omit<BlockInsert, 'book_id'>> = {},
): Omit<BlockInsert, 'book_id'> => ({
  seq,
  type: 'text',
  text,
  chars: Array.from(text).length,
  ...patch,
});

let db: Db;
let books: ReturnType<typeof createBooksRepo>;
let parts: ReturnType<typeof createPartsRepo>;
let blocks: ReturnType<typeof createBlocksRepo>;
let sections: ReturnType<typeof createSectionsRepo>;
beforeEach(async () => {
  db = openMemoryDb();
  await migrate(db);
  books = createBooksRepo(db, () => later);
  parts = createPartsRepo(db, () => later);
  blocks = createBlocksRepo(db);
  sections = createSectionsRepo(db);
  await books.insert(bookInput('book'));
  await books.insert(bookInput('other'));
});
afterEach(async () => db.close());

async function seedLearning(bookId = 'book') {
  await sections.replaceAll(bookId, [
    sectionInput('1.1', 1, { status: 'learning', summary: '已保存摘要' }),
  ]);
  await sections.setParts(bookId, '1.1', [
    { part_no: 0, block_from: 1001, block_to: 1002, name: '示意段' },
  ]);
  await blocks.insertMany(bookId, [
    blockInput(1001, '示意原文', { page: 1, section_id: '1.1' }),
  ]);
  await parts.upsert({
    book_id: bookId,
    part_no: 1,
    page_from: 1,
    page_to: 2,
    stage: 'done',
    updated_at: at,
  });
  await db.run(
    "INSERT INTO lesson_plan VALUES (?, '1.1', 0, ?, 'fallback', ?)",
    [bookId, serializeJson([]), at],
  );
  await db.run('INSERT INTO study_state(book_id) VALUES (?)', [bookId]);
  await db.run(
    "INSERT INTO detour(book_id,from_section,to_section,depth,started_at) VALUES (?,'1.1','1.2',1,?)",
    [bookId, at],
  );
  const detourId = await lastInsertId(db);
  await db.run(
    "INSERT INTO message(book_id,section_id,kind,content,detour_id,created_at) VALUES (?,'1.1','user','示意提问',?,?)",
    [bookId, detourId, at],
  );
  await db.run(
    "INSERT INTO qa(book_id,section_id,q,a,message_ids_json,created_at) VALUES (?,'1.1','示意问题','示意回答',?,?)",
    [bookId, serializeJson([]), at],
  );
  await db.run(
    "INSERT INTO stuck(book_id,section_id,text,source,created_at) VALUES (?,'1.1','示意卡点','user',?)",
    [bookId, at],
  );
  await db.run("INSERT INTO section_note VALUES (?,'1.1','自己的笔记',?)", [
    bookId,
    at,
  ]);
  await db.run(
    'INSERT INTO highlight(book_id,block_seq,created_at) VALUES (?,1001,?)',
    [bookId, at],
  );
  await db.run(
    "INSERT INTO pin(book_id,block_seq,section_id,question,answer_summary,message_ids_json,created_at) VALUES (?,1001,'1.1','示意问题','示意回答',?,?)",
    [bookId, serializeJson([]), at],
  );
  await db.run(
    "INSERT INTO card(book_id,section_id,front,back,due_on,origin,created_at) VALUES (?,'1.1','示意问题','示意答案','2026-10-29','manual',?)",
    [bookId, at],
  );
  const cardId = await lastInsertId(db);
  await db.run(
    "INSERT INTO review_log(card_id,rated,box_from,box_to,at) VALUES (?,'good',1,2,?)",
    [cardId, at],
  );
  await db.run(
    "INSERT INTO ai_usage(book_id,provider_id,model,purpose,input,cache_read,cache_write,output,cache_reported,at) VALUES (?,'demo','demo','teach',1,0,0,1,0,?)",
    [bookId, at],
  );
}

const associatedTables = [
  'book_part',
  'block',
  'section',
  'section_part',
  'lesson_plan',
  'study_state',
  'detour',
  'message',
  'qa',
  'stuck',
  'section_note',
  'highlight',
  'pin',
  'card',
  'ai_usage',
];

describe('books repository', () => {
  it('inserts domain defaults, maps nullable booleans/outline, and looks up by id/hash', async () => {
    expect(await books.get('book')).toMatchObject({
      id: 'book',
      author: '',
      pages: null,
      has_text_layer: null,
      has_outline: null,
      outline: null,
      ocr: false,
      page_offset: 0,
      priority_from: 1,
      ready_to_page: 0,
      tokens_total: 0,
      last_opened_at: null,
    });
    const outline = [{ title: '示意章', page: 1, level: 1 }];
    const inserted = await books.insert(
      bookInput('outlined', {
        has_text_layer: true,
        has_outline: false,
        ocr: true,
        outline,
      }),
    );
    expect(inserted).toMatchObject({
      has_text_layer: true,
      has_outline: false,
      ocr: true,
      outline,
    });
    expect(await books.bySha('sha-outlined')).toEqual(inserted);
    expect(await books.bySha('missing')).toBeUndefined();
    expect(await books.get('missing')).toBeUndefined();
    expect(
      await db.get(
        'SELECT has_text_layer,has_outline,ocr,outline_json FROM book WHERE id=?',
        ['outlined'],
      ),
    ).toEqual({
      has_text_layer: 1,
      has_outline: 0,
      ocr: 1,
      outline_json: serializeJson(outline),
    });
  });

  it('updates explicit fields, leaves undefined unchanged, and clears explicit nulls', async () => {
    await books.update('book', {
      author: '作者',
      outline: [{ title: '章', page: 2, level: 1 }],
      has_text_layer: false,
      has_outline: true,
    });
    const updated = await books.update('book', {
      title: '新标题',
      author: undefined,
      outline: null,
      has_text_layer: null,
      has_outline: null,
      ocr: false,
    });
    expect(updated).toMatchObject({
      title: '新标题',
      author: '作者',
      outline: null,
      has_text_layer: null,
      has_outline: null,
      ocr: false,
    });
    expect(await books.update('missing', { title: '无记录' })).toBeUndefined();
    await db.run('UPDATE book SET outline_json=? WHERE id=?', [
      '{broken',
      'book',
    ]);
    expect((await books.get('book'))?.outline).toBeNull();
    await db.run('UPDATE book SET outline_json=? WHERE id=?', [
      '[{"title":"旧章","page":1,"level":1}]',
      'book',
    ]);
    expect((await books.get('book'))?.outline).toEqual([
      { title: '旧章', page: 1, level: 1 },
    ]);
  });

  it('lists most recently opened books first and uses the injected clock', async () => {
    await books.insert(bookInput('newer', { created_at: later }));
    expect((await books.list())[0].id).toBe('newer');
    expect((await books.touchOpened('other'))?.last_opened_at).toBe(later);
    expect(
      (await books.list()).findIndex(book => book.id === 'other'),
    ).toBeLessThan((await books.list()).findIndex(book => book.id === 'book'));
    expect(await books.touchOpened('missing')).toBeUndefined();
    const liveClock = createBooksRepo(db);
    expect((await liveClock.touchOpened('book'))?.last_opened_at).toMatch(
      /^\d{4}-\d{2}-\d{2}T/,
    );
  });

  it('deletes all book-owned records, cascades review logs, and preserves another book', async () => {
    await seedLearning('book');
    await seedLearning('other');
    await db.run('INSERT INTO setting VALUES (?,?)', [
      'ui.skin',
      serializeJson('paper'),
    ]);
    await books.remove('book');
    expect(await books.get('book')).toBeUndefined();
    expect(await books.get('other')).toBeDefined();
    for (const table of associatedTables) {
      expect(
        await db.all(`SELECT * FROM ${table} WHERE book_id='book'`),
      ).toEqual([]);
      expect(
        await db.all(`SELECT * FROM ${table} WHERE book_id='other'`),
      ).toHaveLength(1);
    }
    expect(await db.all('SELECT * FROM review_log')).toHaveLength(1);
    expect(await db.all('SELECT * FROM setting')).toHaveLength(1);
    await books.remove('missing');
  });

  it('rolls back the entire removal if any dependent delete fails', async () => {
    await seedLearning();
    await db.run(
      "CREATE TRIGGER prevent_block_delete BEFORE DELETE ON block BEGIN SELECT RAISE(ABORT,'blocked'); END;",
    );
    await expect(books.remove('book')).rejects.toThrow('blocked');
    expect(await books.get('book')).toBeDefined();
    expect(
      await db.all("SELECT * FROM message WHERE book_id='book'"),
    ).toHaveLength(1);
    expect(
      await db.all("SELECT * FROM card WHERE book_id='book'"),
    ).toHaveLength(1);
    expect(await db.all('SELECT * FROM review_log')).toHaveLength(1);
  });
});

describe('parse parts repository', () => {
  it('upserts one composite key, preserves absent fields, and isolates books', async () => {
    const first = await parts.upsert({
      book_id: 'book',
      part_no: 1,
      page_from: 1,
      page_to: 2,
      stage: 'queued',
      updated_at: at,
      batch_id: 'batch',
      attempts: 1,
    });
    expect(first).toMatchObject({
      batch_id: 'batch',
      attempts: 1,
      file_path: null,
      error_code: null,
    });
    await parts.upsert({
      book_id: 'other',
      part_no: 1,
      page_from: 1,
      page_to: 2,
      stage: 'done',
      updated_at: at,
    });
    const next = await parts.upsert({
      book_id: 'book',
      part_no: 1,
      page_from: 1,
      page_to: 2,
      stage: 'waiting',
      updated_at: later,
    });
    expect(next).toMatchObject({
      stage: 'waiting',
      batch_id: 'batch',
      attempts: 1,
    });
    expect(await parts.list('book')).toEqual([next]);
    expect((await parts.get('other', 1))?.stage).toBe('done');
    expect(await parts.get('missing', 1)).toBeUndefined();
  });

  it('updates nullable values and timestamps; pending excludes only completed parts', async () => {
    for (const [partNo, stage] of [
      [2, 'failed'],
      [1, 'queued'],
      [3, 'done'],
    ] as const) {
      await parts.upsert({
        book_id: 'book',
        part_no: partNo,
        page_from: 1,
        page_to: 2,
        stage,
        updated_at: at,
        batch_id: 'retained',
      });
    }
    expect((await parts.list('book')).map(part => part.part_no)).toEqual([
      1, 2, 3,
    ]);
    expect((await parts.pending()).map(part => part.part_no)).toEqual([1, 2]);
    expect(
      await parts.update('book', 2, { error_code: 'E', error_msg: '示意错误' }),
    ).toMatchObject({
      updated_at: later,
      error_code: 'E',
      batch_id: 'retained',
    });
    expect(
      await parts.update('book', 2, {
        error_code: null,
        error_msg: null,
        batch_id: undefined,
        updated_at: at,
      }),
    ).toMatchObject({
      error_code: null,
      error_msg: null,
      batch_id: 'retained',
      updated_at: at,
    });
    expect(await parts.update('missing', 1, { stage: 'done' })).toBeUndefined();
  });
});

describe('content blocks repository', () => {
  it('preserves immutable sequence IDs and supports all scoped read methods', async () => {
    await blocks.insertMany('book', [
      blockInput(2001, '后到页', { page: 2, section_id: '1.2' }),
      blockInput(1001, '先读页', {
        id: 50,
        page: 1,
        section_id: '1.1',
        x0: 0,
        y0: 0.1,
        x1: 1,
        y1: 0.5,
      }),
      blockInput(1002, '', {
        page: 1,
        section_id: '1.1',
        type: 'equation',
        latex: 'f(n)',
        html: '<table/>',
        image_path: 'image.png',
        level: 2,
        loc: '示意位置',
      }),
    ]);
    await blocks.insertMany('other', [blockInput(1001, '另一本')]);
    expect(
      (await blocks.range('book', 1001, 2001)).map(block => block.seq),
    ).toEqual([1001, 1002, 2001]);
    expect((await blocks.byPage('book', 1)).map(block => block.seq)).toEqual([
      1001, 1002,
    ]);
    expect(
      (await blocks.bySection('book', '1.2')).map(block => block.seq),
    ).toEqual([2001]);
    expect(await blocks.get('book', 1001)).toMatchObject({
      id: 50,
      seq: 1001,
      x0: 0,
      y0: 0.1,
      x1: 1,
      y1: 0.5,
    });
    expect(await blocks.get('book', 1002)).toMatchObject({
      latex: 'f(n)',
      html: '<table/>',
      image_path: 'image.png',
      level: 2,
      loc: '示意位置',
    });
    expect(await blocks.get('missing', 1001)).toBeUndefined();
    await expect(
      blocks.insertMany('book', [blockInput(1001, '不能重编号')]),
    ).rejects.toThrow();
    expect((await blocks.get('book', 1001))?.text).toBe('先读页');
  });

  it('inserts beyond one 1000-row batch atomically and rolls back a later-batch failure', async () => {
    await blocks.insertMany(
      'book',
      Array.from({ length: 1001 }, (_, i) => blockInput(i + 1)),
    );
    expect(await blocks.range('book', 1, 2000)).toHaveLength(1001);
    await blocks.insertMany('other', [blockInput(9999)]);
    const rows = Array.from({ length: 1001 }, (_, i) => blockInput(i + 1));
    rows.push(blockInput(1));
    await expect(blocks.insertMany('other', rows)).rejects.toThrow();
    expect(
      (await blocks.range('other', 1, 10000)).map(block => block.seq),
    ).toEqual([9999]);
    await blocks.insertMany('book', []);
  });

  it('uses trigram FTS for literal three-plus-character phrases and limits to one book', async () => {
    await blocks.insertMany('book', [
      blockInput(1001, `${'甲'.repeat(20)}一致代价${'乙'.repeat(35)}`, {
        page: 1,
        section_id: '1.1',
      }),
      blockInput(1002, '原"文的示意'),
      blockInput(1003, '图注', {
        latex: 'heuristic_formula',
        type: 'equation',
      }),
      blockInput(1004, 'café 教程'),
    ]);
    await blocks.insertMany('other', [blockInput(1001, '一致代价')]);
    const matches = await blocks.search('book', '一致代价');
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      book_id: 'book',
      seq: 1001,
      ref: 'b1001',
      page: 1,
      section_id: '1.1',
    });
    expect(matches[0].snippet).toBe(
      `…${'甲'.repeat(18)}一致代价${'乙'.repeat(30)}…`,
    );
    expect(
      (await blocks.search('book', '原"文')).map(match => match.seq),
    ).toEqual([1002]);
    expect((await blocks.search('book', 'formula'))[0].snippet).toContain(
      'heuristic_formula',
    );
    expect(await blocks.search('book', 'cafe')).toEqual([]);
    expect((await blocks.search('book', 'CAFÉ'))[0].snippet).toBe('café 教程');
    expect(await blocks.search('book', 'foo OR bar')).toEqual([]);
    expect(await blocks.search('book', '一致代价', 0)).toEqual([]);
    expect(await blocks.search('book', '一致代价', -1)).toEqual([]);
    expect(await blocks.search('book', '  ')).toEqual([]);
  });

  it('uses literal LIKE for one/two characters, escapes wildcard syntax, and strips query whitespace', async () => {
    await blocks.insertMany('book', [
      blockInput(1001, '启发与100%'),
      blockInput(1002, '启发_算法'),
      blockInput(1003, '路径\\文件'),
      blockInput(1004, '普通文本'),
    ]);
    expect(
      (await blocks.search('book', '启 发')).map(match => match.seq),
    ).toEqual([1001, 1002]);
    expect((await blocks.search('book', '%')).map(match => match.seq)).toEqual([
      1001,
    ]);
    expect((await blocks.search('book', '_')).map(match => match.seq)).toEqual([
      1002,
    ]);
    expect((await blocks.search('book', '\\')).map(match => match.seq)).toEqual(
      [1003],
    );
    expect(await blocks.search('book', '启发', 1)).toHaveLength(1);
  });

  it('deletes only selected pages and updates the FTS index', async () => {
    await blocks.insertMany('book', [
      blockInput(1001, '删除目标', { page: 1 }),
      blockInput(2001, '保留目标', { page: 2 }),
      blockInput(3001, '无页目标'),
    ]);
    await blocks.insertMany('other', [
      blockInput(1001, '删除目标', { page: 1 }),
    ]);
    await blocks.deleteByPages('book', 1, 1);
    expect(await blocks.byPage('book', 1)).toEqual([]);
    expect(await blocks.search('book', '删除目标')).toEqual([]);
    expect(await blocks.byPage('other', 1)).toHaveLength(1);
    expect(await blocks.range('book', 1, 4000)).toHaveLength(2);
  });

  it('clears parsed caches while retaining every learning record and another book', async () => {
    await seedLearning();
    await seedLearning('other');
    await blocks.clearParsed('book');
    for (const table of associatedTables) {
      const rows = await db.all(`SELECT * FROM ${table} WHERE book_id='book'`);
      expect(rows).toHaveLength(
        ['block', 'section_part', 'lesson_plan'].includes(table) ? 0 : 1,
      );
      expect(
        await db.all(`SELECT * FROM ${table} WHERE book_id='other'`),
      ).toHaveLength(1);
    }
    expect((await sections.get('book', '1.1'))?.summary).toBe('已保存摘要');
    expect(await db.all('SELECT * FROM review_log')).toHaveLength(2);
  });
});

describe('sections repository', () => {
  it('reads an ordered flat tree, leaf successors, booleans, and JSON flag details', async () => {
    await sections.replaceAll('book', [
      sectionInput('1.2', 3, {
        parent_id: 'ch1',
        flag: 'level',
        flag_detail: { old_level: 2 },
      }),
      sectionInput('ch1', 1, { level: 1, is_leaf: false }),
      sectionInput('1.1', 2, { parent_id: 'ch1' }),
    ]);
    await sections.replaceAll('other', [sectionInput('x', 1)]);
    expect((await sections.tree('book')).map(section => section.id)).toEqual([
      'ch1',
      '1.1',
      '1.2',
    ]);
    expect((await sections.leaves('book')).map(section => section.id)).toEqual([
      '1.1',
      '1.2',
    ]);
    expect(await sections.get('book', '1.2')).toMatchObject({
      is_leaf: true,
      flag_detail: { old_level: 2 },
      chars: 0,
      parts: 1,
      status: 'new',
    });
    expect((await sections.get('book', 'ch1'))?.is_leaf).toBe(false);
    expect((await sections.nextLeaf('book', 'ch1'))?.id).toBe('1.1');
    expect((await sections.nextLeaf('book', '1.1'))?.id).toBe('1.2');
    expect(await sections.nextLeaf('book', '1.2')).toBeUndefined();
    expect(await sections.nextLeaf('book', 'missing')).toBeUndefined();
    expect(
      await sections.update('book', '1.2', { flag: null, flag_detail: null }),
    ).toMatchObject({ flag: null, flag_detail: null });
    expect(
      await sections.update('missing', '1.2', { title: '不存在' }),
    ).toBeUndefined();
    await db.run(
      'UPDATE section SET flag_detail_json=? WHERE book_id=? AND id=?',
      ['{broken', 'book', '1.1'],
    );
    expect((await sections.get('book', '1.1'))?.flag_detail).toBeNull();
  });

  it('replaces parsed nodes without overwriting manual nodes, progress, notes, or existing parts', async () => {
    await sections.replaceAll('book', [
      sectionInput('manual', 1, {
        source: 'manual',
        title: '人工标题',
        status: 'done',
        summary: '人工摘要',
        guide: '人工导读',
        flag_detail: { fixed: true },
      }),
      sectionInput('auto', 2, {
        status: 'learning',
        summary: '已学摘要',
        guide: '已生成导读',
      }),
      sectionInput('removed', 3),
    ]);
    await sections.setParts('book', 'manual', [
      { part_no: 0, block_from: 1001, block_to: 1002, name: '人工段' },
    ]);
    await sections.setParts('book', 'auto', [
      { part_no: 0, block_from: 2001, block_to: 2002, name: '原段' },
    ]);
    await sections.setParts('book', 'removed', [
      { part_no: 0, block_from: 3001, block_to: 3002, name: '旧段' },
    ]);
    await sections.replaceAll('book', [
      sectionInput('manual', 1, { title: '模型覆盖' }),
      sectionInput('auto', 2, {
        title: '新解析标题',
        summary: '不能覆盖',
        guide: '不能覆盖',
      }),
      sectionInput('new', 4),
    ]);
    expect(await sections.get('book', 'manual')).toMatchObject({
      title: '人工标题',
      status: 'done',
      summary: '人工摘要',
      guide: '人工导读',
      source: 'manual',
      flag_detail: { fixed: true },
    });
    expect(await sections.get('book', 'auto')).toMatchObject({
      title: '新解析标题',
      status: 'learning',
      summary: '已学摘要',
      guide: '已生成导读',
    });
    expect(await sections.parts('book', 'manual')).toHaveLength(1);
    expect(await sections.parts('book', 'auto')).toHaveLength(1);
    expect(await sections.get('book', 'removed')).toBeUndefined();
    expect(await sections.parts('book', 'removed')).toEqual([]);
    await sections.replaceAll('book', []);
    expect((await sections.tree('book')).map(section => section.id)).toEqual([
      'manual',
    ]);
  });

  it('fills previously absent generated summaries and rolls back a failed replacement', async () => {
    await sections.replaceAll('book', [sectionInput('old', 1)]);
    await sections.replaceAll('book', [
      sectionInput('old', 1, { summary: '新摘要', guide: '新导读' }),
    ]);
    expect(await sections.get('book', 'old')).toMatchObject({
      summary: '新摘要',
      guide: '新导读',
    });
    await expect(
      sections.replaceAll('book', [
        sectionInput('dup', 2),
        sectionInput('dup', 3),
      ]),
    ).rejects.toThrow();
    expect((await sections.tree('book')).map(section => section.id)).toEqual([
      'old',
    ]);
  });

  it('stores replacement parts atomically, sorts them, and retains old parts after invalid input', async () => {
    await sections.replaceAll('book', [sectionInput('1.1', 1)]);
    const original = [
      { part_no: 1, block_from: 2001, block_to: 2002, name: '后段' },
      { part_no: 0, block_from: 1001, block_to: 1002, name: '前段' },
    ];
    expect(
      (await sections.setParts('book', '1.1', original)).map(
        part => part.part_no,
      ),
    ).toEqual([0, 1]);
    expect((await sections.get('book', '1.1'))?.parts).toBe(2);
    await expect(
      sections.setParts('book', '1.1', [original[0], original[0]]),
    ).rejects.toThrow();
    expect(await sections.parts('book', '1.1')).toHaveLength(2);
    expect(await sections.setParts('book', '1.1', [])).toEqual([]);
    expect((await sections.get('book', '1.1'))?.parts).toBe(1);
    await expect(
      sections.setParts('book', 'missing', [original[0]]),
    ).rejects.toThrow();
  });

  it('covers leaf ranges using the actual stable block order across page gaps', async () => {
    await blocks.insertMany(
      'book',
      [1001, 1002, 2001, 2002].map(seq => blockInput(seq)),
    );
    await sections.replaceAll('book', [
      sectionInput('1.1', 1, { block_from: 1001, block_to: 1002 }),
      sectionInput('1.2', 2, { block_from: 2001, block_to: 2002 }),
    ]);
    const leaves = await sections.leaves('book');
    const ranges = await Promise.all(
      leaves.map(section =>
        blocks.range('book', section.block_from!, section.block_to!),
      ),
    );
    const references = ranges.flat().map(block => block.seq);
    expect(references).toEqual([1001, 1002, 2001, 2002]);
    expect(new Set(references).size).toBe(references.length);
  });
});
