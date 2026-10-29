import { runEpubReparseSmoke } from '@app/dev/reparseSmoke';
import type { Container } from '@app/container';
import { createTestContainer } from '@app/testing';
import {
  configureImportRuntime,
  type ImportRuntime,
} from '@app/usecases/importRuntime';
import { configureStorageRuntime } from '@app/usecases/storage';
import type { BlockInsert, Section } from '@core/types';
import type { StorageIO } from '@services/backup';

let c: Container;
let runtime: ImportRuntime;
let io: StorageIO;
let paths: Set<string>;
let reports: Map<string, string>;
const directory = '/docs/books/epub';
const reportPath = '/cache/epub-reparse-smoke.json';
const privateText =
  'Synthetic private source body used only in this test fixture.'.repeat(4);
const privateKey = 'sk-private-reparse-test-secret';
const savedGuide = JSON.stringify({
  one_line: 'Existing private guide.',
  full: 'Existing private guide details.',
});
function fixture() {
  const blocks: BlockInsert[] = Array.from({ length: 5 }, (_, index) => ({
    book_id: 'epub',
    seq: index + 1,
    page: null,
    loc: `chapter · ${index + 1}`,
    section_id: 'chapter',
    type: index === 4 ? 'image' : 'text',
    text: index === 4 ? '' : `${index + 1} ${privateText}`,
    chars: index === 4 ? 0 : privateText.length + 2,
    image_path: index === 4 ? 'images/fixture.png' : null,
  }));
  const section: Section = {
    book_id: 'epub',
    id: 'chapter',
    parent_id: null,
    level: 1,
    ord: 0,
    no: '1',
    title: 'Synthetic chapter',
    is_leaf: true,
    block_from: 1,
    block_to: 5,
    page_from: null,
    page_to: null,
    chars: 1000,
    parts: 1,
    status: 'new',
    summary: null,
    guide: null,
    source: 'auto',
    flag: null,
    flag_detail: null,
    merged_into: null,
  };
  return {
    blocks,
    sections: [section],
    parts: [
      {
        book_id: 'epub',
        section_id: 'chapter',
        part_no: 0,
        block_from: 1,
        block_to: 5,
        name: 'Synthetic part',
      },
    ],
  };
}
async function seed() {
  for (const format of ['epub', 'pdf'] as const)
    await c.repos.books.insert({
      id: format,
      sha256: `real-${format}-sha`,
      title: `Synthetic ${format}`,
      format,
      pages: format === 'epub' ? null : 10,
      size_bytes: 1000,
      status: 'ready',
      cover_color: '#3B4F7A',
      created_at: c.clock.now().toISOString(),
    });
  const data = fixture();
  await c.repos.sections.replaceAll('epub', data.sections);
  await c.repos.sections.update('epub', 'chapter', {
    status: 'learning',
    guide: savedGuide,
    summary: 'Existing private summary.',
  });
  await c.repos.sections.setParts('epub', 'chapter', data.parts);
  await c.repos.blocks.insertMany(
    'epub',
    data.blocks.map(({ book_id: _bookId, ...block }) => block),
  );
  const message = await c.repos.messages.append({
    book_id: 'epub',
    section_id: 'chapter',
    kind: 'assistant',
    content: 'Existing private answer. [[b:1]]',
    quote_seq: 1,
    allowed_refs: [1],
    created_at: c.clock.now().toISOString(),
  });
  await c.repos.notes.userText.set(
    'epub',
    'chapter',
    'Existing private user note.',
  );
  await c.repos.notes.highlights.toggle({
    book_id: 'epub',
    block_seq: 1,
    note: 'Existing private block note.',
    created_at: c.clock.now().toISOString(),
  });
  await c.repos.notes.pins.add({
    book_id: 'epub',
    section_id: 'chapter',
    block_seq: 1,
    question: 'Existing private question.',
    answer_summary: 'Existing private pin.',
    message_ids: [message.id],
    created_at: c.clock.now().toISOString(),
  });
  await c.repos.cards.addMany([
    {
      book_id: 'epub',
      section_id: 'chapter',
      front: 'Existing private card front.',
      back: 'Existing private card back.',
      origin: 'manual',
      due_on: c.clock.today(),
      created_at: c.clock.now().toISOString(),
    },
  ]);
  await c.repos.notes.qa.add({
    book_id: 'epub',
    section_id: 'chapter',
    q: 'Existing private QA question.',
    a: 'Existing private QA answer.',
    message_ids: [message.id],
    created_at: c.clock.now().toISOString(),
  });
  await c.repos.notes.stuck.add({
    book_id: 'epub',
    section_id: 'chapter',
    text: 'Existing private stuck point.',
    source: 'user',
    created_at: c.clock.now().toISOString(),
  });
}
beforeEach(async () => {
  c = await createTestContainer();
  paths = new Set([
    `${directory}/source.epub`,
    `${directory}/images/fixture.png`,
    '/docs/books/pdf/source.pdf',
  ]);
  reports = new Map();
  runtime = {
    files: {
      cacheDir: '/cache',
      documentDir: '/docs',
      exists: jest.fn(async path => paths.has(path)),
      mkdir: jest.fn(async () => {}),
      move: jest.fn(async () => {}),
      copy: jest.fn(async () => {}),
      remove: jest.fn(async path => {
        for (const file of paths)
          if (file === path || file.startsWith(`${path}/`)) paths.delete(file);
      }),
      sha256: jest.fn(),
      copyFromUri: jest.fn(),
    },
    chooseFile: jest.fn(),
    pdf: {
      info: jest.fn(),
      textLayer: jest.fn(),
      outline: jest.fn(),
      pageLabels: jest.fn(),
      split: jest.fn(),
      close: jest.fn(),
    },
    mineru: {
      requestUpload: jest.fn(),
      upload: jest.fn(),
      query: jest.fn(),
      download: jest.fn(),
      test: jest.fn(),
    },
    adapt: jest.fn(),
    epub: {
      inspect: jest.fn(),
      parse: jest.fn(async () => {
        paths.add(`${directory}/images/fixture.png`);
        return fixture();
      }),
    },
  };
  configureImportRuntime(c, runtime);
  io = {
    ...runtime.files,
    readText: jest.fn(async path => reports.get(path) ?? ''),
    writeText: jest.fn(async (path, text) => {
      reports.set(path, text);
    }),
    dirSize: jest.fn(async () => 0),
    zip: jest.fn(),
    unzip: jest.fn(),
    pickBackup: jest.fn(),
    share: jest.fn(),
    saveDownloads: jest.fn(),
    openSnapshot: jest.fn(async () => c.db),
    replaceDatabase: jest.fn(),
    restart: jest.fn(),
  };
  configureStorageRuntime(c, io);
  await seed();
});
afterEach(async () => {
  await c.close();
});

