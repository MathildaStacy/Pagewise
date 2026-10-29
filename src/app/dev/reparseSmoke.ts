import type { Block, Section } from '@core/types';
import type { Row } from '@data/db';
import type { Container } from '../container';
import { resolveStudyBlockImage } from '../bookImages';
import { bookDirectory, getImportRuntime } from '../usecases/importRuntime';
import { reparseBook } from '../usecases/importBooks';
import { saveUserNote } from '../usecases/notes';
import { saveStudyBlockNote, saveStudyPin } from '../usecases/studyReader';
import {
  clearParseCache,
  preservedReparseBlocks,
  storageRuntime,
} from '../usecases/storage';

type Stage =
  | 'prepare'
  | 'seed'
  | 'snapshot'
  | 'clear'
  | 'cleared'
  | 'reparse'
  | 'verify'
  | 'complete';
type Failure =
  | 'device-library-required'
  | 'epub-required'
  | 'epub-parser-required'
  | 'original-required'
  | 'study-records-required'
  | 'block-note-target-required'
  | 'pdf-queue-active'
  | 'learning-records-changed'
  | 'cache-not-cleared'
  | 'snapshot-missing'
  | 'reparse-failed'
  | 'reparse-timeout'
  | 'blocks-changed'
  | 'image-invalid'
  | 'report-write-failed'
  | 'operation-failed';
const tables = [
  'message',
  'section_note',
  'highlight',
  'pin',
  'card',
  'qa',
  'stuck',
] as const;
type RecordTable = (typeof tables)[number];
interface LearningSnapshot {
  sections: Pick<Section, 'id' | 'status' | 'summary' | 'guide'>[];
  records: Record<RecordTable, Row[]>;
}
interface Counts {
  messages: number;
  guides: number;
  summaries: number;
  userNotes: number;
  highlights: number;
  pins: number;
  cards: number;
  qa: number;
  stuck: number;
}
interface ChangedField {
  table: 'section' | RecordTable;
  field: string;
  records: number;
}
export interface EpubReparseSmokeReport {
  version: 1;
  startedAtMs: number;
  elapsedMs: number;
  status: 'running' | 'passed' | 'failed';
  stage: Stage;
  errors: { stage: Stage; code: Failure }[];
  sections: number;
  blocksBefore: number;
  blocksAfterClear: number;
  blocksAfterReparse: number;
  preservedBlocks: number;
  images: number;
  resolvedImages: number;
  before: Counts | null;
  afterClear: Counts | null;
  afterReparse: Counts | null;
  retainedAfterClear: boolean;
  retainedAfterReparse: boolean;
  changesAfterClear: ChangedField[];
  changesAfterReparse: ChangedField[];
}
class SmokeFailure extends Error {
  constructor(readonly code: Failure) {
    super(code);
  }
}
function check(value: unknown, code: Failure): asserts value {
  if (!value) throw new SmokeFailure(code);
}
const marker = '[Pagewise EPUB reparse acceptance]';
const blockNote = `${marker} 块笔记保留验收。`;
const pinQuestion = `${marker} 重新解析后便签还在吗？`;
const pinAnswer = `${marker} 核对便签、消息和原文引用。`;
const sectionNote = `${marker} 用户小节笔记保留验收。`;
const summary = `${marker} 小结保留验收。`;
const cardFront = `${marker} 重新解析会保留学习记录吗？`;
const cardBack = `${marker} 核对原有导读、消息、笔记、便签和闪卡。`;
const appendOnce = (previous: string | null | undefined, addition: string) =>
  previous?.includes(addition)
    ? previous
    : [previous, addition].filter(Boolean).join('\n');
const same = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);
const comparableBlocks = (blocks: Block[]) =>
  blocks.map(block => ({
    seq: block.seq,
    page: block.page,
    loc: block.loc,
    type: block.type,
    text: block.text,
    section_id: block.section_id,
    image_path: block.image_path,
  }));
