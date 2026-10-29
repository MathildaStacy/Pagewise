import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import https from 'node:https';
import http from 'node:http';
import { createTestDemoContainer } from '@app/testing';
import { createAiGateway } from '@services/ai/gateway';
import type { FetchLike } from '@services/ai/http';
import { toAppError } from '@app/errors';
import type { AiService, StoredMessage } from '@services/ai/types';
import {
  buildTaskPrompt,
  parseTaskJson,
  type StudyTask,
} from '@app/study/prompts';
import { StudySession } from '@app/study/StudySession';
import { parseStudyCard } from '@app/study/types';
import { validateLessonPlan } from '@core/lesson';
import { parse } from '@core/markup';
import { validateCitations } from '@core/citations';

jest.setTimeout(1_200_000);
const config = JSON.parse(
  readFileSync(process.env.PAGEWISE_AI_CONFIG!, 'utf8'),
);
const service: AiService = {
  id: 'live-eval',
  name: 'Live evaluation',
  protocol: config.protocol ?? 'chat',
  baseUrl: config.baseUrl,
  model: config.model,
  effort: config.effort ?? 'off',
  cache: 'auto',
  auth: 'bearer',
  price: null,
  keyTail: '',
};
const fetchImpl: FetchLike = (url, init) =>
  new Promise((resolve, reject) => {
    const transport = url.startsWith('https:') ? https : http;
    const request = transport.request(
      url,
      {
        method: init.method,
        headers: { ...init.headers, 'User-Agent': 'Pagewise/0.0.1' },
      },
      response => {
        response.setEncoding('utf8');
        let body = '';
        response.on('data', chunk => {
          body += chunk;
          init.onChunk?.(chunk);
        });
        response.on('end', () =>
          resolve({ status: response.statusCode ?? 0, text: async () => body }),
        );
        response.on('error', () =>
          reject(new Error('live response interrupted')),
        );
      },
    );
    const abort = () => request.destroy(new Error('cancelled'));
    init.signal?.addEventListener('abort', abort, { once: true });
    request.on('close', () => init.signal?.removeEventListener('abort', abort));
    request.on('error', () => reject(new Error('live request failed')));
    request.end(init.body);
  });
const report: Record<string, unknown> = {
  date: new Date().toISOString(),
  model: service.model,
  protocol: service.protocol,
  json: [],
  flows: [],
  cache: { status: 'not-run' },
};
const text = (parts: { t: string; text?: string }[]) =>
  parts
    .filter(p => p.t === 'text')
    .map(p => p.text)
    .join('\n');
const message = (value: string, id = 0): StoredMessage => ({
  id,
  threadId: 0,
  role: 'user',
  parts: [{ t: 'text', text: value }],
  raw: null,
  ui: null,
  compacted: false,
  createdAt: '2026-10-29T00:00:00Z',
});
const gateway = createAiGateway({
  resolve: () => ({ service, key: config.key, cacheKey: 'pagewise-live-eval' }),
  resolveProvider: () => ({
    service,
    key: config.key,
    cacheKey: 'pagewise-live-eval',
  }),
  recordUsage: () => {},
  fetchImpl,
});
afterAll(() => {
  const dir = process.env.PAGEWISE_EVAL_OUTPUT ?? 'docs/dev/evidence/t7';
  mkdirSync(dir, { recursive: true });
  const stamp = String(report.date).replace(/[:.]/g, '-');
  const saved = JSON.stringify(report, null, 2) + '\n';
  writeFileSync(`${dir}/live-eval-${stamp}.json`, saved);
  writeFileSync(`${dir}/live-eval.json`, saved);
});