it('runs production clear and local EPUB reparse while retaining annotations, guide, messages, notes and cards', async () => {
  const pdf = await c.repos.books.get('pdf');
  const messages = await c.repos.messages.thread('epub', 'chapter');
  const report = await runEpubReparseSmoke(c);
  const expectedCounts = {
    messages: 1,
    guides: 1,
    summaries: 1,
    userNotes: 1,
    highlights: 2,
    pins: 2,
    cards: 2,
    qa: 1,
    stuck: 1,
  };
  expect(report).toMatchObject({
    status: 'passed',
    stage: 'complete',
    errors: [],
    sections: 1,
    blocksBefore: 5,
    blocksAfterClear: 0,
    blocksAfterReparse: 5,
    preservedBlocks: 5,
    images: 1,
    resolvedImages: 1,
    before: expectedCounts,
    afterClear: expectedCounts,
    afterReparse: expectedCounts,
    retainedAfterClear: true,
    retainedAfterReparse: true,
  });
  expect(runtime.epub?.parse).toHaveBeenCalledWith(
    `${directory}/source.epub`,
    directory,
    'epub',
  );
  expect(runtime.files.remove).toHaveBeenCalledWith(`${directory}/images`);
  expect(await c.repos.books.get('pdf')).toEqual(pdf);
  expect(runtime.pdf.info).not.toHaveBeenCalled();
  expect(runtime.files.copyFromUri).not.toHaveBeenCalled();
  expect(runtime.mineru.requestUpload).not.toHaveBeenCalled();
  expect(await c.repos.messages.thread('epub', 'chapter')).toEqual(messages);
  expect((await c.repos.sections.get('epub', 'chapter'))?.guide).toBe(
    savedGuide,
  );
  expect(await c.repos.notes.highlights.list('epub')).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        block_seq: 1,
        note: 'Existing private block note.',
      }),
      expect.objectContaining({
        block_seq: 2,
        note: expect.stringContaining('[Pagewise EPUB reparse acceptance]'),
      }),
    ]),
  );
  expect(
    (await c.repos.notes.userText.get('epub', 'chapter'))?.user_text,
  ).toContain('Existing private user note.');
  expect(JSON.parse(reports.get(reportPath)!)).toEqual(report);
  expect(reports.get(reportPath)).not.toContain(privateText);
  expect(reports.get(reportPath)).not.toContain('Existing private');
  expect(reports.get(reportPath)).not.toContain(directory);
});

