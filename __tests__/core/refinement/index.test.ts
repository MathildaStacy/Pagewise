import {
  layoutCharacters,
  parseRefinement,
  projectRefinement,
  refinementChunks,
  ruleEdits,
  type RefinementRun,
} from '@core/refinement';
import { formatBlocks } from '@core/context';
import type { Block } from '@core/types';

const block = (
  seq: number,
  text: string,
  over: Partial<Block> = {},
): Block => ({
  id: seq,
  book_id: 'book',
  seq,
  page: seq,
  loc: null,
  type: 'text',
  text,
  chars: Array.from(text).length,
  level: null,
  latex: null,
  html: null,
  image_path: null,
  section_id: 'one',
  x0: 10,
  y0: 20,
  x1: 500,
  y1: 600,
  ...over,
});
const parse = (
  source: Block[],
  edits: unknown[],
  mode: 'structure' | 'vision' = 'structure',
) =>
  parseRefinement(
    JSON.stringify({ edits, issues: [] }),
    source,
    { seqs: source.map(b => b.seq), context: [] },
    mode,
  );
const edit = (seq: number, text: string, over = {}) => ({
  seq,
  text,
  reason: '核对原文',
  ...over,
});

it('repairs every wrapped line, CJK spacing and hyphenation while preserving paragraph breaks and Unicode', () => {
  const source = [
    block(1, 'a\nb\nc\r\nd\n\nnext'),
    block(2, '中文\n段落\n测试🙂'),
    block(3, 'docu-\nment\u00adation'),
  ];
  const edits = ruleEdits(source);
  expect(edits.map(e => e.text)).toEqual([
    'a b c d\n\nnext',
    '中文段落测试🙂',
    'documentation',
  ]);
  expect(
    edits.every(
      (e, i) => layoutCharacters(e.text) === layoutCharacters(source[i].text),
    ),
  ).toBe(true);
  expect(
    ruleEdits([
      block(1, 'x\ny', { type: 'code' }),
      block(2, 'x\ny', { type: 'list' }),
    ]),
  ).toEqual([]);
});

it('covers complete blocks once, isolates images for visual reconstruction and leaves code as read-only context', () => {
  const source = [
    block(1, 'a'.repeat(8)),
    block(2, 'b'.repeat(8)),
    block(3, 'code', { type: 'code' }),
    block(4, 'x', { type: 'equation', latex: 'x=1' }),
    block(5, 'image', { type: 'image' }),
    block(6, 'z'),
  ];
  expect(refinementChunks(source, 'structure', 10)).toEqual([
    { seqs: [1], context: [2] },
    { seqs: [2], context: [1, 3] },
    { seqs: [6], context: [5] },
  ]);
  const chunks = refinementChunks(source, 'vision', 100);
  expect(chunks.flatMap(c => c.seqs)).toEqual([1, 2, 4, 5, 6]);
  expect(
    chunks.every(
      c =>
        new Set(c.seqs.map(seq => source.find(b => b.seq === seq)!.page))
          .size <= 2,
    ),
  ).toBe(true);
  expect(
    refinementChunks([block(1, 'x'.repeat(30))], 'structure', 10)[0].seqs,
  ).toEqual([1]);
});

it('accepts layout, headings and adjacent continuations but converts semantic edits into issues', () => {
  const source = [
    block(1, 'Chapter One', { type: 'title', level: 4 }),
    block(2, 'docu-\nment'),
    block(3, '原文不能改写'),
  ];
  const result = parse(source, [
    edit(1, 'Chapter One', { level: 2 }),
    edit(2, 'document'),
    edit(3, '原文不可改写'),
  ]);
  expect(result.edits.map(e => [e.seq, e.level])).toEqual([
    [1, 2],
    [2, null],
  ]);
  expect(result.issues).toEqual([expect.objectContaining({ seq: 3 })]);
  expect(
    parse(source, [edit(3, source[2].text, { continuesFrom: 2 })]).edits[0]
      .continuesFrom,
  ).toBe(2);
  const far = parse(source, [edit(3, source[2].text, { continuesFrom: 1 })]);
  expect(far.edits).toEqual([]);
  expect(far.issues[0].reason).toContain('相邻');
});

it.each([
  ['unknown target', [edit(99, 'text')], '本批以外'],
  ['duplicate target', [edit(1, 'text'), edit(1, 'text')], '重复'],
  ['content type change', [edit(1, 'text', { type: 'image' })], '内容类型'],
  [
    'invalid heading',
    [edit(1, 'text', { type: 'title', level: 7 })],
    '层级无效',
  ],
])(
  'turns a %s into an issue and keeps the rest of the batch',
  (_name, rows, reason) => {
    const source = [block(1, 'text'), block(2, 'two\nlines')];
    const result = parse(source, [...rows, edit(2, 'two lines')]);
    expect(result.edits.map(e => [e.seq, e.text])).toEqual([[2, 'two lines']]);
    expect(result.issues.map(i => i.reason).join()).toContain(reason);
  },
);

it('ignores a formula field on prose, the response that stopped real AIMA runs', () => {
  const source = [block(1, 'where is the vector ofx inputs')];
  const result = parse(
    source,
    [
      edit(1, 'where $\\mathbf{w}$ is the vector of $\\mathbf{x}$ inputs', {
        type: 'text',
        latex: '\\mathbf{w}',
      }),
    ],
    'vision',
  );
  expect(result.edits[0]).toMatchObject({
    text: 'where $\\mathbf{w}$ is the vector of $\\mathbf{x}$ inputs',
    latex: null,
  });
  expect(result.issues).toEqual([]);
});

