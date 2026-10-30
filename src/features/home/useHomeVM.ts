import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useContainer } from '@app/ContainerProvider';
import {
  answerShelf,
  loadHome,
  recordLearningTime,
  saveShelfAnswer,
  searchShelf,
} from '@app/usecases/home';
import {
  defaultPrefs,
  fetchServiceModels,
  patchMineru,
  patchPrefs,
  readPrefs,
  readServiceEditor,
  readProviders,
  saveService,
  testServiceConnection,
  type ServiceForm,
} from '@app/usecases/settings';
import { demoRefBySourceId } from '@app/demo/seed';
import { parse } from '@core/markup';
import { useAppNav } from '@features/nav';
import { presentShelf, sectionName } from '@features/library/presenters';
import { useShelfVM } from '@features/library/useLibraryVM';
import type { RichDoc, RichInline } from '@ui/kit';
import { useAiOptions } from '@features/settings/useAiOptions';
import type { ConversationConfig } from '@features/settings/types';
import { openExternalSource } from '@app/usecases/aiOptions';
import type {
  AskState,
  AskIntents,
  HomeState,
  HomeIntents,
  WelcomeState,
  WelcomeIntents,
} from './types';

const message = (error: unknown) =>
  error instanceof Error ? error.message : '操作没有完成，请重试';
const emptyShelf = {
  loading: true,
  error: null,
  toast: null,
  demo: false,
  books: [],
  continueCard: null,
  empty: false,
  overlay: null,
};
const emptyStats = {
  streak: 0,
  best: 0,
  today: 0,
  week: [0, 0, 0, 0, 0, 0, 0],
  month: [],
  totals: { sections: 0, cards: 0, asks: 0, detours: 0 },
};