test('20 first-attempt structured tasks, real teaching/tool/draft flows, and reported cache', async () => {
  const c = await createTestDemoContainer({ ai: gateway });
  const session = new StudySession(c, 'aima');
  try {
    const blocks = await c.repos.blocks.bySection('aima', '3.5.2');
    const tasks = [
      'plan',
      'recap',
      'sectionDraft',
      'detourTitle',
      'pinTitle',
      'explain',
      'translate',
      'guide',
      'partSummary',
      'compact',
    ] as const satisfies readonly StudyTask[];
    const section = await c.repos.sections.get('aima', '3.5.2');
    const map = (await c.repos.sections.tree('aima')).map(s => ({
      id: s.id,
      title: s.title,
    }));
    const block = blocks.find(b => b.type === 'text') ?? blocks[0];
    const question = '为什么h不能高估？';
    const fixtureAnswer = `避免漏掉最优路径。[[b:${block.seq}]]`;
    const fixtureMessages = [
      { kind: 'user', content: question },
      { kind: 'assistant', content: fixtureAnswer },
    ];
    // Keep each shape identical to StudySession's production task call.
    const inputs: Record<(typeof tasks)[number], unknown> = {
      plan: { section: section?.title, blocks },
      recap: {
        days: 3,
        progress: { sectionId: '3.5.2', part: 0, step: 1 },
        titles: ['评价函数的直觉'],
        stuck: ['为何扩展时检查目标'],
        questions: [question],
      },
      sectionDraft: {
        section,
        blocks,
        qa: [],
        detours: [],
        wrongQuizzes: [],
        candidates: ['可容许和一致性的区别'],
      },
      detourTitle: { messages: fixtureMessages },
      pinTitle: { question, answer: fixtureAnswer },
      explain: { seq: block.seq, block, map },
      translate: { seq: block.seq, block, map },
      guide: { section, blocks, map },
      partSummary: {
        section: '3.5.2',
        part: 0,
        messages: fixtureMessages.map(m => m.content),
      },
      compact: { messages: fixtureMessages },
    };
    const results: { task: string; ok: boolean; reason?: string }[] = [];
    for (let iteration = 0; iteration < 2; iteration++) {
      for (const task of tasks) {
        let ok = false,
          reason: string | undefined;
        let output: string | undefined;
        try {
          const response = await gateway.complete(
            task === 'explain' ? 'teach' : 'tidy',
            {
              system: buildTaskPrompt(task, inputs[task]),
              contextBlocks: [],
              tools: [],
              noTools: true,
              history: [message('只输出要求的 JSON。')],
            },
          );
          output = text(response.parts);
          const data = parseTaskJson(output) as Record<string, unknown>;
          const string = (key: string) =>
            typeof data[key] === 'string' &&
            Boolean((data[key] as string).trim());
          if (task === 'plan') {
            const check = validateLessonPlan(data, blocks);
            ok = check.valid;
            reason = check.reason;
          } else if (task === 'recap')
            ok =
              Array.isArray(data.lines) &&
              data.lines.length >= 1 &&
              data.lines.length <= 3 &&
              data.lines.every(
                line => typeof line === 'string' && !!line.trim(),
              );
          else if (task === 'sectionDraft')
            ok =
              string('summary') &&
              Array.isArray(data.stuck) &&
              data.stuck.every(item => typeof item === 'string') &&
              Array.isArray(data.cards) &&
              data.cards.length >= 3 &&
              data.cards.length <= 5 &&
              data.cards.every(
                card =>
                  Boolean(card) &&
                  typeof card === 'object' &&
                  typeof card.front === 'string' &&
                  !!card.front.trim() &&
                  typeof card.back === 'string' &&
                  !!card.back.trim() &&
                  typeof card.from_detour === 'boolean',
              );
          else if (task === 'detourTitle')
            ok = string('title') && string('summary');
          else if (task === 'pinTitle')
            ok = string('question') && string('answer');
          else if (task === 'guide')
            ok =
              string('one_line') &&
              string('full') &&
              Array.isArray(data.prereq) &&
              data.prereq.every(id => map.some(s => s.id === id));
          else if (task === 'explain') {
            const check = validateCitations(parse(String(data.answer)), {
              allowedRefs: [block.seq],
              blocks: [block],
            });
            ok =
              string('answer') &&
              check.invalidCitations === 0 &&
              check.verifiedRefs.length > 0;
            if (!ok)
              reason = !string('answer')
                ? 'empty-answer'
                : check.invalidCitations
                ? 'invalid-citation'
                : 'missing-citation';
          } else ok = string(task === 'translate' ? 'answer' : 'summary');
        } catch (error) {
          reason =
            error instanceof SyntaxError
              ? 'json-syntax'
              : toAppError(error).code;
          process.stdout.write(`Task error: ${reason}\n`);
        }
        if (!ok && process.env.PAGEWISE_EVAL_PRIVATE_OUTPUT) {
          const privateDir = process.env.PAGEWISE_EVAL_PRIVATE_OUTPUT;
          mkdirSync(privateDir, { recursive: true, mode: 0o700 });
          writeFileSync(
            `${privateDir}/${iteration + 1}-${task}.json`,
            JSON.stringify(
              { task, input: inputs[task], output, reason },
              null,
              2,
            ),
            { mode: 0o600 },
          );
        }
        results.push({ task, ok, ...(reason ? { reason } : {}) });
        report.json = results;
        process.stdout.write(
          `JSON ${results.length}/20 ${task}: ${ok ? 'pass' : 'fail'}\n`,
        );
      }
    }
    report.jsonSuccessRate = results.filter(r => r.ok).length / 20;

    await session.open({ autoStart: false });
    const flows: {
      intent: string;
      ok: boolean;
      citations?: number;
      invalid?: number;
      calls?: string[];
    }[] = [];
    for (const intent of ['first', 'next', 'detour', 'quiz', 'draft']) {
      const before = session.store.getState().messages.at(-1)?.id ?? 0;
      if (intent === 'first') await session.act('reteachSection');
      else if (intent === 'next') await session.act('next');
      else if (intent === 'detour')
        await session.send(
          '请调用 load_section 读取 3.4.2 一致代价搜索原文，解释它和A*的关系。',
        );
      else if (intent === 'quiz') await session.act('quiz');
      else await session.finishDraft();
      const state = session.store.getState();
      const messages = state.messages.filter(m => m.id > before);
      const answers = messages.filter(m => m.kind === 'assistant');
      let citations = 0,
        invalid = 0;
      for (const answer of answers) {
        const checked = validateCitations(parse(answer.content), {
          allowedRefs: answer.allowed_refs ?? [],
          blocks: await c.db.all('SELECT * FROM block WHERE book_id=?', [
            'aima',
          ]),
        });
        citations += checked.verifiedRefs.length;
        invalid += checked.invalidCitations;
      }
      const calls = messages.flatMap(
        m =>
          (m.parts as unknown as { t: string; name?: string }[] | null)
            ?.filter(p => p.t === 'call')
            .map(p => p.name!) ?? [],
      );
      const quiz = messages.some(
        m => m.kind === 'card' && parseStudyCard(m.content)?.kind === 'quiz',
      );
      const ok =
        !state.error &&
        invalid === 0 &&
        (intent === 'draft'
          ? Boolean(
              state.draft?.summary &&
                state.draft.cards.length >= 3 &&
                !state.draft.error,
            )
          : intent === 'quiz'
          ? quiz
          : answers.length > 0 &&
            citations > 0 &&
            (intent !== 'detour' || calls.includes('load_section')));
      flows.push({ intent, ok, citations, invalid, calls });
      report.flows = flows;
      process.stdout.write(`Flow ${intent}: ${ok ? 'pass' : 'fail'}\n`);
    }

    const cache: { cacheRead: number; reported: boolean }[] = [];
    for (let i = 0; i < 5; i++) {
      const response = await gateway.complete('teach', {
        system: '你是伴读老师。只回答一句话。',
        contextBlocks: [
          { text: JSON.stringify({ section, blocks, map }), cache: true },
        ],
        tools: [],
        noTools: true,
        history: [message(`第${i + 1}轮：一句话解释A*。`)],
      });
      cache.push({
        cacheRead: response.usage.cacheRead,
        reported: response.usage.cacheReported,
      });
    }
    report.cache = {
      protocol: service.protocol,
      rounds: cache,
      status:
        service.protocol === 'anthropic'
          ? cache.slice(1).every(r => r.cacheRead > 0)
            ? 'pass'
            : 'fail'
          : 'anthropic-acceptance-unavailable',
    };
    expect(report.jsonSuccessRate).toBeGreaterThanOrEqual(0.95);
    expect(flows.every(f => f.ok)).toBe(true);
    if (service.protocol === 'anthropic')
      expect(cache.slice(1).every(r => r.cacheRead > 0)).toBe(true);
  } finally {
    await session.dispose();
    await c.close();
  }
});
