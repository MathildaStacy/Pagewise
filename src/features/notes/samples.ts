import type { NotesState, NotesBookState, NoteDetailState } from './types';
export const notesSamples: Record<string, NotesState> = {
  normal: {
    books: [
      {
        id: 'aima',
        title: '人工智能：现代方法',
        cover: { title: '人工智能：现代方法', color: '#456a83' },
        meta: '12 节有笔记 · 4 条问答 · 3 处高亮',
        hasNotes: true,
      },
    ],
    loading: false,
  },
  empty: { books: [], loading: false },
  loading: { books: [], loading: true },
  error: { books: [], loading: false, error: '出了点问题，请重试' },
};
export const notesBookSamples: Record<string, NotesBookState> = {
  normal: {
    title: '人工智能：现代方法',
    chapters: [
      {
        title: '3 通过搜索进行问题求解',
        sections: [
          {
            id: '3.5.2',
            label: '3.5.2 A*搜索',
            status: 'learning',
            summary: '综合已花代价与剩余代价的估计。',
            tags: [{ tone: 'stuck', label: '卡点 1' }],
          },
        ],
      },
    ],
    overlay: null,
    loading: false,
  },
  empty: { title: '书籍笔记', chapters: [], overlay: null, loading: false },
};
export const noteDetailSamples: Record<string, NoteDetailState> = {
  normal: {
    title: '3.5.2 A*搜索',
    subtitle: '笔记 · p.102–106',
    canOpenSource: true,
    summary: '评价函数 f(n)=g(n)+h(n)。',
    qa: [
      {
        q: '为什么要同时考虑两项？',
        a: 'g 是已经付出的代价，h 估计剩余代价。',
      },
    ],
    detourQa: [],
    stuck: [{ text: '可容许和一致的区别', resolved: false }],
    highlights: [],
    pins: [],
    userText: '先想清楚直觉，再看公式。',
    loading: false,
    saveStatus: '已保存',
  },
  empty: {
    title: '3.5.3 搜索等值线',
    subtitle: '笔记',
    canOpenSource: false,
    qa: [],
    detourQa: [],
    stuck: [],
    highlights: [],
    pins: [],
    userText: '',
    loading: false,
    saveStatus: '已保存',
  },
};

notesSamples.long = {
  ...notesSamples.normal,
  books: [
    {
      ...notesSamples.normal.books[0],
      title:
        '人工智能：现代方法（第四版）——关于问题求解、逻辑、概率、学习与智能体的完整技术参考',
      meta: '128 节有笔记 · 256 条问答 · 1024 处高亮',
    },
  ],
};
notesBookSamples.loading = { ...notesBookSamples.empty, loading: true };
notesBookSamples.error = {
  ...notesBookSamples.empty,
  error: '出了点问题，请重试',
};
notesBookSamples.long = {
  ...notesBookSamples.normal,
  title: '人工智能：现代方法（第四版）与复杂系统的学习和思考笔记',
  chapters: [
    {
      title: '第三章：通过搜索进行问题求解以及搜索中的启发式方法',
      sections: [
        {
          ...notesBookSamples.normal.chapters[0].sections[0],
          label: '3.5.2 A*搜索、最优性、可容许启发函数以及一致性条件',
          summary:
            '从直觉到公式，理解评价函数的两部分分别代表什么，以及为什么启发函数的性质会影响搜索算法的最优性。'.repeat(
              4,
            ),
        },
      ],
    },
  ],
};
noteDetailSamples.loading = { ...noteDetailSamples.empty, loading: true };
noteDetailSamples.error = {
  ...noteDetailSamples.empty,
  error: '出了点问题，请重试',
};
noteDetailSamples.long = {
  ...noteDetailSamples.normal,
  summary:
    '理解搜索算法时，需要把已经花费的路径代价和对剩余代价的估计分开考虑，再观察两者共同决定节点扩展顺序时发生了什么。'.repeat(
      5,
    ),
  userText: '这部分内容需要结合具体的搜索图一步步计算。'.repeat(10),
};
