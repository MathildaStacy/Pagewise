import { createTestClock, systemClock } from '@app/clock';

test('clock uses caller time zone across midnight and follows a changed time zone', () => {
  const clock = createTestClock('2026-10-29T16:30:00.000Z');
  expect(clock.today('UTC')).toBe('2026-10-29');
  expect(clock.today('Asia/Shanghai')).toBe('2026-10-30');
  expect(clock.today('America/Los_Angeles')).toBe('2026-10-29');
  clock.advance(24 * 60 * 60 * 1000);
  expect(clock.today('Asia/Shanghai')).toBe('2026-10-31');
  clock.set('2026-11-01T08:30:00Z');
  expect(clock.today('America/Los_Angeles')).toBe('2026-11-01');
  expect(clock.now().toISOString()).toBe('2026-11-01T08:30:00.000Z');
});

test('test clock returns fresh Dates and rejects invalid test input', () => {
  const clock = createTestClock();
  clock.now().setUTCFullYear(1900);
  expect(clock.now().getUTCFullYear()).toBe(2026);
  expect(() => clock.set('invalid')).toThrow('有效时间');
  expect(() => clock.advance(Number.NaN)).toThrow('有限数字');
  expect(() => createTestClock('invalid')).toThrow('有效时间');
});

test('system clock supplies the current instant and local day', () => {
  const before = Date.now();
  expect(systemClock.now().getTime()).toBeGreaterThanOrEqual(before);
  expect(systemClock.today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
