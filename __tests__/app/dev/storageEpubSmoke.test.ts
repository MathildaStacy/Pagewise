import type { Container } from '@app/container';
import { createTestContainer } from '@app/testing';
import {
  runRestoreBackupSmoke,
  runStorageEpubSmoke,
} from '@app/dev/storageEpubSmoke';
import {
  configureImportRuntime,
  type ImportRuntime,
} from '@app/usecases/importRuntime';
import {
  configureStorageRuntime,
  exportBackup,
  restoreBackup,
} from '@app/usecases/storage';
import type { BlockInsert, Section } from '@core/types';
import type { AiGateway, GatewayRequest } from '@services/ai/gateway';
import type { ParsedResponse } from '@services/ai/protocol';
import type { StorageIO } from '@services/backup';

jest.mock('@app/usecases/storage', () => ({
  ...jest.requireActual('@app/usecases/storage'),
  exportBackup: jest.fn(),
  restoreBackup: jest.fn(),
}));

let c: Container;
let runtime: ImportRuntime;
let io: StorageIO;
let paths: Set<string>;
let written: Map<string, string>;
let ai: AiGateway;
const body =
  'Synthetic private source sentence used only inside this fixture. '.repeat(3);
const secret = 'sk-private-fixture-secret-never-report';
const reportPath = '/cache/storage-epub-smoke.json';
const restoreReportPath = '/cache/restore-backup-smoke.json';

function section(bookId: string): Section {
  return {
    book_id: bookId,
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
    chars: body.length * 4,
    parts: 1,
    status: 'new',
    summary: null,
    guide: null,
    source: 'auto',
    flag: null,
    flag_detail: null,
    merged_into: null,
  };
}
function response(value: unknown): ParsedResponse {
  const parts = [{ t: 'text' as const, text: JSON.stringify(value) }];
  return {
    parts,
    raw: { protocol: 'chat', model: 'test', items: parts },
    usage: {
      input: 12,
      output: 4,
      cacheRead: 0,
      cacheWrite: 0,
      cacheReported: false,
    },
    stop: 'end',
    model: 'test',
  };
}
function taskResult(req: GatewayRequest): ParsedResponse {
  const task = /<task name="([^"]+)">/.exec(req.system)?.[1];
  const input = JSON.parse(
    /<input>\s*([\s\S]*?)\s*<\/input>/.exec(req.system)?.[1] ?? '{}',
  ) as { seq?: number };
  if (task === 'guide')
    return response({
      one_line: 'Synthetic guide. [[b:1]]',
      full: 'Synthetic explanation. [[b:2]]',
      prereq: [],
    });
  if (task === 'plan')
    return response({
      steps: [
        { title: 'First step', kind: 'intuition', from: 1, to: 2 },
        { title: 'Second step', kind: 'definition', from: 3, to: 5 },
      ],
    });
  if (task === 'explain')
    return response({
      answer: `Synthetic block explanation. [[b:${input.seq}]]`,
    });
  throw new Error(`Unexpected fixture task: ${task}`);
}
async function addPdf() {
  await c.repos.books.insert({
    id: 'pdf',
    sha256: 'real-pdf-sha',
    title: 'Synthetic PDF',
    format: 'pdf',
    pages: 10,
    size_bytes: 1000,
    status: 'ready',
    cover_color: '#3B4F7A',
    created_at: c.clock.now().toISOString(),
  });
  await c.repos.sections.replaceAll('pdf', [section('pdf')]);
  await c.repos.notes.userText.set('pdf', 'chapter', 'Private fixture note');
  await c.repos.cards.addMany([
    {
      book_id: 'pdf',
      section_id: 'chapter',
      front: 'Fixture question',
      back: 'Fixture answer',
      due_on: c.clock.today(),
      origin: 'manual',
      created_at: c.clock.now().toISOString(),
    },
  ]);
}

