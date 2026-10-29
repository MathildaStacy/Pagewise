import type { CardBox, CardRating } from '@core/types';
import {
  addCalendarDays,
  BOX_DAYS,
  newCardSchedule,
  nextReview,
  reviewDate,
  selectDueCards,
} from '@core/review';

it('starts a new card in box one tomorrow', () => {
  expect(newCardSchedule('2026-12-31')).toEqual({
    box: 1,
    days: 1,
    dueOn: '2027-01-01',
  });
});
it.each([1, 2, 3, 4, 5] as CardBox[])(
  'promotes, retains and resets box %i within its bounds',
  box => {
    expect(nextReview(box, 'again', '2026-10-29')).toEqual({
      box: 1,
      days: 1,
      dueOn: '2026-10-30',
    });
    expect(nextReview(box, 'hard', '2026-10-29')).toEqual({
      box,
      days: BOX_DAYS[box - 1],
      dueOn: addCalendarDays('2026-10-29', BOX_DAYS[box - 1]),
    });
    const promoted = Math.min(5, box + 1) as CardBox;
    expect(nextReview(box, 'good', '2026-10-29')).toEqual({
      box: promoted,
      days: BOX_DAYS[promoted - 1],
      dueOn: addCalendarDays('2026-10-29', BOX_DAYS[promoted - 1]),
    });
  },
);
it.each([
  ['2026-03-07', 1, '2026-03-08'],
  ['2026-03-08', 1, '2026-03-09'],
  ['2026-11-01', 1, '2026-11-02'],
  ['2028-02-28', 1, '2028-02-29'],
  ['2028-02-29', 1, '2028-03-01'],
  ['2027-02-28', 1, '2027-03-01'],
  ['2026-12-31', 1, '2027-01-01'],
  ['2026-01-01', -1, '2025-12-31'],
])(
  'adds local calendar days from %s through DST, leap days and year boundaries',
  (day, days, expected) => {
    expect(addCalendarDays(day, days)).toBe(expected);
  },
);
it('uses the device date at midnight, independent of the UTC timestamp day', () => {
  expect(reviewDate('2026-10-29T03:59:59Z', 'America/New_York')).toBe(
    '2026-10-28',
  );
  expect(reviewDate('2026-10-29T04:00:00Z', 'America/New_York')).toBe(
    '2026-10-29',
  );
  const before = nextReview(
    1,
    'hard',
    reviewDate('2026-10-29T03:59:59Z', 'America/New_York'),
  );
  const after = nextReview(
    1,
    'hard',
    reviewDate(new Date('2026-10-29T04:00:00Z'), 'America/New_York'),
  );
  expect(before.dueOn).toBe('2026-10-29');
  expect(after.dueOn).toBe('2026-10-30');
});
it.each([
  ['2026-03-08T06:59:59Z', '2026-03-08'],
  ['2026-03-08T07:00:00Z', '2026-03-08'],
  ['2026-11-01T05:59:59Z', '2026-11-01'],
  ['2026-11-01T06:00:00Z', '2026-11-01'],
])('keeps calendar scheduling on a DST transition at %s', (instant, today) => {
  expect(reviewDate(instant, 'America/New_York')).toBe(today);
  expect(
    nextReview(1, 'hard', reviewDate(instant, 'America/New_York')).dueOn,
  ).toBe(addCalendarDays(today, 1));
});
it('switches from UTC+8 to UTC using the local date while keeping persisted due dates unchanged', () => {
  const instant = '2026-10-28T18:00:00Z';
  expect(reviewDate(instant, 'Asia/Shanghai')).toBe('2026-10-29');
  expect(reviewDate(instant, 'UTC')).toBe('2026-10-28');
  const cards = [{ id: 1, due_on: '2026-10-29' }];
  expect(
    selectDueCards(cards, reviewDate(instant, 'Asia/Shanghai')).due,
  ).toEqual(cards);
  expect(selectDueCards(cards, reviewDate(instant, 'UTC')).due).toEqual([]);
  expect(cards[0].due_on).toBe('2026-10-29');
});
it('takes overdue cards by date and id, deferring overflow without losing their original due dates', () => {
  const cards = [
    { id: 4, due_on: '2026-10-30' },
    { id: 2, due_on: '2026-10-28' },
    { id: 1, due_on: '2026-10-28' },
    { id: 3, due_on: '2026-10-29' },
  ];
  const saved = JSON.stringify(cards);
  const result = selectDueCards(cards, '2026-10-29', 2);
  expect(result.due.map(card => card.id)).toEqual([1, 2]);
  expect(result.deferred.map(card => card.id)).toEqual([3]);
  expect(
    selectDueCards([...result.deferred, cards[0]], '2026-10-30', 2).due.map(
      card => card.id,
    ),
  ).toEqual([3, 4]);
  expect(JSON.stringify(cards)).toBe(saved);
});
it('defaults to thirty cards and honors zero, fractional and invalid configured limits', () => {
  const cards = Array.from({ length: 35 }, (_, id) => ({
    id,
    due_on: '2026-10-29',
  }));
  expect(selectDueCards(cards, '2026-10-29').due).toHaveLength(30);
  expect(selectDueCards(cards, '2026-10-29').deferred).toHaveLength(5);
  expect(selectDueCards(cards, '2026-10-29', 0).due).toEqual([]);
  expect(selectDueCards(cards, '2026-10-29', -1).deferred).toHaveLength(35);
  expect(selectDueCards(cards, '2026-10-29', 2.9).due).toHaveLength(2);
  expect(selectDueCards(cards, '2026-10-29', NaN).due).toHaveLength(30);
  expect(selectDueCards([], '2026-10-29').due).toEqual([]);
});
it.each(['again', 'hard', 'good'] as CardRating[])(
  'does not mutate an input card on rating %s',
  rating => {
    const card = Object.freeze({ box: 3 as CardBox, due_on: '2026-10-28' });
    nextReview(card.box, rating, '2026-10-29');
    expect(card).toEqual({ box: 3, due_on: '2026-10-28' });
  },
);
