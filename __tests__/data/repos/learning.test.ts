import type {
  CardBox,
  CardInsert,
  CardRating,
  LessonPlanInsert,
  MessageInsert,
} from '@core/types';
import type { Db } from '@data/db';
import { openMemoryDb } from '@data/drivers/nodeSqlite';
import { migrate } from '@data/migrations';
import { serializeJson } from '@data/repos/shared';
import { createNotesRepo } from '@data/repos/notes';
import { createMessagesRepo } from '@data/repos/messages';
import { createDetoursRepo } from '@data/repos/detours';
import { createCardsRepo } from '@data/repos/cards';
import { createPlansRepo } from '@data/repos/plans';
import { createStudyRepo } from '@data/repos/study';

const NOW = '2026-10-29T08:00:00.000Z';
const TODAY = '2026-10-29';
let db: Db;
let instant: string;
let notes: ReturnType<typeof createNotesRepo>;
let messages: ReturnType<typeof createMessagesRepo>;
let detours: ReturnType<typeof createDetoursRepo>;
let cards: ReturnType<typeof createCardsRepo>;
let plans: ReturnType<typeof createPlansRepo>;
let study: ReturnType<typeof createStudyRepo>;
const message = (patch: Partial<MessageInsert> = {}): MessageInsert => ({
  book_id: 'a',
  section_id: '3.5.2',
  kind: 'assistant',
  content: '示意讲解',
  created_at: NOW,
  ...patch,
});
const card = (patch: Partial<CardInsert> = {}): CardInsert => ({
  book_id: 'a',
  section_id: '3.5.2',
  front: '示意问题',
  back: '示意答案',
  due_on: TODAY,
  origin: 'section_end',
  created_at: NOW,
  ...patch,
});
const plan = (patch: Partial<LessonPlanInsert> = {}): LessonPlanInsert => ({
  book_id: 'a',
  section_id: '3.5.2',
  part_no: 0,
  source: 'model',
  created_at: NOW,
  steps: [
    {
      no: 1,
      title: '直觉',
      kind: 'intuition',
      block_from: 103001,
      block_to: 103003,
      status: 'current',
    },
    {
      no: 2,
      title: '定义',
      kind: 'definition',
      block_from: 103004,
      block_to: 103006,
      status: 'todo',
    },
  ],
  ...patch,
});

beforeEach(async () => {
  db = openMemoryDb();
  instant = NOW;
  await migrate(db);
  for (const id of ['a', 'b'])
    await db.run(
      'INSERT INTO book (id,sha256,title,format,size_bytes,cover_color,status,created_at) VALUES (?,?,?,?,?,?,?,?)',
      [id, `sha-${id}`, `示意书籍${id}`, 'pdf', 100, '#2F5AA8', 'ready', NOW],
    );
  notes = createNotesRepo(db, () => instant);
  messages = createMessagesRepo(db);
  detours = createDetoursRepo(db, () => instant);
  cards = createCardsRepo(db, () => instant);
  plans = createPlansRepo(db);
  study = createStudyRepo(db);
});
afterEach(async () => db.close());

