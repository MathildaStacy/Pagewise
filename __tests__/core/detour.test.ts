import {
  activeSection,
  reduce,
  reduceDetour,
  type DetourState,
} from '@core/detour';

const initial: DetourState = { main: '3.5.2', stack: [] };
it('enters, nests and refuses a third detour without moving the main pointer', () => {
  const first = reduce(initial, {
    t: 'load',
    sectionId: '3.4.2',
    detourId: 11,
  });
  expect(first.next).toEqual({
    main: '3.5.2',
    stack: [{ sectionId: '3.4.2', detourId: 11 }],
  });
  expect(first.effects).toEqual(['startDetour']);
  expect(first.operations).toEqual([
    {
      t: 'startDetour',
      frame: { sectionId: '3.4.2', detourId: 11 },
      fromSection: '3.5.2',
      depth: 1,
      pendingId: false,
    },
  ]);
  const second = reduce(first.next, {
    t: 'load',
    sectionId: '3.3.1',
    detourId: 12,
  });
  expect(second.next.main).toBe(initial.main);
  expect(activeSection(second.next)).toBe('3.3.1');
  expect(second.operations[0]).toMatchObject({
    fromSection: '3.4.2',
    depth: 2,
  });
  const third = reduce(second.next, {
    t: 'load',
    sectionId: '2.1',
    detourId: 13,
  });
  expect(third.next).toBe(second.next);
  expect(third.effects).toEqual(['askReturnFirst']);
  expect(third.operations[0]).toMatchObject({
    message: '已在第 2 层岔路，先请用户决定是否回主线',
  });
  expect(initial).toEqual({ main: '3.5.2', stack: [] });
});
it('treats loads of the main or current section as no-ops even at maximum depth', () => {
  expect(reduce(initial, { t: 'load', sectionId: initial.main })).toEqual({
    next: initial,
    effects: ['none'],
    operations: [],
  });
  const state: DetourState = {
    main: '3.5.2',
    stack: [
      { sectionId: '3.4.2', detourId: 11 },
      { sectionId: '3.3.1', detourId: 12 },
    ],
  };
  for (const sectionId of ['3.5.2', '3.3.1'])
    expect(reduce(state, { t: 'load', sectionId }).effects).toEqual(['none']);
  expect(reduce(state, { t: 'load', sectionId: '3.4.2' }).effects).toEqual([
    'askReturnFirst',
  ]);
});
it('returns straight to the main and closes every frame in stack order', () => {
  const state: DetourState = {
    main: '3.5.2',
    stack: [
      { sectionId: '3.4.2', detourId: 11 },
      { sectionId: '3.3.1', detourId: 12 },
    ],
  };
  const back = reduce(state, { t: 'back' });
  expect(back.next).toEqual(initial);
  expect(back.effects).toEqual(['endDetour', 'endDetour']);
  expect(back.operations).toEqual([
    { t: 'endDetour', frame: state.stack[1] },
    { t: 'endDetour', frame: state.stack[0] },
  ]);
  expect(activeSection(back.next)).toBe('3.5.2');
  expect(state.stack).toHaveLength(2);
});
it('rebases to the top detour after ending both frames, and ignores back/rebase on the main', () => {
  const state: DetourState = {
    main: '3.5.2',
    stack: [
      { sectionId: '3.4.2', detourId: 11 },
      { sectionId: '3.3.1', detourId: 12 },
    ],
  };
  const rebased = reduceDetour(state, { t: 'rebase' });
  expect(rebased.next).toEqual({ main: '3.3.1', stack: [] });
  expect(rebased.effects).toEqual(['endDetour', 'endDetour', 'changeMain']);
  expect(rebased.operations.at(-1)).toEqual({
    t: 'changeMain',
    fromSection: '3.5.2',
    toSection: '3.3.1',
  });
  for (const t of ['back', 'rebase'] as const)
    expect(reduce(initial, { t }).effects).toEqual(['none']);
});
it('retains stuck IDs for review detours, including a review of the main section', () => {
  const reviewed = reduce(initial, {
    t: 'review',
    sectionId: '3.5.2',
    stuckId: 7,
    detourId: 25,
  });
  expect(reviewed.next.stack[0]).toEqual({
    sectionId: '3.5.2',
    detourId: 25,
    reviewStuckId: 7,
  });
  expect(
    reduce(reviewed.next, { t: 'review', sectionId: '3.5.2', stuckId: 7 })
      .effects,
  ).toEqual(['none']);
  expect(
    reduce(reviewed.next, { t: 'review', sectionId: '3.4.2', stuckId: 8 }).next
      .stack[1],
  ).toEqual({ sectionId: '3.4.2', detourId: 0, reviewStuckId: 8 });
  expect(
    reduce(initial, { t: 'load', sectionId: '3.4.2' }).operations[0],
  ).toMatchObject({ pendingId: true });
});
