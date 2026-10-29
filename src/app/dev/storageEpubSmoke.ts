import type { Block, Book } from '@core/types';
import { parse } from '@core/markup';
import { validateCitations } from '@core/citations';
import { validateLessonPlan } from '@core/lesson';
import type { Container } from '../container';
import { StudySession } from '../study/StudySession';
import { resolveStudyBlockImage } from '../bookImages';
import { importBookFile, confirmImportDraft } from '../usecases/importBooks';
import { bookDirectory, getImportRuntime } from '../usecases/importRuntime';
import { exportNotes } from '../usecases/exportNotes';
import {
  exportBackup,
  restoreBackup,
  storageRuntime,
} from '../usecases/storage';

type Stage =
  | 'prepare'
  | 'import'
  | 'inspect'
  | 'guide'
  | 'plan'
  | 'explain'
  | 'exports'
  | 'markdown'
  | 'anki'
  | 'backup'
  | 'restore'
  | 'complete';
type Failure =
  | 'device-library-required'
  | 'epub-file-missing'
  | 'pdf-queue-active'
  | 'epub-import-failed'
  | 'epub-import-timeout'
  | 'epub-data-invalid'
  | 'epub-image-invalid'
  | 'body-section-required'
  | 'session-failed'
  | 'guide-invalid'
  | 'plan-invalid'
  | 'explain-required'
  | 'invalid-citation'
  | 'pdf-required'
  | 'original-required'
  | 'export-failed'
  | 'backup-file-missing'
  | 'restore-not-completed'
  | 'operation-failed'
  | 'report-write-failed'
  | 'dispose-failed';
interface FailureResult {
  stage: Stage;
  code: Failure;
}
interface EpubResult {
  status: 'running' | 'passed' | 'failed';
  bookId: string | null;
  imported: boolean;
  sections: number;
  blocks: number;
  images: number;
  missingImages: number;
  locatedBlocks: number;
  sectionId: string | null;
  guideSaved: boolean;
  guideCitations: number;
  planSteps: number;
  planSource: 'model' | 'fallback' | null;
  explainCitations: number;
  invalidCitations: number;
}
export interface StorageEpubSmokeReport {
  version: 1;
  startedAtMs: number;
  elapsedMs: number;
  status: 'running' | 'passed' | 'failed';
  stage: Stage;
  errors: FailureResult[];
  epub: EpubResult;
  exports: {
    status: 'pending' | 'running' | 'passed' | 'failed';
    bookId: string | null;
    sectionsWithNotes: number;
    cards: number;
    markdownPath: string | null;
    ankiPath: string | null;
  };
  backup: {
    includeOriginals: true;
    books: number;
    originalsAvailable: number;
    path: string | null;
  };
}
export interface RestoreBackupSmokeReport {
  version: 1;
  startedAtMs: number;
  elapsedMs: number;
  status: 'running' | 'passed' | 'failed';
  stage: Stage;
  restored: boolean;
  errors: FailureResult[];
}
class SmokeFailure extends Error {
  constructor(readonly code: Failure) {
    super(code);
  }
}
function requireCheck(value: unknown, code: Failure): asserts value {
  if (!value) throw new SmokeFailure(code);
}
const safeId = (value: string) =>
  /^[a-z\d_.:-]{1,160}$/i.test(value) ? value : null;
const failure = (error: unknown, stage: Stage): FailureResult => ({
  stage,
  code: error instanceof SmokeFailure ? error.code : 'operation-failed',
});
const frontMatter =
  /(?:contents|copyright|license|preface|foreword|acknowledg|^cover$|title page|目录|版权|前言|序言|致谢)/i;

async function readyEpub(c: Container, bookId: string): Promise<Book> {
  const deadline = Date.now() + 120_000;
  for (;;) {
    const book = await c.repos.books.get(bookId);
    requireCheck(book?.format === 'epub', 'epub-import-failed');
    if (book.status === 'ready') return book;
    requireCheck(
      book.status !== 'failed' && book.status !== 'paused',
      'epub-import-failed',
    );
    requireCheck(Date.now() < deadline, 'epub-import-timeout');
    await new Promise<void>(resolve => setTimeout(resolve, 300));
  }
}