describe('messages', () => {
  it('append 返回SQLite默认值和null，JSON使用v1封套且解码后保持原字节字段', async () => {
    const raw = { protocol: 'anthropic', items: [{ text: '原样  空格' }] };
    const row = await messages.append(
      message({
        parts: [{ t: 'text', text: '示意内容' }],
        raw,
        allowed_refs: [103001, 103003],
        usage: { input: 10, cacheRead: 2, output: 3 },
        unverified: 2,
      }),
    );
    expect(row).toMatchObject({
      book_id: 'a',
      part_no: null,
      step_no: null,
      intent: null,
      detour_id: null,
      quote_seq: null,
      in_context: true,
      unverified: 2,
      raw,
      allowed_refs: [103001, 103003],
    });
    expect(row.parts).toEqual([{ t: 'text', text: '示意内容' }]);
    expect(row.usage).toEqual({ input: 10, cacheRead: 2, output: 3 });
    const stored = await db.get<{ parts_json: string; raw_json: string }>(
      'SELECT parts_json, raw_json FROM message WHERE id = ?',
      [row.id],
    );
    expect(JSON.parse(stored!.parts_json)).toEqual({
      version: 1,
      data: [{ t: 'text', text: '示意内容' }],
    });
    expect(JSON.parse(stored!.raw_json)).toEqual({ version: 1, data: raw });
    const explicit = await messages.append(
      message({ id: 100, in_context: false }),
    );
    expect(explicit.id).toBe(100);
    expect(explicit.in_context).toBe(false);
    expect(explicit.parts).toBeNull();
  });
  it('thread 默认取最新200条，结果升序；before/after/limit稳定分页', async () => {
    await db.transaction(async tx => {
      const repo = createMessagesRepo(tx);
      for (let index = 1; index <= 205; index++)
        await repo.append(message({ id: index, content: `第${index}条示意` }));
    });
    expect((await messages.thread('a', '3.5.2')).map(row => row.id)).toEqual(
      Array.from({ length: 200 }, (_, index) => index + 6),
    );
    expect(
      (await messages.thread('a', '3.5.2', { limit: 3 })).map(row => row.id),
    ).toEqual([203, 204, 205]);
    expect(
      (await messages.thread('a', '3.5.2', { before_id: 100, limit: 3 })).map(
        row => row.id,
      ),
    ).toEqual([97, 98, 99]);
    expect(
      (await messages.thread('a', '3.5.2', { after_id: 100, limit: 3 })).map(
        row => row.id,
      ),
    ).toEqual([101, 102, 103]);
    expect(await messages.thread('a', '3.5.2', { limit: 0 })).toEqual([]);
  });
  it('thread 的book/section、in_context、岔路null和part_no过滤可组合', async () => {
    const detour = await detours.start({
      book_id: 'a',
      from_section: '3.5.2',
      to_section: '3.4.2',
      depth: 1,
      started_at: NOW,
    });
    const main = await messages.append(
      message({ part_no: 0, in_context: true }),
    );
    const branch = await messages.append(
      message({ part_no: 1, detour_id: detour.id, in_context: false }),
    );
    await messages.append(message({ book_id: 'b' }));
    await messages.append(message({ section_id: 'other' }));
    expect(
      (await messages.thread('a', '3.5.2', { detour_id: null })).map(
        row => row.id,
      ),
    ).toEqual([main.id]);
    expect(
      (
        await messages.thread('a', '3.5.2', {
          detour_id: detour.id,
          in_context: false,
          part_no: 1,
        })
      ).map(row => row.id),
    ).toEqual([branch.id]);
    expect(
      (
        await messages.thread('a', '3.5.2', { in_context: true, part_no: 0 })
      ).map(row => row.id),
    ).toEqual([main.id]);
    expect(await messages.thread('a', '3.5.2', { part_no: null })).toEqual([]);
  });
  it('update 支持JSON、nullable、false和空patch，缺失ID返回undefined', async () => {
    const row = await messages.append(
      message({
        parts: [{ t: 'text', text: '旧内容' }],
        raw: { a: 1 },
        allowed_refs: [1],
        usage: { input: 1 },
      }),
    );
    const changed = await messages.update(row.id, {
      content: '新示意',
      kind: 'user',
      part_no: 2,
      step_no: 3,
      intent: 'ask',
      unverified: 4,
      quote_seq: 103005,
      in_context: false,
      parts: [{ t: 'text', text: '新内容' }],
      raw: { b: 2 },
      allowed_refs: [103005],
      usage: { input: 8 },
      created_at: '2026-10-30T00:00:00.000Z',
    });
    expect(changed).toMatchObject({
      content: '新示意',
      kind: 'user',
      part_no: 2,
      step_no: 3,
      intent: 'ask',
      unverified: 4,
      quote_seq: 103005,
      in_context: false,
      parts: [{ t: 'text', text: '新内容' }],
      raw: { b: 2 },
      allowed_refs: [103005],
      usage: { input: 8 },
    });
    const cleared = await messages.update(row.id, {
      parts: null,
      raw: null,
      allowed_refs: null,
      usage: null,
      intent: null,
      part_no: null,
      step_no: null,
      quote_seq: null,
    });
    expect(cleared).toMatchObject({
      parts: null,
      raw: null,
      allowed_refs: null,
      usage: null,
      intent: null,
      part_no: null,
      step_no: null,
      quote_seq: null,
    });
    expect(await messages.update(row.id, {})).toEqual(cleared);
    expect(await messages.update(999, {})).toBeUndefined();
  });
  it('markOutOfContext 空集不改变消息，大集合分批并保留原文与引用', async () => {
    const row = await messages.append(message({ allowed_refs: [103001] }));
    await messages.markOutOfContext([]);
    expect((await messages.thread('a', '3.5.2'))[0].in_context).toBe(true);
    await messages.markOutOfContext([
      row.id,
      ...Array.from({ length: 1000 }, (_, index) => index + 1000),
    ]);
    expect((await messages.thread('a', '3.5.2'))[0]).toMatchObject({
      in_context: false,
      content: '示意讲解',
      allowed_refs: [103001],
    });
  });
  it('读取旧JSON，损坏或未知版本退回null，不把SQLNULL变成空对象', async () => {
    const row = await messages.append(message());
    await db.run(
      'UPDATE message SET parts_json = ?, raw_json = ?, allowed_refs_json = ?, usage_json = ? WHERE id = ?',
      [
        '[{"t":"text","text":"旧格式"}]',
        'broken',
        '{"version":9,"data":[1]}',
        '{"input":9}',
        row.id,
      ],
    );
    expect((await messages.thread('a', '3.5.2'))[0]).toMatchObject({
      parts: [{ t: 'text', text: '旧格式' }],
      raw: null,
      allowed_refs: null,
      usage: { input: 9 },
    });
  });
});

