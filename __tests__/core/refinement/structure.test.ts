import {
  numberedLevel,
  parseRefinement,
  projectRefinement,
  ruleEdits,
  type RefinementEdit,
  type RefinementRun,
} from '@core/refinement';
import type { Block } from '@core/types';
import { presentReaderItems } from '@features/study/presenters';
import type { StudyState as SessionState } from '@app/study/types';

// Geometry from the real AIMA 4th-edition PDF (612pt wide): body at x=89, margin terms at x=136.
const BODY = 89 / 612,
  MARGIN = 136 / 612;
let next = 0;
const block = (
  page: number,
  type: Block['type'],
  text: string,
  over: Partial<Block> = {},
): Block => {
  next++;
  return {
    id: next,
    book_id: 'aima',
    seq: next,
    page,
    loc: null,
    type,
    level: type === 'title' ? 2 : null,
    text,
    latex: null,
    html: null,
    image_path: null,
    section_id: '21',
    chars: Array.from(text).length,
    x0: BODY,
    y0: 0.1,
    x1: 0.85,
    y1: 0.2,
    ...over,
  };
};
const term = (page: number, text: string) =>
  block(page, 'title', text, { x0: MARGIN, x1: MARGIN + 0.15 });
const long = (s: string) =>
  `${s} ${'and more words that fill the line. '.repeat(3)}`;
const byText = (edits: RefinementEdit[], blocks: Block[], text: string) =>
  edits.find(e => e.seq === blocks.find(b => b.text.startsWith(text))!.seq);

function chapter21() {
  next = 0;
  return [
    block(1378, 'title', 'Chapter 21', { level: 1 }),
    block(1378, 'title', 'Deep Learning', { level: 1 }),
    block(
      1378,
      'text',
      long(
        'Deep learning is a broad family of techniques organized into many layers',
      ),
    ),
    term(1378, 'Deep learning'),
    term(1378, 'Layer'),
    block(
      1378,
      'text',
      long(
        'Deep learning has its origins in early work; such networks are called neural networks',
      ),
    ),
    term(1378, 'Neural network'),
    block(
      1379,
      'text',
      'The basic idea of deep learning is to train circuits such that the computation paths are long (Figure',
    ),
    block(1379, 'image', '', { image_path: 'f21-1.png' }),
    block(1379, 'caption', 'Figure 21.1 (a) A shallow model'),
    block(
      1380,
      'text',
      long(
        '21.1(c)). These circuit models turn out to be sufficiently expressive',
      ),
    ),
    block(1381, 'title', '21.1 Simple Feedforward Networks'),
    block(1381, 'title', '21.1.1 Networks as complex functions'),
    term(1381, 'Unit'),
    block(
      1382,
      'text',
      long(
        'Each node within a network is called a unit. A unit calculates the weighted sum',
      ),
    ),
  ];
}

it('derives heading levels from the book numbering, not the importer', () => {
  expect(
    [
      'Chapter 21',
      '第 3 章 搜索',
      '第二节 方法',
      '21.1 Simple Feedforward Networks',
      '21.1.1 Networks',
      'A.2 Proofs',
      'Deep Learning',
      '1.5 million users',
    ].map(numberedLevel),
  ).toEqual([1, 1, 2, 2, 3, 2, null, 2]);
});

