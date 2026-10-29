import type {
  ReaderScreenState,
  ReaderState,
  SectionDoneState,
  StudyState,
} from './types';
const read: ReaderState = {
  view: 'flow',
  hint: '讲到第 2 步 · 点段落可解释、提问',
  loading: false,
  error: null,
  guide: {
    oneLine: '用已走的代价和对剩余路程的估计，选择下一个节点',
    full: '先建立 f(n) = g(n) + h(n) 的直觉，再看可容许性如何保证 A* 的代价最优。',
    expanded: false,
    loading: false,
  },
  items: [
    { kind: 'pageBreak', page: 'p.103', id: 'page-1' },
    {
      kind: 'block',
      ref: 'b1',
      seq: 1,
      type: 'title',
      page: 'p.103',
      doc: [{ t: 'p', c: [{ t: 'b', c: [{ t: 'text', v: '3.5.2 A*搜索' }] }] }],
      marks: [],
    },
    {
      kind: 'block',
      ref: 'b2',
      seq: 2,
      type: 'text',
      page: 'p.103',
      doc: [
        {
          t: 'p',
          c: [
            {
              t: 'text',
              v: 'A* 搜索用到达节点的已知路径代价与到达目标的估计代价之和，评估这个节点。',
            },
          ],
        },
      ],
      marks: ['heard'],
    },
    {
      kind: 'block',
      ref: 'b3',
      seq: 3,
      type: 'equation',
      page: 'p.103',
      doc: [{ t: 'math', tex: 'f(n)=g(n)+h(n)' }],
      marks: ['now', 'highlight'],
      pin: { id: '1', label: 'g 和 h 有什么区别？' },
    },
  ],
  readEnd: {
    visible: true,
    label: '读完这一节',
    hint: '和听讲一样生成摘要和闪卡草稿',
  },
  selection: null,
};
const normal: StudyState = {
  header: {
    title: '3.5.2 A*搜索',
    subtitle: '人工智能：现代方法 · p.103–105',
    readSubtitle: 'p.103–105',
    backLabel: '地图',
  },
  mode: 'listen',
  loading: false,
  toast: null,
  listen: {
    progress: {
      label: '第 2/4 步',
      steps: [
        { title: '直觉', state: 'done' },
        { title: '评价函数', state: 'current' },
        { title: '可容许性', state: 'todo' },
        { title: '一致性', state: 'todo' },
      ],
    },
    detour: null,
    thread: [
      {
        kind: 'stepHeader',
        id: '1',
        step: 2,
        label: '第 2 步',
        title: 'f(n) = g(n) + h(n) 的含义',
        pages: 'p.103',
      },
      {
        kind: 'ai',
        id: '2',
        doc: [
          {
            t: 'p',
            c: [
              { t: 'text', v: '把它想成一次旅行：' },
              {
                t: 'b',
                c: [{ t: 'text', v: 'g 是已经走过的，h 是估计还要走的。' }],
              },
              {
                t: 'cite',
                ref: 3,
                verified: true,
                detour: false,
                label: 'p.103',
              },
            ],
          },
          { t: 'math', tex: 'f(n)=g(n)+h(n)' },
          {
            t: 'aux',
            kind: 'example',
            open: false,
            body: [
              {
                t: 'p',
                c: [
                  {
                    t: 'text',
                    v: '到当前城市用了 40 分钟，估计还要 25 分钟，f 就是 65 分钟。',
                  },
                ],
              },
            ],
          },
        ],
        streaming: false,
        detour: false,
      },
      {
        kind: 'user',
        id: '3',
        text: 'h 估得准不准会影响结果吗？',
        detour: false,
      },
    ],
    scroll: { toEndToken: 0 },
    quickActions: [
      { key: 'next', label: '懂了，下一步', kind: 'primary' },
      { key: 'alt', label: '换个说法' },
      { key: 'example', label: '举个例子' },
      { key: 'derive', label: '展开推导' },
      { key: 'quiz', label: '考考我' },
      { key: 'source', label: '看原文' },
    ],
    composer: {
      value: '',
      placeholder: '不懂就问…',
      canSend: false,
      streaming: false,
      quote: null,
    },
    busy: false,
  },
  read,
  overlay: null,
};
export const studySamples: Record<
  'normal' | 'empty' | 'loading' | 'error' | 'long',
  StudyState
