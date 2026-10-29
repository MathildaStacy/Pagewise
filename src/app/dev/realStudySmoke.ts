import type { Block, Book, Section } from '@core/types';
import { parse } from '@core/markup';
import { validateCitations } from '@core/citations';
import { bookFiles } from '@platform/bookFiles';
import type { Container } from '../container';
import { StudySession } from '../study/StudySession';
import { parseStudyCard } from '../study/types';

type Stage =
  | 'select'
  | 'open'
  | 'switch'
  | 'advance'
  | 'draft'
  | 'save'
  | 'complete';
type Failure =
  | 'device-library-required'
  | 'book-not-found'
  | 'three-body-sections-required'
  | 'session-failed'
  | 'teaching-required'
  | 'invalid-citation'
  | 'citation-required'
  | 'anchor-not-persisted'
  | 'mode-not-persisted'
  | 'progress-not-persisted'
  | 'advance-stalled'
  | 'advance-limit'
  | 'draft-invalid'
  | 'summary-not-saved'
  | 'cards-not-saved'
  | 'operation-failed'
  | 'dispose-failed'
  | 'report-write-failed';
interface SectionResult {
  index: number;
  sectionId: string | null;
  status: 'running' | 'passed' | 'failed';
  stage: Stage;
  pageFrom: number | null;
  pageTo: number | null;
  bodyBlocks: number;
  answers: number;
  citations: number;
  invalidCitations: number;
  modeCycles: number;
  nextActions: number;
  skipActions: number;
  quizAnswers: number;
  draftCards: number;
  savedCardIds: number[];
  nextSectionId: string | null;
  summarySaved: boolean;
  progressSaved: boolean;
  errorCode?: Failure;
}
export interface RealStudySmokeReport {
  version: 1;
  startedAtMs: number;
  elapsedMs: number;
  status: 'running' | 'passed' | 'failed';
  stage: Stage;
  bookId: string | null;
  selection: 'chapter-3' | 'body-page-order' | null;
  completedSections: number;
  results: SectionResult[];
  errorCode?: Failure;
}
class SmokeFailure extends Error {
  constructor(readonly code: Failure) {
    super(code);
  }
}
function requireCheck(value: unknown, code: Failure): asserts value {
  if (!value) throw new SmokeFailure(code);
}
const reportId = (id: string | null | undefined) =>
  id && /^[a-z\d_.:-]{1,160}$/i.test(id) ? id : null;
const chapter = (value: string | null) => {
  const match = (value ?? '')
    .trim()
    .match(/^(?:chapter\s+)?(\d{1,2})(?=[.\s:–—-]|$)/i);
  return match ? Number(match[1]) : null;
};
const frontMatter =
  /(?:table\s+of\s+contents|^contents$|copyright|all rights reserved|preface|foreword|acknowledg|about the (?:author|reviewer)|contributors|dedication|conventions|who this book is for|^index$|bibliography|^references$|title page|目录|版权|前言|序言|致谢|索引|参考文献)/i;
const bodyBlocks = (blocks: readonly Block[]) =>
  blocks.filter(
    b => (b.type === 'text' || b.type === 'list') && b.text.trim().length >= 40,
  );

