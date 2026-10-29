import type { LessonStep } from '@core/types';
import {
  fallbackLessonPlan,
  resolveLessonPlan,
  validateLessonPlan,
  type LessonBlock,
} from '@core/lesson';
const blocks = (count = 8): LessonBlock[] =>
  Array.from({ length: count }, (_, index) => ({
    seq: 1000 + index,
    type: 'text',
    text: '示意段落 ' + index,
    chars: 400,
  }));
const steps = (b: LessonBlock[]): LessonStep[] => [
  {
    no: 0,
    title: '先理解直觉',
    kind: 'intuition',
    block_from: b[0].seq,
    block_to: b[3].seq,
    status: 'done',
  },
  {
    no: 1,
    title: '再理解定义',
    kind: 'definition',
    block_from: b[4].seq,
    block_to: b[b.length - 1].seq,
    status: 'current',
  },
];
function expectCoherent(b: LessonBlock[], plan: LessonStep[]) {
  expect(validateLessonPlan(plan, b)).toMatchObject({
    valid: true,
    repaired: false,
  });
  expect(
    plan.flatMap(step =>
      b
        .filter(
          block => block.seq >= step.block_from && block.seq <= step.block_to,
        )
        .map(block => block.seq),
    ),
  ).toEqual([...b].sort((a, c) => a.seq - c.seq).map(block => block.seq));
  expect(
    plan.every((step, index) => step.no === index && step.title.length > 0),
  ).toBe(true);
}

it('returns a valid stored plan unchanged, retaining object identity and statuses', () => {
  const b = blocks(),
    p = steps(b);
  const validated = validateLessonPlan(p, b);
  expect(validated).toEqual({ valid: true, steps: p, repaired: false });
  expect(validated.steps).toBe(p);
  expect(validated.steps[0]).toBe(p[0]);
  expect(resolveLessonPlan(p, b)).toEqual({
    steps: p,
    source: 'model',
    repaired: false,
  });
});

it('normalizes JSON model steps to zero-based domain steps without mutating input', () => {
  const b = blocks();
  const model = {
    steps: [
      { title: '直觉', kind: 'intuition', from: 1000, to: 1003 },
      { title: '定义', kind: 'definition', from: 1004, to: 1007 },
    ],
  };
  expect(validateLessonPlan(JSON.stringify(model), b)).toEqual({
    valid: true,
    repaired: false,
    steps: [
      {
        no: 0,
        title: '直觉',
        kind: 'intuition',
        block_from: 1000,
        block_to: 1003,
        status: 'todo',
      },
      {
        no: 1,
        title: '定义',
        kind: 'definition',
        block_from: 1004,
        block_to: 1007,
        status: 'todo',
      },
    ],
  });
  expect(model.steps[0]).not.toHaveProperty('no');
});

it('treats actual reading-order blocks as adjacent when stable PDF seq crosses pages', () => {
  const b = blocks();
  b.slice(4).forEach(block => {
    block.seq += 995;
  });
  const p = steps(b);
  expect(p[1].block_from).not.toBe(p[0].block_to + 1);
  expect(validateLessonPlan(p, b).valid).toBe(true);
});

it.each(['equation', 'image', 'table', 'code'] as const)(
  'moves a cut after the entire %s group, retaining titles and statuses',
  type => {
    const b = blocks();
    b[4] = { ...b[4], type };
    b[5] = { ...b[5], type: 'caption' };
    const p = steps(b),
      saved = JSON.stringify(p);
    const result = validateLessonPlan(p, b);
    expect(result).toMatchObject({ valid: true, repaired: true });
    expect(result.steps[0]).toMatchObject({
      block_from: 1000,
      block_to: 1005,
      status: 'done',
      title: p[0].title,
    });
    expect(result.steps[1]).toMatchObject({
      block_from: 1006,
      block_to: 1007,
      status: 'current',
    });
    expect(JSON.stringify(p)).toBe(saved);
    expectCoherent(b, result.steps);
  },
);

it('moves a cut after an equation followed by its explanation paragraph', () => {
  const b = blocks();
  b[3].type = 'equation';
  const result = validateLessonPlan(steps(b), b);
  expect(result.steps[0].block_to).toBe(1004);
  expectCoherent(b, result.steps);
});

