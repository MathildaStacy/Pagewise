import TestRenderer, { act } from 'react-test-renderer';
import { createTestDemoContainer } from '@app/testing';
import type { Container } from '@app/container';
import { useContainer } from '@app/ContainerProvider';
import { useAppNav } from '@features/nav';
import { useReviewVM, useReviewSessionVM } from '@features/review/useReviewVM';
import {
  editReviewCard,
  loadReview,
  loadReviewCards,
  rateReviewCard,
  setReviewCardSuspended,
} from '@app/usecases/review';
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
const settle = () => new Promise(resolve => setImmediate(resolve));
it('starts a five-card group while retaining the normal start and existing daily limit', async () => {
  const current = await mount(useReviewVM);
  expect(current().state.quickStart).toEqual({
    enabled: true,
    label: '先复习 5 张',
  });
  current().intents.startQuick!();
  expect(nav.open).toHaveBeenLastCalledWith({
    name: 'ReviewSession',
    limit: 5,
  });
  expect((await loadReviewCards(c, 5)).cards).toHaveLength(5);
  expect(await c.repos.settings.get('review.dailyLimit', 30)).toBe(30);
  await c.repos.settings.set('review.dailyLimit', 3);
  expect((await loadReviewCards(c, 5)).cards).toHaveLength(3);
  expect(presentReview(await loadReview(c)).quickStart?.label).toBe(
    '先复习 3 张',
  );
  await c.repos.settings.set('review.dailyLimit', 0);
  expect((await loadReviewCards(c, 5)).cards).toHaveLength(0);
  expect(presentReview(await loadReview(c)).quickStart?.enabled).toBe(false);
});
it('completes exactly five ratings, presents group progress, and leaves other due cards for later', async () => {
  const before = await c.repos.cards.due(c.clock.today(), 100);
  const current = await mount(() => useReviewSessionVM(5));
  for (let index = 0; index < 5; index++) {
    expect(current().state.title).toBe(`复习 ${index + 1}/5`);
    expect(current().state.card?.front).toBe(before[index].front);
    await act(async () => current().intents.flip());
    await act(async () => {
      current().intents.rate('good');
      await settle();
    });
  }
  expect(current().state.finished).toEqual({
    title: '这组复习完成了',
    text: '记得 5 · 模糊 0 · 忘了 0',
  });
  expect(await c.db.all('SELECT * FROM review_log')).toHaveLength(5);
  expect(
    (await c.repos.cards.due(c.clock.today(), 100)).map(card => card.id),
  ).toEqual(before.slice(5).map(card => card.id));
});
it('edits the current card without losing its place, blocks rating during editing, and requires a fresh flip', async () => {
  const cards = (await loadReviewCards(c, 3)).cards;
  const current = await mount(() => useReviewSessionVM(3));
  await act(async () => current().intents.flip());
  await act(async () => current().intents.editCard!());
  expect(current().state.editor).toMatchObject({
    front: cards[0].front,
    back: cards[0].back,
  });
  await act(async () => {
    current().intents.editor!.setFront('修订后的问题');
    current().intents.editor!.setBack('修订后的答案');
    current().intents.rate('again');
    current().intents.suspendCard!();
    current().intents.editor!.save();
    current().intents.editor!.save();
    await settle();
  });
  expect(current().state.title).toBe('复习 1/3');
  expect(current().state.card).toMatchObject({
    front: '修订后的问题',
    flipped: false,
  });
  expect(current().state.rate).toBeNull();
  expect(current().state.editor).toBeUndefined();
  expect(await c.db.all('SELECT * FROM review_log')).toEqual([]);
  expect(await c.repos.cards.get(cards[0].id)).toMatchObject({
    back: '修订后的答案',
    box: cards[0].box,
    due_on: cards[0].due_on,
  });
  await act(async () => current().intents.rate('good'));
  expect(await c.db.all('SELECT * FROM review_log')).toEqual([]);
  await act(async () => current().intents.flip());
  await act(async () => {
    current().intents.rate('good');
    await settle();
  });
  expect(current().state.title).toBe('复习 2/3');
  expect(current().state.card?.front).toBe(cards[1].front);
  expect(await c.db.all('SELECT * FROM review_log')).toHaveLength(1);
});
it('retains a failed edit draft and current card, then saves after retry', async () => {
  const cards = (await loadReviewCards(c, 2)).cards;
  const current = await mount(() => useReviewSessionVM(2));
  await act(async () => current().intents.editCard!());
  await act(async () => {
    current().intents.editor!.setFront('');
    current().intents.editor!.save();
  });
  expect(current().state.editor?.error).toBe('问题和答案都需要填写');
  const edit = jest
    .spyOn(c.repos.cards, 'edit')
    .mockRejectedValueOnce(new Error('fixture write failed'));
  await act(async () => {
    current().intents.editor!.setFront('修订草稿');
    current().intents.editor!.save();
    await settle();
  });
  expect(current().state.editor).toMatchObject({
    front: '修订草稿',
    saving: false,
    error: '保存失败，请重试。修改内容已保留。',
  });
  expect(current().state.card?.front).toBe(cards[0].front);
  await act(async () => {
    current().intents.editor!.save();
    await settle();
  });
  expect(current().state.card?.front).toBe('修订草稿');
  expect(current().state.title).toBe('复习 1/2');
  expect(await c.db.all('SELECT * FROM review_log')).toEqual([]);
  edit.mockRestore();
});
it('pauses the current card without rating, undoes even after another rating, and never skips the next card', async () => {
  const cards = (await loadReviewCards(c, 3)).cards;
  const current = await mount(() => useReviewSessionVM(3));
  await act(async () => {
    current().intents.suspendCard!();
    current().intents.suspendCard!();
    await settle();
  });
  expect((await c.repos.cards.get(cards[0].id))?.suspended).toBe(true);
  expect(current().state.title).toBe('复习 1/2');
  expect(current().state.card?.front).toBe(cards[1].front);
  expect(await c.db.all('SELECT * FROM review_log')).toEqual([]);
  await act(async () => current().intents.flip());
  await act(async () => {
    current().intents.rate('hard');
    await settle();
  });
  expect(current().state.card?.front).toBe(cards[2].front);
  await act(async () => {
    current().intents.undoSuspend!();
    await settle();
  });
  expect(current().state.title).toBe('复习 2/3');
  expect(current().state.card?.front).toBe(cards[0].front);
  expect(current().state.card?.flipped).toBe(false);
  expect(current().state.notice).toBeUndefined();
  expect((await c.repos.cards.get(cards[0].id))?.suspended).toBe(false);
  for (const expected of [cards[0], cards[2]]) {
    expect(current().state.card?.front).toBe(expected.front);
    await act(async () => current().intents.flip());
    await act(async () => {
      current().intents.rate('good');
      await settle();
    });
  }
  expect(current().state.finished?.text).toBe('记得 2 · 模糊 1 · 忘了 0');
  expect(
    (await c.db.all<{ card_id: number }>('SELECT card_id FROM review_log')).map(
      row => row.card_id,
    ),
  ).toEqual([cards[1].id, cards[0].id, cards[2].id]);
});
it('keeps a paused last card recoverable from the completion state', async () => {
  const card = (await loadReviewCards(c, 1)).cards[0];
  const current = await mount(() => useReviewSessionVM(1));
  await act(async () => {
    current().intents.suspendCard!();
    await settle();
  });
  expect(current().state.finished?.text).toContain('已暂停 1 张');
  expect(current().state.notice).toContain('已暂停这张卡');
  expect((await c.repos.cards.stats(c.clock.today())).total).toBe(
    (await c.repos.cards.list()).length - 1,
  );
  await act(async () => {
    current().intents.undoSuspend!();
    await settle();
  });
  expect(current().state.finished).toBeNull();
  expect(current().state.title).toBe('复习 1/1');
  expect(current().state.card?.front).toBe(card.front);
});
it('finds and restores paused cards through management, including when no active cards remain', async () => {
  const all = await c.repos.cards.list();
  await c.db.run('UPDATE card SET suspended = 1');
  const current = await mount(useReviewVM);
  expect(current().state.hero.total).toBe(0);
  expect(current().state.start.enabled).toBe(false);
  await act(async () => {
    current().intents.management!.open();
    await settle();
  });
  expect(current().state.management?.total).toBe(all.length);
  await act(async () => current().intents.management!.setFilter('suspended'));
  expect(current().state.management?.cards).toHaveLength(all.length);
  const id = String(all[0].id);
  await act(async () => {
    current().intents.management!.toggleSuspended(id);
    await settle();
  });
  expect(current().state.management?.cards).toHaveLength(all.length - 1);
  expect(current().state.hero.total).toBe(1);
  await act(async () => current().intents.management!.setFilter('all'));
  expect(
    current().state.management?.cards.find(card => card.id === id)?.suspended,
  ).toBe(false);
  await act(async () => current().intents.management!.edit(id));
  await act(async () => {
    current().intents.management!.editor.setBack('管理入口修订的答案');
    current().intents.management!.editor.save();
    await settle();
  });
  expect(
    current().state.management?.cards.find(card => card.id === id)?.back,
  ).toBe('管理入口修订的答案');
  expect(await c.db.all('SELECT * FROM review_log')).toEqual([]);
});
it('rejects stale or paused session answers, and retry refreshes only the current card', async () => {
  const cards = (await loadReviewCards(c, 3)).cards;
  const current = await mount(() => useReviewSessionVM(3));
  await act(async () => current().intents.flip());
  await act(async () => {
    current().intents.rate('good');
    await settle();
  });
  await editReviewCard(c, cards[1].id, {
    front: '其它入口修订',
    back: '修订答案',
  });
  await act(async () => current().intents.flip());
  await act(async () => {
    current().intents.rate('again');
    await settle();
  });
  expect(current().state.error).toContain('闪卡已更新');
  expect(await c.db.all('SELECT * FROM review_log')).toHaveLength(1);
  await act(async () => {
    current().intents.retry();
    await settle();
  });
  expect(current().state.title).toBe('复习 2/3');
  expect(current().state.card).toMatchObject({
    front: '其它入口修订',
    flipped: false,
  });
  await setReviewCardSuspended(c, cards[1].id, true);
  await act(async () => current().intents.flip());
  await act(async () => {
    current().intents.rate('good');
    await settle();
  });
  expect(current().state.error).toContain('已暂停');
  await act(async () => {
    current().intents.retry();
    await settle();
  });
  expect(current().state.card?.front).toBe(cards[2].front);
  expect(current().state.title).toBe('复习 2/2');
  expect(await c.db.all('SELECT * FROM review_log')).toHaveLength(1);
});