export function useHomeVM() {
  const c = useContainer(),
    nav = useAppNav(),
    library = useShelfVM();
  const [state, setState] = useState<HomeState>({
    loading: true,
    error: null,
    demo: c.mode === 'demo',
    date: c.clock.today(),
    greeting: '晚上好',
    due: 0,
    goal: 20,
    reminder: false,
    shelf: emptyShelf,
    books: [],
    stuck: [],
    stats: emptyStats,
  });
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const refresh = useCallback(() => {
    loadHome(c)
      .then(data => {
        if (!alive.current) return;
        const hour = c.clock.now().getHours();
        setState({
          ...data,
          conversations: data.conversations.map(item => ({
            id: item.id,
            bookId: item.book_id,
            sectionId: item.section_id,
            title: item.title,
            subtitle: `${item.book_title} · ${item.section_title} · ${item.message_count} 条消息`,
          })),
          loading: false,
          error: null,
          demo: c.mode === 'demo',
          greeting:
            c.mode === 'demo'
              ? '晚上好'
              : hour < 12
              ? '早上好'
              : hour < 18
              ? '下午好'
              : '晚上好',
          due: data.cards.due,
          shelf: {
            ...emptyShelf,
            ...presentShelf(data.shelf, c.clock.now(), c.mode === 'demo'),
            loading: false,
          },
          books: data.shelf.map(r => {
            const leaves = r.sections.filter(s => s.is_leaf),
              done = leaves.filter(s => s.status === 'done').length;
            const section = r.sections.find(
              s => s.id === r.study?.main_section,
            );
            return {
              id: r.book.id,
              title: r.book.title,
              cover: {
                title: r.book.title,
                color: r.book.cover_color,
                subtitle: r.book.author,
              },
              progress: leaves.length ? done / leaves.length : 0,
              progressLabel: leaves.length ? `${done}/${leaves.length}` : '—',
              status: section
                ? sectionName(section)
                : ['parsing', 'importing'].includes(r.book.status)
                ? '解析中…'
                : r.book.status === 'paused'
                ? '解析暂停'
                : '还没开始',
            };
          }),
          stuck: data.stuck
            .slice(-3)
            .reverse()
            .map(s => ({
              id: s.id,
              bookId: s.book_id,
              sectionId: s.section_id,
              title: s.text,
              solved: Boolean(s.resolved_at),
              subtitle:
                sectionName(
                  data.shelf
                    .find(r => r.book.id === s.book_id)
                    ?.sections.find(sec => sec.id === s.section_id) ?? {
                    no: null,
                    title: s.section_id,
                  },
                ) + (s.resolved_at ? ' · 已解决' : ''),
            })),
        });
      })
      .catch(error => {
        if (alive.current)
          setState(s => ({ ...s, loading: false, error: message(error) }));
      });
  }, [c]);
  const refreshLibrary = library.intents.refresh;
  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshLibrary();
    }, [refresh, refreshLibrary]),
  );
  const intents: HomeIntents = {
    openConversation: id => {
      const conversation = state.conversations?.find(item => item.id === id);
      if (conversation)
        nav.open({
          name: 'Study',
          bookId: conversation.bookId,
          sectionId: conversation.sectionId,
          conversationId: id,
        });
    },
    refresh,
    ask: () => nav.open({ name: 'AskShelf' }),
    me: () => nav.open({ name: 'Tabs', tab: 'Me' }),
    review: () =>
      nav.open(
        state.due ? { name: 'ReviewSession' } : { name: 'Tabs', tab: 'Review' },
      ),
    stats: () => nav.open({ name: 'LearningStats' }),
    shelf: () => nav.open({ name: 'Tabs', tab: 'Shelf' }),
    openBook: library.intents.openBook,
    openContinue: mode => {
      const card = state.shelf.continueCard;
      if (card) nav.open({ name: 'Study', bookId: card.bookId, mode });
    },
    openStuck: id => {
      const s = state.stuck.find(x => x.id === id);
      if (s)
        nav.open({
          name: 'NoteDetail',
          bookId: s.bookId,
          sectionId: s.sectionId,
        });
    },
    setup: name => nav.open({ name }),
    goal: value => {
      c.repos.settings
        .set('learning.goal', Number(value))
        .then(refresh)
        .catch(error => setState(s => ({ ...s, error: message(error) })));
    },
    reminder: value => {
      c.repos.settings
        .set('learning.reminder', value)
        .then(refresh)
        .catch(error => setState(s => ({ ...s, error: message(error) })));
    },
  };
  return { state, intents, library };
}

/** A navigation blur or background transition ends this foreground interval. */
export function useLearningActivity(focused: boolean) {
  const c = useContainer();
  useEffect(() => {
    if (!focused || c.mode === 'demo') return;
    let start: number | null =
      AppState.currentState === 'active' ? c.clock.now().getTime() : null;
    let day = c.clock.today();
    const flush = () => {
      if (start === null) return;
      const seconds = Math.max(0, (c.clock.now().getTime() - start) / 1000);
      start = null;
      recordLearningTime(c, seconds, day).catch(error =>
        c.log.error('学习时长保存失败：' + message(error)),
      );
    };
    const subscription = AppState.addEventListener('change', value => {
      if (value === 'active') {
        start = c.clock.now().getTime();
        day = c.clock.today();
      } else flush();
    });
    return () => {
      subscription.remove();
      flush();
    };
  }, [c, focused]);
}

const demoAnswer =
  '在你书架上，这个问题只有《人工智能：现代方法》讲到。\n\n**一致代价搜索就是 Dijkstra 算法在搜索问题上的版本**：以路径代价 $g(n)$ 作为评价函数，每次扩展代价最小的结点 [1]，第一个被扩展的目标就是最便宜的 [2]。\n\n**A* 在它的基础上加了启发式 h(n)**，按 $f(n) = g(n) + h(n)$ 选结点 [3]。所以 h 恒为 0 时，A* 就是一致代价搜索；h 可容许时，A* 同样代价最优 [4]。\n\n你在 3.4.2 记过一个卡点「为什么扩展时才做目标测试」，和这个问题有关。';