it('fails a batch only for unreadable output, and relocates issues instead of rejecting them', () => {
  const source = [block(1, 'text'), block(2, 'next')],
    chunk = { seqs: [1], context: [2] };
  expect(() =>
    parseRefinement('{"edits":[', source, chunk, 'structure'),
  ).toThrow('完整');
  expect(() =>
    parseRefinement('{"issues":[]}', source, chunk, 'structure'),
  ).toThrow('修改列表');
  const result = parseRefinement(
    '{"edits":[{"seq":2,"text":"next","reason":"x"}],"issues":[{"seq":2,"reason":"context"},{"seq":77,"reason":"stray"}]}',
    source,
    chunk,
    'structure',
  );
  expect(result.edits).toEqual([]);
  expect(result.issues).toEqual([
    { seq: 2, reason: 'context' },
    { seq: 1, reason: 'stray' },
    expect.objectContaining({
      seq: 1,
      reason: expect.stringContaining('1 条'),
    }),
  ]);
  for (const type of ['code', 'image'] as const)
    expect(
      parse([block(1, 'code', { type })], [edit(1, 'new')], 'vision').issues[0]
        .reason,
    ).toContain(type === 'code' ? '不能修改' : '图片需要完整');
});

it('permits image-verified formula and table corrections even with empty OCR text, and never clears their content', () => {
  const source = [
    block(1, '', { type: 'equation', latex: 'E=mc3' }),
    block(2, '', { type: 'table', html: '<table><tr><td>l</td></tr></table>' }),
  ];
  const edits = [
    edit(1, '', { latex: 'E=mc^2' }),
    edit(2, '', { html: '<table><tr><td>1</td></tr></table>' }),
  ];
  expect(parse(source, edits, 'vision').edits).toHaveLength(2);
  const structure = parse(source, edits);
  expect(structure.edits).toEqual([]);
  expect(structure.issues[0].reason).toContain('受保护');
  for (const row of [edit(1, '', { latex: '' }), edit(2, '', { html: null })]) {
    const result = parse(source, [row], 'vision');
    expect(result.edits).toEqual([]);
    expect(result.issues[0].reason).toContain('清空');
  }
  expect(
    parse([block(1, 'a long original sentence')], [edit(1, 'x')], 'vision')
      .issues,
  ).toHaveLength(1);
});

it('allows page-verified removal of spurious subscript tags without permitting large text deletions', () => {
  const source = [
    block(
      1,
      '<sub>w</sub>hil<sub>e no</sub>t <sub>converge</sub>d d<sub>o</sub>',
    ),
    block(
      2,
      'f<sub>or</sub> <sub>eac</sub>h $w _ { i }$ i<sub>n</sub> <sub>w</sub> d<sub>o</sub>',
    ),
    block(3, '<sup>A</sup> long original sentence that must not disappear.'),
  ];
  const result = parse(
    source,
    [
      edit(1, 'while not converged do'),
      edit(2, 'for each $w_i$ in $\\mathbf{w}$ do'),
      edit(3, 'A'),
    ],
    'vision',
  );
  expect(result.edits.map(e => e.seq)).toEqual([1, 2]);
  expect(result.issues).toEqual([
    expect.objectContaining({
      seq: 3,
      reason: expect.stringContaining('幅度过大'),
    }),
  ]);
  // Structure-only mode still cannot change non-whitespace source characters.
  expect(parse(source, [edit(1, 'while not converged do')]).edits).toEqual([]);
});

it('projects only selected applied suggestions, retaining source IDs, geometry, image assets and raw text', () => {
  const source = [block(1, '中\n文🙂'), block(2, 'two\nlines')];
  const run = {
    status: 'applied',
    document: { source, edits: ruleEdits(source), selected: [1] },
  } as RefinementRun;
  const projected = projectRefinement(source, run);
  expect(projected[0]).toMatchObject({
    id: 1,
    seq: 1,
    page: 1,
    x0: 10,
    y1: 600,
    text: '中文🙂',
    chars: 3,
    refinement: { originalText: '中\n文🙂' },
  });
  expect(projected[1]).toBe(source[1]);
  expect(source[0].text).toBe('中\n文🙂');
  expect(projectRefinement(source, { ...run, status: 'ready' })).toEqual(
    source,
  );
  expect(
    projectRefinement([block(1, '中\n文🙂', { x0: 11 }), source[1]], run)[0]
      .text,
  ).toBe('中\n文🙂');
});

it('marks refined sources and includes corrected LaTeX/HTML in AI context', () => {
  const refinement = {
    originalText: '',
    originalType: 'table' as const,
    reason: 'OCR',
    continuesFrom: null,
  };
  const formatted = formatBlocks([
    block(1, '', {
      type: 'table',
      html: '<table>corrected</table>',
      refinement,
    }),
    block(2, '', { type: 'equation', latex: 'x^2' }),
  ]);
  expect(formatted).toContain('source="ai_refined"');
  expect(formatted).toContain('&lt;table&gt;corrected&lt;/table&gt;');
  expect(formatted).toContain('x^2');
});

it('keeps fenced code intact when an importer classified it as prose', () => {
  const source = [block(1, '```python\nif x:\n  run()\n```')];
  expect(ruleEdits(source)).toEqual([]);
  expect(refinementChunks(source, 'vision')).toEqual([]);
  const result = parse(
    source,
    [edit(1, '```python if x: run() ```')],
    'vision',
  );
  expect(result.edits).toEqual([]);
  expect(result.issues[0].reason).toContain('代码');
});
