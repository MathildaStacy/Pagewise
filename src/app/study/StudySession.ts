import { createStore } from 'zustand/vanilla';
import type {
  Block,
  JsonValue,
  Message,
  MessageInsert,
  Section,
  LessonPlan,
  DetourFrame,
  StudyPhase,
} from '@core/types';
import {
  buildContext,
  type ConversationGroup,
  type LoadedContext,
} from '@core/context';
import { reduceDetour } from '@core/detour';
import { resolveLessonPlan } from '@core/lesson';
import { parse } from '@core/markup';
import { advanceCitationStreak, validateCitations } from '@core/citations';
import { pageLabel, parseBlockRef } from '@core/ids';
import { stableStringify, truncateText } from '@core/text';
import type { GatewayRequest } from '@services/ai/gateway';
import type {
  ConversationConfig,
  Part,
  RawOutput,
  StoredMessage,
  Usage,
} from '@services/ai/types';
import { TOOL_DEFS } from '@services/ai/tools';
import type { Container } from '../container';
import { toAppError } from '../errors';
import { defaultPrefs, readPrefs } from '../usecases/settings';
import { loadAiOptions, normalizeAiOptions } from '../usecases/aiOptions';
import {
  buildTaskPrompt,
  buildTeachPrompt,
  parseTaskJson,
  type StudyTask,
} from './prompts';
import { finishSection } from './finishSection';
import { deferQuizzes } from './quizSupport';
import { translationChunks } from './translation';
import { executeReadTool, jsonObject, parseToolArgs } from './toolExec';
import {
  asJson,
  parseStudyCard,
  type FinishSectionInput,
  type QuickKey,
  type SectionDraft,
  type StudyCard,
  type StudyOpenOptions,
  type StudySessionApi,
  type StudyState,
} from './types';

const labels: Partial<Record<QuickKey, string>> = {
  next: '懂了，下一步',
  skip: '这步熟，跳过',
  alt: '换个说法',
  example: '举个例子',
  derive: '展开推导',
  quiz: '考考我',
  nextPart: '懂了，下一段',
  reteachSection: '再讲一遍这一节',
  backMain: '回到主线',
  reviewAgain: '还是不太懂',
};
type Round = {
  request: GatewayRequest;
  blocks: Block[];
  allowed: Set<number>;
  intent: string;
  user: Message;
  question?: string;
  calls: number;
  rounds: number;
};
type ConversationCheckpoint = {
  part?: number;
  step?: number;
  phase?: StudyPhase;
  detours?: DetourFrame[];
  plan?: LessonPlan | null;
  plans?: Record<number, LessonPlan>;
};
const textOf = (parts: readonly Part[]) =>
  parts
    .filter((p): p is Extract<Part, { t: 'text' }> => p.t === 'text')
    .map(p => p.text)
    .join('\n');
const stringValue = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback;
const stringList = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
const partsOf = (message: Message): Part[] =>
  message.parts
    ? (message.parts as unknown as Part[])
    : [{ t: 'text', text: message.content }];
const stored = (message: Message): StoredMessage => ({
  id: message.id,
  threadId: 0,
  role:
    message.kind === 'tool'
      ? 'tool'
      : message.kind === 'user'
      ? 'user'
      : 'assistant',
  parts: partsOf(message),
  raw: message.raw as unknown as RawOutput | null,
  ui: null,
  compacted: false,
  createdAt: message.created_at,
});

/** A long-lived book session. React views subscribe; only explicit intents start work. */
export class StudySession implements StudySessionApi {
  readonly store;
  private initialized = false;
  private opening: Promise<void> | null = null;
  private active: Promise<void> | null = null;
  private controller: AbortController | null = null;
  private extraControllers = new Set<AbortController>();
  private background = new Set<Promise<void>>();
  private retryAction: (() => Promise<void>) | null = null;
  private reminder: string | null = null;
  private anchorTimer: ReturnType<typeof setTimeout> | null = null;
  private anchorWrite: Promise<unknown> = Promise.resolve();
  private flashTimer: ReturnType<typeof setTimeout> | null = null;
  private streamTimer: ReturnType<typeof setTimeout> | null = null;
  private lastStream = '';
  private disposed = false;
  private sequence = 0;