const running = new WeakMap<Container, Promise<StorageEpubSmokeReport>>();
/** Debug-only acceptance entry; never clears a book or starts a PDF import/reparse. */
export function runStorageEpubSmoke(
  c: Container,
): Promise<StorageEpubSmokeReport> {
  const existing = running.get(c);
  if (existing) return existing;
  const work = run(c).finally(() => running.delete(c));
  running.set(c, work);
  return work;
}

async function run(c: Container): Promise<StorageEpubSmokeReport> {
  const io = storageRuntime(c);
  const report: StorageEpubSmokeReport = {
    version: 1,
    startedAtMs: Date.now(),
    elapsedMs: 0,
    status: 'running',
    stage: 'prepare',
    errors: [],
    epub: {
      status: 'running',
      bookId: null,
      imported: false,
      sections: 0,
      blocks: 0,
      images: 0,
      missingImages: 0,
      locatedBlocks: 0,
      sectionId: null,
      guideSaved: false,
      guideCitations: 0,
      planSteps: 0,
      planSource: null,
      explainCitations: 0,
      invalidCitations: 0,
    },
    exports: {
      status: 'pending',
      bookId: null,
      sectionsWithNotes: 0,
      cards: 0,
      markdownPath: null,
      ankiPath: null,
    },
    backup: {
      includeOriginals: true,
      books: 0,
      originalsAvailable: 0,
      path: null,
    },
  };
  const write = async () => {
    report.elapsedMs = Date.now() - report.startedAtMs;
    try {
      await io.writeText(
        `${io.cacheDir}/storage-epub-smoke.json`,
        JSON.stringify(report),
      );
    } catch {
      throw new SmokeFailure('report-write-failed');
    }
  };
  const stage = async (next: Stage) => {
    report.stage = next;
    await write();
  };
  let session: StudySession | null = null;
  try {
    await write();
    requireCheck(c.mode !== 'demo', 'device-library-required');
    try {
      const runtime = getImportRuntime(c);
      const source = `${runtime.files.cacheDir}/acceptance.epub`;
      requireCheck(await runtime.files.exists(source), 'epub-file-missing');
      // confirmImportDraft resumes the shared production queue. Refuse to wake pending PDF uploads.
      const pending = await c.db.get<{ count: number }>(
        "SELECT COUNT(*) AS count FROM book_part p JOIN book b ON b.id=p.book_id WHERE b.format='pdf' AND p.stage NOT IN ('done','failed')",
      );
      requireCheck(!pending?.count, 'pdf-queue-active');
      await stage('import');
      const selected = await importBookFile(c, {
        uri: `file://${source}`,
        name: 'acceptance.epub',
        mime: 'application/epub+zip',
      });
      const bookId =
        selected.kind === 'duplicate'
          ? selected.bookId
          : await confirmImportDraft(c, selected.draftId, {
              model: 'vlm',
              ocr: false,
              priorityFrom: 1,
            });
      report.epub.bookId = safeId(bookId);
      report.epub.imported = selected.kind === 'draft';
      await readyEpub(c, bookId);
      await stage('inspect');
      const [sections, blocks] = await Promise.all([
        c.repos.sections.tree(bookId),
        c.db.all<Block>('SELECT * FROM block WHERE book_id=? ORDER BY seq', [
          bookId,
        ]),
      ]);
      report.epub.sections = sections.length;
      report.epub.blocks = blocks.length;
      report.epub.locatedBlocks = blocks.filter(
        block => block.page === null && !!block.loc?.trim(),
      ).length;
      requireCheck(
        sections.length &&
          blocks.length &&
          report.epub.locatedBlocks === blocks.length &&
          blocks.every(
            block =>
              block.section_id &&
              sections.some(section => section.id === block.section_id),
          ),
        'epub-data-invalid',
      );
      const images = blocks.filter(block => block.type === 'image');
      report.epub.images = images.length;
      const directory = bookDirectory(runtime, bookId);
      for (const block of images) {
        const uri = resolveStudyBlockImage(c, bookId, block).image_path;
        const path = uri?.startsWith('file://') ? uri.slice(7) : null;
        if (
          !path ||
          !path.startsWith(`${directory}/`) ||
          !(await runtime.files.exists(path))
        )
          report.epub.missingImages++;
      }
      requireCheck(!report.epub.missingImages, 'epub-image-invalid');
      const section = sections.find(
        value =>
          value.is_leaf &&
          !value.merged_into &&
          !frontMatter.test(value.title) &&
          blocks
            .filter(
              block =>
                block.section_id === value.id &&
                (block.type === 'text' || block.type === 'list'),
            )
            .reduce((count, block) => count + block.chars, 0) >= 160,
      );
      requireCheck(section, 'body-section-required');
      report.epub.sectionId = safeId(section.id);
      session = new StudySession(c, bookId);
      await session.open({
        sectionId: section.id,
        mode: 'read',
        autoStart: false,
      });
      requireCheck(!session.store.getState().error, 'session-failed');
      await stage('guide');
      const guide = JSON.parse(await session.generateGuide()) as {
        one_line?: unknown;
        full?: unknown;
      };
      requireCheck(
        typeof guide.one_line === 'string' &&
          guide.one_line.trim() &&
          typeof guide.full === 'string' &&
          guide.full.trim(),
        'guide-invalid',
      );
      report.epub.guideSaved = !!(
        await c.repos.sections.get(bookId, section.id)
      )?.guide;
      requireCheck(report.epub.guideSaved, 'guide-invalid');
      const sectionBlocks = blocks.filter(
        block => block.section_id === section.id,
      );
      const guideRefs = validateCitations(
        parse(`${guide.one_line}\n${guide.full}`),
        {
          allowedRefs: sectionBlocks.map(block => block.seq),
          blocks: sectionBlocks,
        },
      );
      report.epub.guideCitations = guideRefs.verifiedRefs.length;
      report.epub.invalidCitations += guideRefs.invalidCitations;
      requireCheck(!guideRefs.invalidCitations, 'invalid-citation');
      await stage('plan');
      await session.open({
        sectionId: section.id,
        mode: 'listen',
        autoStart: true,
      });
      const state = session.store.getState();
      requireCheck(!state.error && !state.busy, 'session-failed');
      report.epub.planSteps = state.plan?.steps.length ?? 0;
      report.epub.planSource = state.plan?.source ?? null;
      requireCheck(
        state.plan &&
          state.plan.source === 'model' &&
          validateLessonPlan({ steps: state.plan.steps }, state.partBlocks)
            .valid,
        'plan-invalid',
      );
      for (const message of state.messages.filter(
        value => value.kind === 'assistant',
      )) {
        const checked = validateCitations(parse(message.content), {
          allowedRefs: message.allowed_refs ?? [],
          blocks,
        });
        report.epub.invalidCitations += checked.invalidCitations;
      }
      requireCheck(!report.epub.invalidCitations, 'invalid-citation');
      await stage('explain');
      const block = sectionBlocks.find(
        value => value.type === 'text' && value.chars >= 40,
      );
      requireCheck(block, 'body-section-required');
      const answer = await session.explainBlock(block.seq, 'explain');
      requireCheck(answer.trim(), 'explain-required');
      const checked = validateCitations(parse(answer), {
        allowedRefs: [block.seq],
        blocks: [block],
      });
      report.epub.explainCitations = checked.verifiedRefs.length;
      report.epub.invalidCitations += checked.invalidCitations;
      requireCheck(!checked.invalidCitations, 'invalid-citation');
      requireCheck(checked.verifiedRefs.length, 'explain-required');
      report.epub.status = 'passed';
    } catch (error) {
      report.epub.status = 'failed';
      report.errors.push(failure(error, report.stage));
    } finally {
      if (session) {
        try {
          await session.dispose();
        } catch {
          report.errors.push({ stage: report.stage, code: 'dispose-failed' });
        }
      }
    }
    // Export checks continue even if EPUB/AI validation failed, and never mutate the PDF.
    try {
      await stage('exports');
      report.exports.status = 'running';
      const runtime = getImportRuntime(c);
      const books = await c.repos.books.list();
      const pdfs = books.filter(
        book =>
          book.format === 'pdf' &&
          (book.status === 'ready' || book.ready_to_page > 0),
      );
      const book = pdfs.find(
        value => value.sha256 && !value.sha256.startsWith('demo:'),
      );
      requireCheck(book, 'pdf-required');
      requireCheck(
        await runtime.files.exists(
          `${bookDirectory(runtime, book.id)}/source.pdf`,
        ),
        'original-required',
      );
      report.exports.bookId = safeId(book.id);
      const [notes, cards] = await Promise.all([
        c.db.get<{ count: number }>(
          "SELECT COUNT(*) AS count FROM section s WHERE s.book_id=? AND (s.summary IS NOT NULL OR EXISTS(SELECT 1 FROM section_note n WHERE n.book_id=s.book_id AND n.section_id=s.id AND n.user_text<>''))",
          [book.id],
        ),
        c.db.get<{ count: number }>(
          'SELECT COUNT(*) AS count FROM card WHERE book_id=?',
          [book.id],
        ),
      ]);
      report.exports.sectionsWithNotes = notes?.count ?? 0;
      report.exports.cards = cards?.count ?? 0;
      await stage('markdown');
      report.exports.markdownPath = await exportNotes(
        c,
        book.id,
        'md',
        true,
        'downloads',
      );
      requireCheck(report.exports.markdownPath, 'export-failed');
      await stage('anki');
      report.exports.ankiPath = await exportNotes(
        c,
        book.id,
        'anki',
        true,
        'downloads',
      );
      requireCheck(report.exports.ankiPath, 'export-failed');
      await stage('backup');
      report.backup.books = books.length;
      for (const value of books)
        if (
          await runtime.files.exists(
            `${bookDirectory(runtime, value.id)}/source.${value.format}`,
          )
        )
          report.backup.originalsAvailable++;
      report.backup.path = await exportBackup(c, true, 'downloads');
      requireCheck(report.backup.path, 'export-failed');
      report.exports.status = 'passed';
    } catch (error) {
      report.exports.status = 'failed';
      report.errors.push(failure(error, report.stage));
    }
    report.status = report.errors.length ? 'failed' : 'passed';
    await stage('complete');
  } catch (error) {
    report.status = 'failed';
    report.errors.push(failure(error, report.stage));
    try {
      await write();
    } catch {
      /* The returned safe report still records the failure. */
    }
  }
  return report;
}