it('repairs the AIMA chapter 21 layout without any AI call', () => {
  const blocks = chapter21();
  const edits = ruleEdits(blocks);
  for (const t of ['Deep learning', 'Layer', 'Neural network', 'Unit'])
    expect(
      edits.find(e => e.seq === blocks.find(b => b.text === t)!.seq),
    ).toMatchObject({ role: 'note', type: 'text', level: null });
  // `Chapter 21` + `Deep Learning` read as one chapter heading.
  expect(byText(edits, blocks, 'Deep Learning')).toMatchObject({
    continuesFrom: 1,
    level: 1,
  });
  expect(byText(edits, blocks, '21.1 Simple')).toBeUndefined();
  expect(byText(edits, blocks, '21.1.1')).toMatchObject({ level: 3 });
  // The sentence broken by Figure 21.1 and the page turn continues.
  expect(byText(edits, blocks, '21.1(c))')).toMatchObject({
    continuesFrom: blocks.find(b => b.text.startsWith('The basic idea'))!.seq,
  });
  // A paragraph that starts a new sentence on the next page is left alone.
  expect(byText(edits, blocks, 'Deep learning has')).toBeUndefined();
  expect(byText(edits, blocks, 'Each node')).toBeUndefined();
  // No suggestion changes wording.
  for (const e of edits)
    expect(e.text.replace(/\s/g, '')).toBe(
      blocks.find(b => b.seq === e.seq)!.text.replace(/\s/g, ''),
    );
});

it('does not demote section titles or body text that happens to repeat a term', () => {
  next = 0;
  const blocks = [
    block(1, 'title', 'Summary'),
    block(1, 'text', long('In summary, the search terminates')),
    block(1, 'text', long('Search is the process of looking for a sequence')),
    block(2, 'title', 'Search', { x0: BODY }),
    block(2, 'text', long('Search again begins here')),
  ];
  expect(ruleEdits(blocks).filter(e => e.role === 'note')).toEqual([]);
});

it('applies AI structure roles without letting the model rewrite text', () => {
  next = 0;
  const blocks = [
    block(
      1,
      'title',
      'Gradient descent Gradient descent is a general method for minimizing',
    ),
    block(1, 'title', 'Weight space'),
    block(
      1,
      'text',
      `${long('A body paragraph mentioning weight space')} so the`,
    ),
    block(2, 'text', 'which then continues on the next page.'),
  ];
  const chunk = { seqs: blocks.map(b => b.seq), context: [] };
  const result = parseRefinement(
    JSON.stringify({
      edits: [
        {
          seq: 1,
          role: 'runin',
          heading: 'Gradient descent',
          reason: '段首粗体小标题',
        },
        { seq: 2, role: 'note', reason: '页边术语' },
        { seq: 3, role: 'body', text: 'A rewritten paragraph', reason: '改字' },
        { seq: 4, role: 'continue', reason: '跨页' },
      ],
      issues: [],
    }),
    blocks,
    chunk,
    'structure',
  );
  expect(result.edits.find(e => e.seq === 1)).toMatchObject({
    type: 'text',
    heading: { length: 'Gradient descent'.length, level: 4 },
    text: blocks[0].text,
  });
  expect(result.edits.find(e => e.seq === 2)).toMatchObject({ role: 'note' });
  expect(result.edits.find(e => e.seq === 3)).toBeUndefined();
  expect(result.issues).toEqual([
    expect.objectContaining({
      seq: 3,
      reason: expect.stringContaining('原页复核'),
    }),
  ]);
  expect(result.edits.find(e => e.seq === 4)).toMatchObject({
    continuesFrom: 3,
  });

  const bad = parseRefinement(
    JSON.stringify({
      edits: [
        { seq: 1, role: 'runin', heading: 'Stochastic descent', reason: 'x' },
      ],
    }),
    blocks,
    chunk,
    'structure',
  );
  expect(bad.edits).toEqual([]);
  expect(bad.issues[0].reason).toContain('开头的原文');
});