  constructor(private readonly c: Container, private readonly bookId: string) {
    this.store = createStore<StudyState>(() => ({
      conversation: null,
      conversations: [],
      config: null,
      bookId,
      book: null,
      section: null,
      sections: [],
      blocks: [],
      partBlocks: [],
      parts: [],
      plan: null,
      main: { sectionId: '', part: 0, step: 0 },
      phase: 'idle',
      detours: [],
      mode: 'listen',
      readerView: 'orig',
      readerSectionId: null,
      readAnchor: null,
      flashRef: null,
      messages: [],
      streaming: null,
      busy: false,
      loading: false,
      pendingQuote: null,
      tools: [],
      error: null,
      notice: null,
      context: [],
      lastUsage: null,
      unverifiedStreak: 0,
      scrollToStep: null,
      prefs: defaultPrefs,
      stuckCandidates: [],
      draft: null,
      streamKeys: {},
    }));
  }
  private get state() {
    return this.store.getState();
  }
  private set(patch: Partial<StudyState>) {
    this.store.setState(patch);
  }
  private now() {
    return this.c.clock.now().toISOString();
  }
  private top() {
    return this.state.detours.at(-1);
  }
  private async checkpoint() {
    const s = this.state;
    if (s.conversation?.section_id === s.main.sectionId) {
      const previous = s.conversation
        .checkpoint as ConversationCheckpoint | null;
      const checkpoint = asJson({
        part: s.main.part,
        step: s.main.step,
        phase: s.phase,
        detours: s.detours,
        plans: {
          ...previous?.plans,
          ...(s.plan ? { [s.plan.part_no]: s.plan } : {}),
        },
      });
      await this.c.repos.conversations.update(s.conversation.id, {
        checkpoint,
        config: asJson(s.config),
      });
      this.set({
        conversation: {
          ...s.conversation,
          checkpoint,
          config: asJson(s.config),
        },
        conversations: await this.c.repos.conversations.list(
          this.bookId,
          s.main.sectionId,
        ),
      });
    }
    await this.c.repos.study.put({
      book_id: this.bookId,
      conversation_id: s.conversation?.id ?? null,
      main_section: s.main.sectionId || null,
      main_part: s.main.part,
      main_step: s.main.step,
      phase: s.phase,
      detours: s.detours,
      mode: s.mode,
      reader_view: s.readerView,
      read_anchor: s.readAnchor,
      last_active_at: this.now(),
      resume_shown_at:
        (await this.c.repos.study.get(this.bookId))?.resume_shown_at ?? null,
    });
  }
  private run(operation: () => Promise<void>): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.active) {
      this.set({ notice: '请先等待本轮结束，或点停止' });
      return Promise.resolve();
    }
    this.retryAction = operation;
    this.controller = new AbortController();
    this.set({ busy: true, error: null });
    const work = operation()
      .catch(error => {
        if (!this.controller?.signal.aborted) {
          this.set({ error: toAppError(error).message });
          this.c.log.warn('学习会话操作失败');
        }
      })
      .finally(() => {
        this.stopStream();
        this.set({ busy: false, loading: false, streaming: null, tools: [] });
        this.controller = null;
        this.active = null;
      });
    this.active = work;
    return work;
  }
  open(options: StudyOpenOptions = {}): Promise<void> {
    if (this.opening) return this.opening;
    if (
      this.initialized &&
      !options.sectionId &&
      !options.conversationId &&
      !options.blockRef &&
      !options.question &&
      !options.stuckId
    ) {
      if (options.mode && options.mode !== this.state.mode) {
        if (options.mode === 'listen' && options.autoStart === false) {
          this.set({ mode: 'listen' });
          return this.checkpoint();
        }
        return this.setMode(options.mode);
      }
      return Promise.resolve();
    }
    this.opening = this.run(async () => {
      this.set({ loading: true });
      let previous = await this.c.repos.study.get(this.bookId);
      if (!this.initialized) {
        const [book, sections, prefs] = await Promise.all([
          this.c.repos.books.get(this.bookId),
          this.c.repos.sections.tree(this.bookId),
          readPrefs(this.c),
        ]);
        if (!book) throw new Error('找不到这本书');
        const leaf =
          sections.find(section => section.id === previous?.main_section) ||
          sections.find(
            section =>
              section.is_leaf &&
              section.status !== 'done' &&
              section.block_from !== null,
          ) ||
          sections.find(
            section => section.is_leaf && section.block_from !== null,
          );
        this.set({
          book,
          sections,
          prefs,
          main: {
            sectionId: leaf?.id ?? '',
            part: previous?.main_part ?? 0,
            step: previous?.main_step ?? 0,
          },
          phase: previous?.phase ?? 'idle',
          detours: previous?.detours ?? [],
          mode: previous?.mode ?? 'listen',
          readerView: previous?.reader_view ?? 'orig',
          readAnchor: previous?.read_anchor ?? leaf?.block_from ?? null,
        });
        this.initialized = true;
      }
      if (options.conversationId !== undefined) {
        const conversation = await this.c.repos.conversations.get(
          options.conversationId,
        );
        if (!conversation || conversation.book_id !== this.bookId)
          throw new Error('找不到本书的对话');
        options = {
          ...options,
          sectionId: conversation.section_id,
          mode: options.mode ?? 'listen',
          autoStart: false,
        };
      }
      if (
        options.sectionId &&
        !options.preserveMain &&
        !options.stuckId &&
        !options.question
      ) {
        if (this.state.main.sectionId !== options.sectionId) {
          await this.checkpoint();
          await this.foldDetours(false);
          this.set({
            main: { sectionId: options.sectionId, part: 0, step: 0 },
            phase: 'idle',
            detours: [],
          });
        }
      }
      if (options.mode) this.set({ mode: options.mode });
      if (options.preserveMain && options.sectionId)
        this.set({ readerSectionId: options.sectionId });
      const lastConversation = previous?.conversation_id
        ? await this.c.repos.conversations.get(previous.conversation_id)
        : undefined;
      await this.loadMain(
        options.conversationId ??
          (lastConversation?.section_id === this.state.main.sectionId
            ? lastConversation.id
            : undefined),
      );
      if (!this.state.section) {
        await this.checkpoint();
        return;
      }
      if (this.state.section.status === 'new') {
        await this.c.repos.sections.update(
          this.bookId,
          this.state.main.sectionId,
          { status: 'learning' },
        );
        this.c.events.emit('section.status', {
          bookId: this.bookId,
          sectionId: this.state.main.sectionId,
          status: 'learning',
        });
      }
      const oldActivity = previous?.last_active_at;
      const days = oldActivity
        ? Math.floor(
            (this.c.clock.now().getTime() - new Date(oldActivity).getTime()) /
              86400000,
          )
        : 0;
      const showResume =
        days >= 1 &&
        this.state.prefs.recap &&
        previous?.resume_shown_at !== this.c.clock.today() &&
        options.autoStart !== false;
      await this.checkpoint();
      this.retryAction = async () => {
        await this.ensurePlan();
        await this.request('start', '从当前步骤继续讲');
      };
      if (options.stuckId) {
        const stuck = (await this.c.repos.notes.stuck.list(this.bookId)).find(
          item => item.id === options.stuckId,
        );
        if (stuck) {
          if (!(await this.enterDetour(stuck.section_id, stuck.id))) return;
          await this.loadSectionSource(stuck.section_id);
          await this.request(
            'review',
            `请重新讲解这个卡点：${stuck.text}`,
            true,
          );
          return;
        }
      }
      if (options.blockRef) {
        const seq = parseBlockRef(options.blockRef);
        if (seq !== null) {
          this.set({ readAnchor: seq });
          this.flash(seq);
          if (
            this.state.mode === 'listen' &&
            !options.question &&
            !options.preserveMain
          )
            await this.anchorToStep(seq);
        }
      }
      if (options.question) {
        await this.deferPendingQuizzes();
        if (
          options.sectionId &&
          options.sectionId !== this.state.main.sectionId
        ) {
          if (!(await this.enterDetour(options.sectionId))) return;
          await this.loadSectionSource(options.sectionId);
        }
        await this.ensurePlan();
        await this.request('ask', options.question, true);
        return;
      }
      if (this.state.mode === 'read' || options.autoStart === false) return;
      if (showResume) {
        await this.showResume(days);
        return;
      }
      const hadPlan = !!this.state.plan;
      await this.ensurePlan();
      if (
        !hadPlan ||
        !this.state.messages.some(
          m => m.kind === 'assistant' && m.part_no === this.state.main.part,
        )
      ) {
        await this.stepHeader();
        await this.request('start', '请从当前步骤开始讲');
      }
      previous = undefined;
    }).finally(() => {
      this.opening = null;
    });
    return this.opening;
  }
  private async loadMain(conversationId?: number, fresh = false) {
    const id = this.state.main.sectionId;
    if (!id) {
      this.set({
        section: null,
        blocks: [],
        partBlocks: [],
        parts: [],
        plan: null,
        messages: [],
      });
      return;
    }
    const changed =
      conversationId !== undefined ||
      this.state.conversation?.section_id !== id;
    const conversation =
      conversationId !== undefined
        ? await this.c.repos.conversations.get(conversationId)
        : changed
        ? await this.c.repos.conversations.ensure(this.bookId, id)
        : this.state.conversation;
    if (
      !conversation ||
      conversation.book_id !== this.bookId ||
      conversation.section_id !== id
    )
      throw new Error('对话不属于当前书籍或章节');
    if (changed) {
      const saved = conversation.checkpoint as ConversationCheckpoint | null;
      const options = await loadAiOptions(this.c, 'teach');
      const config =
        conversation.config as unknown as ConversationConfig | null;
      this.set({
        conversation,
        main: {
          sectionId: id,
          part: saved?.part ?? (fresh ? 0 : this.state.main.part),
          step: saved?.step ?? (fresh ? 0 : this.state.main.step),
        },
        phase: saved?.phase ?? (fresh ? 'idle' : this.state.phase),
        detours: saved?.detours ?? (fresh ? [] : this.state.detours),
        config: config
          ? normalizeAiOptions(config, options.providers)
          : options.config,
        pendingQuote: null,
        streamKeys: {},
        tools: [],
        error: null,
        context: [],
        draft: null,
      });
    }
    const [section, blocks, parts, messages] = await Promise.all([
      this.c.repos.sections.get(this.bookId, id),
      this.c.repos.blocks.bySection(this.bookId, id),
      this.c.repos.sections.parts(this.bookId, id),
      this.c.repos.messages.thread(this.bookId, id, {
        conversation_id: conversation.id,
      }),
    ]);
    if (!section) throw new Error('小节不存在');
    const ranges = parts.length
      ? parts
      : blocks.length
      ? [
          {
            book_id: this.bookId,
            section_id: id,
            part_no: 0,
            block_from: blocks[0].seq,
            block_to: blocks.at(-1)!.seq,
            name: section.title,
          },
        ]
      : [];
    const part =
      ranges.find(p => p.part_no === this.state.main.part) ?? ranges[0];
    const partNo = part?.part_no ?? 0;
    let plan = await this.c.repos.plans.get(this.bookId, id, partNo);
    const saved = conversation.checkpoint as ConversationCheckpoint | null;
    const savedPlan =
      saved?.plans?.[partNo] ??
      (saved?.plan?.part_no === partNo ? saved.plan : undefined);
    if (
      plan &&
      savedPlan?.part_no === partNo &&
      savedPlan.steps.every(
        item =>
          part &&
          item.block_from >= part.block_from &&
          item.block_to <= part.block_to,
      )
    )
      plan = await this.c.repos.plans.put(savedPlan);
    else if (plan && (fresh || (saved && !savedPlan)))
      plan = await this.c.repos.plans.put({
        ...plan,
        steps: plan.steps.map((item, i) => ({
          ...item,
          status: i === 0 ? 'current' : 'todo',
        })),
      });
    const step = Math.min(
      this.state.main.step,
      Math.max(0, (plan?.steps.length ?? 1) - 1),
    );
    this.set({
      section,
      blocks,
      parts: ranges,
      partBlocks: part
        ? blocks.filter(b => b.seq >= part.block_from && b.seq <= part.block_to)
        : [],
      plan: plan ?? null,
      messages,
      conversations: await this.c.repos.conversations.list(this.bookId, id),
      main: { sectionId: id, part: partNo, step },
    });
  }
  newConversation(sectionId = this.state.main.sectionId): Promise<void> {
    return this.run(async () => {
      await this.checkpoint();
      if (!this.state.sections.some(s => s.id === sectionId && s.is_leaf))
        throw new Error('请选择可阅读的章节');
      const conversation = await this.c.repos.conversations.create(
        this.bookId,
        sectionId,
      );
      this.set({
        main: { sectionId, part: 0, step: 0 },
        detours: [],
        phase: 'idle',
        mode: 'listen',
        readerSectionId: null,
      });
      await this.loadMain(conversation.id, true);
      this.retryAction = null;
      await this.checkpoint();
    });
  }
  selectConversation(id: number): Promise<void> {
    return this.run(async () => {
      const conversation = await this.c.repos.conversations.get(id);
      if (!conversation || conversation.book_id !== this.bookId)
        throw new Error('找不到本书的对话');
      await this.checkpoint();
      this.set({
        main: { sectionId: conversation.section_id, part: 0, step: 0 },
        detours: [],
        phase: 'idle',
        mode: 'listen',
        readerSectionId: null,
      });
      await this.loadMain(id);
      this.retryAction = null;
      await this.checkpoint();
    });
  }
  async setConfig(config: ConversationConfig) {
    if (this.state.busy) return;
    const options = await loadAiOptions(this.c, 'teach');
    this.set({ config: normalizeAiOptions(config, options.providers) });
    await this.checkpoint();
  }
  private taskMessage(): StoredMessage {
    return {
      id: 0,
      threadId: 0,
      role: 'user',
      parts: [{ t: 'text', text: '请根据任务和输入，只输出要求的 JSON。' }],
      raw: null,
      ui: null,
      compacted: false,
      createdAt: this.now(),
    };
  }
  private async task(
    task: StudyTask,
    input: unknown,
    signal = this.controller?.signal,
    purpose: 'teach' | 'tidy' = 'tidy',
    config?: ConversationConfig,
  ): Promise<Record<string, JsonValue>> {
    const response = await this.c.ai.complete(
      purpose,
      {
        system: buildTaskPrompt(task, input),
        contextBlocks: [],
        tools: [],
        noTools: !config?.search,
        bookId: this.bookId,
        config,
        history: [this.taskMessage()],
      },
      { signal },
    );
    if (signal?.aborted) throw new Error('已停止');
    if (task === 'translate' && response.stop === 'max_tokens')
      throw new Error('模型的译文未完整返回，请重试或切换模型');
    this.set({ lastUsage: response.usage });
    return jsonObject(parseTaskJson(textOf(response.parts))) ?? {};
  }
  private async ensurePlan() {
    if (this.state.plan || !this.state.partBlocks.length) return;
    this.set({
      phase: 'planning',
      tools: [
        { id: 'plan', text: '整理本节路线图', running: true, detour: false },
      ],
    });
    await this.checkpoint();
    const response = await this.c.ai.complete(
      'tidy',
      {
        system: buildTaskPrompt('plan', {
          section: this.state.section?.title,
          blocks: this.state.partBlocks,
        }),
        contextBlocks: [],
        history: [this.taskMessage()],
        tools: [],
        noTools: true,
        bookId: this.bookId,
      },
      { signal: this.controller?.signal },
    );
    if (this.controller?.signal.aborted) return;
    let input: unknown;
    try {
      input = parseTaskJson(textOf(response.parts));
    } catch {
      input = null;
    }
    const resolved = resolveLessonPlan(input, this.state.partBlocks);
    const plan = await this.c.repos.plans.put({
      book_id: this.bookId,
      section_id: this.state.main.sectionId,
      part_no: this.state.main.part,
      steps: resolved.steps.map((step, i) => ({
        ...step,
        status: i === this.state.main.step ? 'current' : 'todo',
      })),
      source: resolved.source,
      created_at: this.now(),
    });
    this.set({ plan, phase: 'teaching', tools: [], lastUsage: response.usage });
    await this.checkpoint();
  }
  private async append(
    kind: MessageInsert['kind'],
    content: string,
    patch: Partial<MessageInsert> = {},
    state: (message: Message) => Partial<StudyState> = () => ({}),
  ): Promise<Message> {
    const s = this.state;
    const message = await this.c.repos.messages.append({
      book_id: this.bookId,
      section_id: s.main.sectionId,
      conversation_id: s.conversation?.id,
      part_no: s.main.part,
      step_no: s.main.step,
      kind,
      content,
      detour_id: this.top()?.detourId ?? null,
      created_at: this.now(),
      ...patch,
    });
    this.set({
      messages: [...this.state.messages, message],
      ...state(message),
    });
    if (kind === 'user' && s.conversation?.title === '新对话') {
      const title = content.slice(0, 50);
      await this.c.repos.conversations.update(s.conversation.id, { title });
      this.set({ conversation: { ...s.conversation, title } });
    }
    return message;
  }
  private async card(card: StudyCard, inContext = false) {
    return this.append('card', JSON.stringify(card), { in_context: inContext });
  }
  private async replaceMessage(message: Message) {
    this.set({
      messages: this.state.messages.map(item =>
        item.id === message.id ? message : item,
      ),
    });
  }
  private async stepHeader() {
    const s = this.state,
      step = s.plan?.steps[s.main.step];
    if (!step) return;
    await this.card({
      kind: 'stepHeader',
      step: s.main.step,
      label: `第 ${s.main.step + 1} 步`,
      title: step.title,
      pages:
        s.section?.page_from != null
          ? pageLabel(s.book ?? { page_offset: 0 }, s.section.page_from)
          : '',
    });
  }
  private turn(intent: string, extra: Record<string, JsonValue> = {}) {
    const s = this.state,
      step = s.plan?.steps[s.main.step];
    const turn = {
      intent,
      section: s.main.sectionId,
      part: s.main.part,
      parts: s.parts.length,
      step: s.main.step,
      steps: s.plan?.steps.length ?? 0,
      step_blocks: step ? [step.block_from, step.block_to] : [],
      step_title: step?.title ?? '',
      skipped:
        s.plan?.steps
          .filter(item => item.status === 'skipped')
          .map(item => item.no) ?? [],
      reminder: this.reminder,
      ...extra,
    };
    this.reminder = null;
    return asJson(turn);
  }
  private async request(
    intent: string,
    text: string,
    question = false,
    extra: Record<string, JsonValue> = {},
    existingUser?: Message,
  ) {
    if (this.controller?.signal.aborted) return;
    const quote = existingUser?.quote_seq ?? this.state.pendingQuote;
    if (!existingUser && question && quote !== null) {
      const block = await this.c.repos.blocks.get(this.bookId, quote);
      if (block?.section_id) {
        if (!(await this.enterDetour(block.section_id))) return;
        if (!this.state.partBlocks.some(item => item.seq === quote))
          await this.loadSectionSource(block.section_id, quote);
      }
    }
    const savedTurn = existingUser
      ? partsOf(existingUser).find(
          part => part.t === 'text' && part.text.startsWith('<turn>'),
        )
      : null;
    const turn: JsonValue =
      savedTurn?.t === 'text'
        ? (JSON.parse(savedTurn.text.slice(6, -7)) as JsonValue)
        : this.turn(intent, {
            ...extra,
            ...(quote !== null ? { quote_seq: quote } : {}),
          });
    const operation = `<turn>${stableStringify(turn).replace(
      /</g,
      '\\u003c',
    )}</turn>`;
    const user =
      existingUser ??
      (await this.append('user', text, {
        intent,
        quote_seq: quote,
        parts: asJson([
          { t: 'text', text },
          { t: 'text', text: operation },
        ]) as JsonValue[],
      }));
    this.retryAction = () => this.request(intent, text, question, extra, user);
    this.set({
      pendingQuote: null,
      phase: intent === 'quiz' ? 'quiz' : 'teaching',
    });
    await this.checkpoint();
    const stuck = await this.c.repos.notes.stuck.list(this.bookId, undefined, {
      resolved: false,
    });
    const groups: ConversationGroup<NonNullable<StoredMessage['ui']>>[] = [];
    for (const message of this.state.messages.filter(item => item.in_context)) {
      if (message.kind === 'card') {
        const card = parseStudyCard(message.content);
        if (card?.kind === 'fold')
          groups.push({
            id: String(message.id),
            messages: [],
            kind: 'detour-summary',
            sectionId: card.sectionId,
            summary: card.summary,
          });
        if (card?.kind === 'partSummary')
          groups.push({
            id: String(message.id),
            messages: [],
            kind: 'part-summary',
            sectionId: message.section_id,
            summary: card.summary,
          });
      } else if (
        message.part_no === this.state.main.part ||
        message.detour_id !== null
      ) {
        groups.push({ id: String(message.id), messages: [stored(message)] });
      }
    }
    const loaded: LoadedContext<NonNullable<StoredMessage['ui']>>[] = [];
    const readNames = new Set([
      'load_section',
      'search_book',
      'get_figure',
      'get_notes',
    ]);
    for (let index = 0; index < groups.length; index++) {
      const group = groups[index],
        first = group.messages[0];
      if (!first || first.role !== 'assistant') continue;
      const calls = first.parts.filter(part => part.t === 'call');
      if (
        !calls.length ||
        !calls.every(call => call.t === 'call' && readNames.has(call.name))
      )
        continue;
      const paired = [first];
      let following = index + 1;
      while (
        following < groups.length &&
        groups[following].messages[0]?.role === 'tool'
      ) {
        paired.push(...groups[following].messages);
        following++;
      }
      const results = paired
        .flatMap(message => message.parts)
        .filter(part => part.t === 'result');
      if (
        !calls.every(
          call =>
            call.t === 'call' &&
            results.some(
              result => result.t === 'result' && result.id === call.id,
            ),
        )
      )
        continue;
      const detour = this.state.messages.find(
        message => message.id === first.id,
      )?.detour_id;
      const sectionId =
        this.state.detours.find(frame => frame.detourId === detour)
          ?.sectionId ?? this.state.main.sectionId;
      loaded.push({
        id: group.id,
        sectionId,
        messages: paired,
        detour: !!detour,
        summary:
          this.state.sections.find(section => section.id === sectionId)
            ?.summary ?? undefined,
      });
      groups.splice(index, following - index);
      index--;
    }
    const assemble = () =>
      buildContext({
        system: buildTeachPrompt(this.state.prefs),
        sections: this.state.sections,
        currentSectionId: this.state.main.sectionId,
        currentBlocks: this.state.partBlocks,
        studyRecord: {
          progress: asJson(this.state.main),
          stuck: stuck.map(item => ({
            sectionId: item.section_id,
            text: item.text,
          })),
          recentQuestions: this.state.messages
            .filter(item => item.intent === 'ask')
            .map(item => item.content),
        },
        conversation: groups,
        loaded,
        turn,
        pageOffset: this.state.book?.page_offset ?? 0,
      });
    let context = assemble();
    if (context.overBudget) {
      const earlier = this.state.messages.filter(
        message =>
          message.in_context &&
          message.id < user.id &&
          (message.kind !== 'card' ||
            ['fold', 'partSummary'].includes(
              parseStudyCard(message.content)?.kind ?? '',
            )),
      );
      if (earlier.length) {
        const key = `study.compact.${this.bookId}.${
          this.state.main.sectionId
        }.${earlier.at(-1)!.id}`;
        let summary = await this.c.repos.settings.get<string | null>(key, null);
        if (!summary) {
          const result = await this.task('compact', {
            messages: earlier.map(message => ({
              kind: message.kind,
              content: message.content,
            })),
          });
          summary = stringValue(result.summary);
          if (!summary) throw new Error('对话压缩失败，请重试');
          await this.c.repos.settings.set(key, summary);
        }
        const ids = earlier.map(message => message.id);
        await this.c.repos.messages.markOutOfContext(ids);
        this.set({
          messages: this.state.messages.map(message =>
            ids.includes(message.id)
              ? { ...message, in_context: false }
              : message,
          ),
        });
        const compact = await this.card(
          { kind: 'partSummary', part: this.state.main.part, summary },
          true,
        );
        loaded.splice(0, loaded.length);
        groups.splice(
          0,
          groups.length,
          {
            id: String(compact.id),
            messages: [],
            kind: 'part-summary',
            sectionId: this.state.main.sectionId,
            summary,
          },
          { id: String(user.id), messages: [stored(user)] },
        );
        context = assemble();
      }
      if (context.overBudget)
        throw new Error('本段上下文过长，请切换到较短的段落后重试');
    }
    this.set({ context: context.estimate });
    const sourceRefs = new Set<number>();
    for (const group of loaded)
      for (const item of group.messages) {
        const message = this.state.messages.find(value => value.id === item.id);
        for (const ref of message?.allowed_refs ?? []) sourceRefs.add(ref);
        for (const part of item.parts)
          if (part.t === 'result')
            for (const match of part.output.matchAll(/<block id="b(\d+)"/g))
              sourceRefs.add(Number(match[1]));
      }
    const loadedBlocks = (
      await Promise.all(
        [...sourceRefs].map(ref => this.c.repos.blocks.get(this.bookId, ref)),
      )
    ).filter((block): block is Block => !!block);
    const round: Round = {
      request: {
        system:
          context.system +
          (this.state.config?.search
            ? '\n联网搜索已开启。将互联网补充信息与原书内容明确区分，提供来源网址；互联网内容不能冒充原书引用。'
            : ''),
        contextBlocks: context.contextBlocks,
        history: context.history,
        tools: TOOL_DEFS,
        bookId: this.bookId,
        config: this.state.config ?? undefined,
      },
      blocks: [...this.state.partBlocks, ...loadedBlocks],
      allowed: new Set(
        [...this.state.partBlocks, ...loadedBlocks].map(block => block.seq),
      ),
      intent,
      user,
      question: question ? text : undefined,
      calls: 0,
      rounds: 0,
    };
    this.retryAction = () => this.loop(round);
    await this.loop(round);
  }
  private stopStream() {
    if (this.streamTimer) {
      clearTimeout(this.streamTimer);
      this.streamTimer = null;
    }
  }
  /** Publish received text at most every 50ms; the view paces the reveal itself. */
  private streamText(full: string) {
    this.lastStream = full;
    this.streamTimer ??= setTimeout(() => {
      this.streamTimer = null;
      const streaming = this.state.streaming;
      if (streaming)
        this.set({ streaming: { ...streaming, text: this.lastStream } });
    }, 50);
  }
  private async loop(round: Round) {
    const signal = this.controller!.signal;
    for (;;) {
      if (round.rounds >= 6) {
        this.set({ error: 'AI 服务未遵守工具调用上限，请重试' });
        return;
      }
      round.rounds++;
      this.lastStream = '';
      this.set({
        streaming: {
          entryId: `stream-${++this.sequence}`,
          text: '',
          allowedRefs: [...round.allowed],
          detourId: this.top()?.detourId ?? null,
        },
      });
      let response;
      try {
        response = await this.c.ai.stream('teach', round.request, {
          signal,
          onText: full => this.streamText(full),
        });
      } catch (error) {
        this.stopStream();
        if (signal.aborted) {
          if (this.lastStream)
            await this.saveAnswer(
              this.lastStream + '\n\n（已停止）',
              [{ t: 'text', text: this.lastStream + '\n\n（已停止）' }],
              null,
              null,
              round,
            );
          this.set({ notice: '已停止' });
          this.retryAction = null;
          return;
        }
        throw error;
      }
      this.stopStream();
      if (signal.aborted) {
        const partial = this.lastStream || textOf(response.parts);
        if (partial)
          await this.saveAnswer(
            partial + '\n\n（已停止）',
            [{ t: 'text', text: partial + '\n\n（已停止）' }],
            null,
            response.usage,
            round,
          );
        this.retryAction = null;
        return;
      }
      const calls = response.parts.filter(
        (part): part is Extract<Part, { t: 'call' }> => part.t === 'call',
      );
      const content = textOf(response.parts);
      const saved = await this.saveAnswer(
        content,
        response.parts,
        response.raw,
        response.usage,
        round,
        calls.length === 0,
      );
      this.set({ streaming: null, lastUsage: response.usage });
      round.request = {
        ...round.request,
        history: [...round.request.history, stored(saved)],
      };
      if (!calls.length) {
        this.retryAction = null;
        return;
      }
      let deferred = false;
      for (const call of calls) {
        round.calls++;
        let output: string;
        let sourceRefs: number[] = [];
        if (deferred) {
          output = JSON.stringify({
            error: '已有操作等待用户处理，请先等待用户选择',
          });
        } else if (
          round.calls > 4 ||
          round.rounds >= 5 ||
          round.request.noTools
        ) {
          output = JSON.stringify({
            error: '本轮工具调用次数已用完，请直接回答',
          });
        } else {
          try {
            const args = parseToolArgs(call.args);
            if (call.name === 'show_quiz') {
              const options = stringList(args.options),
                answer = args.answer;
              if (
                options.length < 3 ||
                options.length > 4 ||
                typeof answer !== 'number' ||
                !Number.isInteger(answer) ||
                answer < 0 ||
                answer >= options.length ||
                !stringValue(args.question)
              )
                throw new Error('无效测验');
              await this.card({
                kind: 'quiz',
                question: stringValue(args.question),
                options,
                answer,
                explain: stringValue(args.explain),
                final: args.final === true,
                picked: null,
                toolCall: { id: call.id, name: call.name },
              });
              this.set({ phase: 'quiz' });
              deferred = true;
              continue;
            }
            if (
              call.name === 'mark_stuck' ||
              call.name === 'advance_progress'
            ) {
              if (call.name === 'mark_stuck' && !stringValue(args.text).trim())
                throw new Error('卡点不能为空');
              const to = args.to;
              if (
                call.name === 'advance_progress' &&
                to !== 'next_step' &&
                to !== 'next_part' &&
                to !== 'section_done'
              )
                throw new Error('进度无效');
              await this.card({
                kind: 'proposal',
                type: call.name,
                title:
                  call.name === 'mark_stuck'
                    ? 'AI 建议 · 记为卡点'
                    : 'AI 建议 · 推进进度',
                body: stringValue(args.reason, stringValue(args.text)),
                state: 'pending',
                text: stringValue(args.text),
                ...(to === 'next_step' ||
                to === 'next_part' ||
                to === 'section_done'
                  ? { to }
                  : {}),
                toolCall: { id: call.id, name: call.name },
              });
              deferred = true;
              continue;
            }
            const id = `${call.id}-${round.calls}`;
            this.set({
              tools: [
                ...this.state.tools,
                { id, text: '正在读取…', running: true, detour: !!this.top() },
              ],
            });
            const result = await executeReadTool(
              this.c,
              this.bookId,
              call.name,
              args,
            );
            let entered = true;
            if (call.name === 'load_section' && result.section)
              entered = await this.enterDetour(result.section.id);
            output = entered
              ? result.output
              : JSON.stringify({
                  error: '已在第 2 层岔路，先请用户决定是否回主线',
                });
            if (entered) {
              sourceRefs = result.allowedRefs;
              result.blocks.forEach(block => round.allowed.add(block.seq));
              round.blocks.push(...result.blocks);
            }
            this.set({
              tools: this.state.tools.map(item =>
                item.id === id
                  ? { ...item, text: result.label, running: false }
                  : item,
              ),
            });
          } catch {
            output = JSON.stringify({
              error: '工具参数无效或读取失败，请检查后直接回答',
            });
          }
        }
        const result = await this.toolResult(
          call.id,
          call.name,
          output,
          sourceRefs,
        );
        round.request = {
          ...round.request,
          history: [...round.request.history, stored(result)],
        };
      }
      await this.checkpoint();
      if (deferred) {
        this.retryAction = null;
        return;
      }
      if (round.calls >= 4 || round.rounds >= 5)
        round.request = { ...round.request, noTools: true };
      // One final no-tools response prevents a provider that ignores noTools from looping forever.
      if (round.rounds > 6) {
        this.set({ error: 'AI 服务未遵守工具调用上限，请重试' });
        return;
      }
    }
  }
  private async saveAnswer(
    content: string,
    parts: Part[],
    raw: RawOutput | null,
    usage: Usage | null,
    round: Round,
    complete = true,
  ) {
    const checked = validateCitations(parse(content), {
      allowedRefs: round.allowed,
      blocks: round.blocks,
      mainSectionId: this.state.main.sectionId,
    });
    const message = await this.append(
      'assistant',
      content,
      {
        parts: asJson(parts) as JsonValue[],
        raw: raw ? asJson(raw) : null,
        allowed_refs: [...round.allowed],
        unverified: checked.unverifiedCount,
        usage: usage ? asJson(usage) : null,
        intent: round.intent,
      },
      // Swap the live entry for the saved message in one update, keeping its list key.
      saved => {
        const streaming = this.state.streaming;
        return streaming
          ? {
              streaming: null,
              streamKeys: {
                ...this.state.streamKeys,
                [saved.id]: streaming.entryId,
              },
            }
          : {};
      },
    );
    if (complete) {
      const next = advanceCitationStreak(
        this.state.unverifiedStreak,
        checked.hasUnverifiedCitation,
      );
      this.reminder = next.reminder;
      this.set({ unverifiedStreak: next.streak });
      if (round.question && content) {
        const sectionId = this.top()?.sectionId ?? this.state.main.sectionId;
        const answer = truncateText(content, 80),
          question = truncateText(round.question, 60),
          ids = [round.user.id, message.id];
        const qa = await this.c.repos.notes.qa.add({
          book_id: this.bookId,
          section_id: sectionId,
          q: question,
          a: answer,
          from_section: this.top() ? this.state.main.sectionId : null,
          detour_id: this.top()?.detourId ?? null,
          message_ids: ids,
          created_at: this.now(),
        });
        const anchor =
          round.user.quote_seq ??
          checked.verifiedRefs.find(
            seq =>
              round.blocks.find(block => block.seq === seq)?.section_id ===
              this.state.main.sectionId,
          );
        let pinId: number | undefined;
        if (anchor !== undefined && anchor !== null) {
          const pin = await this.c.repos.notes.pins.add({
            book_id: this.bookId,
            section_id: sectionId,
            block_seq: anchor,
            question: truncateText(round.question, 18),
            answer_summary: answer,
            message_ids: ids,
            created_at: this.now(),
          });
          pinId = pin.id;
        }
        this.summarizeQa(qa.id, pinId, round.question, content);
        this.set({ notice: `这段问答已记入 ${sectionId} 的学习记录` });
      }
    }
    return message;
  }
  private summarizeQa(
    qaId: number,
    pinId: number | undefined,
    question: string,
    answer: string,
  ): void {
    const controller = new AbortController();
    this.extraControllers.add(controller);
    const work = this.task('pinTitle', { question, answer }, controller.signal)
      .then(async result => {
        const summary = truncateText(stringValue(result.answer), 80),
          title = truncateText(stringValue(result.question), 18);
        if (!summary || controller.signal.aborted) return;
        await this.c.db.transaction(async tx => {
          await tx.run('UPDATE qa SET a=? WHERE id=?', [summary, qaId]);
          if (pinId !== undefined)
            await tx.run(
              'UPDATE pin SET question=?,answer_summary=? WHERE id=?',
              [title || truncateText(question, 18), summary, pinId],
            );
        });
      })
      .catch(() => {})
      .finally(() => {
        this.extraControllers.delete(controller);
        this.background.delete(work);
      });
    this.background.add(work);
  }
  private async toolResult(
    id: string,
    name: string,
    output: string,
    allowedRefs: number[] = [],
  ) {
    return this.append('tool', output, {
      allowed_refs: allowedRefs,
      parts: asJson([{ t: 'result', id, name, output }]) as JsonValue[],
    });
  }
  retry(): Promise<void> {
    const retry = this.retryAction;
    if (!retry) return Promise.resolve();
    return this.run(retry);
  }
  stop() {
    this.controller?.abort();
    for (const controller of this.extraControllers) controller.abort();
  }
  private hasPendingTool(): boolean {
    return this.state.messages.some(message => {
      if (message.kind !== 'card') return false;
      const card = parseStudyCard(message.content);
      return (
        (card?.kind === 'quiz' && card.picked === null && !card.deferred) ||
        (card?.kind === 'proposal' &&
          card.state === 'pending' &&
          !!card.toolCall)
      );
    });
  }
  send(text: string): Promise<void> {
    if (!text.trim()) return Promise.resolve();
    if (
      this.state.messages.some(message => {
        const card =
          message.kind === 'card' ? parseStudyCard(message.content) : null;
        return (
          card?.kind === 'proposal' &&
          card.state === 'pending' &&
          !!card.toolCall
        );
      })
    ) {
      this.set({ notice: '请先确认或取消 AI 建议' });
      return Promise.resolve();
    }
    return this.run(async () => {
      await this.deferPendingQuizzes();
      await this.ensurePlan();
      await this.request('ask', text.trim(), true);
    });
  }
  private async deferPendingQuizzes(messageId?: number): Promise<void> {
    const deferred = await deferQuizzes(this.c, this.state.messages, messageId);
    for (const message of deferred.updated) await this.replaceMessage(message);
    if (deferred.results.length)
      this.set({ messages: [...this.state.messages, ...deferred.results] });
    if (deferred.updated.length && this.state.phase === 'quiz') {
      const final = deferred.updated.some(message => {
        const card = parseStudyCard(message.content);
        return card?.kind === 'quiz' && card.final;
      });
      this.set({ phase: final ? 'ready' : 'teaching' });
      await this.checkpoint();
    }
  }
  deferQuiz(messageId: number): Promise<void> {
    return this.run(async () => {
      await this.deferPendingQuizzes(messageId);
      this.set({ notice: '已暂时跳过，之后仍可回来看题。' });
    });
  }
  act(key: QuickKey): Promise<void> {
    if (key !== 'source' && key !== 'detourSource' && this.hasPendingTool()) {
      this.set({ notice: '请先完成测验或处理 AI 建议' });
      return Promise.resolve();
    }
    if (key === 'source' || key === 'detourSource') return this.setMode('read');
    return this.run(async () => {
      await this.ensurePlan();
      if (key === 'backMain') {
        await this.backMainInternal(false);
        return;
      }
      if (key === 'nextSection') {
        await this.makeDraft();
        return;
      }
      if (key === 'reviewOk') {
        const stuck = this.top()?.reviewStuckId;
        if (stuck) {
          await this.c.repos.notes.stuck.resolve(stuck, this.now());
          this.c.events.emit('stuck.changed', {
            bookId: this.bookId,
            sectionId: this.top()!.sectionId,
          });
        }
        await this.backMainInternal(false);
        return;
      }
      if (key === 'reteachSection') {
        const s = this.state;
        if (!s.plan) return;
        const plans = await Promise.all(
          s.parts.map(part =>
            this.c.repos.plans.get(this.bookId, s.main.sectionId, part.part_no),
          ),
        );
        for (const plan of plans)
          if (plan)
            await this.c.repos.plans.put({
              ...plan,
              steps: plan.steps.map((step, i) => ({
                ...step,
                status: plan.part_no === 0 && i === 0 ? 'current' : 'todo',
              })),
            });
        await this.c.repos.messages.markOutOfContext(s.messages.map(m => m.id));
        this.set({ main: { ...s.main, part: 0, step: 0 }, phase: 'teaching' });
        await this.loadMain();
        await this.checkpoint();
        await this.ensurePlan();
        await this.stepHeader();
        await this.request(key, labels[key]!);
        return;
      }
      if (key === 'next' || key === 'skip') {
        await this.advance(key === 'skip');
        return;
      }
      if (key === 'nextPart') {
        await this.nextPart();
        return;
      }
      if (key === 'alt') {
        const title = this.state.plan?.steps[this.state.main.step]?.title;
        if (title)
          this.set({
            stuckCandidates: [
              ...new Set([...this.state.stuckCandidates, title]),
            ],
          });
      }
      await this.request(
        key,
        labels[key] ?? key,
        false,
        key === 'quiz' ? { want_tool: 'show_quiz' } : {},
      );
    });
  }
  private async setStep(
    index: number,
    status: 'done' | 'skipped' | 'current' | 'todo',
  ) {
    const s = this.state,
      step = s.plan?.steps[index];
    if (!step) return;
    const plan = await this.c.repos.plans.setStepStatus(
      this.bookId,
      s.main.sectionId,
      s.main.part,
      step.no,
      status,
    );
    this.set({ plan });
  }
  private async advance(skip = false) {
    if (this.top()) {
      this.set({ notice: '请先回到主线，再推进学习进度' });
      return;
    }
    const s = this.state;
    if (!s.plan) return;
    await this.setStep(s.main.step, skip ? 'skipped' : 'done');
    if (skip)
      await this.card({
        kind: 'divider',
        text: `跳过了第 ${s.main.step + 1} 步`,
        tone: 'main',
      });
    if (s.main.step + 1 < s.plan.steps.length) {
      this.set({
        main: { ...s.main, step: s.main.step + 1 },
        phase: 'teaching',
      });
      await this.setStep(s.main.step + 1, 'current');
      await this.checkpoint();
      await this.stepHeader();
      await this.request(
        skip ? 'skip' : 'next',
        labels[skip ? 'skip' : 'next']!,
      );
    } else if (s.main.part + 1 < s.parts.length) {
      await this.nextPart();
    } else if (s.prefs.quizAtEnd) {
      this.set({ phase: 'quiz' });
      await this.checkpoint();
      await this.request('quiz', '考考我，检查本节是否掌握', false, {
        want_tool: 'show_quiz',
        final: true,
      });
    } else {
      await this.ready();
    }
  }
  private async ready() {
    this.set({ phase: 'ready' });
    await this.checkpoint();
    await this.card({
      kind: 'done',
      title: '这一节讲完了',
      text: '整理小结，把重点和卡点留下来',
    });
  }
  private async nextPart() {
    const s = this.state;
    if (this.top()) {
      this.set({ notice: '请先回到主线' });
      return;
    }
    if (s.main.part + 1 >= s.parts.length) {
      await this.ready();
      return;
    }
    await this.setStep((s.plan?.steps.length ?? 1) - 1, 'done');
    const result = await this.task('partSummary', {
      section: s.main.sectionId,
      part: s.main.part,
      messages: s.messages
        .filter(m => m.part_no === s.main.part && m.kind !== 'card')
        .map(m => m.content),
    });
    await this.card(
      {
        kind: 'partSummary',
        part: s.main.part,
        summary: stringValue(result.summary),
      },
      true,
    );
    await this.c.repos.messages.markOutOfContext(
      s.messages.filter(m => m.part_no === s.main.part).map(m => m.id),
    );
    this.set({
      main: { ...s.main, part: s.main.part + 1, step: 0 },
      phase: 'idle',
    });
    await this.loadMain();
    await this.checkpoint();
    await this.ensurePlan();
    await this.stepHeader();
    await this.request('nextPart', labels.nextPart!);
  }
  jumpStep(index: number): Promise<void> {
    return this.run(() => this.jumpInternal(index));
  }
  private async jumpInternal(index: number) {
    await this.ensurePlan();
    const s = this.state,
      step = s.plan?.steps[index];
    if (!step) return;
    if (step.status !== 'todo') {
      this.set({ scrollToStep: index, notice: `听讲 · 第 ${index + 1} 步` });
      return;
    }
    if (s.plan?.steps[s.main.step]?.status === 'current')
      await this.setStep(s.main.step, 'todo');
    this.set({
      main: { ...s.main, step: index },
      phase: 'teaching',
      scrollToStep: index,
    });
    await this.setStep(index, 'current');
    await this.checkpoint();
    await this.stepHeader();
    await this.request('jumpStep', `从第 ${index + 1} 步开始讲`);
  }
  private async enterDetour(sectionId: string, stuckId?: number) {
    const s = this.state,
      event = stuckId
        ? { t: 'review' as const, sectionId, stuckId }
        : { t: 'load' as const, sectionId };
    const reduction = reduceDetour(
      { main: s.main.sectionId, stack: s.detours },
      event,
    );
    if (reduction.effects.includes('askReturnFirst')) {
      this.set({ notice: '已在第 2 层岔路，请先回到主线' });
      return false;
    }
    if (!reduction.effects.includes('startDetour')) return true;
    const detour = await this.c.repos.detours.start({
      book_id: this.bookId,
      from_section: this.top()?.sectionId ?? s.main.sectionId,
      to_section: sectionId,
      depth: s.detours.length + 1,
      stuck_id: stuckId ?? null,
      started_at: this.now(),
    });
    const result = reduceDetour(
      { main: s.main.sectionId, stack: s.detours },
      { ...event, detourId: detour.id },
    );
    this.set({ detours: result.next.stack });
    const section = s.sections.find(item => item.id === sectionId);
    await this.card({
      kind: 'divider',
      text: `岔路 · ${sectionId} ${section?.title ?? ''}`,
      tone: 'detour',
    });
    await this.checkpoint();
    return true;
  }
  private async loadSectionSource(sectionId: string, quote?: number) {
    const ranges = await this.c.repos.sections.parts(this.bookId, sectionId);
    const part =
      quote === undefined
        ? undefined
        : ranges.find(
            range => quote >= range.block_from && quote <= range.block_to,
          );
    const args = { id: sectionId, ...(part ? { part: part.part_no } : {}) };
    const source = await executeReadTool(
      this.c,
      this.bookId,
      'load_section',
      args,
    );
    const callId = `source-${++this.sequence}`;
    await this.append('assistant', '', {
      parts: asJson([
        {
          t: 'call',
          id: callId,
          name: 'load_section',
          args: JSON.stringify(args),
        },
      ]) as JsonValue[],
    });
    await this.toolResult(
      callId,
      'load_section',
      source.output,
      source.allowedRefs,
    );
  }
  backMain(rebase = false): Promise<void> {
    return this.run(() => this.backMainInternal(rebase));
  }
  private async backMainInternal(rebase: boolean) {
    if (!this.top()) return;
    await this.foldDetours(rebase);
    if (rebase) {
      await this.loadMain();
      await this.ensurePlan();
      await this.stepHeader();
    }
    await this.card({
      kind: 'divider',
      text: `回到主线 · ${this.state.main.sectionId} ${
        this.state.section?.title ?? ''
      }`,
      tone: 'main',
    });
    await this.request('backMain', '回到主线');
    this.set({ notice: '岔路已折叠，问答已记入学习记录' });
  }
  private async foldDetours(rebase: boolean) {
    const s = this.state;
    if (!s.detours.length) return;
    const ids = s.detours.map(frame => frame.detourId),
      messages = s.messages.filter(
        message =>
          message.detour_id !== null && ids.includes(message.detour_id),
      );
    const result = await this.task('detourTitle', {
      messages: messages.map(m => ({ kind: m.kind, content: m.content })),
    });
    const title = truncateText(stringValue(result.title, '岔路讨论'), 16),
      summary = truncateText(
        stringValue(
          result.summary,
          messages.filter(m => m.kind === 'assistant').at(-1)?.content ?? title,
        ),
        80,
      );
    for (const frame of [...s.detours].reverse())
      await this.c.repos.detours.end(frame.detourId, title, this.now());
    await this.c.repos.messages.markOutOfContext(messages.map(m => m.id));
    this.set({
      detours: [],
      messages: this.state.messages.map(message =>
        messages.some(m => m.id === message.id)
          ? { ...message, in_context: false }
          : message,
      ),
    });
    await this.card(
      {
        kind: 'fold',
        title: `已解决：${title}`,
        summary,
        count: messages.length,
        messageIds: messages.map(m => m.id),
        detourIds: ids,
        sectionId: s.detours.at(-1)!.sectionId,
      },
      true,
    );
    if (rebase) {
      this.set({
        main: { sectionId: s.detours.at(-1)!.sectionId, part: 0, step: 0 },
        phase: 'idle',
      });
      await this.c.repos.sections.update(
        this.bookId,
        this.state.main.sectionId,
        { status: 'learning' },
      );
    }
    await this.checkpoint();
  }
  private flash(seq: number | null): void {
    if (this.flashTimer) clearTimeout(this.flashTimer);
    this.set({ flashRef: seq });
    this.flashTimer = setTimeout(() => {
      this.flashTimer = null;
      this.set({ flashRef: null });
    }, 2000);
  }
  async setMode(mode: 'read' | 'listen', anchor?: number) {
    const previous = this.state.mode;
    if (mode === 'read') {
      const seq =
        anchor ??
        (this.top()
          ? this.state.sections.find(
              section => section.id === this.top()?.sectionId,
            )?.block_from
          : null) ??
        this.state.plan?.steps[this.state.main.step]?.block_from ??
        this.state.readAnchor;
      this.set({
        mode,
        readAnchor: seq,
        flashRef: seq,
        readerSectionId: this.top()?.sectionId ?? null,
      });
      this.flash(seq);
      await this.checkpoint();
      return;
    }
    this.set({ mode });
    await this.checkpoint();
    if (anchor === undefined && this.state.pendingQuote !== null) return;
    const seq = anchor ?? (previous === 'read' ? this.state.readAnchor : null);
    if (seq !== null && seq !== undefined)
      await this.run(() => this.anchorToStep(seq));
  }
  private async anchorToStep(seq: number) {
    const s = this.state;
    const part = s.parts.find(
      item => seq >= item.block_from && seq <= item.block_to,
    );
    if (!part) return;
    if (part.part_no !== s.main.part) {
      this.set({ main: { ...s.main, part: part.part_no, step: 0 } });
      await this.loadMain();
      await this.ensurePlan();
      await this.checkpoint();
    }
    await this.ensurePlan();
    const index =
      this.state.plan?.steps.findIndex(
        step => seq >= step.block_from && seq <= step.block_to,
      ) ?? -1;
    if (index >= 0) await this.jumpInternal(index);
  }
  async setReaderView(readerView: 'orig' | 'flow') {
    this.set({ readerView });
    await this.checkpoint();
  }
  reportAnchor(seq: number) {
    this.set({ readAnchor: seq });
    if (this.anchorTimer) clearTimeout(this.anchorTimer);
    this.anchorTimer = setTimeout(() => {
      this.anchorTimer = null;
      this.anchorWrite = this.anchorWrite
        .then(() =>
          this.c.repos.study.patch(this.bookId, {
            read_anchor: seq,
            last_active_at: this.now(),
          }),
        )
        .catch(() => {
          this.set({ error: '阅读位置保存失败，请重试' });
        });
    }, 500);
  }
  setQuote(seq: number | null) {
    this.set({ pendingQuote: seq });
  }
  answerQuiz(messageId: number, index: number): Promise<void> {
    return this.run(async () => {
      const message = this.state.messages.find(m => m.id === messageId),
        card = message ? parseStudyCard(message.content) : null;
      if (
        !message ||
        card?.kind !== 'quiz' ||
        card.picked !== null ||
        !card.options[index]
      )
        return;
      const updated = await this.c.repos.messages.update(message.id, {
        content: JSON.stringify({ ...card, picked: index }),
      });
      if (updated) await this.replaceMessage(updated);
      const correct = index === card.answer;
      if (card.toolCall)
        await this.toolResult(
          card.toolCall.id,
          card.toolCall.name,
          JSON.stringify({ picked: index, correct }),
        );
      if (card.final) {
        this.set({ phase: 'ready' });
        await this.checkpoint();
      }
      await this.request(
        'quizAnswer',
        `我选 ${String.fromCharCode(65 + index)}：${card.options[index]}`,
        false,
        { correct, final: card.final },
      );
      if (!correct) {
        this.set({
          stuckCandidates: [
            ...new Set([...this.state.stuckCandidates, card.question]),
          ],
        });
        await this.card({
          kind: 'proposal',
          type: 'mark_stuck',
          title: 'AI 建议 · 记为卡点',
          body: card.question,
          text: card.question,
          state: 'pending',
        });
      }
      if (card.final) await this.ready();
    });
  }
  resolveProposal(messageId: number, accept: boolean): Promise<void> {
    return this.run(async () => {
      const message = this.state.messages.find(m => m.id === messageId),
        card = message ? parseStudyCard(message.content) : null;
      if (!message || card?.kind !== 'proposal' || card.state !== 'pending')
        return;
      const updated = await this.c.repos.messages.update(message.id, {
        content: JSON.stringify({
          ...card,
          state: accept ? 'accepted' : 'dismissed',
        }),
      });
      if (updated) await this.replaceMessage(updated);
      if (card.toolCall)
        await this.toolResult(
          card.toolCall.id,
          card.toolCall.name,
          JSON.stringify({ accepted: accept }),
        );
      if (accept && card.type === 'mark_stuck' && card.text) {
        const sectionId = this.top()?.sectionId ?? this.state.main.sectionId;
        const existing = await this.c.repos.notes.stuck.list(
          this.bookId,
          sectionId,
          { resolved: false },
        );
        if (!existing.some(item => item.text === card.text))
          await this.c.repos.notes.stuck.add({
            book_id: this.bookId,
            section_id: sectionId,
            text: card.text,
            source: 'ai',
            created_at: this.now(),
          });
        this.c.events.emit('stuck.changed', { bookId: this.bookId, sectionId });
        this.set({ notice: '已记为卡点' });
      }
      if (accept && card.type === 'advance_progress') {
        if (card.to === 'next_step') await this.advance();
        if (card.to === 'next_part') await this.nextPart();
        if (card.to === 'section_done') await this.makeDraft();
      }
    });
  }
  private async showResume(days: number) {
    const stuck = await this.c.repos.notes.stuck.list(this.bookId, undefined, {
      resolved: false,
    });
    const data = await this.task('recap', {
      days,
      progress: this.state.main,
      titles:
        this.state.plan?.steps
          .filter(step => step.status === 'done')
          .map(step => step.title) ?? [],
      stuck: stuck.map(item => item.text),
      questions: this.state.messages
        .filter(m => m.intent === 'ask')
        .slice(-3)
        .map(m => m.content),
    });
    await this.card(
      {
        kind: 'resume',
        title: `续学 · 距上次 ${days} 天`,
        lines: stringList(data.lines).slice(0, 3),
        hasStuck: !!stuck.length,
        stuckId: stuck[0]?.id,
      },
      true,
    );
    await this.c.repos.study.patch(this.bookId, {
      resume_shown_at: this.c.clock.today(),
    });
  }
  resume(action: 'go' | 'review'): Promise<void> {
    return this.run(async () => {
      if (action === 'review') {
        const stuck = (
          await this.c.repos.notes.stuck.list(this.bookId, undefined, {
            resolved: false,
          })
        )[0];
        if (stuck) {
          if (!(await this.enterDetour(stuck.section_id, stuck.id))) return;
          await this.loadSectionSource(stuck.section_id);
          await this.request(
            'review',
            `请重新讲解这个卡点：${stuck.text}`,
            true,
          );
          return;
        }
      }
      await this.ensurePlan();
      await this.request('resume', '直接继续当前步骤');
    });
  }
  async finishDraft(): Promise<SectionDraft | null> {
    await this.run(() => this.makeDraft());
    return this.state.draft;
  }
  private async makeDraft() {
    const s = this.state;
    const [qa, stuck, nextSection] = await Promise.all([
      this.c.repos.notes.qa.list(this.bookId, s.main.sectionId),
      this.c.repos.notes.stuck.list(this.bookId, s.main.sectionId, {
        resolved: false,
      }),
      this.c.repos.sections.nextLeaf(this.bookId, s.main.sectionId),
    ]);
    let data: Record<string, JsonValue> = {};
    let draftError: string | undefined;
    try {
      data = await this.task('sectionDraft', {
        section: s.section,
        blocks: s.blocks,
        qa,
        detours: s.messages
          .filter(m => m.detour_id !== null)
          .map(m => m.content),
        wrongQuizzes: s.messages.filter(m => {
          const card = parseStudyCard(m.content);
          return (
            card?.kind === 'quiz' &&
            card.picked !== null &&
            card.picked !== card.answer
          );
        }),
        candidates: s.stuckCandidates,
      });
    } catch (error) {
      if (this.controller?.signal.aborted) return;
      draftError = toAppError(error).message;
    }
    const id = `${this.bookId}-${s.main.sectionId}-${this.now()}-${++this
      .sequence}`;
    const rawCards = Array.isArray(data.cards) ? data.cards : [];
    const cards = rawCards
      .flatMap((value, i) => {
        const item = jsonObject(value);
        return item && stringValue(item.front) && stringValue(item.back)
          ? [
              {
                id: `card-${i}`,
                front: stringValue(item.front),
                back: stringValue(item.back),
                checked: true,
                fromDetour: item.from_detour === true,
              },
            ]
          : [];
      })
      .slice(0, 5);
    const candidates = [
      ...new Set([...stuck.map(item => item.text), ...stringList(data.stuck)]),
    ];
    this.set({
      draft: {
        id,
        bookId: this.bookId,
        sectionId: s.main.sectionId,
        summary: stringValue(data.summary),
        stuck: candidates.map((text, i) => ({
          id: `stuck-${i}`,
          text,
          checked: true,
        })),
        cards,
        detours: qa
          .filter(item => item.detour_id !== null)
          .map(item => ({
            q: item.q,
            where: item.from_section ?? item.section_id,
          })),
        nextSection: nextSection ?? null,
        ...(draftError ? { error: draftError } : {}),
      },
    });
  }
  async saveDraft(input: FinishSectionInput): Promise<Section | null> {
    let next: Section | null = null;
    await this.run(async () => {
      if (
        input.bookId !== this.bookId ||
        input.sectionId !== this.state.draft?.sectionId
      )
        throw new Error('小结不匹配');
      next = await finishSection(this.c, {
        ...input,
        draftId: this.state.draft.id,
      });
      const saved = await this.c.repos.study.get(this.bookId);
      this.set({
        main: { sectionId: saved?.main_section ?? '', part: 0, step: 0 },
        phase: 'idle',
        detours: [],
        draft: null,
        sections: await this.c.repos.sections.tree(this.bookId),
      });
      await this.loadMain();
    });
    return next;
  }
  async translateSection(
    sectionId: string,
    signal?: AbortSignal,
    config?: ConversationConfig,
    refresh = false,
  ): Promise<string> {
    if (signal?.aborted) throw new Error('已停止翻译');
    const blocks = await this.c.repos.blocks.bySection(this.bookId, sectionId);
    const chunks = translationChunks(blocks);
    const source = chunks.map(chunk => chunk.source).join('\n\n');
    if (!source.trim()) throw new Error('本节暂无可翻译的原文，请先完成解析');
    const cached = await this.c.db.get<{
      source_text: string;
      content: string;
    }>(
      'SELECT source_text, content FROM section_translation WHERE book_id = ? AND section_id = ?',
      [this.bookId, sectionId],
    );
    if (!refresh && cached?.source_text === source) return cached.content;
    const controller = new AbortController();
    this.extraControllers.add(controller);
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) controller.abort();
    try {
      const answers: string[] = [];
      for (const chunk of chunks) {
        if (controller.signal.aborted) throw new Error('已停止翻译');
        if (!chunk.translate) {
          answers.push(chunk.source);
          continue;
        }
        const data = await this.task(
          'translate',
          {
            block: { text: chunk.source },
            target_language: '简体中文',
            map: this.state.sections.map(s => ({ id: s.id, title: s.title })),
          },
          controller.signal,
          'tidy',
          config,
        );
        const answer = stringValue(data.answer);
        if (!answer.trim()) throw new Error('AI 未返回译文，请重试');
        answers.push(answer);
      }
      if (controller.signal.aborted) throw new Error('已停止翻译');
      const content = answers.join('\n\n');
      await this.c.db.run(
        'INSERT OR REPLACE INTO section_translation(book_id, section_id, source_text, content, updated_at) VALUES (?, ?, ?, ?, ?)',
        [this.bookId, sectionId, source, content, this.now()],
      );
      return content;
    } finally {
      signal?.removeEventListener('abort', abort);
      this.extraControllers.delete(controller);
    }
  }
  async explainBlock(
    seq: number,
    kind: 'explain' | 'translate',
    signal?: AbortSignal,
    config?: ConversationConfig,
  ): Promise<string> {
    const block = await this.c.repos.blocks.get(this.bookId, seq);
    if (!block) throw new Error('找不到这段原文');
    const controller = new AbortController();
    this.extraControllers.add(controller);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) controller.abort();
    try {
      const data = await this.task(
        kind,
        {
          seq,
          block,
          ...(kind === 'translate' ? { target_language: '简体中文' } : {}),
          map: this.state.sections.map(section => ({
            id: section.id,
            title: section.title,
          })),
        },
        controller.signal,
        kind === 'explain' ? 'teach' : 'tidy',
        config,
      );
      const answer = stringValue(data.answer);
      if (!answer) throw new Error('AI 未返回内容，请重试');
      return answer;
    } finally {
      signal?.removeEventListener('abort', onAbort);
      this.extraControllers.delete(controller);
    }
  }
  async generateGuide(): Promise<string> {
    const id = this.state.readerSectionId ?? this.state.main.sectionId,
      section = await this.c.repos.sections.get(this.bookId, id);
    if (section?.guide) return section.guide;
    const blocks = await this.c.repos.blocks.bySection(this.bookId, id),
      controller = new AbortController();
    this.extraControllers.add(controller);
    try {
      const data = await this.task(
        'guide',
        {
          section,
          blocks,
          map: this.state.sections.map(item => ({
            id: item.id,
            title: item.title,
          })),
        },
        controller.signal,
      );
      if (!stringValue(data.one_line) || !stringValue(data.full))
        throw new Error('导读生成失败，请重试');
      const guide = JSON.stringify({
        one_line: data.one_line,
        full: data.full,
        prereq: stringList(data.prereq).filter(ref =>
          this.state.sections.some(item => item.id === ref),
        ),
      });
      await this.c.repos.sections.update(this.bookId, id, { guide });
      if (id === this.state.main.sectionId)
        this.set({
          section: this.state.section ? { ...this.state.section, guide } : null,
        });
      return guide;
    } finally {
      this.extraControllers.delete(controller);
    }
  }
  clearNotice() {
    this.set({ notice: null, error: null, flashRef: null, scrollToStep: null });
  }
  async dispose() {
    this.disposed = true;
    if (this.flashTimer) clearTimeout(this.flashTimer);
    this.stop();
    await this.active;
    await Promise.allSettled([...this.background]);
    if (this.anchorTimer) {
      clearTimeout(this.anchorTimer);
      this.anchorTimer = null;
      await this.c.repos.study.patch(this.bookId, {
        read_anchor: this.state.readAnchor,
        last_active_at: this.now(),
      });
    }
    await this.anchorWrite;
    this.stopStream();
  }
}