async function chooseSections(c: Container, book: Book) {
  const tree = await c.repos.sections.tree(book.id);
  const byId = new Map(tree.map(s => [s.id, s]));
  const ancestorChapter = (section: Section) => {
    let current: Section | undefined = section;
    const seen = new Set<string>();
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      const number = chapter(current.no) ?? chapter(current.title);
      if (number !== null) return number;
      current = current.parent_id ? byId.get(current.parent_id) : undefined;
    }
    return null;
  };
  const outline = book.outline ?? [];
  const firstPages = outline
    .filter(e => chapter(e.title) === 1)
    .map(e => e.page);
  const firstTechnicalPage = firstPages.length ? Math.min(...firstPages) : null;
  const thirdPages = outline
    .filter(e => chapter(e.title) === 3)
    .map(e => e.page);
  const thirdFrom = thirdPages.length ? Math.min(...thirdPages) : null;
  const laterPages = outline
    .filter(e => (chapter(e.title) ?? 0) > 3 && e.page > (thirdFrom ?? 0))
    .map(e => e.page);
  const thirdTo = laterPages.length ? Math.min(...laterPages) - 1 : Infinity;
  const candidates: {
    section: Section;
    blocks: Block[];
    third: boolean;
    technical: boolean;
  }[] = [];
  for (const section of tree) {
    if (
      !section.is_leaf ||
      section.merged_into ||
      section.block_from === null ||
      frontMatter.test(section.title)
    )
      continue;
    const blocks = await c.repos.blocks.bySection(book.id, section.id);
    const body = bodyBlocks(blocks);
    if (body.reduce((sum, b) => sum + b.text.trim().length, 0) < 160) continue;
    const tocLines = body.filter(b => /\.{3,}\s*\d+\s*$/m.test(b.text)).length;
    if (tocLines > body.length / 2) continue;
    const third =
      ancestorChapter(section) === 3 ||
      (thirdFrom !== null &&
        section.page_from !== null &&
        section.page_from >= thirdFrom &&
        section.page_from <= thirdTo);
    const technical =
      firstTechnicalPage !== null
        ? section.page_from !== null && section.page_from >= firstTechnicalPage
        : (ancestorChapter(section) ?? 0) >= 1;
    candidates.push({ section, blocks, third, technical });
  }
  const ordered = candidates.sort(
    (a, b) =>
      (a.section.page_from ?? Infinity) - (b.section.page_from ?? Infinity) ||
      a.section.ord - b.section.ord,
  );
  const third = ordered.filter(item => item.third);
  return {
    selection:
      third.length >= 3 ? ('chapter-3' as const) : ('body-page-order' as const),
    items: (third.length >= 3
      ? third
      : ordered.filter(item => item.technical)
    ).slice(0, 3),
  };
}