describe('detours', () => {
  it('start/get/end 重读完整记录并使用注入时钟；缺失ID不创建记录', async () => {
    expect(await detours.get(999)).toBeUndefined();
    const row = await detours.start({
      book_id: 'a',
      from_section: '3.5.2',
      to_section: '3.4.2',
      depth: 1,
      started_at: NOW,
    });
    expect(row).toMatchObject({ title: null, stuck_id: null, ended_at: null });
    expect(await detours.get(row.id)).toEqual(row);
    instant = '2026-10-30T01:02:03.000Z';
    expect(await detours.end(row.id, '两个算法的关系')).toMatchObject({
      title: '两个算法的关系',
      ended_at: instant,
    });
    expect(await detours.end(row.id, '改名', NOW)).toMatchObject({
      title: '改名',
      ended_at: NOW,
    });
    expect(await detours.end(999, '不存在')).toBeUndefined();
  });
});

describe('notes', () => {
  it('qa add/list 按书、小节隔离并保留岔路关联；JSON兼容与兜底', async () => {
    const row = await notes.qa.add({
      book_id: 'a',
      section_id: '3.4.2',
      q: '示意问题',
      a: '示意回答',
      from_section: '3.5.2',
      detour_id: 1,
      message_ids: [10, 11],
      created_at: NOW,
    });
    await notes.qa.add({
      book_id: 'a',
      section_id: '3.5.2',
      q: '另一个问题',
      a: '另一个回答',
      message_ids: [],
      created_at: NOW,
    });
    await notes.qa.add({
      book_id: 'b',
      section_id: '3.4.2',
      q: '另一书',
      a: '回答',
      message_ids: [],
      created_at: NOW,
    });
    expect(await notes.qa.list('a', '3.4.2')).toEqual([row]);
    expect(await notes.qa.list('a')).toHaveLength(2);
    await db.run('UPDATE qa SET message_ids_json = ? WHERE id = ?', [
      '[8,9]',
      row.id,
    ]);
    expect((await notes.qa.list('a', '3.4.2'))[0].message_ids).toEqual([8, 9]);
    await db.run('UPDATE qa SET message_ids_json = ? WHERE id = ?', [
      '{"version":2,"data":[8]}',
      row.id,
    ]);
    expect((await notes.qa.list('a', '3.4.2'))[0].message_ids).toEqual([]);
  });
  it('stuck add/list/resolve 保留已掌握记录，并支持全库未解决卡点查询', async () => {
    const first = await notes.stuck.add({
      book_id: 'a',
      section_id: '3.5.2',
      text: '定义没懂',
      source: 'quiz',
      created_at: NOW,
    });
    const second = await notes.stuck.add({
      book_id: 'b',
      section_id: '3.5.2',
      text: '另一本卡点',
      source: 'user',
      card_id: 12,
      created_at: NOW,
    });
    expect(first).toMatchObject({ card_id: null, resolved_at: null });
    instant = '2026-10-31T00:00:00.000Z';
    expect(await notes.stuck.resolve(first.id)).toMatchObject({
      resolved_at: instant,
    });
    expect(await notes.stuck.list()).toHaveLength(2);
    expect(await notes.stuck.list('a', '3.5.2')).toHaveLength(1);
    expect(
      await notes.stuck.list(undefined, undefined, { resolved: false }),
    ).toEqual([second]);
    expect(
      await notes.stuck.list('a', undefined, { resolved: true }),
    ).toHaveLength(1);
    expect(await notes.stuck.resolve(999)).toBeUndefined();
    expect((await notes.stuck.resolve(second.id, NOW))?.resolved_at).toBe(NOW);
  });
  it('userText get/set 对单节执行upsert，显式空串也会保存', async () => {
    expect(await notes.userText.get('a', '3.5.2')).toBeUndefined();
    const first = await notes.userText.set('a', '3.5.2', '自己的示意笔记');
    expect(first).toEqual({
      book_id: 'a',
      section_id: '3.5.2',
      user_text: '自己的示意笔记',
      updated_at: NOW,
    });
    instant = '2026-10-30T00:00:00.000Z';
    await notes.userText.set('a', '3.5.2', '修改后');
    expect(await notes.userText.get('a', '3.5.2')).toMatchObject({
      user_text: '修改后',
      updated_at: instant,
    });
    await notes.userText.set('a', '3.5.2', '', NOW);
    expect((await notes.userText.get('a', '3.5.2'))?.user_text).toBe('');
    expect(await db.all('SELECT * FROM section_note')).toHaveLength(1);
  });
  it('整块高亮用NULL安全查询切换，范围高亮独立；同书按块序排列', async () => {
    const input = { book_id: 'a', block_seq: 103002, created_at: NOW };
    const first = await notes.highlights.toggle(input);
    expect(first).toMatchObject({
      start: null,
      end: null,
      color: 'yellow',
      note: null,
    });
    const range = await notes.highlights.toggle({
      ...input,
      start: 0,
      end: 5,
      color: 'blue',
      note: '范围说明',
    });
    expect(range).toMatchObject({
      start: 0,
      end: 5,
      color: 'blue',
      note: '范围说明',
    });
    expect(await notes.highlights.toggle(input)).toBeNull();
    expect(await notes.highlights.list('a')).toEqual([range]);
    const earlier = await notes.highlights.toggle({
      book_id: 'a',
      block_seq: 103001,
      created_at: NOW,
    });
    expect(await notes.highlights.list('a')).toEqual([earlier, range]);
    expect(await notes.highlights.list('b')).toEqual([]);
  });
  it('并发toggle持有完整事务锁，不产生多条NULL整块高亮；兼容旧重复行', async () => {
    const input = { book_id: 'a', block_seq: 103001, created_at: NOW };
    const results = await Promise.all([
      notes.highlights.toggle(input),
      notes.highlights.toggle(input),
      notes.highlights.toggle(input),
    ]);
    expect(results[0]).not.toBeNull();
    expect(results[1]).toBeNull();
    expect(results[2]).not.toBeNull();
    expect(await notes.highlights.list('a')).toHaveLength(1);
    await db.run(
      'INSERT INTO highlight (book_id,block_seq,created_at) VALUES (?,?,?)',
      ['a', 103001, NOW],
    );
    expect(await notes.highlights.list('a')).toHaveLength(2);
    expect(await notes.highlights.toggle(input)).toBeNull();
    expect(await notes.highlights.list('a')).toEqual([]);
  });
  it('pins add/list 保存问答关联并按块排序；损坏JSON退回空列表', async () => {
    const later = await notes.pins.add({
      book_id: 'a',
      section_id: '3.5.2',
      block_seq: 103005,
      question: '示意问题',
      answer_summary: '示意结论',
      message_ids: [1, 2],
      created_at: NOW,
    });
    const earlier = await notes.pins.add({
      book_id: 'a',
      section_id: '3.4.2',
      block_seq: 103001,
      question: '先前问题',
      answer_summary: '先前结论',
      message_ids: [3],
      created_at: NOW,
    });
    expect(await notes.pins.list('a')).toEqual([earlier, later]);
    expect(await notes.pins.list('a', '3.5.2')).toEqual([later]);
    await db.run('UPDATE pin SET message_ids_json = ? WHERE id = ?', [
      'broken',
      later.id,
    ]);
    expect((await notes.pins.list('a', '3.5.2'))[0].message_ids).toEqual([]);
  });
});

