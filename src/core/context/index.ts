import type { Block, JsonValue, Section } from '../types';
import { escapeXml, estimateTokens, stableStringify } from '../text';

export const DEFAULT_INPUT_BUDGET = 24_000;
export type ContextPart =
  /** volatile: rebuilt every turn, so providers must not treat it as a reusable prefix. */
  | { t: 'text'; text: string; volatile?: true }
  | { t: 'call'; id: string; name: string; args: string }
  | { t: 'result'; id: string; name: string; output: string };
/** Structural protocol boundary: no dependency from core to the AI service layer. */
export interface ContextMessage<Ui = never> {
  id: number;
  threadId: number;
  role: 'user' | 'assistant' | 'tool';
  parts: ContextPart[];
  raw: {
    protocol: 'anthropic' | 'openai' | 'chat';
    model: string;
    items: unknown[];
    providerId?: string;
  } | null;
  ui: Ui | null;
  compacted: boolean;
  createdAt: string;
}
export type SourceBlock = Pick<Block, 'seq' | 'type' | 'text'> &
  Partial<Pick<Block, 'page' | 'loc' | 'latex' | 'html' | 'refinement'>>;
export interface ConversationGroup<Ui = never> {
  id: string;
  messages: readonly ContextMessage<Ui>[];
  /** Only earlier turns may be compacted. Current turns remain byte-for-byte intact. */
  earlier?: boolean;
  summary?: string;
  /** Earlier parts and already-folded detours are summaries even below the budget. */
  kind?: 'turn' | 'part-summary' | 'detour-summary';
  sectionId?: string;
}
export interface LoadedContext<Ui = never> {
  id: string;
  sectionId: string;
  /** Include the assistant tool call and its tool result together to preserve protocol pairing. */
  messages: readonly ContextMessage<Ui>[];
  detour?: boolean;
  summary?: string;
  /**
   * Id of the conversation (or loaded) group that followed this read when it happened. The read
   * goes back there, so later turns never move it in front of history that was already sent.
   */
  before?: string;
}
export interface StudyRecordInput {
  progress: JsonValue;
  stuck?: readonly { sectionId: string; text: string }[];
  recentQuestions?: readonly string[];
}
export interface ContextInput<Ui = never> {
  system: string;
  preferences?: JsonValue;
  sections: readonly Section[];
  currentSectionId: string;
  currentBlocks: readonly SourceBlock[];
  studyRecord: StudyRecordInput;
  loaded?: readonly LoadedContext<Ui>[];
  conversation?: readonly ConversationGroup<Ui>[];
  turn: JsonValue;
  /** Original PDF page index minus this offset is the printed page number. */
  pageOffset?: number;
  budget?: number;
  /** Large books show level 3 only within the current chapter. */
  mapDetailLimit?: number;
  /** Sections being visited off the main line, such as the current detour. */
  visitingSectionIds?: readonly string[];
  threadId?: number;
}
export interface LayerEstimate {
  layer: 1 | 2 | 3 | 4 | 5 | 6;
  name: string;
  tokens: number;
  cached: boolean;
}
export interface ContextCompression {
  layer: 5 | 6;
  id: string;
  messageIds: number[];
}
export interface ContextResult<Ui = never> {
  system: string;
  contextBlocks: { text: string; cache: boolean }[];
  history: ContextMessage<Ui>[];
  estimate: LayerEstimate[];
  totalTokens: number;
  budget: number;
  overBudget: boolean;
  compressions: ContextCompression[];
  needsSummary: {
    layer: 5 | 6;
    id: string;
    reason: 'missing' | 'not-shorter';
  }[];
}