it('does not join a new paragraph across a margin note just because OCR moved the period', () => {
  // AIMA p.1382: MinerU reads `unit j.` as `unit .j`, then `Activation function` sits in the margin.
  next = 0;
  const blocks = [
    block(
      1382,
      'text',
      `${long(
        'where g is a nonlinear activation function',
      )} the weighted sum of the inputs to unit .j`,
    ),
    term(1382, 'Activation function'),
    block(
      1382,
      'text',
      long(
        'As in Section 19.6.3 (page 679), we stipulate that each unit has an extra input',
      ),
    ),
    block(
      1382,
      'text',
      `${long(
        'The fact that the activation function is nonlinear is important',
      )} In other words,`,
    ),
    block(
      1383,
      'text',
      long('sufficiently large networks can implement a lookup table'),
    ),
  ];
  const base = ruleEdits(blocks);
  expect(base.find(e => e.seq === 2)).toMatchObject({ role: 'note' });
  const result = parseRefinement(
    JSON.stringify({
      edits: [
        { seq: 3, role: 'continue', reason: '被页边术语隔开' },
        { seq: 5, role: 'continue', reason: '跨页' },
      ],
    }),
    blocks,
    { seqs: blocks.map(b => b.seq), context: [] },
    'structure',
    base,
  );
  expect(result.edits.find(e => e.seq === 3)).toBeUndefined();
  expect(result.issues).toEqual([
    expect.objectContaining({
      seq: 3,
      reason: expect.stringContaining('新段落'),
    }),
  ]);
  // The real page-turn join stays (the rules already made it; the AI only agrees).
  expect(base.find(e => e.seq === 5)).toMatchObject({ continuesFrom: 4 });
  expect(result.reset).toEqual([]);
});

it('keeps rule suggestions the AI agrees with and resets the ones it rejects', () => {
  const blocks = chapter21();
  const base = ruleEdits(blocks);
  const unit = blocks.find(b => b.text === 'Unit')!;
  const layer = blocks.find(b => b.text === 'Layer')!;
  const result = parseRefinement(
    JSON.stringify({
      edits: [
        { seq: unit.seq, role: 'note', reason: '同意' },
        { seq: layer.seq, role: 'heading', level: 2, reason: '真的是标题' },
      ],
      issues: [],
    }),
    blocks,
    { seqs: blocks.map(b => b.seq), context: [] },
    'structure',
    base,
  );
  // Agreeing with `Unit` changes nothing; calling `Layer` a heading restores the parsed block.
  expect(result.edits).toEqual([]);
  expect(result.reset).toEqual([layer.seq]);
  const promoted = parseRefinement(
    JSON.stringify({
      edits: [{ seq: layer.seq, role: 'heading', level: 3, reason: '小节' }],
    }),
    blocks,
    { seqs: blocks.map(b => b.seq), context: [] },
    'structure',
    base,
  );
  expect(promoted.edits).toEqual([
    expect.objectContaining({
      seq: layer.seq,
      type: 'title',
      level: 3,
      role: null,
    }),
  ]);
});

const session = {
  plan: null,
  main: { step: 0 },
  sections: [],
  phase: 'ready',
  flashRef: undefined,
} as unknown as SessionState;
it('reads like the printed book once applied: one heading, joined paragraphs, muted margin terms', () => {
  const blocks = chapter21();
  const edits = ruleEdits(blocks);
  const run = {
    status: 'applied',
    document: { source: blocks, edits, selected: edits.map(e => e.seq) },
  } as unknown as RefinementRun;
  const highlightSeq = blocks.find(b => b.text.startsWith('21.1(c))'))!.seq;
  const items = presentReaderItems(
    projectRefinement(blocks, run),
    null,
    session,
    new Set([highlightSeq]),
    new Map(),
  ).flatMap(i => (i.kind === 'block' ? [i] : []));
  const flat = (node: unknown): string =>
    Array.isArray(node)
      ? node.map(flat).join('')
      : node && typeof node === 'object'
      ? 'v' in node
        ? String((node as { v: unknown }).v)
        : flat((node as { c?: unknown }).c ?? [])
      : '';
  const text = (i: (typeof items)[number]) => i.doc.map(flat).join('\n');
  const chapter = items[0];
  expect(chapter).toMatchObject({
    type: 'title',
    headingLevel: 1,
    joined: [2],
  });
  expect(text(chapter)).toContain('Chapter 21');
  expect(text(chapter)).toContain('Deep Learning');
  expect(items.filter(i => i.note).map(text)).toEqual([
    'Deep learning',
    'Layer',
    'Neural network',
    'Unit',
  ]);
  const paragraph = items.find(i => text(i).startsWith('The basic idea'))!;
  expect(paragraph.joined).toEqual([highlightSeq]);
  expect(paragraph.marks).toContain('highlight');
  expect(text(paragraph)).toContain('(Figure 21.1(c)). These circuit');
  expect(items.find(i => text(i).includes('21.1.1'))!.headingLevel).toBe(3);
  // Structure-only changes do not badge every block as AI-edited.
  expect(items.filter(i => i.refined)).toEqual([]);
});

