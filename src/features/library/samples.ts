import type {
  BookMapState,
  ImportSettingsState,
  ParseProgressState,
  ShelfState,
} from './types';
const base = { loading: false, error: null, toast: null, demo: true };
export const shelfSamples: Record<string, ShelfState> = {
  normal: {
    ...base,
    empty: false,
    overlay: null,
    continueCard: {
      bookId: 'aima',
      kicker: '继续学习 · 人工智能：现代方法（第4版）',
      title: '3.5.2 A*搜索',
      meta: '第 3 章 通过搜索进行问题求解 · p.102–106',
      steps: [
        { done: true },
        { done: false },
        { done: false },
        { done: false },
      ],
      stepLabel: '第 2/4 步',
    },
    books: [
      {
        id: 'aima',
        title: '人工智能：现代方法（第4版）',
        meta: '罗素 等 · PDF · 1136 页',
        cover: { title: '人工智能：现代方法', color: '#B6C7B4' },
        status: { tone: 'accent', text: '在学 3.5.2 · 已学 12/43 个小节' },
      },
    ],
  },
  empty: {
    ...base,
    demo: false,
    empty: true,
    books: [],
    continueCard: null,
    overlay: null,
  },
  loading: {
    ...base,
    loading: true,
    empty: false,
    books: [],
    continueCard: null,
    overlay: null,
  },
  error: {
    ...base,
    error: '书架没有加载成功，请重试',
    empty: false,
    books: [],
    continueCard: null,
    overlay: null,
  },
  long: {
    ...base,
    empty: false,
    overlay: null,
    continueCard: null,
    books: [
      {
        id: 'long',
        title:
          '一本有很长书名的技术书：从基础定义到复杂系统的完整原理、算法和实践',
        meta: '多位作者 · PDF · 2500 页',
        cover: { title: '从基础定义到复杂系统', color: '#B6C7B4' },
        status: {
          tone: 'bad',
          text: '解析暂停：MinerU Token 已过期，请更新后重试',
        },
      },
    ],
  },
};
export const mapSamples: Record<string, BookMapState> = {
  normal: {
    ...base,
    title: '人工智能：现代方法（第4版）',
    check: {
      ok: true,
      text: '已建立书的地图 · 3 章',
      sub: '演示正文为示意内容',
      tone: 'muted',
    },
    chapters: [
      {
        id: 'ch3',
        no: '3',
        title: '通过搜索进行问题求解',
        meta: 'p.78–126 · 6 节 · 在学 3.5.2',
        status: 'learning',
        current: true,
        expanded: true,
        leaf: false,
        children: [
          {
            id: '3.5',
            label: '3.5 有信息的（启发式）搜索策略',
            level: 2,
            status: 'learning',
            current: false,
            pageLabel: '1/6',
            tags: [],
            flagged: false,
            expandable: true,
            expanded: true,
            children: [
              {
                id: '3.5.2',
                label: '3.5.2 A*搜索',
                level: 3,
                status: 'learning',
                current: true,
                pageLabel: 'p.102',
                tags: [{ tone: 'stuck', label: '卡点' }],
                flagged: false,
                expandable: false,
                expanded: false,
                children: [],
              },
            ],
          },
        ],
      },
    ],
    overlay: null,
  },
  empty: {
    ...base,
    title: '书的地图',
    check: { ok: true, text: '地图尚未就绪', tone: 'muted' },
    chapters: [],
    overlay: null,
  },
};
export const parseSamples: Record<string, ParseProgressState> = {
  normal: {
    ...base,
    title: '统计学习方法',
    meta: '李航 · PDF · 470 页',
    cover: { title: '统计学习方法', color: '#C6BEAC' },
    ready: false,
    footer: '每片完成后，那部分的章节就能开始学。',
    parts: [
      {
        number: 1,
        label: '第 1 片 · p.1–200',
        statusText: '解析 61%',
        tone: 'muted',
        progress: 0.522,
        stages: [
          { label: '上传', state: 'done' },
          { label: '排队', state: 'done' },
          { label: '解析', state: 'current' },
          { label: '下载结果', state: 'todo' },
          { label: '建地图', state: 'todo' },
        ],
      },
    ],
  },
};
export const importSamples: Record<string, ImportSettingsState> = {
  normal: {
    ...base,
    title: '人工智能：现代方法（第4版）',
    subtitle: '罗素 等',
    format: 'PDF',
    facts: [
      { label: '页数', value: '1136' },
      { label: '大小', value: '98.2 MB' },
      { label: '文字层', value: '有' },
      { label: '书签目录', value: '有 · 用来核对地图' },
    ],
    model: 'vlm',
    modelHint: '公式、表格、复杂排版效果更好，速度稍慢。',
    ocr: false,
    priorityFrom: '1',
    parts: 'p.1–200、p.201–400、p.401–600、p.601–800、p.801–1000、p.1001–1136',
    quota: '0 → 1136 / 1000',
    confirmUpload: true,
    canStart: true,
    overlay: false,
  },
};

mapSamples.loading = { ...mapSamples.empty, loading: true };
mapSamples.error = { ...mapSamples.empty, error: '地图没有加载成功，请重试' };
mapSamples.long = {
  ...mapSamples.normal,
  title: '一本有很长书名的技术书：从基础定义到复杂系统的完整原理、算法和实践',
};
parseSamples.empty = {
  ...parseSamples.normal,
  parts: [],
  footer: '解析队列还未开始，完成的章节会出现在书的地图中。',
};
parseSamples.loading = { ...parseSamples.empty, loading: true };
parseSamples.error = {
  ...parseSamples.empty,
  error: '解析进度没有加载成功，请重试',
};
parseSamples.long = {
  ...parseSamples.normal,
  title: '一本有很长书名的技术书：从基础定义到复杂系统的完整原理、算法和实践',
  parts: [
    {
      ...parseSamples.normal.parts[0],
      tone: 'bad',
      statusText: '已暂停',
      error:
        'MinerU Token 已过期，请在「我的 → 解析服务」更新，更新后从失败分片继续。',
    },
  ],
};
importSamples.empty = {
  ...importSamples.normal,
  title: '解析设置',
  facts: [],
  canStart: false,
  error: '找不到导入的文件，请返回书架重新选择',
};
importSamples.loading = {
  ...importSamples.normal,
  loading: true,
  canStart: false,
};
importSamples.error = {
  ...importSamples.normal,
  error: '开始页码需要是大于 0 的整数',
};
importSamples.long = {
  ...importSamples.normal,
  title: '一本有很长书名的技术书：从基础定义到复杂系统的完整原理、算法和实践',
  subtitle: '这是用来检查放大字号和长作者列表时排版的一条示例',
};