describe('cards', () => {
  it('addMany/get 使用DB默认盒子；due按本地日期和id稳定排序并应用上限', async () => {
    expect(await cards.get(999)).toBeUndefined();
    expect(await cards.addMany([])).toEqual([]);
    const saved = await cards.addMany([
      card({ id: 10, due_on: '2026-10-30' }),
      card({ id: 11, due_on: '2026-10-28' }),
      card({ id: 12, due_on: TODAY }),
      card({ id: 13, due_on: TODAY, book_id: 'b', box: 3 }),
    ]);
    expect(saved[0].box).toBe(1);
    expect(await cards.get(12)).toEqual(saved[2]);
    expect((await cards.due(TODAY)).map(row => row.id)).toEqual([11, 12, 13]);
    expect((await cards.due(TODAY, 2)).map(row => row.id)).toEqual([11, 12]);
    expect(await cards.due(TODAY, 0)).toEqual([]);
    expect(await cards.stats(TODAY)).toEqual({
      total: 4,
      due: 3,
      boxes: [3, 0, 1, 0, 0],
    });
    expect((await cards.stats()).total).toBe(4);
  });
  it('addMany中途违反CHECK时整批回滚', async () => {
    await expect(
      cards.addMany([card({ id: 20 }), card({ id: 21, box: 8 as CardBox })]),
    ).rejects.toThrow();
    expect(await cards.get(20)).toBeUndefined();
    expect(await cards.stats(TODAY)).toEqual({
      total: 0,
      due: 0,
      boxes: [0, 0, 0, 0, 0],
    });
  });
  it('rate原子更新盒子/到期日并记录每次旧盒子；不计算复习算法', async () => {
    const [row] = await cards.addMany([card()]);
    instant = '2026-10-30T02:00:00.000Z';
    expect(await cards.rate(row.id, 'good', 3, '2026-11-05')).toMatchObject({
      box: 3,
      due_on: '2026-11-05',
    });
    expect(
      await db.all('SELECT card_id,rated,box_from,box_to,at FROM review_log'),
    ).toEqual([
      { card_id: row.id, rated: 'good', box_from: 1, box_to: 3, at: instant },
    ]);
    await cards.rate(row.id, 'again', 1, TODAY, NOW);
    expect(
      (
        await db.all<{ box_from: number; box_to: number }>(
          'SELECT box_from,box_to FROM review_log ORDER BY id',
        )
      )[1],
    ).toEqual({ box_from: 3, box_to: 1 });
    await db.run('DELETE FROM card WHERE id = ?', [row.id]);
    expect(await db.all('SELECT * FROM review_log')).toEqual([]);
  });
  it('rate日志写失败回滚卡片，缺失卡片不创建日志', async () => {
    const [row] = await cards.addMany([card()]);
    await expect(
      cards.rate(row.id, 'invalid' as CardRating, 4, '2026-12-01'),
    ).rejects.toThrow();
    expect(await cards.get(row.id)).toEqual(row);
    expect(await db.all('SELECT * FROM review_log')).toEqual([]);
    await expect(cards.rate(999, 'good', 2, TODAY)).rejects.toThrow(
      '闪卡不存在',
    );
  });
});