it.each([
  ['empty', () => []],
  ['too many', (p: LessonStep[]) => Array.from({ length: 6 }, () => p[0])],
  ['one when splittable', (p: LessonStep[]) => [{ ...p[0], block_to: 1007 }]],
  ['outside', (p: LessonStep[]) => [{ ...p[0], block_from: 999 }, p[1]]],
  ['unknown end', (p: LessonStep[]) => [{ ...p[0], block_to: 10000 }, p[1]]],
  [
    'reversed',
    (p: LessonStep[]) => [{ ...p[0], block_from: 1003, block_to: 1001 }, p[1]],
  ],
  ['missing first', (p: LessonStep[]) => [{ ...p[0], block_from: 1001 }, p[1]]],
  ['missing last', (p: LessonStep[]) => [p[0], { ...p[1], block_to: 1006 }]],
  ['overlapping', (p: LessonStep[]) => [p[0], { ...p[1], block_from: 1003 }]],
  ['gap', (p: LessonStep[]) => [p[0], { ...p[1], block_from: 1005 }]],
  ['empty title', (p: LessonStep[]) => [{ ...p[0], title: ' ' }, p[1]]],
  [
    'long title',
    (p: LessonStep[]) => [{ ...p[0], title: '字'.repeat(25) }, p[1]],
  ],
  ['wrong number', (p: LessonStep[]) => [{ ...p[0], no: 1 }, p[1]]],
  ['unknown kind', (p: LessonStep[]) => [{ ...p[0], kind: 'unknown' }, p[1]]],
  ['unknown status', (p: LessonStep[]) => [{ ...p[0], status: 'bad' }, p[1]]],
  ['null status', (p: LessonStep[]) => [{ ...p[0], status: null }, p[1]]],
  ['null step', () => [null]],
  [
    'fractional endpoint',
    (p: LessonStep[]) => [{ ...p[0], block_to: 1003.5 }, p[1]],
  ],
] as const)('uses a coherent fallback for %s model output', (_name, mutate) => {
  const b = blocks(),
    input = mutate(steps(b));
  const result = resolveLessonPlan(input, b);
  expect(result.source).toBe('fallback');
  expect(result.reason).toBeDefined();
  expectCoherent(b, result.steps);
});

it.each([null, {}, 42, 'invalid JSON', true, [{ title: 3 }], { steps: null }])(
  'rejects malformed model data %s',
  input => {
    const b = blocks();
    expect(resolveLessonPlan(input, b).source).toBe('fallback');
  },
);

it('falls back when moving two cuts would collapse a middle step', () => {
  const b = blocks();
  b[3].type = 'equation';
  const input = [
    { ...steps(b)[0], block_to: 1002 },
    { ...steps(b)[1], block_from: 1003, block_to: 1003 },
    { ...steps(b)[1], no: 2, block_from: 1004 },
  ];
  const result = resolveLessonPlan(input, b);
  expect(result).toMatchObject({
    source: 'fallback',
    reason: 'protected-group',
  });
  expectCoherent(b, result.steps);
});

it('uses one coherent step for an indivisible group or a single block and no invented references for empty input', () => {
  const b = blocks(3);
  b[1].type = 'equation';
  const p = fallbackLessonPlan(b);
  expect(p).toHaveLength(1);
  expectCoherent(b, p);
  const single = [{ ...b[0], text: '', chars: 0 }];
  expect(fallbackLessonPlan(single)[0].title).toBe('第 1 步');
  expectCoherent(single, fallbackLessonPlan(single));
  expect(fallbackLessonPlan([])).toEqual([]);
  expect(resolveLessonPlan({}, [])).toEqual({
    steps: [],
    source: 'fallback',
    repaired: false,
    reason: 'empty-blocks',
  });
});

it('uses safe title boundaries, caps long heading lists at five and derives titles from the first 16 characters', () => {
  const b = blocks(20);
  for (let i = 0; i < 20; i += 2) {
    b[i].type = 'title';
    b[i].text = '标题' + i + '字'.repeat(30);
  }
  const plan = fallbackLessonPlan(b);
  expect(plan).toHaveLength(5);
  expectCoherent(b, plan);
  expect(
    plan.every(
      step => b.find(block => block.seq === step.block_from)?.type === 'title',
    ),
  ).toBe(true);
  expect(plan[0].title).toHaveLength(16);
});

it('aligns headings inside protected groups and balances paragraphs when there are no usable headings', () => {
  const b = blocks();
  b[3].type = 'equation';
  b[4].type = 'title';
  const plan = fallbackLessonPlan(b);
  expect(plan[0].block_to).toBe(1004);
  expectCoherent(b, plan);
  const endGroup = blocks();
  endGroup[7].type = 'equation';
  endGroup[7].text = '尾公式';
  endGroup[7].chars = 20;
  endGroup[6].type = 'title';
  expectCoherent(endGroup, fallbackLessonPlan(endGroup));
});

it('balances without cutting a group and handles empty text, unicode titles and skewed lengths', () => {
  const b = blocks(10);
  b[3].type = 'image';
  b[4].type = 'caption';
  b[0].text = '😀'.repeat(30);
  b[0].chars = 0;
  b[8].chars = 9000;
  const plan = fallbackLessonPlan(b);
  expect(plan.length).toBeLessThanOrEqual(5);
  expect(Array.from(plan[0].title)).toHaveLength(16);
  expectCoherent(b, plan);
  expect(
    validateLessonPlan(
      [{ ...plan[0], title: '😀'.repeat(24) }, ...plan.slice(1)],
      b,
    ).valid,
  ).toBe(true);
});

it('orders a copied block list and refuses duplicate or invalid seq values', () => {
  const b = blocks();
  const reversed = [...b].reverse();
  expectCoherent(b, fallbackLessonPlan(reversed));
  expect(reversed[0].seq).toBe(1007);
  expect(validateLessonPlan([], [{ ...b[0], seq: -1 }]).reason).toBe(
    'invalid-blocks',
  );
  expect(fallbackLessonPlan([b[0], b[0]])).toEqual([]);
});