const running = new WeakMap<Container, Promise<RealStudySmokeReport>>();
/** Native debug-menu entry. Uses the configured production gateway and keeps saved learning data. */
export function runRealStudySmoke(c: Container): Promise<RealStudySmokeReport> {
  const existing = running.get(c);
  if (existing) return existing;
  const work = run(c).finally(() => running.delete(c));
  running.set(c, work);
  return work;
}
async function run(c: Container): Promise<RealStudySmokeReport> {
  const report: RealStudySmokeReport = {
    version: 1,
    startedAtMs: Date.now(),
    elapsedMs: 0,
    status: 'running',
    stage: 'select',
    bookId: null,
    selection: null,
    completedSections: 0,
    results: [],
  };
  const path = `${bookFiles.cacheDir}/real-study-smoke.json`;
  let active: StudySession | null = null;
  let current: SectionResult | undefined;
  const write = async () => {
    report.elapsedMs = Date.now() - report.startedAtMs;
    try {
      await bookFiles.writeText(path, JSON.stringify(report));
    } catch {
      throw new SmokeFailure('report-write-failed');
    }
  };
  const stage = async (value: Stage) => {
    report.stage = value;
    if (current) current.stage = value;
    await write();
  };
  const healthy = () =>
    requireCheck(
      active && !active.store.getState().error && !active.store.getState().busy,
      'session-failed',
    );
  try {
    await write();
    requireCheck(c.mode !== 'demo', 'device-library-required');
    const books = await c.repos.books.list();
    const candidates = books.filter(
      b =>
        b.format === 'pdf' &&
        /(?:ml[\s_-]*trading|machine\s+learning.*trading|机器学习.*交易)/i.test(
          b.title,
        ) &&
        (b.status === 'ready' || b.ready_to_page > 0),
    );
    let book: Book | undefined;
    for (const candidate of candidates) {
      const existingBlock = await c.db.get<{ seq: number }>(
        'SELECT seq FROM block WHERE book_id=? LIMIT 1',
        [candidate.id],
      );
      if (existingBlock) {
        book = candidate;
        break;
      }
    }
    requireCheck(book, 'book-not-found');
    report.bookId = reportId(book.id);
    const chosen = await chooseSections(c, book);
    requireCheck(chosen.items.length === 3, 'three-body-sections-required');
    report.selection = chosen.selection;
    for (const [index, item] of chosen.items.entries()) {
      const { section, blocks } = item;
      current = {
        index: index + 1,
        sectionId: reportId(section.id),
        status: 'running',
        stage: 'open',
        pageFrom: section.page_from,
        pageTo: section.page_to,
        bodyBlocks: bodyBlocks(blocks).length,
        answers: 0,
        citations: 0,
        invalidCitations: 0,
        modeCycles: 0,
        nextActions: 0,
        skipActions: 0,
        quizAnswers: 0,
        draftCards: 0,
        savedCardIds: [],
        nextSectionId: null,
        summarySaved: false,
        progressSaved: false,
      };
      report.results.push(current);
      const old = await c.repos.messages.thread(book.id, section.id, {
        limit: 1,
      });
      let lastMessage = old.at(-1)?.id ?? 0;
      const checkAnswers = async () => {
        healthy();
        const messages = await c.repos.messages.thread(book.id, section.id, {
          after_id: lastMessage,
          limit: 1000,
        });
        for (const message of messages) {
          lastMessage = Math.max(lastMessage, message.id);
          if (message.kind !== 'assistant') continue;
          const existing = (
            await Promise.all(
              (message.allowed_refs ?? []).map(seq =>
                c.repos.blocks.get(book.id, seq),
              ),
            )
          ).filter((b): b is Block => !!b);
          const checked = validateCitations(parse(message.content), {
            allowedRefs: message.allowed_refs ?? [],
            blocks: existing,
          });
          current!.answers++;
          current!.citations += checked.verifiedRefs.length;
          current!.invalidCitations += checked.invalidCitations;
          requireCheck(checked.invalidCitations === 0, 'invalid-citation');
        }
      };
      active = new StudySession(c, book.id);
      await stage('open');
      await active.open({
        sectionId: section.id,
        mode: 'listen',
        autoStart: true,
      });
      await checkAnswers();
      if (!current.answers) {
        await active.act('reteachSection');
        await checkAnswers();
      }
      requireCheck(current.answers > 0, 'teaching-required');
      requireCheck(current.citations > 0, 'citation-required');
      await stage('switch');
      for (let cycle = 0; cycle < 10; cycle++) {
        const before = active.store.getState();
        const step = before.plan?.steps[before.main.step];
        requireCheck(step, 'teaching-required');
        const anchors = before.partBlocks.filter(
          b => b.seq >= step.block_from && b.seq <= step.block_to,
        );
        const anchor = anchors[cycle % Math.max(1, anchors.length)]?.seq;
        requireCheck(anchor !== undefined, 'teaching-required');
        await active.setMode('read', step.block_from);
        active.reportAnchor(anchor);
        await new Promise<void>(resolve => setTimeout(resolve, 550));
        healthy();
        const read = await c.repos.study.get(book.id);
        requireCheck(read?.mode === 'read', 'mode-not-persisted');
        requireCheck(read.read_anchor === anchor, 'anchor-not-persisted');
        await active.setMode('listen', anchor);
        healthy();
        const listen = await c.repos.study.get(book.id);
        requireCheck(listen?.mode === 'listen', 'mode-not-persisted');
        requireCheck(listen.read_anchor === anchor, 'anchor-not-persisted');
        requireCheck(
          listen.main_section === section.id &&
            listen.main_part === before.main.part &&
            listen.main_step === before.main.step,
          'progress-not-persisted',
        );
        current.modeCycles++;
      }
      await stage('advance');
      const limit = active.store.getState().parts.length * 5 + 20;
      for (
        let action = 0;
        active.store.getState().phase !== 'ready';
        action++
      ) {
        requireCheck(action < limit, 'advance-limit');
        const before = active.store.getState();
        const pending = before.messages.find(m => {
          if (m.kind !== 'card') return false;
          const card = parseStudyCard(m.content);
          return (
            (card?.kind === 'quiz' && card.picked === null) ||
            (card?.kind === 'proposal' &&
              card.state === 'pending' &&
              !!card.toolCall)
          );
        });
        if (pending) {
          const card = parseStudyCard(pending.content);
          if (card?.kind === 'quiz') {
            // A fixed first option exercises the ordinary answer path, including wrong-answer feedback.
            await active.answerQuiz(pending.id, 0);
            current.quizAnswers++;
          } else await active.resolveProposal(pending.id, false);
        } else {
          const key = action % 2 === 0 ? 'next' : 'skip';
          await active.act(key);
          if (key === 'next') current.nextActions++;
          else current.skipActions++;
        }
        await checkAnswers();
        const after = active.store.getState();
        requireCheck(
          pending ||
            after.phase !== before.phase ||
            after.main.part !== before.main.part ||
            after.main.step !== before.main.step,
          'advance-stalled',
        );
      }
      requireCheck(
        current.citations > 0 && current.invalidCitations === 0,
        'citation-required',
      );
      await stage('draft');
      const draft = await active.finishDraft();
      healthy();
      requireCheck(
        draft &&
          !draft.error &&
          draft.sectionId === section.id &&
          draft.summary.trim() &&
          draft.cards.length >= 3 &&
          draft.cards.length <= 5 &&
          draft.cards.every(
            card => card.front.trim() && card.back.trim() && card.checked,
          ),
        'draft-invalid',
      );
      current.draftCards = draft.cards.length;
      const previousCards = await c.db.all<{ id: number }>(
        'SELECT id FROM card WHERE book_id=? AND section_id=?',
        [book.id, section.id],
      );
      const previousIds = new Set(previousCards.map(card => card.id));
      const expectedNext = await c.repos.sections.nextLeaf(book.id, section.id);
      await stage('save');
      const next = await active.saveDraft({
        bookId: book.id,
        sectionId: section.id,
        summary: draft.summary,
        stuck: draft.stuck,
        cards: draft.cards,
      });
      healthy();
      const savedSection = await c.repos.sections.get(book.id, section.id);
      requireCheck(
        savedSection?.status === 'done' &&
          savedSection.summary === draft.summary,
        'summary-not-saved',
      );
      current.summarySaved = true;
      const savedCards = (
        await c.db.all<{ id: number; front: string; back: string }>(
          'SELECT id,front,back FROM card WHERE book_id=? AND section_id=? ORDER BY id',
          [book.id, section.id],
        )
      ).filter(card => !previousIds.has(card.id));
      requireCheck(
        savedCards.length === draft.cards.length &&
          savedCards.every(
            (card, i) =>
              card.front === draft.cards[i].front &&
              card.back === draft.cards[i].back,
          ),
        'cards-not-saved',
      );
      current.savedCardIds = savedCards.map(card => card.id);
      const savedStudy = await c.repos.study.get(book.id);
      requireCheck(
        (next?.id ?? null) === (expectedNext?.id ?? null) &&
          savedStudy?.main_section === (next?.id ?? null) &&
          savedStudy.main_part === 0 &&
          savedStudy.main_step === 0 &&
          savedStudy.phase === 'idle',
        'progress-not-persisted',
      );
      current.nextSectionId = reportId(next?.id);
      current.progressSaved = true;
      // dispose only stops this private session's timers; completed notes/cards/progress stay intact.
      await active.dispose();
      active = null;
      current.stage = 'complete';
      current.status = 'passed';
      report.completedSections++;
      await write();
    }
    report.status = 'passed';
    report.stage = 'complete';
  } catch (error) {
    const code =
      error instanceof SmokeFailure ? error.code : 'operation-failed';
    report.status = 'failed';
    report.errorCode = code;
    if (current && current.status !== 'passed') {
      current.status = 'failed';
      current.errorCode = code;
    }
  } finally {
    try {
      await active?.dispose();
    } catch {
      report.status = 'failed';
      report.errorCode ??= 'dispose-failed';
    }
    try {
      await write();
    } catch {
      report.status = 'failed';
      report.errorCode = 'report-write-failed';
    }
  }
  return report;
}