/** Separate manual action: production restore may reload JS before this promise returns. */
export async function runRestoreBackupSmoke(
  c: Container,
): Promise<RestoreBackupSmokeReport> {
  const io = storageRuntime(c);
  const report: RestoreBackupSmokeReport = {
    version: 1,
    startedAtMs: Date.now(),
    elapsedMs: 0,
    status: 'running',
    stage: 'prepare',
    restored: false,
    errors: [],
  };
  const write = async () => {
    report.elapsedMs = Date.now() - report.startedAtMs;
    try {
      await io.writeText(
        `${io.cacheDir}/restore-backup-smoke.json`,
        JSON.stringify(report),
      );
    } catch {
      throw new SmokeFailure('report-write-failed');
    }
  };
  try {
    await write();
    requireCheck(c.mode !== 'demo', 'device-library-required');
    const path = `${io.cacheDir}/acceptance-backup.zip`;
    requireCheck(await io.exists(path), 'backup-file-missing');
    report.stage = 'restore';
    await write();
    report.restored = await restoreBackup(c, path);
    requireCheck(report.restored, 'restore-not-completed');
    report.stage = 'complete';
    report.status = 'passed';
    await write();
  } catch (error) {
    report.status = 'failed';
    report.errors.push(failure(error, report.stage));
    try {
      await write();
    } catch {
      /* Return fixed codes only, never raw exceptions. */
    }
  }
  return report;
}
