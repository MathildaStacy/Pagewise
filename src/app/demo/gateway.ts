import type { AiGateway, GatewayRequest } from '@services/ai/gateway';
import { AiError } from '@services/ai/http';
import type { ParsedResponse } from '@services/ai/protocol';
import type { Part } from '@services/ai/types';
import { demoRefBySourceId, remapDemoCitations } from './seed';
import { exploreSource, prototypeSource } from './source';

type RecordValue = Record<string, unknown>;
function object(value: unknown): RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
}
function decode(text: string | undefined): RecordValue {
  try {
    return object(JSON.parse(text ?? '{}'));
  } catch {
    return {};
  }
}
function textOf(req: GatewayRequest): string {
  return [
    req.system,
    ...req.contextBlocks.map(b => b.text),
    ...req.history.flatMap(m =>
      m.parts.filter(p => p.t === 'text').map(p => p.text),
    ),
  ].join('\n');
}
function refText(text: string): string {
  return remapDemoCitations(text);
}
function response(parts: Part[]): ParsedResponse {
  return {
    parts,
    raw: { protocol: 'chat', model: 'pagewise-demo', items: parts },
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      cacheReported: false,
    },
    stop: parts.some(p => p.t === 'call') ? 'tool' : 'end',
    model: 'pagewise-demo',
  };
}
function oneText(text: string) {
  return response([{ t: 'text', text: refText(text) }]);
}
function call(name: string, args: RecordValue) {
  return response([
    { t: 'call', id: `demo-${name}`, name, args: JSON.stringify(args) },
  ]);
}
function tidy(req: GatewayRequest): ParsedResponse | null {
  const full = textOf(req);
  const task = /<task name="([^"]+)">/.exec(full)?.[1];
  if (!task) return null;
  const input = decode(/<input>\s*([\s\S]*?)\s*<\/input>/.exec(full)?.[1]);
  const rawBlocks = Array.isArray(input.blocks) ? input.blocks.map(object) : [];
  const seqs = rawBlocks.map(b => Number(b.seq)).filter(Number.isFinite);
  const block = object(input.block ?? rawBlocks[0]);
  const seq = Number(input.seq ?? block.seq ?? demoRefBySourceId.b2);
  const sourceId = Object.keys(demoRefBySourceId).find(
    k => demoRefBySourceId[k] === seq,
  );
  let result: unknown;
  switch (task) {
    case 'plan': {
      const ids = seqs.length
        ? seqs
        : [...full.matchAll(/<block[^>]*(?:id|seq)="?(\d+)/g)].map(m =>
            Number(m[1]),
          );
      const count = Math.min(4, ids.length);
      result = {
        steps: Array.from({ length: count }, (_, i) => ({
          title: ['A* 的直觉', '可容许的启发式', '一致性', '最优性保证'][i],
          kind: ['intuition', 'definition', 'derivation', 'check'][i],
          from: ids[Math.floor((i * ids.length) / count)],
          to: ids[Math.floor(((i + 1) * ids.length) / count) - 1],
        })),
      };
      break;
    }
    case 'recap':
    case 'resume':
      result = {
        lines: [
          '上次讲到 A* 如何用 f = g + h 选择结点。',
          '还有「为什么扩展时才判断目标」这个卡点。',
          '要先复习卡点，还是直接继续？',
        ],
      };
      break;
    case 'sectionDone':
    case 'sectionDraft':
      result = {
        summary:
          'A* 用 f(n)=g(n)+h(n) 选择结点：g 是已花代价，h 是剩余代价的估计。可容许保证树搜索最优，一致性进一步保证图搜索最优；当 h 恒为零时，A* 就退化为一致代价搜索。',
        stuck: ['图搜索为什么需要一致性？'],
        cards: [
          {
            front: 'A* 的评价函数是什么？',
            back: 'f(n)=g(n)+h(n)：已花代价加剩余代价的估计。',
            from_detour: false,
          },
          {
            front: '什么叫可容许？',
            back: 'h(n) 从不高估到目标的真实最小代价。',
            from_detour: false,
          },
          {
            front: 'A* 和一致代价搜索有什么关系？',
            back: '当 h(n) 恒为 0 时，A* 就是一致代价搜索。',
            from_detour: true,
          },
        ],
      };
      break;
    case 'detourTitle':
      result = {
        title: 'A* 与一致代价搜索',
        summary: 'h 恒为零时 A* 就是一致代价搜索；h 帮助搜索偏向目标。',
      };
      break;
    case 'pinTitle':
    case 'qaSummary':
      result = {
        question: 'A* 和一致代价搜索有什么关系？',
        answer: 'h(n) 恒为 0 时 A* 就是一致代价搜索。',
        q: 'A* 和一致代价搜索有什么关系？',
        a: 'h(n) 恒为 0 时 A* 就是一致代价搜索。',
      };
      break;
    case 'explain': {
      const examples: Readonly<Record<string, string>> = exploreSource.EXPLAIN;
      result = {
        answer:
          sourceId && examples[sourceId]
            ? refText(examples[sourceId])
            : `这段在说明 ${String(
                block.text ?? 'A* 搜索的评价规则',
              )}。[[b:${seq}]]`,
      };
      break;
    }
    case 'translate':
      result = {
        answer: `[Demo translation] ${String(
          block.text ??
            input.text ??
            'A* chooses the node with the smallest estimated total path cost.',
        )}`,
      };
      break;
    case 'guide':
      result = {
        one_line: '用已花代价和剩余估计理解 A*。',
        full: exploreSource.GUIDE,
        prereq: ['3.4.2'],
      };
      break;
    case 'partSummary':
    case 'compact':
      result = {
        summary:
          '已讨论 f=g+h、可容许和一致性。尚需区分树搜索与图搜索的最优性条件。',
      };
      break;
    default:
      throw new Error(`未实现演示任务：${task}`);
  }
  return oneText(JSON.stringify(result));
}
function scripted(req: GatewayRequest): ParsedResponse {
  const taskResult = tidy(req);
  if (taskResult) return taskResult;
  const user = [...req.history].reverse().find(m => m.role === 'user');
  const userText =
    user?.parts
      .filter(p => p.t === 'text')
      .map(p => p.text)
      .join('\n') ?? '';
  const turn = decode(/<turn>([\s\S]*?)<\/turn>/.exec(userText)?.[1]);
  const step = Math.max(0, Math.min(3, Number(turn.step ?? 0)));
  const intent = String(turn.intent ?? 'next');
  const last = req.history.at(-1);
  if (last?.parts.some(p => p.t === 'result')) {
    const results = last.parts.filter(p => p.t === 'result');
    const load = results.find(p => p.name === 'load_section');
    if (load) {
      const priorCall = req.history
        .flatMap(m => m.parts)
        .filter(p => p.t === 'call' && p.name === 'load_section')
        .at(-1);
      const id =
        priorCall?.t === 'call' ? String(decode(priorCall.args).id) : '3.4.2';
      return oneText(
        id === '3.5.1'
          ? prototypeSource.DETOURS['3.5.1'].answer
          : prototypeSource.DETOURS['3.4.2'].answer,
      );
    }
    const quiz = results.find(p => p.name === 'show_quiz');
    if (quiz)
      return oneText(
        '记住这个区别：可容许约束总体估计，一致性还要求每一步满足三角不等式。[[b:b1026]]',
      );
    return oneText('好，按你确认的选择继续。');
  }
  if (intent === 'ask') {
    for (const [id, detour] of Object.entries(prototypeSource.DETOURS)) {
      if (new RegExp(detour.match.source, detour.match.flags).test(userText))
        return call('load_section', { id });
    }
    for (const answer of prototypeSource.FREE)
      if (new RegExp(answer.match.source, answer.match.flags).test(userText))
        return oneText(answer.a);
    if (/没懂|不明白|记.*卡点/.test(userText))
      return call('mark_stuck', { text: 'A* 图搜索的一致性条件' });
    return oneText(
      `我们可以把这个问题放回当前步骤：${exploreSource.ALT[step].re}`,
    );
  }
  if (intent === 'quiz' || turn.want_tool === 'show_quiz')
    return call('show_quiz', {
      question: 'h(n) 恒为 0 时，A* 相当于哪种搜索？',
      options: ['一致代价搜索', '贪心最佳优先搜索', '深度优先搜索'],
      answer: 0,
      explain: 'f=g+0=g，因此每次选择已花代价最小的结点。',
      final: Boolean(turn.final),
    });
  if (intent === 'alt') return oneText(exploreSource.ALT[step].re);
  if (intent === 'example')
    return oneText(`[[example]]${exploreSource.ALT[step].ex}[[/example]]`);
  if (intent === 'derive')
    return oneText(`[[derive]]${exploreSource.ALT[step].dv}[[/derive]]`);
  if (intent === 'backMain')
    return oneText(`回到 A*：${exploreSource.ALT[step].re}`);
  const lesson = exploreSource.LESSON[step]
    .map(item => {
      if (item.k === 'src') return `[[q:${demoRefBySourceId[item.b]}]]`;
      const tag = item.k === 'ex' ? 'example' : item.k;
      return tag === 'ai' ? item.t : `[[${tag}]]${item.t}[[/${tag}]]`;
    })
    .join('\n\n');
  return oneText(
    `${
      intent === 'skip' ? '刚才跳过的概念会保留在路线图里。\n\n' : ''
    }${lesson}`,
  );
}
function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) throw new AiError('cancelled', '已停止');
}
function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new AiError('cancelled', '已停止'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}
/** Demo only: deterministic content, with the real session/tool/persistence pipeline. */
export function createDemoGateway({
  delayMs = 18,
}: { delayMs?: number } = {}): AiGateway {
  return {
    async complete(_purpose, req, opts = {}) {
      checkAbort(opts.signal);
      return scripted(req);
    },
    async stream(_purpose, req, handlers) {
      checkAbort(handlers.signal);
      const result = scripted(req);
      const content = result.parts
        .filter(p => p.t === 'text')
        .map(p => p.text)
        .join('');
      for (let i = 4; i < content.length + 4; i += 4) {
        checkAbort(handlers.signal);
        handlers.onText(content.slice(0, i));
        if (delayMs) await delay(delayMs, handlers.signal);
      }
      checkAbort(handlers.signal);
      return result;
    },
    async test(_providerId, model) {
      return { ok: true, model, latencyMs: 0, usage: response([]).usage };
    },
  };
}