it('coalesces simultaneous runs and does not duplicate acceptance records on another run', async () => {
  const first = runEpubReparseSmoke(c);
  expect(runEpubReparseSmoke(c)).toBe(first);
  const original = await first;
  expect(original.status).toBe('passed');
  const second = await runEpubReparseSmoke(c);
  expect(second.status).toBe('passed');
  expect(second.before).toEqual(original.before);
  expect(second.afterReparse).toEqual(original.afterReparse);
  expect(runtime.epub?.parse).toHaveBeenCalledTimes(2);
  const note = (await c.repos.notes.userText.get('epub', 'chapter'))!.user_text;
  expect(note.match(/\[Pagewise EPUB reparse acceptance\]/g)).toHaveLength(1);
});

it('preserves existing citations, allow lists, raw response and verification state for an unchanged empty-alt EPUB image', async () => {
  const [message] = await c.repos.messages.thread('epub', 'chapter');
  const saved = await c.repos.messages.update(message.id, {
    content: 'Existing text and image answer. [[b:1]] [[fig:5]]',
    parts: [{ t: 'text', text: 'Existing image answer. [[b:5]]' }],
    raw: { protocol: 'chat', model: 'test', items: [] },
    allowed_refs: [1, 2, 3, 4, 5],
    unverified: 3,
  });
  const report = await runEpubReparseSmoke(c);
  expect(report.status).toBe('passed');
  expect(report.changesAfterClear).toEqual([]);
  expect(report.changesAfterReparse).toEqual([]);
  expect((await c.repos.messages.thread('epub', 'chapter'))[0]).toEqual(saved);
});

it.each(['image_path', 'loc'] as const)(
  'does not retain an empty-alt image reference if its %s changed',
  async field => {
    const [message] = await c.repos.messages.thread('epub', 'chapter');
    await c.repos.messages.update(message.id, {
      content: 'Existing image answer. [[fig:5]]',
      allowed_refs: [5],
      unverified: 0,
    });
    jest.mocked(runtime.epub!.parse).mockImplementationOnce(async () => {
      paths.add(`${directory}/images/fixture.png`);
      const data = fixture();
      data.blocks[4][field] =
        field === 'loc' ? 'another location' : 'images/another.png';
      return data;
    });
    const report = await runEpubReparseSmoke(c);
    expect(report.errors).toEqual([
      { stage: 'verify', code: 'blocks-changed' },
    ]);
    expect((await c.repos.messages.thread('epub', 'chapter'))[0]).toMatchObject(
      {
        content: 'Existing image answer. 〔原文位置已变化〕',
        allowed_refs: [],
        unverified: 1,
      },
    );
  },
);