export function useAskVM(): { state: AskState; intents: AskIntents } {
  const c = useContainer(),
    nav = useAppNav();
  const [config, setConfig] = useState<ConversationConfig | null>(null);
  const aiOptions = useAiOptions(config);
  const [state, setState] = useState<AskState>({
    query: '',
    scope: 'all',
    books: [],
    asked: '',
    answer: '',
    doc: [],
    busy: false,
    done: false,
    tools: [],
    hits: [],
    error: null,
    toast: null,
    demo: c.mode === 'demo',
    recent: [],
  });
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    let mounted = true;
    Promise.all([
      c.repos.books.list(),
      c.repos.settings.get<string[]>('shelf.questions', []),
    ]).then(([books, recent]) => {
      if (mounted)
        setState(s => ({
          ...s,
          books: books.map(b => ({ id: b.id, title: b.title })),
          recent,
        }));
    });
    return () => {
      mounted = false;
      controller.current?.abort();
    };
  }, [c]);
  const ask = async (value = state.query) => {
    const question = value.trim();
    if (!question || state.busy) return;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setState(s => ({
      ...s,
      asked: question,
      busy: true,
      done: false,
      answer: '',
      doc: [],
      hits: [],
      sources: [],
      error: null,
      tools: [
        `在 ${
          state.scope === 'all' ? state.books.length : 1
        } 本书已解析的正文里检索：${question}`,
      ],
    }));
    try {
      let hits = await searchShelf(c, question, state.scope);
      const demoHit =
        c.mode === 'demo' &&
        (state.scope === 'all' || state.scope === 'aima') &&
        /A\*|Dijkstra|一致代价|关系/i.test(question);
      if (demoHit) {
        const refs = ['b0901', 'b0904', 'b1021', 'b1025'].map(
          id => demoRefBySourceId[id],
        );
        const blocks = await Promise.all(
          refs.map(ref => c.repos.blocks.get('aima', ref)),
        );
        const book = await c.repos.books.get('aima');
        hits = blocks.flatMap(block =>
          block && book
            ? [
                {
                  bookId: book.id,
                  bookTitle: book.title,
                  cover: { title: book.title, color: book.cover_color },
                  ref: `b${block.seq}`,
                  sectionId: block.section_id ?? '',
                  section:
                    block.seq === refs[0] || block.seq === refs[1]
                      ? '3.4.2 Dijkstra算法或一致代价搜索'
                      : '3.5.2 A*搜索',
                  page: `p.${block.page}`,
                  text: block.text,
                },
              ]
            : [],
        );
      }
      if (current.signal.aborted) return;
      setState(s => ({
        ...s,
        hits,
        tools: [
          ...s.tools,
          ...[...new Set(hits.map(h => `读取 ${h.section}（${h.page}）`))],
        ],
      }));
      const onText = (answer: string) => {
        if (!current.signal.aborted) setState(s => ({ ...s, answer }));
      };
      if (c.mode === 'demo') {
        const answer = demoHit
          ? demoAnswer
          : '在你书架上的书里没有找到直接相关的内容。\n\n（原型演示：试试「A* 和 Dijkstra 是什么关系？」。实际 App 会先在所有已解析的书里全文检索，再把命中的小节原文交给 AI 回答，回答里的每个说法都带书名和页码。）';
        for (let i = 0; i < answer.length; i += 16) {
          if (current.signal.aborted) return;
          onText(answer.slice(0, i + 16));
          await new Promise(resolve => setTimeout(resolve, 16));
        }
      } else {
        const response = await answerShelf(
          c,
          question,
          hits,
          current.signal,
          onText,
          aiOptions.state.config ?? undefined,
        );
        if (!current.signal.aborted)
          setState(s => ({ ...s, sources: response?.search?.sources ?? [] }));
      }
      if (current.signal.aborted) return;
      const recent = [
        question,
        ...state.recent.filter(q => q !== question),
      ].slice(0, 8);
      await c.repos.settings.set('shelf.questions', recent);
      if (!current.signal.aborted)
        setState(s => ({ ...s, busy: false, done: true, query: '', recent }));
    } catch (error) {
      if (!current.signal.aborted)
        setState(s => ({ ...s, busy: false, error: message(error) }));
    }
  };
  const inline = (nodes: RichInline[]): RichInline[] =>
    nodes.map(n =>
      n.t === 'b'
        ? { ...n, c: inline(n.c) }
        : n.t === 'cite'
        ? {
            ...n,
            verified: Boolean(state.hits[n.ref - 1]),
            label: state.hits[n.ref - 1]
              ? `${state.hits[n.ref - 1].bookTitle.replace(
                  /[（(].*$/u,
                  '',
                )} · ${state.hits[n.ref - 1].page}`
              : `[${n.ref}]`,
          }
        : n,
    );
  const labelCitations = (blocks: RichDoc): RichDoc =>
    blocks.map(block => {
      if ('c' in block) return { ...block, c: inline(block.c) };
      if (block.t === 'list')
        return { ...block, items: block.items.map(inline) };
      if (block.t === 'aux')
        return { ...block, body: labelCitations(block.body) };
      return block;
    });
  const doc = labelCitations(
    parse(state.answer.replace(/\[(\d+)\]/g, '[[b:$1]]'), {
      streaming: state.busy,
    }),
  );
  return {
    state: { ...state, doc, aiOptions: aiOptions.state },
    intents: {
      openSource: url =>
        openExternalSource(url).catch(error =>
          setState(s => ({ ...s, error: message(error) })),
        ),
      setAiOptions: patch => {
        if (!state.busy) setConfig(aiOptions.patch(patch));
      },
      back: nav.back,
      query: value => setState(s => ({ ...s, query: value })),
      scope: value => setState(s => ({ ...s, scope: value })),
      ask: value => {
        ask(value);
      },
      stop: () => {
        controller.current?.abort();
        setState(s => ({ ...s, busy: false, done: false }));
      },
      openHit: i => {
        const hit = state.hits[i];
        if (hit)
          nav.open({
            name: 'Reader',
            bookId: hit.bookId,
            sectionId: hit.sectionId,
            blockRef: hit.ref,
          });
      },
      continue: () => {
        const hit = state.hits[0];
        if (hit)
          nav.open({
            name: 'Study',
            bookId: hit.bookId,
            mode: 'listen',
            draftQuestion: state.asked,
          });
      },
      save: () => {
        const hit = state.hits[0];
        if (hit)
          saveShelfAnswer(c, state.asked, state.answer, hit)
            .then(() =>
              setState(s => ({
                ...s,
                toast: `已保存到 ${hit.section} 的笔记`,
              })),
            )
            .catch(error => setState(s => ({ ...s, error: message(error) })));
      },
      clearToast: () => setState(s => ({ ...s, toast: null })),
    },
  };
}