export function formatBlocks(
  blocks: readonly SourceBlock[],
  pageOffset = 0,
): string {
  return [...blocks]
    .sort((a, b) => a.seq - b.seq)
    .map(block => {
      const location =
        block.page != null
          ? ` page="${block.page - pageOffset}"`
          : block.loc
          ? ` loc="${escapeXml(block.loc)}"`
          : '';
      let text =
        block.type === 'equation'
          ? block.latex ?? block.text
          : block.type === 'table'
          ? block.html ?? block.text
          : block.text;
      if (block.refinement?.visual) {
        const v = block.refinement.visual;
        text += `\n[AI 图表重绘；${
          v.kind === 'chart'
            ? '数值由扫描图估读，不是精确原始数据'
            : '结构据原图复原'
        }]\n${JSON.stringify(v)}`;
      }
      return `<block id="b${block.seq}"${location} type="${block.type}"${
        block.refinement ? ' source="ai_refined"' : ''
      }>${escapeXml(text)}</block>`;
    })
    .join('\n');
}
export function formatBookMap(
  sections: readonly Section[],
  currentSectionId: string,
  detailLimit = 200,
  pageOffset = 0,
  /** A detour's chapter is expanded too, so its sibling sections stay visible. */
  alsoSectionIds: readonly string[] = [],
): string {
  const byId = new Map(sections.map(section => [section.id, section]));
  const chapterIds = new Set<string>();
  for (const id of [currentSectionId, ...alsoSectionIds]) {
    let current = byId.get(id);
    const seen = new Set<string>();
    while (current?.parent_id && !seen.has(current.id)) {
      seen.add(current.id);
      const parent = byId.get(current.parent_id);
      if (!parent) break;
      current = parent;
    }
    if (current) chapterIds.add(current.id);
  }
  const inChapter = (section: Section) => {
    let node: Section | undefined = section;
    const visited = new Set<string>();
    while (node && !visited.has(node.id)) {
      if (chapterIds.has(node.id)) return true;
      visited.add(node.id);
      node = node.parent_id ? byId.get(node.parent_id) : undefined;
    }
    return false;
  };
  const ordered = [...sections].sort(
    (a, b) => a.ord - b.ord || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const visible = ordered.filter(
    section =>
      sections.length <= detailLimit ||
      section.level <= 2 ||
      inChapter(section),
  );
  const lines = visible.map(
    section =>
      `${section.id} ${escapeXml(section.title)}${
        section.page_from != null
          ? ` p.${section.page_from - pageOffset}${
              section.page_to != null && section.page_to !== section.page_from
                ? `–${section.page_to - pageOffset}`
                : ''
            }`
          : ''
      } [${section.status}]`,
  );
  const summaries = ordered
    .filter(section => section.status === 'done' && section.summary)
    .map(
      section =>
        `<summary section="${escapeXml(section.id)}">${escapeXml(
          section.summary!,
        )}</summary>`,
    );
  return `<book_map>\n${lines.join(
    '\n',
  )}\n</book_map>\n<learned_summaries>\n${summaries.join(
    '\n',
  )}\n</learned_summaries>`;
}
function recordText(record: StudyRecordInput): string {
  const stuck = (record.stuck ?? [])
    .map(
      item =>
        `<stuck section="${escapeXml(item.sectionId)}">${escapeXml(
          item.text,
        )}</stuck>`,
    )
    .join('\n');
  const questions = (record.recentQuestions ?? [])
    .slice(-10)
    .map(question => `<question>${escapeXml(question)}</question>`)
    .join('\n');
  return `<study_record>\n<progress>${escapeXml(
    stableStringify(record.progress),
  )}</progress>\n${stuck}\n<recent_questions>\n${questions}\n</recent_questions>\n</study_record>`;
}
function synthetic<Ui>(
  id: number,
  threadId: number,
  text: string,
): ContextMessage<Ui> {
  return {
    id,
    threadId,
    role: 'user',
    parts: [{ t: 'text', text }],
    raw: null,
    ui: null,
    compacted: false,
    createdAt: '',
  };
}
function messageTokens(messages: readonly ContextMessage<unknown>[]): number {
  return messages.reduce(
    (sum, message) =>
      sum +
      estimateTokens(
        message.parts
          .map(part =>
            part.t === 'text'
              ? part.text
              : part.t === 'call'
              ? part.name + ' ' + part.args
              : part.output,
          )
          .join('\n'),
      ),
    0,
  );
}
function summaryText(group: {
  id: string;
  sectionId?: string;
  summary?: string;
  kind?: string;
}): string {
  const tag =
    group.kind === 'detour-summary'
      ? 'detour_summary'
      : group.kind === 'part-summary'
      ? 'part_summary'
      : 'conversation_summary';
  return `<${tag}${
    group.sectionId ? ` section="${escapeXml(group.sectionId)}"` : ''
  }>${escapeXml(group.summary ?? '')}</${tag}>`;
}
/**
 * Matches tool results to the calls they answer, in conversation order: a result answers the
 * earliest still-open call with its id (ids can repeat across turns). Unmatched halves are stray.
 */
export function matchToolCalls(
  messages: readonly { id: number; parts: readonly ContextPart[] }[],
) {
  type At = { message: number; part: number };
  const open = new Map<string, At[]>();
  const pairs: { call: At; result: At }[] = [];
  const strayResults: At[] = [];
  messages.forEach((message, m) =>
    message.parts.forEach((part, p) => {
      if (part.t === 'call')
        open.set(part.id, [
          ...(open.get(part.id) ?? []),
          { message: m, part: p },
        ]);
      else if (part.t === 'result') {
        const call = open.get(part.id)?.shift();
        if (call) pairs.push({ call, result: { message: m, part: p } });
        else strayResults.push({ message: m, part: p });
      }
    }),
  );
  return { pairs, strayCalls: [...open.values()].flat(), strayResults };
}
/** Strict protocols reject a call without its result or the reverse, so drop such halves. */
function pairedOnly<Ui>(messages: ContextMessage<Ui>[]): ContextMessage<Ui>[] {
  const { strayCalls, strayResults } = matchToolCalls(messages);
  const drop = new Set(
    [...strayCalls, ...strayResults].map(at => `${at.message}:${at.part}`),
  );
  if (!drop.size) return messages;
  return messages.flatMap((message, m) => {
    const parts = message.parts.filter((_, p) => !drop.has(`${m}:${p}`));
    if (parts.length === message.parts.length) return [message];
    // Replayed provider output would still carry the dropped call.
    return parts.some(part => part.t !== 'text' || part.text.trim())
      ? [{ ...message, parts, raw: null }]
      : [];
  });
}
const isTurnPart = (part: ContextPart) =>
  part.t === 'text' && part.text.startsWith('<turn>');
/** Saved user turns already carry their operation; appending it again would repeat <turn>. */
function carriesTurn(messages: readonly ContextMessage<unknown>[]): boolean {
  const last = messages.at(-1);
  return last?.role === 'user' && last.parts.some(isTurnPart);
}
function compressLoaded<Ui>(group: LoadedContext<Ui>): ContextMessage<Ui>[] {
  const text = `<section_summary section="${escapeXml(
    group.sectionId,
  )}">${escapeXml(group.summary!)}</section_summary>`;
  return group.messages.map(message => ({
    ...message,
    raw: null,
    compacted: true,
    parts: message.parts.map(part =>
      part.t === 'call'
        ? part
        : part.t === 'result'
        ? { ...part, output: text }
        : { ...part, text },
    ),
  }));
}

/** Deterministic assembly; summaries are supplied by the application, never invented or silently truncated. */
export function buildContext<Ui = never>(
  input: ContextInput<Ui>,
): ContextResult<Ui> {
  const system =
    input.system +
    (input.preferences === undefined
      ? ''
      : `\n<preferences>${escapeXml(
          stableStringify(input.preferences),
        )}</preferences>`);
  const contextBlocks = [
    {
      text: formatBookMap(
        input.sections,
        input.currentSectionId,
        input.mapDetailLimit,
        input.pageOffset,
        input.visitingSectionIds,
      ),
      cache: true,
    },
    {
      text: `<current_source>\n${formatBlocks(
        input.currentBlocks,
        input.pageOffset,
      )}\n</current_source>`,
      cache: true,
    },
  ];
  const record = synthetic<Ui>(
    -1,
    input.threadId ?? 0,
    recordText(input.studyRecord),
  );
  const loaded = (input.loaded ?? []).map(group => ({
    group,
    messages: [...group.messages],
  }));
  const conversation = (input.conversation ?? []).map((group, index) => ({
    group,
    messages:
      (group.kind === 'part-summary' || group.kind === 'detour-summary') &&
      group.summary !== undefined
        ? [synthetic<Ui>(-100 - index, input.threadId ?? 0, summaryText(group))]
        : [...group.messages],
  }));
  const operation = `<turn>${stableStringify(input.turn).replace(
    /</g,
    '\\u003c',
  )}</turn>`;
  const compressions: ContextCompression[] = [];
  const needsSummary: ContextResult<Ui>['needsSummary'] = conversation
    .filter(
      item =>
        (item.group.kind === 'part-summary' ||
          item.group.kind === 'detour-summary') &&
        item.group.summary === undefined,
    )
    .map(item => ({ layer: 6, id: item.group.id, reason: 'missing' }));
  const budget = input.budget ?? DEFAULT_INPUT_BUDGET;
  /**
   * The study record changes every turn, so it rides at the very end, just before <turn>:
   * everything earlier stays byte-identical across turns and providers can reuse it as a prefix.
   */
  function composeHistory(): ContextMessage<Ui>[] {
    const sequence = conversation.map(item => ({
      id: item.group.id,
      messages: item.messages,
    }));
    // Latest first, so a read that preceded another read can find it already placed.
    for (const item of [...loaded].reverse()) {
      const at =
        item.group.before === undefined
          ? -1
          : sequence.findIndex(entry => entry.id === item.group.before);
      // Without a known place, keep the former layout: reads ahead of the conversation.
      sequence.splice(Math.max(at, 0), 0, {
        id: item.group.id,
        messages: item.messages,
      });
    }
    const messages = pairedOnly(sequence.flatMap(entry => entry.messages));
    const recordPart = {
      ...(record.parts[0] as { t: 'text'; text: string }),
      volatile: true as const,
    };
    const turnPart = { t: 'text' as const, text: operation };
    const last = messages.at(-1);
    if (last?.role === 'user') {
      // A saved user turn already carries its own <turn>; keep it last and don't repeat it.
      const turns = carriesTurn(messages)
        ? last.parts.filter(isTurnPart)
        : [turnPart];
      return [
        ...messages.slice(0, -1),
        {
          ...last,
          parts: [
            ...last.parts.filter(part => !isTurnPart(part)),
            recordPart,
            ...turns,
          ],
        },
      ];
    }
    return [
      ...messages,
      {
        ...synthetic<Ui>(-2, input.threadId ?? 0, operation),
        parts: [recordPart, turnPart],
      },
    ];
  }
  function estimates(): LayerEstimate[] {
    return [
      {
        layer: 1,
        name: '讲解规则',
        tokens: estimateTokens(system),
        cached: true,
      },
      {
        layer: 2,
        name: '书的地图',
        tokens: estimateTokens(contextBlocks[0].text),
        cached: true,
      },
      {
        layer: 3,
        name: '当前原文',
        tokens: estimateTokens(contextBlocks[1].text),
        cached: true,
      },
      {
        layer: 4,
        name: '学习记录',
        tokens: messageTokens([record]),
        cached: false,
      },
      {
        layer: 5,
        name: '按需加载',
        tokens: messageTokens(loaded.flatMap(group => group.messages)),
        cached: false,
      },
      {
        layer: 6,
        name: '最近对话与本轮操作',
        tokens:
          messageTokens(conversation.flatMap(group => group.messages)) +
          (carriesTurn(conversation.flatMap(group => group.messages))
            ? 0
            : estimateTokens(operation)),
        cached: false,
      },
    ];
  }
  const total = () => estimates().reduce((sum, layer) => sum + layer.tokens, 0);
  for (const item of conversation) {
    if (total() <= budget) break;
    if (
      !item.group.earlier ||
      item.group.kind === 'part-summary' ||
      item.group.kind === 'detour-summary'
    )
      continue;
    if (!item.group.summary) {
      needsSummary.push({ layer: 6, id: item.group.id, reason: 'missing' });
      continue;
    }
    const replacement = [
      synthetic<Ui>(
        -100 - conversation.indexOf(item),
        input.threadId ?? 0,
        summaryText(item.group),
      ),
    ];
    if (messageTokens(replacement) >= messageTokens(item.messages)) {
      needsSummary.push({ layer: 6, id: item.group.id, reason: 'not-shorter' });
      continue;
    }
    compressions.push({
      layer: 6,
      id: item.group.id,
      messageIds: item.messages.map(message => message.id),
    });
    item.messages = replacement;
  }
  for (const item of loaded) {
    if (total() <= budget) break;
    if (!item.group.detour) continue;
    if (!item.group.summary) {
      needsSummary.push({ layer: 5, id: item.group.id, reason: 'missing' });
      continue;
    }
    const replacement = compressLoaded(item.group);
    if (messageTokens(replacement) >= messageTokens(item.messages)) {
      needsSummary.push({ layer: 5, id: item.group.id, reason: 'not-shorter' });
      continue;
    }
    compressions.push({
      layer: 5,
      id: item.group.id,
      messageIds: item.messages.map(message => message.id),
    });
    item.messages = replacement;
  }
  const estimate = estimates();
  const totalTokens = estimate.reduce((sum, layer) => sum + layer.tokens, 0);
  return {
    system,
    contextBlocks,
    history: composeHistory(),
    estimate,
    totalTokens,
    budget,
    overBudget: totalTokens > budget,
    compressions,
    needsSummary,
  };
}
export const assembleContext = buildContext;