async function snapshot(
  c: Container,
  bookId: string,
): Promise<LearningSnapshot> {
  const sections = (await c.repos.sections.tree(bookId)).map(
    ({ id, status, summary: savedSummary, guide }) => ({
      id,
      status,
      summary: savedSummary,
      guide,
    }),
  );
  const records = {} as LearningSnapshot['records'];
  for (const table of tables)
    records[table] = await c.db.all(
      `SELECT * FROM ${table} WHERE book_id=? ORDER BY ${
        table === 'section_note' ? 'section_id' : 'id'
      }`,
      [bookId],
    );
  return { sections, records };
}
const counts = ({ sections, records }: LearningSnapshot): Counts => ({
  messages: records.message.length,
  guides: sections.filter(section => !!section.guide).length,
  summaries: sections.filter(section => !!section.summary).length,
  userNotes: records.section_note.length,
  highlights: records.highlight.length,
  pins: records.pin.length,
  cards: records.card.length,
  qa: records.qa.length,
  stuck: records.stuck.length,
});
function changedFields(
  before: LearningSnapshot,
  after: LearningSnapshot,
): ChangedField[] {
  const changes: ChangedField[] = [];
  const compare = (table: ChangedField['table'], left: Row[], right: Row[]) => {
    if (left.length !== right.length)
      changes.push({
        table,
        field: 'record-count',
        records: Math.abs(left.length - right.length),
      });
    const fields = new Map<string, number>();
    for (let i = 0; i < Math.min(left.length, right.length); i++)
      for (const field of new Set([
        ...Object.keys(left[i]),
        ...Object.keys(right[i]),
      ]))
        if (!same(left[i][field], right[i][field]))
          fields.set(field, (fields.get(field) ?? 0) + 1);
    for (const [field, records] of fields)
      changes.push({ table, field, records });
  };
  compare('section', before.sections, after.sections);
  for (const table of tables)
    compare(table, before.records[table], after.records[table]);
  return changes;
}
async function ensureNoPdfQueue(c: Container) {
  const pending = await c.db.get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM book_part p JOIN book b ON b.id=p.book_id WHERE b.format='pdf' AND p.stage NOT IN ('done','failed')",
  );
  check(!pending?.count, 'pdf-queue-active');
}
async function waitReady(c: Container, bookId: string) {
  const deadline = Date.now() + 120_000;
  for (;;) {
    const book = await c.repos.books.get(bookId);
    check(book?.format === 'epub', 'reparse-failed');
    if (book.status === 'ready') return;
    check(
      book.status !== 'failed' && book.status !== 'paused',
      'reparse-failed',
    );
    check(Date.now() < deadline, 'reparse-timeout');
    await new Promise<void>(resolve => setTimeout(resolve, 300));
  }
}
const running = new WeakMap<Container, Promise<EpubReparseSmokeReport>>();
/** Manual debug acceptance; only a ready, studied EPUB can reach the production reparse queue. */
export function runEpubReparseSmoke(
  c: Container,
): Promise<EpubReparseSmokeReport> {
  const existing = running.get(c);
  if (existing) return existing;
  const work = run(c).finally(() => running.delete(c));
  running.set(c, work);
  return work;
}
async function run(c: Container): Promise<EpubReparseSmokeReport> {
  const report: EpubReparseSmokeReport = {
    version: 1,
    startedAtMs: Date.now(),
    elapsedMs: 0,
    status: 'running',
    stage: 'prepare',
    errors: [],
    sections: 0,
    blocksBefore: 0,
    blocksAfterClear: 0,
    blocksAfterReparse: 0,
    preservedBlocks: 0,
    images: 0,
    resolvedImages: 0,
    before: null,
    afterClear: null,
    afterReparse: null,
    retainedAfterClear: false,
    retainedAfterReparse: false,
    changesAfterClear: [],
    changesAfterReparse: [],
  };
  const write = async () => {
    report.elapsedMs = Date.now() - report.startedAtMs;
    try {
      const io = storageRuntime(c);
      await io.writeText(
        `${io.cacheDir}/epub-reparse-smoke.json`,
        JSON.stringify(report),
      );
    } catch {
      throw new SmokeFailure('report-write-failed');
    }
  };
  const stage = async (value: Stage) => {
    report.stage = value;
    await write();
  };
  try {
    await write();
    check(c.mode !== 'demo', 'device-library-required');
    await ensureNoPdfQueue(c);
    const runtime = getImportRuntime(c);
    check(runtime.epub, 'epub-parser-required');
    const book = (await c.repos.books.list()).find(
      value =>
        value.format === 'epub' &&
        value.status === 'ready' &&
        value.sha256 &&
        !value.sha256.startsWith('demo:'),
    );
    check(book, 'epub-required');
    const directory = bookDirectory(runtime, book.id),
      source = `${directory}/source.epub`;
    check(await runtime.files.exists(source), 'original-required');
    const [sections, blocks, highlights] = await Promise.all([
      c.repos.sections.tree(book.id),
      c.db.all<Block>('SELECT * FROM block WHERE book_id=? ORDER BY seq', [
        book.id,
      ]),
      c.repos.notes.highlights.list(book.id),
    ]);
    const section = sections.find(
      value =>
        value.is_leaf &&
        !!value.guide &&
        blocks.some(
          block =>
            block.section_id === value.id &&
            block.type === 'text' &&
            !!block.text.trim() &&
            block.page === null &&
            !!block.loc,
        ),
    );
    check(section, 'study-records-required');
    const messages = await c.repos.messages.thread(book.id, section.id, {
      limit: 2147483647,
    });
    check(messages.length, 'study-records-required');
    const targets = blocks.filter(
      block =>
        block.section_id === section.id &&
        block.type === 'text' &&
        !!block.text.trim() &&
        block.page === null &&
        !!block.loc,
    );
    const block =
      targets.find(value =>
        highlights.some(
          highlight =>
            highlight.block_seq === value.seq &&
            highlight.start === null &&
            highlight.end === null &&
            highlight.note === blockNote,
        ),
      ) ??
      targets.find(
        value =>
          !highlights.some(
            highlight =>
              highlight.block_seq === value.seq &&
              highlight.start === null &&
              highlight.end === null &&
              !!highlight.note,
          ),
      );
    check(block, 'block-note-target-required');
    report.sections = sections.length;
    report.blocksBefore = blocks.length;
    await stage('seed');
    await saveStudyBlockNote(c, book.id, section.id, block.seq, blockNote);
    const pins = await c.repos.notes.pins.list(book.id, section.id);
    if (
      !pins.some(
        pin => pin.question === pinQuestion && pin.block_seq === block.seq,
      )
    )
      await saveStudyPin(
        c,
        book.id,
        section.id,
        block.seq,
        pinQuestion,
        pinAnswer,
        [
          messages.find(message => message.kind === 'assistant')?.id ??
            messages[0].id,
        ],
      );
    const note = await c.repos.notes.userText.get(book.id, section.id);
    await saveUserNote(
      c,
      book.id,
      section.id,
      appendOnce(note?.user_text, sectionNote),
    );
    await c.repos.sections.update(book.id, section.id, {
      summary: appendOnce(section.summary, summary),
    });
    const cards = await c.db.all<{ front: string }>(
      'SELECT front FROM card WHERE book_id=? AND section_id=?',
      [book.id, section.id],
    );
    if (!cards.some(card => card.front === cardFront))
      await c.repos.cards.addMany([
        {
          book_id: book.id,
          section_id: section.id,
          front: cardFront,
          back: cardBack,
          origin: 'manual',
          due_on: c.clock.today(),
          created_at: c.clock.now().toISOString(),
        },
      ]);
    await stage('snapshot');
    const before = await snapshot(c, book.id);
    report.before = counts(before);
    await ensureNoPdfQueue(c);
    await stage('clear');
    await clearParseCache(c, book.id);
    await stage('cleared');
    const cleared = await snapshot(c, book.id);
    report.afterClear = counts(cleared);
    report.changesAfterClear = changedFields(before, cleared);
    report.retainedAfterClear = same(before, cleared);
    check(report.retainedAfterClear, 'learning-records-changed');
    const remaining = await c.db.get<{ count: number }>(
      'SELECT COUNT(*) AS count FROM block WHERE book_id=?',
      [book.id],
    );
    report.blocksAfterClear = remaining?.count ?? 0;
    check(
      !report.blocksAfterClear && (await runtime.files.exists(source)),
      'cache-not-cleared',
    );
    const preserved = await preservedReparseBlocks(c, book.id);
    report.preservedBlocks = preserved.length;
    check(
      same(comparableBlocks(blocks), comparableBlocks(preserved)),
      'snapshot-missing',
    );
    await ensureNoPdfQueue(c);
    await stage('reparse');
    await reparseBook(c, book.id);
    await waitReady(c, book.id);
    await stage('verify');
    const parsed = await c.db.all<Block>(
      'SELECT * FROM block WHERE book_id=? ORDER BY seq',
      [book.id],
    );
    report.blocksAfterReparse = parsed.length;
    check(
      same(comparableBlocks(blocks), comparableBlocks(parsed)),
      'blocks-changed',
    );
    const restored = await snapshot(c, book.id);
    report.afterReparse = counts(restored);
    report.changesAfterReparse = changedFields(before, restored);
    report.retainedAfterReparse = same(before, restored);
    check(report.retainedAfterReparse, 'learning-records-changed');
    const images = parsed.filter(value => value.type === 'image');
    report.images = images.length;
    for (const image of images) {
      const uri = resolveStudyBlockImage(c, book.id, image).image_path;
      const path = uri?.startsWith('file://') ? uri.slice(7) : null;
      if (
        path &&
        path.startsWith(`${directory}/`) &&
        (await runtime.files.exists(path))
      )
        report.resolvedImages++;
    }
    check(report.images === report.resolvedImages, 'image-invalid');
    check(await runtime.files.exists(source), 'original-required');
    report.status = 'passed';
    await stage('complete');
  } catch (error) {
    report.status = 'failed';
    report.errors.push({
      stage: report.stage,
      code: error instanceof SmokeFailure ? error.code : 'operation-failed',
    });
    try {
      await write();
    } catch {
      /* Return fixed codes even if the report cannot be persisted. */
    }
  }
  return report;
}
