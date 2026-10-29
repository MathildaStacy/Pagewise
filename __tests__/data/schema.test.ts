import fs from 'node:fs';
import path from 'node:path';
import type { Db } from '@data/db';
import { openMemoryDb } from '@data/drivers/nodeSqlite';
import { m0001 } from '@data/migrations/0001_init';
import { migrate } from '@data/migrations';
import {
  insertRow,
  lastInsertId,
  parseJson,
  serializeJson,
  updateRow,
} from '@data/repos/shared';

const at = '2026-10-29T08:00:00.000Z';
const normalizeSql = (sql: string) =>
  sql
    .replace(/--[^\n]*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

async function insertBook(db: Db, id = 'book') {
  await db.run(
    `INSERT INTO book(id,sha256,title,format,size_bytes,cover_color,status,created_at)
     VALUES (?, ?, '示意书籍', 'pdf', 12, '#112233', 'ready', ?)`,
    [id, `sha-${id}`, at],
  );
}

describe('0001 schema fidelity and constraints', () => {
  let db: Db;
  beforeEach(async () => {
    db = openMemoryDb();
    await migrate(db, [m0001]);
  });
  afterEach(async () => db.close());

  it('contains the complete specification SQL with whole trigger statements', () => {
    const doc = fs.readFileSync(
      path.join(__dirname, '../../docs/dev/04-data.md'),
      'utf8',
    );
    const sql = /```sql\n([\s\S]*?)\n```/.exec(doc)![1];
    expect(normalizeSql(m0001.join('\n\n'))).toBe(normalizeSql(sql));
    expect(m0001).toHaveLength(28);
    const triggers = m0001.filter(statement =>
      statement.startsWith('CREATE TRIGGER'),
    );
    expect(triggers).toHaveLength(2);
    for (const trigger of triggers) {
      expect(trigger.trim().endsWith('END;')).toBe(true);
      expect(trigger.match(/;/g)).toHaveLength(2);
    }
  });

  it('creates every declared table and index and applies book defaults', async () => {
    const tables = (
      await db.all<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table'",
      )
    ).map(row => row.name);
    for (const name of [
      'book',
      'book_part',
      'block',
      'block_fts',
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
      'review_log',
      'ai_usage',
      'setting',
      'math_cache',
      'import_draft',
    ]) {
      expect(tables).toContain(name);
    }
    const indexes = (
      await db.all<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='index'",
      )
    ).map(row => row.name);
    expect(indexes).toEqual(
      expect.arrayContaining([
        'block_page',
        'block_section',
        'section_ord',
        'message_thread',
        'card_due',
      ]),
    );
    await insertBook(db);
    expect(
      await db.get(
        'SELECT author,has_text_layer,has_outline,outline_json,page_offset,ocr,priority_from,ready_to_page,tokens_total,last_opened_at FROM book',
      ),
    ).toEqual({
      author: '',
      has_text_layer: null,
      has_outline: null,
      outline_json: null,
      page_offset: 0,
      ocr: 0,
      priority_from: 1,
      ready_to_page: 0,
      tokens_total: 0,
      last_opened_at: null,
    });
  });

  it('enforces book hash uniqueness, supported formats, and required values', async () => {
    await insertBook(db);
    await expect(
      db.run('UPDATE book SET format = ?', ['txt']),
    ).rejects.toThrow();
    await expect(
      db.run('UPDATE book SET status = ?', ['done']),
    ).rejects.toThrow();
    await expect(
      db.run('UPDATE book SET parse_model = ?', ['other']),
    ).rejects.toThrow();
    await expect(db.run('UPDATE book SET title = NULL')).rejects.toThrow();
    await expect(
      db.run(
        "INSERT INTO book(id,sha256,title,format,size_bytes,cover_color,status,created_at) VALUES ('other','sha-book','重复','pdf',1,'#000','ready',?)",
        [at],
      ),
    ).rejects.toThrow();
  });

  it('keeps block references stable regardless of arrival order and scoped to a book', async () => {
    await insertBook(db);
    await insertBook(db, 'other');
    for (const [book, seq] of [
      ['book', 2001],
      ['book', 1001],
      ['other', 1001],
    ] as const) {
      await db.run(
        "INSERT INTO block(book_id,seq,type,chars) VALUES (?,?,'text',0)",
        [book, seq],
      );
    }
    expect(
      await db.all("SELECT seq FROM block WHERE book_id='book' ORDER BY seq"),
    ).toEqual([{ seq: 1001 }, { seq: 2001 }]);
    await expect(
      db.run(
        "INSERT INTO block(book_id,seq,type,chars) VALUES ('book',1001,'text',0)",
      ),
    ).rejects.toThrow();
    await expect(
      db.run(
        "INSERT INTO block(book_id,seq,type,chars) VALUES ('book',3001,'unknown',0)",
      ),
    ).rejects.toThrow();
  });

  it('maintains trigram text and formula indexes on block insertion and deletion', async () => {
    await insertBook(db);
    await db.run(
      "INSERT INTO block(book_id,seq,type,text,latex,chars) VALUES ('book',1001,'equation','一致代价搜索','heuristic_formula',6)",
    );
    expect(
      await db.all('SELECT rowid FROM block_fts WHERE block_fts MATCH ?', [
        '"一致代价"',
      ]),
    ).toHaveLength(1);
    expect(
      await db.all('SELECT rowid FROM block_fts WHERE block_fts MATCH ?', [
        '"formula"',
      ]),
    ).toHaveLength(1);
    await db.run("DELETE FROM block WHERE book_id='book'");
    expect(
      await db.all('SELECT rowid FROM block_fts WHERE block_fts MATCH ?', [
        '"formula"',
      ]),
    ).toEqual([]);
  });

  it('enforces section identity and cascades dependent parsing/study records', async () => {
    await insertBook(db);
    await db.run(
      "INSERT INTO section(book_id,id,level,ord,title,is_leaf,source) VALUES ('book','1.1',3,1,'示意小节',1,'auto')",
    );
    await expect(
      db.run(
        "INSERT INTO section(book_id,id,level,ord,title,is_leaf,source) VALUES ('book','1.1',3,2,'重复',1,'auto')",
      ),
    ).rejects.toThrow();
    await expect(db.run('UPDATE section SET level=4')).rejects.toThrow();
    await db.run(
      "INSERT INTO section_part VALUES ('book','1.1',0,1001,1002,'示意段')",
    );
    await expect(
      db.run(
        "INSERT INTO section_part VALUES ('book','missing',0,1001,1002,'缺失')",
      ),
    ).rejects.toThrow();
    await db.run(
      "INSERT INTO book_part(book_id,part_no,page_from,page_to,stage,updated_at) VALUES ('book',1,1,2,'queued',?)",
      [at],
    );
    await expect(
      db.run("UPDATE book_part SET stage='paused'"),
    ).rejects.toThrow();
    await db.run("INSERT INTO study_state(book_id) VALUES ('book')");
    expect(
      await db.get(
        'SELECT phase,mode,reader_view,main_part,main_step,detours_json FROM study_state',
      ),
    ).toEqual({
      phase: 'idle',
      mode: 'listen',
      reader_view: 'orig',
      main_part: 0,
      main_step: 0,
      detours_json: '[]',
    });
    await db.run("DELETE FROM book WHERE id='book'");
    for (const table of [
      'book_part',
      'section',
      'section_part',
      'study_state',
    ]) {
      expect(await db.all(`SELECT * FROM ${table}`)).toEqual([]);
    }
  });

  it('constrains review ratings and cascades card review history', async () => {
    await db.run(
      "INSERT INTO card(book_id,section_id,front,back,due_on,origin,created_at) VALUES ('book','1.1','示意问题','示意答案','2026-10-29','manual',?)",
      [at],
    );
    const id = await lastInsertId(db);
    expect(await db.get('SELECT box FROM card WHERE id=?', [id])).toEqual({
      box: 1,
    });
    await expect(
      db.run('UPDATE card SET box=6 WHERE id=?', [id]),
    ).rejects.toThrow();
    await db.run(
      "INSERT INTO review_log(card_id,rated,box_from,box_to,at) VALUES (?,'good',1,2,?)",
      [id, at],
    );
    await expect(db.run("UPDATE review_log SET rated='bad'")).rejects.toThrow();
    await db.run('DELETE FROM card WHERE id=?', [id]);
    expect(await db.all('SELECT * FROM review_log')).toEqual([]);
  });
});

