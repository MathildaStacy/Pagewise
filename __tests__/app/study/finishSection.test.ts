import { createTestDemoContainer } from '@app/testing';
import type { Container } from '@app/container';
import { finishSection } from '@app/study/finishSection';
import { executeReadTool, parseToolArgs } from '@app/study/toolExec';
let c: Container;
beforeEach(async () => {
  c = await createTestDemoContainer();
});
afterEach(async () => {
  await c.close();
});
const input = {
  bookId: 'aima',
  sectionId: '3.5.2',
  summary: '本节小结',
  draftId: 'draft-id',
  stuck: [{ text: '需要复习的一点', checked: true }],
  cards: [{ front: '问题', back: '答案', checked: true }],
};
it('saves a draft once, deduplicates unresolved stuck points and schedules selected review material', async () => {
  const before = (await c.repos.cards.stats()).total;
  const next = await finishSection(c, input);
  await finishSection(c, input);
  expect((await c.repos.cards.stats()).total).toBe(before + 1);
  expect(
    (await c.repos.notes.stuck.list('aima', '3.5.2')).filter(
      item => item.text === input.stuck[0].text,
    ),
  ).toHaveLength(1);
  expect((await c.repos.study.get('aima'))?.main_section).toBe(
    next?.id ?? null,
  );
  const card = await c.db.get<{ box: number; due_on: string }>(
    'SELECT box,due_on FROM card WHERE front=?',
    ['问题'],
  );
  expect(card).toEqual({ box: 1, due_on: '2026-10-30' });
});
it('rolls back summary, notes, cards and pointer when one write fails', async () => {
  const beforeSection = await c.repos.sections.get('aima', '3.5.2'),
    beforeStudy = await c.repos.study.get('aima'),
    beforeCards = (await c.repos.cards.stats()).total;
  await c.db.run(
    "CREATE TRIGGER fail_test_card BEFORE INSERT ON card BEGIN SELECT RAISE(ABORT,'injected failure'); END",
  );
  await expect(finishSection(c, input)).rejects.toThrow('injected failure');
  expect(await c.repos.sections.get('aima', '3.5.2')).toEqual(beforeSection);
  expect(await c.repos.study.get('aima')).toEqual(beforeStudy);
  expect((await c.repos.cards.stats()).total).toBe(beforeCards);
  expect(
    (await c.repos.notes.stuck.list('aima')).some(
      item => item.text === input.stuck[0].text,
    ),
  ).toBe(false);
});
it('executes source searches, figures and notes from the actual repositories with allowed block refs', async () => {
  const search = await executeReadTool(c, 'aima', 'search_book', {
    query: '搜索',
  });
  expect(search.allowedRefs.length).toBeGreaterThan(0);
  expect(search.allowedRefs).toEqual(search.blocks.map(block => block.seq));
  const image = (await c.repos.blocks.bySection('aima', '3.5.2')).find(
    block => block.type === 'image',
  )!;
  const figure = await executeReadTool(c, 'aima', 'get_figure', {
    id: `b${image.seq}`,
  });
  expect(figure.allowedRefs).toEqual([image.seq]);
  expect(figure.output).toContain(`b${image.seq}`);
  const notes = await executeReadTool(c, 'aima', 'get_notes', {
    section_id: '3.5.2',
  });
  expect(JSON.parse(notes.output)).toHaveProperty('qa');
  const missing = await executeReadTool(c, 'aima', 'load_section', {
    id: '3.5.99',
  });
  expect(JSON.parse(missing.output).nearest).toHaveLength(3);
  expect(() => parseToolArgs('[]')).toThrow();
  expect(() => parseToolArgs('{')).toThrow();
});