beforeEach(async () => {
  jest.clearAllMocks();
  jest
    .mocked(exportBackup)
    .mockResolvedValue('/Downloads/acceptance-backup.zip');
  jest.mocked(restoreBackup).mockResolvedValue(true);
  ai = {
    complete: jest.fn(async (_purpose, req) => taskResult(req)),
    stream: jest.fn(async (_purpose, _req, handlers) => {
      handlers.onText('Synthetic lesson. [[b:1]]');
      const parsed = response('unused');
      const parts = [{ t: 'text' as const, text: 'Synthetic lesson. [[b:1]]' }];
      return { ...parsed, parts, raw: { ...parsed.raw, items: parts } };
    }),
    test: jest.fn(),
  };
  c = await createTestContainer({ ai });
  paths = new Set(['/cache/acceptance.epub', '/docs/books/pdf/source.pdf']);
  written = new Map();
  runtime = {
    files: {
      cacheDir: '/cache',
      documentDir: '/docs',
      exists: jest.fn(async path => paths.has(path)),
      mkdir: jest.fn(async () => {}),
      move: jest.fn(async (from, to) => {
        paths.delete(from);
        paths.add(to);
      }),
      copy: jest.fn(async (_from, to) => {
        paths.add(to);
      }),
      remove: jest.fn(async path => {
        paths.delete(path);
      }),
      sha256: jest.fn(async () => 'epub-sha'),
      copyFromUri: jest.fn(async (_uri, to) => {
        paths.add(to);
        return {
          size: 1000,
          name: 'acceptance.epub',
          mime: 'application/epub+zip',
        };
      }),
    },
    chooseFile: jest.fn(async () => null),
    pdf: {
      render: jest.fn(),
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
      inspect: jest.fn(async () => ({
        title: 'Synthetic EPUB',
        author: 'Fixture',
      })),
      parse: jest.fn(async (_source, directory, bookId) => {
        paths.add(`${directory}/images/fixture.png`);
        const blocks: BlockInsert[] = Array.from({ length: 5 }, (_, index) => ({
          book_id: bookId,
          seq: index + 1,
          page: null,
          loc: `chapter · ${index + 1}`,
          type: index === 4 ? 'image' : 'text',
          text: index === 4 ? '' : body,
          chars: index === 4 ? 0 : body.length,
          image_path: index === 4 ? 'images/fixture.png' : null,
          section_id: 'chapter',
        }));
        return {
          blocks,
          sections: [section(bookId)],
          parts: [
            {
              book_id: bookId,
              section_id: 'chapter',
              part_no: 0,
              block_from: 1,
              block_to: 5,
              name: 'Synthetic part',
            },
          ],
        };
      }),
    },
  };
  configureImportRuntime(c, runtime);
  io = {
    ...runtime.files,
    readText: jest.fn(async path => written.get(path) ?? ''),
    writeText: jest.fn(async (path, text) => {
      written.set(path, text);
    }),
    dirSize: jest.fn(async () => 0),
    zip: jest.fn(async (_source, destination) => {
      paths.add(destination);
    }),
    unzip: jest.fn(async () => {}),
    pickBackup: jest.fn(async () => null),
    share: jest.fn(async () => {}),
    saveDownloads: jest.fn(async (_source, name) => `/Downloads/${name}`),
    openSnapshot: jest.fn(async () => c.db),
    replaceDatabase: jest.fn(async () => {}),
    restart: jest.fn(async () => {}),
  };
  configureStorageRuntime(c, io);
  await addPdf();
});
afterEach(async () => {
  await c.close();
});

it('imports through the production queue, studies valid EPUB blocks and exports the existing PDF', async () => {
  const beforePdf = await c.repos.books.get('pdf');
  const report = await runStorageEpubSmoke(c);
  expect(report).toMatchObject({
    status: 'passed',
    stage: 'complete',
    errors: [],
    epub: {
      status: 'passed',
      imported: true,
      sections: 1,
      blocks: 5,
      images: 1,
      missingImages: 0,
      locatedBlocks: 5,
      guideSaved: true,
      guideCitations: 2,
      planSteps: 2,
      planSource: 'model',
      explainCitations: 1,
      invalidCitations: 0,
    },
    exports: {
      status: 'passed',
      bookId: 'pdf',
      sectionsWithNotes: 1,
      cards: 1,
      markdownPath: '/Downloads/Synthetic PDF-笔记.zip',
      ankiPath: '/Downloads/Synthetic PDF-闪卡.csv',
    },
    backup: {
      includeOriginals: true,
      books: 2,
      originalsAvailable: 2,
      path: '/Downloads/acceptance-backup.zip',
    },
  });
  expect(await c.repos.books.get('pdf')).toEqual(beforePdf);
  expect(await c.repos.drafts.list()).toEqual([]);
  expect(runtime.files.copyFromUri).toHaveBeenCalledWith(
    'file:///cache/acceptance.epub',
    expect.stringMatching(/_incoming\/.+\.epub$/),
  );
  expect(runtime.epub?.parse).toHaveBeenCalledTimes(1);
  expect(ai.stream).toHaveBeenCalledTimes(1);
  expect(runtime.mineru.requestUpload).not.toHaveBeenCalled();
  expect(runtime.pdf.info).not.toHaveBeenCalled();
  expect(exportBackup).toHaveBeenCalledWith(c, true, 'downloads');
  expect(restoreBackup).not.toHaveBeenCalled();
  expect(JSON.parse(written.get(reportPath)!)).toEqual(report);
  expect(written.get(reportPath)).not.toContain(body);
  expect(written.get(reportPath)).not.toContain('Private fixture note');
});

