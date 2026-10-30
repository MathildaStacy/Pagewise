import type { Container } from '@app/container';
import { createTestDemoContainer } from '@app/testing';
import { searchNotes } from '@app/usecases/noteSearch';
import { loadNoteConversation } from '@app/usecases/noteConversation';
import { createMessagesRepo } from '@data/repos/messages';

let c: Container;
beforeEach(async () => {
  c = await createTestDemoContainer();
});
afterEach(async () => {
  await c.close();
});
const sectionId = '3.5.2';
async function addQa(q: string, messageIds: number[] = []) {
  return c.repos.notes.qa.add({
    book_id: 'aima',
    section_id: sectionId,
    q,
    a: '保留的简短结论',
    message_ids: messageIds,
    created_at: c.clock.now().toISOString(),
  });
}

it('searches all learning record kinds with literal SQL-safe terms and bounded excerpts', async () => {
  const term = "100%_O'Reilly";
  await c.repos.sections.update('aima', sectionId, {
    summary: `${'很长的前文'.repeat(1000)}${term} 摘要结论`,
  });
  await addQa(`${term} 为什么？`);
  await c.repos.notes.userText.set('aima', sectionId, `${term} 我的理解`);
  await c.repos.notes.stuck.add({
    book_id: 'aima',
    section_id: sectionId,
    text: `${term} 尚未理解`,
    source: 'user',
    created_at: c.clock.now().toISOString(),
  });
  const all = jest.spyOn(c.db, 'all');
  const result = await searchNotes(c, term);
  expect(new Set(result.hits.map(hit => hit.kind))).toEqual(
    new Set(['summary', 'qa', 'user', 'stuck']),
  );
  expect(
    result.hits.every(
      hit =>
        hit.book_id === 'aima' &&
        hit.section_id === sectionId &&
        hit.excerpt.includes(term) &&
        hit.excerpt.length <= 180,
    ),
  ).toBe(true);
  expect(all).toHaveBeenCalledTimes(1);
  expect(all.mock.calls[0][1]).toEqual([term, term, 41]);
  expect((await searchNotes(c, "' OR 1=1 --")).hits).toEqual([]);
  all.mockClear();
  expect(await searchNotes(c, '   ')).toEqual({ hits: [], hasMore: false });
  expect(all).not.toHaveBeenCalled();
});

it('limits results in SQLite, exposes truncation, and locates identical section IDs in different books', async () => {
  const sourceBook = (await c.repos.books.get('aima'))!;
  await c.repos.books.insert({
    ...sourceBook,
    id: 'other',
    sha256: 'other',
    title: '另一本文献',
  });
  const section = (await c.repos.sections.get('aima', sectionId))!;
  await c.repos.sections.replaceAll('other', [
    { ...section, book_id: 'other', summary: '限量关键词，另一书的摘要' },
  ]);
  expect((await searchNotes(c, '限量关键词')).hits).toContainEqual(
    expect.objectContaining({
      book_id: 'other',
      book_title: '另一本文献',
      section_id: sectionId,
    }),
  );
  for (let index = 0; index < 65; index++) await addQa(`限量关键词 ${index}`);
  const result = await searchNotes(c, '限量关键词');
  expect(result.hits).toHaveLength(40);
  expect(result.hasMore).toBe(true);
  const clamped = await searchNotes(c, '限量关键词', 1000);
  expect(clamped.hits).toHaveLength(60);
  expect(clamped.hasMore).toBe(true);
  expect(await searchNotes(c, '限量关键词', 0)).toEqual({
    hits: [],
    hasMore: false,
  });
});

it('loads the exact full conversation even when its messages are older than the current 200-message window', async () => {
  const block = (await c.repos.blocks.bySection('aima', sectionId))[0];
  const user = await c.repos.messages.append({
    book_id: 'aima',
    section_id: sectionId,
    kind: 'user',
    content: '为什么 $f(n)$ 这样定义？',
    created_at: c.clock.now().toISOString(),
  });
  const answer = await c.repos.messages.append({
    book_id: 'aima',
    section_id: sectionId,
    kind: 'assistant',
    content: `完整推导 $$f(n)=g(n)+h(n)$$ [[b:${block.seq}]]`,
    allowed_refs: [block.seq],
    created_at: c.clock.now().toISOString(),
  });
  const qa = await addQa('旧问答', [answer.id, user.id]);
  await c.db.transaction(async tx => {
    const messages = createMessagesRepo(tx);
    for (let index = 0; index < 205; index++)
      await messages.append({
        book_id: 'aima',
        section_id: sectionId,
        kind: 'assistant',
        content: `后续讲解 ${index}`,
        created_at: c.clock.now().toISOString(),
      });
  });
  expect(
    (await c.repos.messages.thread('aima', sectionId)).some(
      item => item.id === answer.id,
    ),
  ).toBe(false);
  const complete = jest.spyOn(c.ai, 'complete');
  const result = await loadNoteConversation(c, 'aima', sectionId, qa.id);
  expect(result.messages.map(item => item.id)).toEqual([user.id, answer.id]);
  expect(result.messages[1]).toMatchObject({
    content: answer.content,
    allowedRefs: [block.seq],
  });
  expect(result.blocks.map(item => item.seq)).toEqual([block.seq]);
  expect(result.missing).toBe(false);
  expect(complete).not.toHaveBeenCalled();
});

it('keeps QA and messages scoped to the owning book and reports unavailable linked content', async () => {
  const sourceBook = (await c.repos.books.get('aima'))!;
  await c.repos.books.insert({
    ...sourceBook,
    id: 'foreign',
    sha256: 'foreign',
    title: '另一本书',
  });
  const foreign = await c.repos.messages.append({
    book_id: 'foreign',
    section_id: sectionId,
    kind: 'assistant',
    content: '其他书里的私人对话',
    created_at: c.clock.now().toISOString(),
  });
  const qa = await addQa('有缺失的对话', [foreign.id, 999999]);
  const result = await loadNoteConversation(c, 'aima', sectionId, qa.id);
  expect(result.messages).toEqual([]);
  expect(result.missing).toBe(true);
  await expect(
    loadNoteConversation(c, 'foreign', sectionId, qa.id),
  ).rejects.toThrow('找不到这条问答');
  await expect(loadNoteConversation(c, 'aima', '3.4.2', qa.id)).rejects.toThrow(
    '找不到这条问答',
  );
});