it('hides e-book link icons in the reader while the source text keeps them', () => {
  next = 0;
  const icon = String.fromCharCode(0xe606);
  const blocks = [block(1, 'text', `see Chapter 22 ).${icon} The next`)];
  const [item] = presentReaderItems(
    blocks,
    null,
    session,
    new Set(),
    new Map(),
  ).flatMap(i => (i.kind === 'block' ? [i] : []));
  expect(JSON.stringify(item.doc)).not.toContain(icon);
  expect(blocks[0].text).toContain(icon);
});

it('badges only page-review edits that change visible wording', () => {
  next = 0;
  const icon = String.fromCharCode(0xe606);
  const blocks = [
    block(
      1384,
      'text',
      `These functions are shown in Figure 21.2 ${icon}. Notice`,
    ),
    block(1386, 'text', 'We will generally use to denote a weightW matrix'),
  ];
  const edit = (seq: number, text: string): RefinementEdit => ({
    seq,
    text,
    type: 'text',
    level: null,
    latex: null,
    html: null,
    continuesFrom: null,
    reason: '原页复核',
  });
  const edits = [
    edit(1, 'These functions are shown in Figure 21.2. Notice'),
    edit(2, 'We will generally use $\\mathbf{W}$ to denote a weight matrix'),
  ];
  const run = {
    status: 'applied',
    document: { source: blocks, edits, selected: [1, 2] },
  } as unknown as RefinementRun;
  const items = presentReaderItems(
    projectRefinement(blocks, run),
    null,
    session,
    new Set(),
    new Map(),
  ).flatMap(i => (i.kind === 'block' ? [i] : []));
  expect(items.map(i => i.refined)).toEqual([false, true]);
});

it('renders MinerU display formulas without their dollar delimiters', () => {
  next = 0;
  const blocks = [
    block(
      1382,
      'equation',
      '$$ a _ {j} = g _ {j} (\\mathbf {w} ^ {\\top} \\mathbf {x})\\tag{21.1} $$',
    ),
  ];
  const [item] = presentReaderItems(
    blocks,
    null,
    session,
    new Set(),
    new Map(),
  ).flatMap(i => (i.kind === 'block' ? [i] : []));
  expect(item.doc).toEqual([
    {
      t: 'math',
      tex: 'a _ {j} = g _ {j} (\\mathbf {w} ^ {\\top} \\mathbf {x})\\qquad\\text{(21.1)}',
    },
  ]);
});

it('splits a run-in heading from its paragraph in the reader', () => {
  next = 0;
  const blocks = [
    block(1, 'text', 'Gradient descent Gradient descent is a general method.'),
  ];
  const run = {
    status: 'applied',
    document: {
      source: blocks,
      edits: [
        {
          seq: 1,
          text: blocks[0].text,
          type: 'text',
          level: null,
          latex: null,
          html: null,
          continuesFrom: null,
          heading: { length: 16, level: 4 },
          role: null,
          reason: '段首小标题',
        },
      ],
      selected: [1],
    },
  } as unknown as RefinementRun;
  const [item] = presentReaderItems(
    projectRefinement(blocks, run),
    null,
    session,
    new Set(),
    new Map(),
  ).flatMap(i => (i.kind === 'block' ? [i] : []));
  expect(item.runIn).toEqual({ text: 'Gradient descent', level: 4 });
  expect(JSON.stringify(item.doc)).not.toContain('Gradient descent Gradient');
  expect(JSON.stringify(item.doc)).toContain('Gradient descent is a general');
});