export function useWelcomeVM(): {
  state: WelcomeState;
  intents: WelcomeIntents;
} {
  const c = useContainer(),
    nav = useAppNav();
  const [state, setState] = useState<WelcomeState>({
    step: 0,
    provider: 'claude',
    key: '',
    baseUrl: 'https://api.anthropic.com',
    model: '',
    token: '',
    expiry: '',
    busy: false,
    tested: false,
    notice: null,
    error: null,
    prefs: defaultPrefs,
  });
  const form = useRef<ServiceForm | null>(null),
    providerId = useRef<string | undefined>(undefined);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    let mounted = true;
    readPrefs(c).then(prefs => {
      if (mounted) setState(s => ({ ...s, prefs }));
    });
    readServiceEditor(c).then(data => {
      form.current = data.form;
    });
    return () => {
      mounted = false;
      controller.current?.abort();
    };
  }, [c]);
  const run = async (work: () => Promise<void>) => {
    if (state.busy) return;
    setState(s => ({ ...s, busy: true, error: null, notice: null }));
    try {
      await work();
    } catch (error) {
      setState(s => ({ ...s, error: message(error) }));
    } finally {
      setState(s => ({ ...s, busy: false }));
    }
  };
  const draft = (): ServiceForm => {
    if (!form.current) throw new Error('正在读取服务设置，请稍后重试');
    return {
      ...form.current,
      name:
        state.provider === 'claude'
          ? 'Claude 官方'
          : state.provider === 'openai'
          ? 'OpenAI 官方'
          : 'OpenAI 兼容',
      protocol:
        state.provider === 'claude'
          ? 'anthropic'
          : state.provider === 'openai'
          ? 'openai'
          : 'chat',
      auth: state.provider === 'claude' ? 'x-api-key' : 'bearer',
      baseUrl: state.baseUrl,
      key: state.key,
      model: state.model,
    };
  };
  const advance = () =>
    setState(s => ({ ...s, step: s.step + 1, notice: null, error: null }));
  const finish = async () => {
    await c.repos.settings.set('welcome.completed', true);
    nav.replace({ name: 'Tabs', tab: 'Today' });
  };
  const fetchModels = async (value: ServiceForm, signal: AbortSignal) => {
    const catalog =
      c.mode === 'demo'
        ? {
            models:
              (await readProviders(c)).find(
                provider => provider.protocol === value.protocol,
              )?.models ?? [],
          }
        : undefined;
    return fetchServiceModels(c, value, providerId.current, {
      signal,
      catalog,
    });
  };
  return {
    state,
    intents: {
      back: () =>
        state.step
          ? setState(s => ({ ...s, step: s.step - 1, error: null }))
          : nav.back(),
      skip: () => {
        if (state.step === 0 || state.step === 3) run(finish);
        else advance();
      },
      next: () => {
        run(async () => {
          if (state.step === 1) {
            const value = draft();
            if (!value.model) {
              const current = new AbortController();
              controller.current = current;
              const models = await fetchModels(value, current.signal);
              if (!models.ok)
                throw new Error(Object.values(models.errors).join('；'));
              value.model = models.catalog.models[0]?.id ?? '';
              if (!value.model)
                throw new Error('未读到模型，请填写模型 ID 后重试');
              setState(s => ({ ...s, model: value.model }));
            }
            const saved = await saveService(c, value, providerId.current);
            if (!saved.ok)
              throw new Error(Object.values(saved.errors).join('；'));
            providerId.current = saved.providerId;
          }
          if (state.step === 2 && state.token.trim())
            await patchMineru(
              c,
              { tokenExpiresOn: state.expiry || undefined },
              state.token,
            );
          if (state.step === 3) {
            await patchPrefs(c, state.prefs);
            await finish();
          } else advance();
        });
      },
      test: () => {
        run(async () => {
          const value = draft();
          const current = new AbortController();
          controller.current = current;
          const models = await fetchModels(value, current.signal);
          if (!models.ok)
            throw new Error(Object.values(models.errors).join('；'));
          if (!value.model) value.model = models.catalog.models[0]?.id ?? '';
          if (!value.model) throw new Error('未读到模型，请填写模型 ID 后重试');
          const tested = await testServiceConnection(
            c,
            value,
            providerId.current,
            { catalog: models.catalog, signal: current.signal },
          );
          if (!tested.ok)
            throw new Error(Object.values(tested.errors).join('；'));
          setState(s => ({
            ...s,
            model: value.model,
            tested: true,
            notice: `${c.mode === 'demo' ? '演示连接正常' : '连接正常'} · ${
              value.model
            }`,
          }));
        });
      },
      provider: value =>
        setState(s => ({
          ...s,
          provider: value,
          key: '',
          model: '',
          tested: false,
          baseUrl:
            value === 'claude'
              ? 'https://api.anthropic.com'
              : value === 'openai'
              ? 'https://api.openai.com/v1'
              : '',
          notice: null,
        })),
      field: (key, value) =>
        setState(s => ({ ...s, [key]: value, tested: false, notice: null })),
      pref: (key, value) =>
        setState(s => ({ ...s, prefs: { ...s.prefs, [key]: value } })),
    },
  };
}
