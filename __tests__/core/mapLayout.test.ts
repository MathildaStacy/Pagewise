import { buildMap } from '@core/map';
import { figureLabel, marginNotes, tocPages } from '@core/layout';
import type { Block } from '@core/types';

// Geometry modelled on the real AIMA PDF: body at x=0.138, margin terms at x=0.217.
const BODY = 0.138,
  MARGIN = 0.217;
let next = 0;
const block = (
  page: number,
  type: Block['type'],
  text: string,
  over: Partial<Block> = {},
): Block => {
  const seq = page * 1000 + (++next % 1000);
  return {
    id: seq,
    book_id: 'book',
    seq,
    page,
    loc: null,
    type,
    level: type === 'title' ? 2 : null,
    text,
    latex: null,
    html: null,
    image_path: null,
    section_id: null,
    chars: Array.from(text).length,
    x0: BODY,
    y0: 0.1,
    x1: 0.86,
    y1: 0.2,
    ...over,
  };
};
const term = (page: number, text: string) =>
  block(page, 'title', text, { x0: MARGIN, x1: MARGIN + 0.12 });
// Long enough that the existing short-section merge (< 300 characters) stays out of the way.
const para = (page: number, words: string) =>
  block(
    page,
    'text',
    `${words} ${'and the body continues with more words. '.repeat(8)}`,
  );
beforeEach(() => {
  next = 0;
});
const units = (blocks: Block[]) =>
  buildMap(blocks).sections.filter(s => s.is_leaf && !s.merged_into);

it('detects contents pages even when lines end in link icons, and figure labels', () => {
  const icon = String.fromCharCode(0xe606);
  const contents = [
    '3.6 Heuristic Functions 97 ',
    'Summary 104 ',
    '4 Search in Complex Environments 110 ',
    '4.1 Local Search and Optimization Problems 110 ',
    '4.2 Local Search in Continuous Spaces 119 ',
    '5.1 Game Theory 146 ',
  ].map(t => block(18, 'text', t + icon));
  const body = [para(40, 'Search agents'), para(41, 'Game theory')];
  expect([...tocPages([...contents, ...body])]).toEqual([18]);
  expect(
    [
      'Figure 19.11 function DECISION-LIST',
      'Table A.1 Values',
      'function TT-ENTAILS?(KB, α)',
      '图 3.2 示意',
    ].map(figureLabel),
  ).toEqual([true, true, true, true]);
  expect(
    ['Table of Contents', 'Function approximation', 'Figures of speech'].map(
      figureLabel,
    ),
  ).toEqual([false, false, false]);
});

it('keeps contents lines from becoming sections or taking the real section IDs', () => {
  const blocks = [
    block(17, 'title', 'Contents', { x0: 0.076 }),
    block(
      17,
      'text',
      Array.from(
        { length: 12 },
        (_, i) => `${i + 1} Chapter title ${i * 40 + 1}`,
      ).join('\n'),
    ),
    ...[
      '5 Adversarial Search and Games 146',
      '5.1 Game Theory 146',
      '5.2 Optimal Decisions in Games 148',
      '5.3 Heuristic Alpha–Beta Tree Search 156',
      'Summary 170',
    ].map(t => block(18, 'text', t)),
    block(296, 'title', 'Chapter 5 Adversarial Search and Games', { level: 1 }),
    para(296, 'In which we explore environments'),
    block(297, 'title', '5.1 Game Theory'),
    para(297, 'Game theory studies'),
  ];
  const map = buildMap(blocks);
  expect(map.sections.find(s => s.id === '5.1')).toMatchObject({
    page_from: 296,
  });
  expect(map.sections.some(s => /_b\d+$/.test(s.id))).toBe(false);
  expect(map.sections.find(s => s.id === 'ch5')).toMatchObject({
    page_from: 296,
  });
  expect(map.sections.find(s => s.title === 'Contents')).toBeTruthy();
});

