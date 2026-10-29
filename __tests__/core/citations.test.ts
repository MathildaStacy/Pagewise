import {
  advanceCitationStreak,
  CITATION_REMINDER,
  rewriteReferences,
  validateCitations,
  type CitationContext,
} from '@core/citations';
import { parse, type RichDoc } from '@core/markup';
const context: CitationContext = {
  allowedRefs: [1, 2, 3, 404],
  blocks: [
    { seq: 1, section_id: '3.5.2' },
    { seq: 2, section_id: '3.4.2' },
    { seq: 3, section_id: null },
    { seq: 4, section_id: '3.5.2' },
  ],
  mainSectionId: '3.5.2',
};
const text = (v: string) => ({ t: 'text', v });
const citation = (ref: number, verified = false, detour = false) => ({
  t: 'cite' as const,
  ref,
  verified,
  detour,
});
it('checks allow-list and block existence separately and marks detour refs', () => {
  const result = validateCitations(
    parse('主线 [[b:1]] 岔路 [[b:2]] 无节 [[b:3]] 重复 [[b:1]]。'),
    context,
  );
  expect(result.doc).toEqual([
    {
      t: 'p',
      c: [
        text('主线 '),
        citation(1, true),
        text(' 岔路 '),
        citation(2, true, true),
        text(' 无节 '),
        citation(3, true),
        text(' 重复 '),
        citation(1, true),
        text('。'),
      ],
    },
  ]);
  expect(result.verifiedRefs).toEqual([1, 2, 3]);
  expect(result.invalidRefs).toEqual([]);
  expect(result.hasUnverified).toBe(false);
  expect(validateCitations(parse('[[b:4]]'), context).invalidRefs).toEqual([4]);
  expect(validateCitations(parse('[[b:404]]'), context).invalidRefs).toEqual([
    404,
  ]);
});
it('removes invalid capsules and inserts one unverified marker at each affected sentence end', () => {
  const result = validateCitations(
    parse(
      '第一句 [[b:999]]还没说完 [[b:998]]。下一句 [[b:404]]！最后 [[b:997]]',
    ),
    context,
  );
  expect(result.doc).toEqual([
    {
      t: 'p',
      c: [
        text('第一句 还没说完 。'),
        { t: 'unverified' },
        text('下一句 ！'),
        { t: 'unverified' },
        text('最后 '),
        { t: 'unverified' },
      ],
    },
  ]);
  expect(result.invalidCitations).toBe(4);
  expect(result.invalidRefs).toEqual([999, 998, 404, 997]);
  expect(result.hasUnverifiedCitation).toBe(true);
});
it('places post-punctuation citations at that sentence and preserves emphasis while validating', () => {
  expect(
    validateCitations(parse('书中说。[[b:999]][[b:999]]下一句。'), context).doc,
  ).toEqual([
    { t: 'p', c: [text('书中说。'), { t: 'unverified' }, text('下一句。')] },
  ]);
  expect(
    validateCitations(parse('**强调 [[b:999]]**后面继续。结束。'), context).doc,
  ).toEqual([
    {
      t: 'p',
      c: [
        { t: 'b', c: [text('强调 ')] },
        text('后面继续。'),
        { t: 'unverified' },
        text('结束。'),
      ],
    },
  ]);
  expect(
    validateCitations(parse('“这是一句。” [[b:999]]'), context).doc,
  ).toEqual([{ t: 'p', c: [text('“这是一句。” '), { t: 'unverified' }] }]);
  expect(validateCitations(parse('[[b:999]]$x$。'), context).doc).toEqual([
    { t: 'p', c: [{ t: 'math', tex: 'x' }, text('。'), { t: 'unverified' }] },
  ]);
});
it('checks quote and figure refs and replaces unverified blocks with explicit copy', () => {
  const result = validateCitations(
    parse('[[q:1]]\n[[fig:2]]\n[[q:404]]\n[[fig:999]]'),
    context,
  );
  expect(result.doc).toEqual([
    { t: 'quote', ref: 1, verified: true },
    { t: 'figure', ref: 2, verified: true },
    { t: 'p', c: [text('（引用的原文未核实）')] },
    { t: 'p', c: [text('（引用的原文未核实）')] },
  ]);
  expect(result.invalidCitations).toBe(2);
});
it('validates aux, list, check and nested bold refs without counting aux prose as unsupported', () => {
  const long = '一个很长的没有引用的陈述'.repeat(5);
  const source = `${long}\n\n[[derive]]${long}\n\n[[example]]${long} [[b:2]][[/example]]\n[[b:999]][[/derive]]\n\n- ${long}\n- **有引用 [[b:1]]**\n\n[[check]]问题 [[b:999]][[/check]]\n\n$$x=1$$\n\n\x60\x60\x60\ncode\n\x60\x60\x60`;
  const result = validateCitations(parse(source), context);
  expect(result.unsupportedParagraphs).toBe(2);
  expect(result.invalidCitations).toBe(2);
  expect(result.unverifiedCount).toBe(4);
  expect(result.hasUnverified).toBe(true);
  expect(result.verifiedRefs).toEqual([2, 1]);
  expect(
    result.doc.some(
      block => block.t === 'aux' && block.body.some(b => b.t === 'aux'),
    ),
  ).toBe(true);
  expect(result.doc.some(block => block.t === 'code')).toBe(true);
});
it('counts only over-40-character unsupported prose, without displaying an extra badge', () => {
  for (const length of [0, 40, 41]) {
    const doc = parse('字'.repeat(length));
    const result = validateCitations(doc, context);
    expect(result.unsupportedParagraphs).toBe(length > 40 ? 1 : 0);
    expect(result.doc).toEqual(doc);
    expect(result.hasUnverifiedCitation).toBe(false);
  }
});
it('does not report a still-streaming partial reference as an invalid citation', () => {
  expect(
    validateCitations(parse('正在说明 [[b:99', { streaming: true }), context)
      .invalidCitations,
  ).toBe(0);
  expect(
    validateCitations(parse('正在说明 [[b:99', { final: true }), context)
      .invalidCitations,
  ).toBe(0);
  expect(
    validateCitations(parse('正在说明 [[b:99]]', { final: true }), context)
      .invalidCitations,
  ).toBe(1);
});
it('does not mutate the original AST or context when verifying/replacing refs', () => {
  const doc = parse(
    '**[[b:2]]** [[b:99]]。\n\n[[q:1]]\n[[derive]][[b:3]][[/derive]]',
  );
  const saved = JSON.stringify(doc);
  validateCitations(doc, context);
  expect(JSON.stringify(doc)).toBe(saved);
  expect(
    validateCitations(doc, { ...context, mainSectionId: undefined }).doc[0],
  ).toEqual({
    t: 'p',
    c: [{ t: 'b', c: [citation(2, true)] }, text(' 。'), { t: 'unverified' }],
  });
});
it('rewrites every reference shape, preserves unmapped refs, and requires revalidation', () => {
  const doc: RichDoc = validateCitations(
    parse(
      '**[[b:1]]**\n\n- [[b:2]]\n\n[[q:1]]\n[[fig:2]]\n[[derive]][[check]][[b:3]][[/check]][[/derive]]\n\n$$x$$\n```\ncode\n```',
    ),
    context,
  ).doc;
  const original = JSON.stringify(doc);
  const mapped = rewriteReferences(
    doc,
    new Map([
      [1, 11],
      [2, 12],
    ]),
  );
  expect(mapped[0]).toEqual({ t: 'p', c: [{ t: 'b', c: [citation(11)] }] });
  expect(mapped[1]).toEqual({
    t: 'list',
    ordered: false,
    items: [[citation(12)]],
  });
  expect(mapped[2]).toEqual({ t: 'quote', ref: 11, verified: false });
  expect(mapped[3]).toEqual({ t: 'figure', ref: 12, verified: false });
  expect(mapped[4]).toEqual({
    t: 'aux',
    kind: 'derive',
    open: false,
    body: [{ t: 'check', c: [citation(3)] }],
  });
  expect(JSON.stringify(doc)).toBe(original);
  expect(rewriteReferences(parse('[[b:1]]'), { 1: 8 })[0]).toEqual({
    t: 'p',
    c: [citation(8)],
  });
});
it('counts three invalid answer turns before a next-turn reminder and then clears the streak', () => {
  expect(advanceCitationStreak(0, true)).toEqual({ streak: 1, reminder: null });
  expect(advanceCitationStreak(1, true)).toEqual({ streak: 2, reminder: null });
  expect(advanceCitationStreak(2, true)).toEqual({
    streak: 0,
    reminder: CITATION_REMINDER,
  });
  expect(advanceCitationStreak(2, false)).toEqual({
    streak: 0,
    reminder: null,
  });
});
