export interface Clock {
  now(): Date;
  today(timeZone?: string): string;
}

function dateInZone(date: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(value => value.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export const systemClock: Clock = {
  now: () => new Date(),
  today: timeZone => dateInZone(new Date(), timeZone),
};

export interface TestClock extends Clock {
  set(value: string | Date): void;
  advance(milliseconds: number): void;
}

export function createTestClock(
  initial: string | Date = '2026-10-29T00:00:00.000Z',
): TestClock {
  let instant = new Date(initial).getTime();
  const set = (value: string | Date) => {
    const next = new Date(value).getTime();
    if (!Number.isFinite(next)) {
      throw new Error('测试时钟需要有效时间');
    }
    instant = next;
  };
  set(initial);
  return {
    now: () => new Date(instant),
    today: timeZone => dateInZone(new Date(instant), timeZone),
    set,
    advance(milliseconds) {
      if (!Number.isFinite(milliseconds)) {
        throw new Error('时间增量需要是有限数字');
      }
      instant += milliseconds;
    },
  };
}
