import type { Card, CardBox, CardRating } from '../types';

export const BOX_DAYS = [1, 3, 7, 15, 30] as const;
/** Calendar arithmetic avoids DST changing the scheduled local date. */
export function addCalendarDays(today: string, days: number): string {
  const [year, month, day] = today.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}
export function nextReview(box: CardBox, rating: CardRating, today: string) {
  const nextBox: CardBox =
    rating === 'again'
      ? 1
      : rating === 'hard'
      ? box
      : (Math.min(5, box + 1) as CardBox);
  const days = BOX_DAYS[nextBox - 1];
  return { box: nextBox, days, dueOn: addCalendarDays(today, days) };
}
export function newCardSchedule(today: string) {
  return {
    box: 1 as const,
    days: BOX_DAYS[0],
    dueOn: addCalendarDays(today, BOX_DAYS[0]),
  };
}
/** Pure counterpart of Clock.today(): callers supply both instant and device timezone. */
export function reviewDate(instant: Date | string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(part => part.type === type)!.value;
  return value('year') + '-' + value('month') + '-' + value('day');
}
/** Deferred cards keep their due_on, so tomorrow's <= today query still includes overdue cards. */
export function selectDueCards<T extends Pick<Card, 'id' | 'due_on'>>(
  cards: readonly T[],
  today: string,
  dailyLimit = 30,
): { due: T[]; deferred: T[] } {
  const limit = Number.isFinite(dailyLimit)
    ? Math.max(0, Math.trunc(dailyLimit))
    : 30;
  const eligible = cards
    .filter(card => card.due_on <= today)
    .sort((a, b) => a.due_on.localeCompare(b.due_on) || a.id - b.id);
  return { due: eligible.slice(0, limit), deferred: eligible.slice(limit) };
}