it('deduplicates simultaneous runs and reuses an already imported EPUB without reparsing', async () => {
  const first = runStorageEpubSmoke(c);
  expect(runStorageEpubSmoke(c)).toBe(first);
  await first;
  const report = await runStorageEpubSmoke(c);
  expect(report.status).toBe('passed');
  expect(report.epub.imported).toBe(false);
  expect(runtime.epub?.parse).toHaveBeenCalledTimes(1);
  expect(await c.repos.books.list()).toHaveLength(2);
  expect(restoreBackup).not.toHaveBeenCalled();
});

it('blocks production queue wakeup when an unfinished PDF exists while still exporting notes and backup', async () => {
  await c.repos.parts.upsert({
    book_id: 'pdf',
    part_no: 1,
    page_from: 1,
    page_to: 10,
    stage: 'queued',
    updated_at: c.clock.now().toISOString(),
  });
  const report = await runStorageEpubSmoke(c);
  expect(report.errors).toEqual([
    { stage: 'prepare', code: 'pdf-queue-active' },
  ]);
  expect(report.epub.status).toBe('failed');
  expect(report.exports.status).toBe('passed');
  expect(runtime.files.copyFromUri).not.toHaveBeenCalled();
  expect(runtime.mineru.requestUpload).not.toHaveBeenCalled();
  expect(exportBackup).toHaveBeenCalledTimes(1);
});

it('reports missing images with a fixed code before requesting AI', async () => {
  jest
    .mocked(runtime.files.exists)
    .mockImplementation(
      async path => !path.endsWith('fixture.png') && paths.has(path),
    );
  const report = await runStorageEpubSmoke(c);
  expect(report.errors).toEqual([
    { stage: 'inspect', code: 'epub-image-invalid' },
  ]);
  expect(report.epub.missingImages).toBe(1);
  expect(ai.complete).not.toHaveBeenCalled();
  expect(report.exports.status).toBe('passed');
});

it('rejects a fallback lesson plan as incomplete AI acceptance while still exporting the PDF', async () => {
  jest
    .mocked(ai.complete)
    .mockImplementation(async (_purpose, req) =>
      req.system.includes('<task name="plan">')
        ? response({ steps: [] })
        : taskResult(req),
    );
  const report = await runStorageEpubSmoke(c);
  expect(report.errors).toEqual([{ stage: 'plan', code: 'plan-invalid' }]);
  expect(report.epub.planSource).toBe('fallback');
  expect(report.exports.status).toBe('passed');
});

it('rejects invalid AI references and never includes raw exceptions, credentials or source text in reports', async () => {
  jest.mocked(ai.complete).mockImplementation(async (_purpose, req) => {
    if (req.system.includes('<task name="explain">'))
      return response({ answer: 'Synthetic answer. [[b:9999]]' });
    return taskResult(req);
  });
  jest
    .mocked(exportBackup)
    .mockRejectedValueOnce(new Error(`${secret} ${body}`));
  const report = await runStorageEpubSmoke(c);
  expect(report.errors).toEqual([
    { stage: 'explain', code: 'invalid-citation' },
    { stage: 'backup', code: 'operation-failed' },
  ]);
  expect(report.epub.invalidCitations).toBe(1);
  const serialized = JSON.stringify(report);
  expect(serialized).not.toContain(secret);
  expect(serialized).not.toContain(body);
  expect(written.get(reportPath)).toBe(serialized);
});

it('keeps restore separate and passes only the staged cache archive to the production restore', async () => {
  paths.add('/cache/acceptance-backup.zip');
  const report = await runRestoreBackupSmoke(c);
  expect(report).toMatchObject({
    status: 'passed',
    stage: 'complete',
    restored: true,
    errors: [],
  });
  expect(restoreBackup).toHaveBeenCalledWith(c, '/cache/acceptance-backup.zip');
  expect(exportBackup).not.toHaveBeenCalled();
  expect(runtime.files.copyFromUri).not.toHaveBeenCalled();
  expect(JSON.parse(written.get(restoreReportPath)!)).toEqual(report);
});

it('does not restore without the staged archive and suppresses raw restore failures', async () => {
  const missing = await runRestoreBackupSmoke(c);
  expect(missing.errors).toEqual([
    { stage: 'prepare', code: 'backup-file-missing' },
  ]);
  expect(restoreBackup).not.toHaveBeenCalled();
  paths.add('/cache/acceptance-backup.zip');
  jest
    .mocked(restoreBackup)
    .mockRejectedValueOnce(new Error(`${secret} ${body}`));
  const failed = await runRestoreBackupSmoke(c);
  expect(failed.errors).toEqual([
    { stage: 'restore', code: 'operation-failed' },
  ]);
  expect(failed.restored).toBe(false);
  expect(written.get(restoreReportPath)).not.toContain(secret);
  expect(written.get(restoreReportPath)).not.toContain(body);
});