describe('plans', () => {
  it('put/get按书/节/段upsert，JSON解码隔离并兼容旧格式', async () => {
    expect(await plans.get('a', '3.5.2', 0)).toBeUndefined();
    const input = plan();
    expect(await plans.put(input)).toEqual(input);
    input.steps[0].title = '在调用方修改';
    expect((await plans.get('a', '3.5.2', 0))?.steps[0].title).toBe('直觉');
    const updated = plan({
      source: 'fallback',
      created_at: '2026-10-30T00:00:00.000Z',
    });
    expect(await plans.put(updated)).toEqual(updated);
    expect(await db.all('SELECT * FROM lesson_plan')).toHaveLength(1);
    await db.run('UPDATE lesson_plan SET steps_json = ?', [
      '[{"no":1,"title":"旧步骤","kind":"check","block_from":1,"block_to":2,"status":"todo"}]',
    ]);
    expect((await plans.get('a', '3.5.2', 0))?.steps[0].title).toBe('旧步骤');
    await db.run('UPDATE lesson_plan SET steps_json = ?', [
      '{"version":9,"data":[]}',
    ]);
    expect((await plans.get('a', '3.5.2', 0))?.steps).toEqual([]);
  });
  it('setStepStatus按步骤no更新，不按数组下标；缺失数据报明确错误', async () => {
    await plans.put(plan());
    const changed = await plans.setStepStatus('a', '3.5.2', 0, 2, 'skipped');
    expect(changed.steps.map(step => step.status)).toEqual([
      'current',
      'skipped',
    ]);
    expect(await plans.get('a', '3.5.2', 0)).toEqual(changed);
    await expect(
      plans.setStepStatus('a', '3.5.2', 0, 99, 'done'),
    ).rejects.toThrow('没有这一步');
    await expect(
      plans.setStepStatus('a', 'missing', 0, 1, 'done'),
    ).rejects.toThrow('路线图不存在');
  });
});

