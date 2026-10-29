import {
  buildBlockMigration,
  collectReferencedSeqs,
  migrateReferences,
  normalizeText,
  textSimilarity,
} from '@core/map';
import type { Block, Highlight, Message, Pin } from '@core/types';
const block = (
  seq: number,
  page: number | null,
  text: string,
  loc: string | null = null,
): Block => ({
  id: seq,
  book_id: 'book',
  seq,
  page,
  text,
  loc,
  type: 'text',
  chars: text.length,
  level: null,
  x0: null,
  y0: null,
  x1: null,
  y1: null,
  latex: null,
  html: null,
  image_path: null,
  section_id: '1.1',
});
const message = (content: string): Message => ({
  id: 1,
  book_id: 'book',
  section_id: '1.1',
  part_no: 0,
  step_no: 0,
  kind: 'assistant',
  intent: 'ask',
  content,
  parts: [{ t: 'text', text: content }],
  raw: { protocol: 'chat', model: 'model', items: [] },
  allowed_refs: [1001, 1002],
  quote_seq: 1001,
  detour_id: null,
  in_context: true,
  usage: null,
  unverified: 0,
  created_at: '2026-10-29T00:00:00Z',
});
const highlight: Highlight = {
  id: 2,
  book_id: 'book',
  block_seq: 1001,
  start: 0,
  end: 4,
  color: 'yellow',
  note: '批注',
  created_at: '2026-10-29T00:00:00Z',
};
const pin: Pin = {
  id: 3,
  book_id: 'book',
  block_seq: 1002,
  section_id: '1.1',
  question: '问题',
  answer_summary: '回答',
  message_ids: [1],
  created_at: '2026-10-29T00:00:00Z',
};
it('matches normalized text on the same page or an adjacent page and leaves removed sources unresolved', () => {
  const old = [
      block(1001, 1, 'Alpha, beta!'),
      block(1002, 1, '这段原文已删除'),
      block(2001, 2, 'The exact paragraph'),
    ],
    next = [
      block(1005, 1, 'Alpha beta'),
      block(3002, 3, 'The exact paragraph'),
      block(5001, 5, '这段原文已删除'),
    ];
  expect(buildBlockMigration(old, next)).toEqual({
    matches: [
      { oldSeq: 1001, newSeq: 1005, similarity: 1, pageDelta: 0 },
      { oldSeq: 2001, newSeq: 3002, similarity: 1, pageDelta: 1 },
    ],
    mapping: { 1001: 1005, 2001: 3002 },
    unmatched: [1002],
  });
});
it('accepts small OCR changes at 90 percent and rejects lower similarity or unreferenced candidates', () => {
  const old = [block(1001, 1, 'abcdefghij'), block(1002, 1, 'unreferenced')],
    next = [block(1009, 1, 'abcdefghiX')];
  expect(buildBlockMigration(old, next, [1001, 9999]).mapping).toEqual({
    1001: 1009,
  });
  expect(
    buildBlockMigration(old, [block(1009, 1, 'abcdefghXY')], [1001]).unmatched,
  ).toEqual([1001]);
  expect(textSimilarity('a'.repeat(3000), 'b'.repeat(3000), 0.9)).toBe(0);
});
it('uses unique nearest matches for repeated text and EPUB locations, without matching empty sources', () => {
  const old = [
      block(1001, 1, '相同正文'),
      block(1005, 1, '相同正文'),
      block(2001, null, 'EPUB 段落', '第二节'),
      block(2002, null, ''),
    ],
    next = [
      block(1002, 1, '相同正文'),
      block(1006, 1, '相同正文'),
      block(3001, null, 'EPUB段落', '第一节'),
      block(3002, null, 'EPUB段落', '第二节'),
    ];
  const result = buildBlockMigration(old, next);
  expect(result.mapping).toEqual({ 1001: 1002, 1005: 1006, 2001: 3002 });
  expect(result.unmatched).toEqual([2002]);
});
it('rewrites citation tags, quote anchors and allow lists while retaining moved annotations as orphaned notes', () => {
  const records = {
      messages: [message('解释 [[b:1001]]\n[[q:1002]]\n[[fig:1001]]')],
      highlights: [highlight],
      pins: [pin],
    },
    before = JSON.stringify(records);
  expect(collectReferencedSeqs(records)).toEqual([1001, 1002]);
  const migration = buildBlockMigration(
    [block(1001, 1, '保留内容'), block(1002, 1, '删除内容')],
    [block(1009, 1, '保留内容')],
  );
  const result = migrateReferences(records, migration);
  expect(result.messages[0]).toMatchObject({
    content: '解释 [[b:1009]]\n[[q:1002]]\n[[fig:1009]]',
    quote_seq: 1009,
    allowed_refs: [1009],
    raw: null,
    unverified: 1,
  });
  expect(result.highlights[0]).toMatchObject({ block_seq: 1009, note: '批注' });
  expect(result.pins).toEqual([]);
  expect(result.orphaned.pins).toEqual([pin]);
  expect(result.moved).toContainEqual({
    kind: 'pin',
    id: 3,
    oldSeq: 1002,
    label: '原文位置已变化',
  });
  expect(JSON.stringify(records)).toBe(before);
});
it('removes unmatched quote pointers, preserves raw data when no rewrite occurred and covers null fields', () => {
  const original = message('正文无引用'),
    records = {
      messages: [
        { ...original, parts: null, quote_seq: 9999, allowed_refs: null },
      ],
      highlights: [{ ...highlight, block_seq: 9999 }],
      pins: [],
    };
  const result = migrateReferences(records, {
    mapping: {},
    matches: [],
    unmatched: [9999],
  });
  expect(result.messages[0]).toMatchObject({
    quote_seq: null,
    allowed_refs: null,
    raw: original.raw,
    unverified: 1,
  });
  expect(result.orphaned.highlights).toHaveLength(1);
  expect(result.moved.map(item => item.kind)).toEqual(['message', 'highlight']);
  expect(
    migrateReferences({}, { mapping: {}, matches: [], unmatched: [] }),
  ).toMatchObject({ messages: [], moved: [] });
});
it('normalizes whitespace and punctuation without erasing mathematical symbols', () => {
  expect(normalizeText(' Ａ， b!\n c ')).toBe('abc');
  expect(normalizeText('a + b = c')).toBe('a+b=c');
  expect(textSimilarity('', '')).toBe(0);
  expect(textSimilarity('abc', 'abc', 0.9)).toBe(1);
  expect(textSimilarity('a', 'abcdefghij', 0.9)).toBe(0);
});
