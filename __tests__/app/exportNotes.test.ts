import { createTestDemoContainer } from '@app/testing';
import type { Container } from '@app/container';
import { loadBookNotes } from '@app/usecases/notes';
import {
  markdownNotes,
  ankiCsv,
  exportFileName,
  exportNotes,
} from '@app/usecases/exportNotes';
import { configureStorageRuntime } from '@app/usecases/storage';
import type { Card } from '@core/types';
import type { StorageIO } from '@services/backup';
let c: Container;
beforeEach(async () => {
  c = await createTestDemoContainer();
});
afterEach(async () => {
  await c.close();
});
it('exports a chapter/section Markdown tree containing summary, QA, detours, stuck, highlights, pins and personal notes', async () => {
  await c.repos.notes.userText.set('aima', '3.5.2', '我的笔记');
  await c.repos.sections.update('aima', '3.5.2', { summary: '本节小结' });
  await c.repos.notes.qa.add({
    book_id: 'aima',
    section_id: '3.5.2',
    q: '问题',
    a: '回答',
    message_ids: [],
    created_at: c.clock.now().toISOString(),
  });
  await c.repos.notes.stuck.add({
    book_id: 'aima',
    section_id: '3.5.2',
    text: '卡点',
    source: 'user',
    created_at: c.clock.now().toISOString(),
  });
  const data = await loadBookNotes(c, 'aima'),
    files = markdownNotes(data, true);
  expect(files[0].path).toBe('README.md');
  const section = files.find(file => file.path.includes('3.5.2-'))!;
  expect(section.path).toMatch(/^课程讲义\/第03章-/);
  for (const heading of [
    '# 3.5.2',
    '## 问答',
    '## 卡点',
    '## 高亮',
    '## 问答便签',
    '## 我的笔记',
  ])
    expect(section.content).toContain(heading);
  expect(section.content).toContain('我的笔记');
  expect(section.content).toContain('p.');
  const full = markdownNotes(data, false).find(
    file => file.path === section.path,
  )!;
  expect(full.content.length).toBeGreaterThan(section.content.length);
  expect(data.blocks.every(block => block.text.length > 0)).toBe(true);
});
it('escapes CSV fields for Anki, preserves multiline cards with HTML and supplies book/section tags', () => {
  const card = {
    front: 'A, "B"\nC',
    back: 'D\nE',
    section_id: '3.5.2',
  } as Card;
  const csv = ankiCsv('A book', [card]);
  expect(csv).toContain('#separator:comma\r\n#html:true');
  expect(csv).toContain('"A, ""B""<br>C","D<br>E","A_book::3.5.2"');
  expect(exportFileName('../bad/name:')).toBe('_bad_name_');
});
it.each([null, '', '  '])(
  'uses the chapter title when its number is %p instead of inventing a number from global heading order',
  async no => {
    await c.repos.notes.userText.set('aima', '3.5.2', '我的笔记');
    const data = await loadBookNotes(c, 'aima');
    let chapter = data.sections.find(section => section.id === '3.5.2')!;
    while (chapter.parent_id)
      chapter = data.sections.find(
        section => section.id === chapter.parent_id,
      )!;
    chapter.no = no;
    chapter.ord = 135;
    chapter.title = 'Market Microstructure';
    const files = markdownNotes(data),
      exported = files.find(file => file.path.includes('3.5.2-'))!;
    expect(exported.path).toBe(
      '课程讲义/Market Microstructure/3.5.2-A_搜索.md',
    );
    expect(files[0].content).toContain(encodeURI(exported.path));
    expect(files.some(file => file.path.includes('第136章'))).toBe(false);
  },
);
it('writes the selected format through the registered IO and saves to Downloads', async () => {
  const writeText = jest.fn(async () => {}),
    saveDownloads = jest.fn(async () => '/downloads/cards.csv');
  const io = {
    cacheDir: '/cache',
    mkdir: jest.fn(async () => {}),
    writeText,
    saveDownloads,
    remove: jest.fn(async () => {}),
    zip: jest.fn(async () => {}),
  } as unknown as StorageIO;
  configureStorageRuntime(c, io);
  expect(await exportNotes(c, 'aima', 'anki')).toBe('/downloads/cards.csv');
  expect(writeText.mock.calls.length).toBe(1);
  expect(saveDownloads).toHaveBeenCalledWith(
    expect.any(String),
    expect.stringContaining('闪卡.csv'),
    'text/csv',
  );
  await exportNotes(c, 'aima', 'md');
  expect(io.zip).toHaveBeenCalledTimes(1);
  expect(writeText.mock.calls.length).toBeGreaterThan(2);
});
