import TestRenderer, { act } from 'react-test-renderer';
import { createTestDemoContainer } from '@app/testing';
import type { Container } from '@app/container';
import { useContainer } from '@app/ContainerProvider';
import { useAppNav } from '@features/nav';
import { useReviewVM, useReviewSessionVM } from '@features/review/useReviewVM';
import { loadReview, rateReviewCard } from '@app/usecases/review';
import { presentReview } from '@features/review/presenters';
import { addCalendarDays, nextReview } from '@core/review';

jest.mock('@app/ContainerProvider', () => ({ useContainer: jest.fn() }));
jest.mock('@features/nav', () => ({ useAppNav: jest.fn() }));
let c: Container, renderer: TestRenderer.ReactTestRenderer | undefined;
const nav = {
  open: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  enterDemo: jest.fn(),
  exitDemo: jest.fn(),
};
beforeEach(async () => {
  c = await createTestDemoContainer();
  jest.mocked(useContainer).mockReturnValue(c);
  jest.mocked(useAppNav).mockReturnValue(nav);
  jest.clearAllMocks();
});
afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = undefined;
  await c.close();
});
async function mount<T>(hook: () => T) {
  let vm!: T;
  function Probe() {
    vm = hook();
    return null;
  }
  await act(async () => {
    renderer = TestRenderer.create(<Probe />);
    await new Promise(resolve => setImmediate(resolve));
  });
  return () => vm;
}

it('uses calendar dates through DST and applies Leitner promotions, retention and resets', () => {
  expect(addCalendarDays('2026-03-08', 1)).toBe('2026-03-09');
  expect(addCalendarDays('2026-11-01', 1)).toBe('2026-11-02');
  expect(nextReview(1, 'good', '2026-10-29')).toEqual({
    box: 2,
    days: 3,
    dueOn: '2026-11-01',
  });
  expect(nextReview(5, 'good', '2026-12-20')).toEqual({
    box: 5,
    days: 30,
    dueOn: '2027-01-19',
  });
  expect(nextReview(4, 'hard', '2026-10-29').box).toBe(4);
  expect(nextReview(4, 'again', '2026-10-29')).toEqual({
    box: 1,
    days: 1,
    dueOn: '2026-10-30',
  });
});
it('presents due count and source text and routes review or a stuck-point lesson', async () => {
  const current = await mount(useReviewVM);
  const data = await loadReview(c);
  expect(current().state.hero.total).toBe(data.stats.total);
  expect(current().state.start.label).toBe(
    `开始复习 ${current().state.hero.due} 张`,
  );
  current().intents.start();
  expect(nav.open).toHaveBeenLastCalledWith({ name: 'ReviewSession' });
  const stuck = data.stuck.find(s => !s.resolved_at)!;
  current().intents.reteach(String(stuck.id));
  expect(nav.open).toHaveBeenLastCalledWith(
    expect.objectContaining({
      name: 'Study',
      bookId: stuck.book_id,
      sectionId: stuck.section_id,
      stuckId: stuck.id,
    }),
  );
  await act(async () => {
    current().intents.markResolved(String(stuck.id));
    await new Promise(resolve => setImmediate(resolve));
  });
  expect(
    current().state.stuckList.find(s => s.id === String(stuck.id))?.resolved,
  ).toBe(true);
  await c.repos.settings.set('review.dailyLimit', 1);
  expect(presentReview(await loadReview(c)).hero.due).toBe(1);
});
it('requires a flip, prevents duplicate rating and completes the fixed due-card session', async () => {
  await c.repos.settings.set('review.dailyLimit', 1);
  const current = await mount(useReviewSessionVM);
  expect(current().state.card?.flipped).toBe(false);
  expect(current().state.rate).toBeNull();
  current().intents.rate('again');
  expect(await c.db.all('SELECT * FROM review_log')).toEqual([]);
  await act(async () => current().intents.flip());
  expect(current().state.rate?.map(r => r.label)).toEqual([
    '忘了',
    '模糊',
    '记得',
  ]);
  const text = current().state.card!.front;
  await act(async () => {
    current().intents.rate('again');
    current().intents.rate('again');
    await new Promise(resolve => setImmediate(resolve));
  });
  expect(current().state.finished).toEqual({
    title: '今天复习完了',
    text: '记得 0 · 模糊 0 · 忘了 1\n忘了的已加入卡点清单',
  });
  expect(await c.db.all('SELECT * FROM review_log')).toHaveLength(1);
  expect(
    (await c.repos.notes.stuck.list()).filter(s => s.text === text),
  ).toHaveLength(1);
  current().intents.done();
  expect(nav.open).toHaveBeenLastCalledWith({ name: 'Tabs', tab: 'Review' });
});
it('rolls back a rating if its stuck record cannot save, and deduplicates unresolved card text', async () => {
  const card = (await c.repos.cards.due(c.clock.today(), 1))[0];
  await c.db.run(
    "CREATE TRIGGER fail_stuck BEFORE INSERT ON stuck BEGIN SELECT RAISE(ABORT,'fixture full'); END",
  );
  await expect(rateReviewCard(c, card, 'again')).rejects.toThrow(
    'fixture full',
  );
  expect(await c.repos.cards.get(card.id)).toEqual(card);
  expect(await c.db.all('SELECT * FROM review_log')).toEqual([]);
  await c.db.run('DROP TRIGGER fail_stuck');
  await rateReviewCard(c, card, 'again');
  await rateReviewCard(c, card, 'again');
  expect(
    (
      await c.repos.notes.stuck.list(card.book_id, card.section_id, {
        resolved: false,
      })
    ).filter(s => s.text === card.front),
  ).toHaveLength(1);
});