> = {
  normal,
  empty: {
    ...normal,
    listen: { ...normal.listen, thread: [], quickActions: [] },
  },
  loading: {
    ...normal,
    loading: true,
    listen: { ...normal.listen, thread: [], quickActions: [] },
  },
  error: {
    ...normal,
    listen: {
      ...normal.listen,
      thread: [
        ...normal.listen.thread,
        {
          kind: 'error',
          id: 'error',
          text: '请先分配讲解模型和整理模型',
          retry: true,
        },
      ],
    },
  },
  long: {
    ...normal,
    listen: {
      ...normal.listen,
      thread: [
        ...normal.listen.thread,
        {
          kind: 'detourRun',
          id: 'run',
          items: [
            {
              kind: 'divider',
              id: 'dt',
              text: '岔路 · 3.4.2 一致代价搜索',
              tone: 'detour',
            },
            {
              kind: 'ai',
              id: 'dt2',
              doc: [
                {
                  t: 'p',
                  c: [
                    {
                      t: 'text',
                      v: '当 h(n) 恒为零时，A* 只看已走代价，回到一致代价搜索。',
                    },
                  ],
                },
              ],
              streaming: false,
              detour: true,
            },
          ],
        },
        {
          kind: 'fold',
          id: 'fold',
          title: '已解决：A* 和一致代价搜索的关系',
          count: '3 条',
          expanded: false,
          items: [],
        },
        {
          kind: 'quiz',
          id: 'quiz',
          title: '检查一下',
          question: '如果 h(n) 恒为零，A* 会变成什么？',
          options: [
            { label: '一致代价搜索', state: 'right' },
            { label: '贪婪搜索', state: 'muted' },
            { label: '深度优先', state: 'wrong' },
          ],
          locked: true,
          explain: '因为 f(n) 只剩下 g(n)。',
        },
        {
          kind: 'proposal',
          id: 'proposal',
          title: 'AI 建议 · 记为卡点',
          body: '可容许和一致性的区别',
          state: 'pending',
          actions: [
            { key: 'accept', label: '记下' },
            { key: 'dismiss', label: '不用' },
          ],
        },
        {
          kind: 'done',
          id: 'done',
          title: '本节讲完了',
          text: '整理摘要、卡点和闪卡，再开始下一节。',
        },
      ],
    },
  },
};
export const readerSamples: Record<
  'normal' | 'empty' | 'loading' | 'error' | 'long',
  ReaderScreenState
> = {
  normal: {
    header: { ...normal.header, subtitle: 'p.103–105' },
    read,
    overlay: null,
    toast: null,
  },
  empty: {
    header: { ...normal.header, subtitle: 'p.103–105' },
    read: { ...read, items: [], guide: null },
    overlay: null,
    toast: null,
  },
  loading: {
    header: { ...normal.header, subtitle: 'p.103–105' },
    read: { ...read, loading: true, items: [] },
    overlay: null,
    toast: null,
  },
  error: {
    header: { ...normal.header, subtitle: 'p.103–105' },
    read: { ...read, error: '原文加载失败', items: [] },
    overlay: null,
    toast: null,
  },
  long: {
    header: { ...normal.header, subtitle: 'p.103–105' },
    read: {
      ...read,
      items: [
        ...read.items,
        ...Array.from({ length: 8 }, (_, i) => ({
          kind: 'block' as const,
          ref: `b${i + 10}`,
          seq: i + 10,
          type: 'text',
          page: 'p.104',
          doc: [
            {
              t: 'p' as const,
              c: [
                {
                  t: 'text' as const,
                  v: '可容许的启发式从不高估到达目标的真实代价。一致性要求每次沿边前进，估计值的减少不超过这条边的代价。'.repeat(
                    3,
                  ),
                },
              ],
            },
          ],
          marks: [],
        })),
      ],
    },
    overlay: null,
    toast: null,
  },
};
const done: SectionDoneState = {
  hero: {
    kicker: '第 3 章 · 通过搜索进行求解',
    title: '3.5.2 A*搜索 · 讲完了',
    stats: '4 步 · 跳过 1 步 · 5 次提问 · 岔路 1 次',
  },
  summary: {
    value:
      'A* 用 f(n) = g(n) + h(n) 选择扩展节点。启发式可容许时，A* 代价最优；一致性是更强的条件。',
    hint: 'AI 起草，可以改',
  },
  stuck: [{ id: 's1', text: '可容许和一致性的区别', checked: true }],
  cards: [
    {
      id: 'c1',
      front: 'A* 的评价函数是什么？各项含义？',
      back: 'f(n) = g(n) + h(n)，g 是已走代价，h 是剩余代价的估计。',
      checked: true,
      fromDetour: false,
    },
    {
      id: 'c2',
      front: 'h(n) 恒为零时会变成什么？',
      back: '一致代价搜索。',
      checked: true,
      fromDetour: true,
    },
  ],
  detours: [
    {
      q: 'A* 和一致代价搜索有什么关系？',
      where: '已记入 3.4.2 Dijkstra算法或一致代价搜索 的笔记',
    },
  ],
  next: {
    label: '保存，开始 3.5.3 搜索等值线',
    hint: '保存后主线进度移到 3.5.3',
  },
  loading: false,
  saving: false,
  toast: null,
  editing: null,
};
export const sectionDoneSamples: Record<
  'normal' | 'empty' | 'loading' | 'error' | 'long',
  SectionDoneState
> = {
  normal: done,
  empty: {
    ...done,
    summary: { ...done.summary, value: '' },
    cards: [],
    stuck: [],
    detours: [],
  },
  loading: { ...done, loading: true },
  error: { ...done, error: 'AI 整理失败' },
  long: {
    ...done,
    summary: { ...done.summary, value: done.summary.value.repeat(8) },
    cards: [
      ...done.cards,
      ...done.cards.map(c => ({
        ...c,
        id: `${c.id}-long`,
        front: c.front.repeat(3),
      })),
    ],
  },
};