it('rejects any unfinished PDF before seeding, clearing or waking the shared queue', async () => {
  await c.repos.parts.upsert({
    book_id: 'pdf',
    part_no: 1,
    page_from: 1,
    page_to: 10,
    stage: 'queued',
    updated_at: c.clock.now().toISOString(),
  });
  const report = await runEpubReparseSmoke(c);
  expect(report.errors).toEqual([
    { stage: 'prepare', code: 'pdf-queue-active' },
  ]);
  expect(await c.repos.notes.highlights.list('epub')).toHaveLength(1);
  expect(runtime.files.remove).not.toHaveBeenCalled();
  expect(runtime.epub?.parse).not.toHaveBeenCalled();
  expect(runtime.mineru.requestUpload).not.toHaveBeenCalled();
});

it.each(['original', 'guide', 'messages'])(
  'requires existing %s before clearing the EPUB',
  async missing => {
    if (missing === 'original') paths.delete(`${directory}/source.epub`);
    if (missing === 'guide')
      await c.repos.sections.update('epub', 'chapter', { guide: null });
    if (missing === 'messages')
      await c.db.run("DELETE FROM message WHERE book_id='epub'");
    const report = await runEpubReparseSmoke(c);
    expect(report.status).toBe('failed');
    expect(report.errors[0].code).toBe(
      missing === 'original' ? 'original-required' : 'study-records-required',
    );
    expect(runtime.files.remove).not.toHaveBeenCalled();
    expect(runtime.epub?.parse).not.toHaveBeenCalled();
  },
);

it('reports changed block locations after reparse without exposing block content', async () => {
  jest.mocked(runtime.epub!.parse).mockImplementationOnce(async () => {
    paths.add(`${directory}/images/fixture.png`);
    const data = fixture();
    data.blocks[0].loc = `changed ${privateText}`;
    return data;
  });
  const report = await runEpubReparseSmoke(c);
  expect(report.errors).toEqual([{ stage: 'verify', code: 'blocks-changed' }]);
  expect(reports.get(reportPath)).not.toContain(privateText);
});

it('detects an altered card even when the retained record counts match', async () => {
  jest.mocked(runtime.epub!.parse).mockImplementationOnce(async () => {
    paths.add(`${directory}/images/fixture.png`);
    await c.db.run(
      "UPDATE card SET back='changed private card' WHERE book_id='epub'",
    );
    return fixture();
  });
  const report = await runEpubReparseSmoke(c);
  expect(report.errors).toEqual([
    { stage: 'verify', code: 'learning-records-changed' },
  ]);
  expect(report.afterReparse).toEqual(report.before);
  expect(report.retainedAfterReparse).toBe(false);
  expect(report.changesAfterReparse).toEqual([
    { table: 'card', field: 'back', records: 2 },
  ]);
  expect(reports.get(reportPath)).not.toContain('changed private card');
});

it('requires rebuilt images to resolve to existing local assets', async () => {
  jest.mocked(runtime.epub!.parse).mockResolvedValueOnce(fixture());
  const report = await runEpubReparseSmoke(c);
  expect(report.errors).toEqual([{ stage: 'verify', code: 'image-invalid' }]);
  expect(report.images).toBe(1);
  expect(report.resolvedImages).toBe(0);
});

it('converts a parser exception into a fixed failure code without reporting body or credentials', async () => {
  jest
    .mocked(runtime.epub!.parse)
    .mockRejectedValueOnce(new Error(`${privateKey} ${privateText}`));
  const report = await runEpubReparseSmoke(c);
  expect(report.errors).toEqual([{ stage: 'reparse', code: 'reparse-failed' }]);
  expect(report.retainedAfterClear).toBe(true);
  expect(reports.get(reportPath)).not.toContain(privateKey);
  expect(reports.get(reportPath)).not.toContain(privateText);
});