describe('study', () => {
  it('put/get 保留默认值、显式null和完整岔路JSON，重写时执行upsert', async () => {
    expect(await study.get('a')).toBeUndefined();
    expect(await study.put({ book_id: 'a' })).toEqual({
      book_id: 'a',
      conversation_id: null,
      main_section: null,
      main_part: 0,
      main_step: 0,
      phase: 'idle',
      detours: [],
      mode: 'listen',
      reader_view: 'orig',
      read_anchor: null,
      resume_shown_at: null,
      last_active_at: null,
    });
    const state = {
      book_id: 'a',
      conversation_id: null,
      main_section: '3.5.2',
      main_part: 1,
      main_step: 2,
      phase: 'teaching' as const,
      detours: [{ sectionId: '3.4.2', detourId: 1, reviewStuckId: 2 }],
      mode: 'read' as const,
      reader_view: 'flow' as const,
      read_anchor: 103005,
      resume_shown_at: NOW,
      last_active_at: NOW,
    };
    expect(await study.put(state)).toEqual(state);
    expect(await study.get('a')).toEqual(state);
    expect(await db.all('SELECT * FROM study_state')).toHaveLength(1);
  });
  it('patch 保留未提供字段，可清空nullable和detours；未知书不创建状态', async () => {
    await study.put({
      book_id: 'a',
      main_section: '3.5.2',
      main_part: 1,
      read_anchor: 103001,
    });
    const patched = await study.patch('a', {
      mode: 'read',
      reader_view: 'flow',
      main_step: 2,
      phase: 'quiz',
      detours: [{ sectionId: '3.4.2', detourId: 3 }],
      last_active_at: NOW,
      resume_shown_at: NOW,
    });
    expect(patched).toMatchObject({
      main_section: '3.5.2',
      main_part: 1,
      main_step: 2,
      phase: 'quiz',
      mode: 'read',
      reader_view: 'flow',
      read_anchor: 103001,
      detours: [{ sectionId: '3.4.2', detourId: 3 }],
    });
    const cleared = await study.patch('a', {
      main_section: null,
      read_anchor: null,
      last_active_at: null,
      resume_shown_at: null,
      detours: [],
    });
    expect(cleared).toMatchObject({
      main_section: null,
      read_anchor: null,
      last_active_at: null,
      resume_shown_at: null,
      detours: [],
    });
    expect(await study.patch('a', {})).toEqual(cleared);
    expect(await study.patch('missing', {})).toBeUndefined();
  });
  it('detours JSON损坏/未知版本退回空栈；camelCase引擎payload原样保留', async () => {
    await study.put({ book_id: 'a' });
    for (const raw of ['bad', '{"version":8,"data":[{"sectionId":"x"}]}']) {
      await db.run(
        'UPDATE study_state SET detours_json = ? WHERE book_id = ?',
        [raw, 'a'],
      );
      expect((await study.get('a'))?.detours).toEqual([]);
    }
    const stack = [{ sectionId: '3.4.2', detourId: 9 }];
    await db.run('UPDATE study_state SET detours_json = ? WHERE book_id = ?', [
      serializeJson(stack),
      'a',
    ]);
    expect((await study.get('a'))?.detours).toEqual(stack);
  });
});