it('never starts a section at a margin glossary term, so numbered sections keep their text', () => {
  const blocks = [
    block(1381, 'title', 'Chapter 21 Deep Learning', { level: 1 }),
    block(1381, 'title', '21.1 Simple Feedforward Networks'),
    para(1381, 'A feedforward network has connections only in one direction'),
    term(1381, 'Feedforward network'),
    term(1381, 'Recurrent network'),
    para(1381, 'Boolean circuits are an example of a recurrent network'),
    block(1381, 'title', '21.1.1 Networks as complex functions'),
    term(1381, 'Unit'),
    para(1382, 'Each node within a network is called a unit'),
    term(1382, 'Activation function'),
    para(1382, 'where g is a nonlinear activation function'),
    block(1386, 'title', '21.1.2 Gradients and learning'),
    term(1386, 'Hidden layer'),
    para(1387, 'The hidden layer computes a weighted sum'),
    term(1387, 'Softmax'),
    para(1387, 'The softmax output normalises the scores'),
    block(1391, 'title', '21.2 Computation Graphs for Deep Learning'),
    para(1391, 'Computation graphs describe networks'),
  ];
  expect(marginNotes(blocks, { min: 5 }).size).toBe(6);
  const map = buildMap(blocks);
  expect(map.sections.filter(s => !s.no && s.level > 1)).toEqual([]);
  expect(map.sections.find(s => s.id === '21.2')?.parent_id).toBe('ch21');
  const gradients = map.sections.find(s => s.id === '21.1.2')!;
  expect(gradients.block_to).toBe(blocks.at(-3)!.seq);
  // One indented line in a book without margin notes is not trusted.
  expect(marginNotes(blocks.slice(0, 6), { min: 5 }).size).toBe(0);
  // A centred heading is not a margin term even when the body repeats it.
  expect(
    marginNotes([
      para(1, 'Opening words'),
      block(1, 'title', 'Summary', { x0: 0.45, x1: 0.55 }),
      para(1, 'In summary the search terminates'),
    ]).size,
  ).toBe(0);
});

it('nests unnumbered headings under the last numbered one and leaves deeper ones in their unit', () => {
  const blocks = [
    block(1, 'title', 'Chapter 21 Deep Learning', { level: 1 }),
    block(1, 'title', '21.7 Unsupervised Learning'),
    block(1, 'title', '21.7.1 Unsupervised learning'),
    para(1, 'Unsupervised learning finds structure'),
    block(2, 'title', 'Autoencoders', { level: 1 }),
    para(2, 'An autoencoder has an encoder and a decoder'),
    block(3, 'title', '21.7.2 Transfer learning'),
    para(3, 'Transfer learning reuses'),
    block(4, 'title', '21.8 Applications'),
    para(4, 'Deep learning has been applied'),
    block(4, 'title', 'Vision applications'),
    para(4, 'Vision applications include'),
    block(5, 'title', 'Summary'),
    para(5, 'This chapter has described'),
    block(6, 'title', 'Bibliographical and Historical Notes'),
    para(6, 'The literature on deep learning'),
    block(9, 'title', 'Bibliography'),
    para(9, 'Aarts, E. and Korst, J. Simulated annealing'),
  ];
  const byTitle = new Map(buildMap(blocks).sections.map(s => [s.title, s]));
  // `Autoencoders` would be level 4, so it stays inside 21.7.1 even though the parser said 1.
  expect(byTitle.has('Autoencoders')).toBe(false);
  expect(byTitle.get('Unsupervised learning')!.block_to).toBe(blocks[5].seq);
  expect(byTitle.get('Vision applications')).toMatchObject({
    level: 3,
    parent_id: '21.8',
  });
  expect(byTitle.get('Summary')).toMatchObject({ level: 2, parent_id: 'ch21' });
  expect(byTitle.get('Bibliographical and Historical Notes')).toMatchObject({
    level: 2,
    parent_id: 'ch21',
  });
  expect(byTitle.get('Bibliography')).toMatchObject({
    level: 1,
    parent_id: null,
  });
});