describe('repository JSON boundary', () => {
  it('writes version 1 payloads and reads both versioned and legacy rows', () => {
    const value = [{ no: 1, title: '示意步骤' }];
    const serialized = serializeJson(value);
    expect(JSON.parse(serialized)).toEqual({ version: 1, data: value });
    expect(parseJson(serialized, [])).toEqual(value);
    expect(parseJson(JSON.stringify(value), [])).toEqual(value);
    expect(parseJson(serializeJson(null), 'fallback')).toBeNull();
  });

  it.each([
    undefined,
    null,
    '{broken',
    '{"version":2,"data":[1]}',
    '{"version":1}',
  ])('falls back for absent, corrupt, or unsupported JSON %s', value => {
    expect(parseJson(value, [])).toEqual([]);
  });

  it('rejects undefined writes instead of silently dropping a requested value', () => {
    expect(() => serializeJson(undefined)).toThrow('不能序列化 undefined');
  });
});

describe('safe repository SQL helpers', () => {
  let db: Db;
  const columns = ['id', 'label', 'optional'];
  beforeEach(async () => {
    db = openMemoryDb();
    await db.run(
      "CREATE TABLE helper(id INTEGER PRIMARY KEY, label TEXT DEFAULT 'default', optional TEXT)",
    );
  });
  afterEach(async () => db.close());

  it('binds text, keeps defaults for undefined fields, and returns inserted IDs', async () => {
    const id = await insertRow(db, 'helper', columns, {
      label: "quote ' ; --",
      optional: undefined,
    });
    expect(await db.get('SELECT * FROM helper WHERE id=?', [id])).toEqual({
      id,
      label: "quote ' ; --",
      optional: null,
    });
    const defaultId = await insertRow(db, 'helper', columns, {});
    expect(
      await db.get('SELECT label FROM helper WHERE id=?', [defaultId]),
    ).toEqual({ label: 'default' });
    expect(await lastInsertId(db)).toBe(defaultId);
  });

  it('keeps concurrent insert IDs attached to the correct payload', async () => {
    const [first, second] = await Promise.all([
      insertRow(db, 'helper', columns, { label: 'first' }),
      insertRow(db, 'helper', columns, { label: 'second' }),
    ]);
    expect(
      await db.get('SELECT label FROM helper WHERE id=?', [first]),
    ).toEqual({ label: 'first' });
    expect(
      await db.get('SELECT label FROM helper WHERE id=?', [second]),
    ).toEqual({ label: 'second' });
  });

  it('updates only explicit values and supports a NULL predicate', async () => {
    const id = await insertRow(db, 'helper', columns, { label: 'before' });
    expect(
      await updateRow(db, 'helper', columns, { label: undefined }, { id }),
    ).toEqual({ changes: 0 });
    expect(
      await updateRow(
        db,
        'helper',
        columns,
        { label: 'after', optional: null },
        { id, optional: null },
      ),
    ).toEqual({ changes: 1 });
    expect(
      await db.get('SELECT label,optional FROM helper WHERE id=?', [id]),
    ).toEqual({ label: 'after', optional: null });
  });

  it('rejects unknown columns, invalid identifiers, and missing update predicates', async () => {
    await expect(
      insertRow(db, 'helper', columns, { injected: 'x' }),
    ).rejects.toThrow('未知数据列');
    await expect(
      insertRow(db, 'helper; DROP TABLE helper', columns, {}),
    ).rejects.toThrow('非法 SQL 标识符');
    await expect(
      insertRow(db, 'helper', ['bad-column'], { 'bad-column': 1 }),
    ).rejects.toThrow('非法 SQL 标识符');
    await expect(
      updateRow(db, 'helper', columns, { label: 'x' }, {}),
    ).rejects.toThrow('更新必须指定记录条件');
    await expect(
      updateRow(db, 'helper', columns, { label: 'x' }, { missing: 1 }),
    ).rejects.toThrow('未知数据列');
    expect(
      await db.get(
        "SELECT count(*) AS n FROM sqlite_master WHERE name='helper'",
      ),
    ).toEqual({ n: 1 });
  });

  it('reports a missing last_insert_rowid result', async () => {
    const spy = jest.spyOn(db, 'get').mockResolvedValueOnce(undefined);
    await expect(lastInsertId(db)).rejects.toThrow('没有可读取的新增记录 ID');
    spy.mockRestore();
  });
});
