import { createTestContainer, createTestDemoContainer } from '@app/testing';
import { createTestClock } from '@app/clock';
import {
  answerShelf,
  loadHome,
  recordLearningTime,
  saveShelfAnswer,
  searchShelf,
} from '@app/usecases/home';

it('counts only recorded foreground time, persists concurrent intervals, and uses the daily goal for streaks', async () => {
  const c = await createTestContainer({
    clock: createTestClock('2026-10-29T12:00:00Z'),
  });
  try {
    await recordLearningTime(c, 1200, '2026-10-28');
    await Promise.all([recordLearningTime(c, 900), recordLearningTime(c, 360)]);
    const home = await loadHome(c);
    expect(home.stats).toMatchObject({ today: 21, streak: 2, best: 2 });
    expect(home.stats.month[28]).toBe(21);
    expect(home.stats.week.reduce((a, b) => a + b, 0)).toBe(41);
    expect(home.shelf).toEqual([]);
  } finally {
    await c.close();
  }
});

it('keeps prototype learning metrics confined to the demo database', async () => {
  const demo = await createTestDemoContainer(),
    live = await createTestContainer();
  try {
    expect((await loadHome(demo)).stats).toMatchObject({
      streak: 6,
      best: 14,
      today: 12,
      week: [25, 18, 32, 12, 0, 0, 0],
    });
    await recordLearningTime(demo, 20000);
    expect(await demo.repos.settings.get('learning.seconds', {})).toEqual({});
    expect((await loadHome(live)).stats.today).toBe(0);
  } finally {
    await Promise.all([demo.close(), live.close()]);
  }
});

it('searches parsed text within the chosen book and saves a cross-book answer to its source section', async () => {
  const c = await createTestDemoContainer();
  try {
    const hits = await searchShelf(c, 'A* 和 Dijkstra 是什么关系？', 'all');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every(h => h.bookId === 'aima' && h.text.length > 0)).toBe(
      true,
    );
    expect(await searchShelf(c, 'A*', 'slm')).toEqual([]);
    const first = hits[0];
    const previous = await c.repos.notes.qa.list(first.bookId, first.sectionId);
    await saveShelfAnswer(c, '问题', '带页码的回答', first);
    const saved = await c.repos.notes.qa.list(first.bookId, first.sectionId);
    expect(saved).toHaveLength(previous.length + 1);
    expect(saved.at(-1)).toMatchObject({
      q: '问题',
      a: '带页码的回答',
      section_id: first.sectionId,
    });
  } finally {
    await c.close();
  }
});

it('answers an empty search without calling the AI gateway', async () => {
  const c = await createTestContainer();
  const stream = jest.spyOn(c.ai, 'stream'),
    text = jest.fn();
  try {
    await answerShelf(
      c,
      '不存在的内容',
      [],
      new AbortController().signal,
      text,
    );
    expect(stream).not.toHaveBeenCalled();
    expect(text).toHaveBeenCalledWith(
      '在你书架上的书里没有找到直接相关的内容。',
    );
  } finally {
    await c.close();
  }
});