it('recognises appendix numbering, split chapter labels, and sentences typed as titles', () => {
  const blocks = [
    block(359, 'text', 'Chapter 6'),
    block(359, 'text', 'Constraint Satisfaction Problems'),
    para(359, 'In which we see how treating states'),
    block(360, 'title', '6.1 Defining Constraint Satisfaction Problems'),
    para(360, 'A constraint satisfaction problem'),
    block(
      363,
      'text',
      '6.1.2 Example problem: Job-shop scheduling with many machines',
    ),
    para(363, 'Factories have the problem'),
    block(
      400,
      'title',
      'Chapter 2 described several agent designs. The components include:',
    ),
    para(400, 'A direct mapping from conditions'),
    block(1863, 'title', 'Appendix A Mathematical Background'),
    block(1863, 'title', 'A.1 Complexity Analysis'),
    block(1863, 'title', 'A.1.1 Asymptotic analysis'),
    para(1863, 'We will consider the problem'),
    block(1869, 'title', 'A.2 Vectors, Matrices, and Linear Algebra'),
    para(1869, 'Mathematicians define a vector'),
  ];
  const map = buildMap(blocks);
  const ids = map.sections.map(s => s.id);
  expect(map.sections.find(s => s.id === 'ch6')).toMatchObject({
    title: 'Constraint Satisfaction Problems',
    level: 1,
  });
  expect(map.sections.find(s => s.id === '6.1.2')?.parent_id).toBe('6.1');
  expect(ids).not.toContain('ch2');
  expect(map.sections.find(s => s.id === 'A.1.1')?.parent_id).toBe('A.1');
  expect(map.sections.find(s => s.id === 'A.2')?.parent_id).toBe('appA');
});

it('gives a long chapter opening its own unit and starts each unit with its parents’ titles', () => {
  const long = [
    block(1378, 'title', 'Chapter 21 Deep Learning', { level: 1 }),
    para(1378, 'In which gradient descent learns multistep programs'),
    block(1378, 'text', 'Deep learning is '.repeat(100)),
    block(1381, 'title', '21.1 Simple Feedforward Networks'),
    para(1381, 'A feedforward network has connections'),
    block(1381, 'title', '21.1.1 Networks as complex functions'),
    para(1382, 'Each node is called a unit'),
  ];
  const map = buildMap(long);
  expect(map.sections.find(s => s.id === 'ch21-intro')).toMatchObject({
    title: '本章导读',
    parent_id: 'ch21',
    block_from: long[0].seq,
    block_to: long[2].seq,
    is_leaf: true,
  });
  // 21.1.1 opens with the 21.1 heading and its short lead-in, as in the printed book.
  expect(map.sections.find(s => s.id === '21.1.1')).toMatchObject({
    block_from: long[3].seq,
  });
  expect(units(long).map(u => u.id)).toEqual(['ch21-intro', '21.1.1']);
  // A short opening still joins the first unit, chapter title included.
  const short = [long[0], long[1], ...long.slice(3)];
  expect(buildMap(short).sections.some(s => s.id.endsWith('-intro'))).toBe(
    false,
  );
  expect(
    buildMap(short).sections.find(s => s.id === '21.1.1')?.block_from,
  ).toBe(long[0].seq);
});

it('keeps run-in subheadings that a chapter’s bookmarks skip inside their unit', () => {
  const blocks = [
    block(62, 'title', 'The Financial Data Universe', { level: 1 }),
    block(66, 'title', '2.1 Exchange data'),
    para(66, 'Exchanges publish several feeds'),
    block(66, 'title', 'Futures', { level: 2 }),
    para(66, 'Futures contracts trade on exchanges'),
    block(66, 'title', 'What you observe', { level: 2 }),
    para(66, 'You observe the order book'),
    block(67, 'title', 'Options', { level: 2 }),
    para(67, 'Options give the right'),
    block(67, 'title', 'What you observe', { level: 2 }),
    para(67, 'You observe the option chain'),
  ];
  const outline = [
    { title: 'The Financial Data Universe', page: 62, level: 1 },
    { title: '2.1 Exchange data', page: 66, level: 2 },
    { title: 'Futures', page: 66, level: 3 },
    { title: 'Options', page: 67, level: 3 },
  ];
  const map = buildMap(blocks, outline);
  expect(map.sections.filter(s => s.title === 'What you observe')).toEqual([]);
  expect(map.sections.find(s => s.title === 'Futures')).toMatchObject({
    level: 3,
    block_to: blocks[6].seq,
  });
  // Without bookmarks that deep, the subheadings stay sections.
  const shallow = buildMap(blocks, outline.slice(0, 2));
  expect(
    shallow.sections.filter(s => s.title === 'What you observe'),
  ).toHaveLength(2);
});
