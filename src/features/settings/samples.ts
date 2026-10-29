import type {
  MeState,
  MineruState,
  AIState,
  AIEditState,
  PrefsState,
  StorageState,
  AboutState,
} from './types';
const ready = { loading: false, saving: false };
const prefs = {
  intuitionFirst: true,
  length: '中' as const,
  askEachStep: true,
  quizAtEnd: true,
  bilingual: true,
  recap: true,
  extra: '',
};
export const meSamples: Record<string, MeState> = {
  normal: {
    ...ready,
    groups: [
      [
        {
          key: 'MeMineru',
          title: '解析服务',
          subtitle: 'MinerU 官方 API · 今日 412/1000 页 · Token 5 天后过期',
          tone: 'stuck',
        },
        {
          key: 'MeAI',
          title: 'AI 服务',
          subtitle: '2 个服务 · 讲解用 Claude',
          tone: 'neutral',
        },
        {
          key: 'MePrefs',
          title: '讲解偏好',
          subtitle: '先直觉后公式 · 每段中 · 术语中英对照',
          tone: 'neutral',
        },
      ],
      [
        {
          key: 'MeAppearance',
          title: '外观',
          subtitle: '纸感 / 苹果风 · 深浅色 · 正文字号',
          tone: 'neutral',
        },
        {
          key: 'MeStorage',
          title: '存储与备份',
          subtitle: '3 本书 · 原文件 612 MB',
          tone: 'neutral',
        },
        {
          key: 'About',
          title: '关于 Pagewise',
          subtitle: '带着整本书的 AI 伴读 · GPL-3.0',
          tone: 'neutral',
        },
      ],
    ],
  },
  empty: {
    ...ready,
    groups: [
      [
        {
          key: 'MeAI',
          title: 'AI 服务',
          subtitle: '还没有配置讲解模型',
          tone: 'neutral',
        },
      ],
    ],
  },
  loading: { loading: true, saving: false, groups: [] },
  error: { ...ready, error: '出了点问题，请重试', groups: [] },
};
export const mineruSamples: Record<string, MineruState> = {
  normal: {
    ...ready,
    token: '',
    tokenLabel: '已保存 · 末 4 位 c71e',
    expiresOn: '2026-11-03',
    expiresHint: 'Token 5 天后过期',
    expired: false,
    model: 'vlm',
    confirmUpload: true,
    quotaLabel: '412/1000 页',
    quotaRatio: 0.412,
  },
  empty: {
    ...ready,
    token: '',
    tokenLabel: '尚未配置 Token',
    expiresOn: '',
    expiresHint: '未填写有效期',
    expired: false,
    model: 'vlm',
    confirmUpload: true,
    quotaLabel: '0/1000 页',
    quotaRatio: 0,
  },
};
export const aiSamples: Record<string, AIState> = {
  normal: {
    ...ready,
    providers: [
      {
        id: 'demo',
        name: '讲解模型',
        meta: 'Anthropic Messages · api.anthropic.com',
      },
    ],
    options: [{ key: 'demo', label: '讲解模型 · Claude' }],
    teach: 'demo',
    tidy: 'demo',
    usage: [
      {
        title: '人工智能：现代方法（第4版）',
        detail: '1.24M tokens · 缓存命中 71%',
      },
    ],
    month: '本月合计 1.31M tokens',
  },
  empty: {
    ...ready,
    providers: [],
    options: [],
    teach: '',
    tidy: '',
    usage: [],
    month: '本月合计 0 tokens',
  },
};
export const aiEditSamples: Record<string, AIEditState> = {
  normal: {
    ...ready,
    title: '添加服务',
    form: {
      name: '',
      protocol: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      model: '',
      effort: 'low',
      cache: 'auto',
      auth: 'x-api-key',
      key: '',
      priceInput: '',
      priceCacheRead: '',
      priceCacheWrite: '',
      priceOutput: '',
    },
    keyLabel: '只保存在 Android Keystore',
    errors: {},
    canDelete: false,
    confirmDelete: false,
  },
};
export const prefsSamples: Record<string, PrefsState> = {
  normal: { ...ready, prefs },
  long: {
    ...ready,
    prefs: {
      ...prefs,
      extra:
        '多用编程里的类比。先讲直觉，再解释公式中的每一项；给出可运行的 Python 例子。'.repeat(
          5,
        ),
    },
  },
};
export const storageSamples: Record<string, StorageState> = {
  normal: {
    ...ready,
    includeOriginals: false,
    confirmClean: null,
    confirmReparse: null,
    confirmRestore: false,
    books: [
      {
        id: 'aima',
        title: '人工智能：现代方法（第4版）',
        meta: '原文件 418.0 MB · 解析结果 12.0 MB',
        needsReparse: false,
      },
    ],
  },
  empty: {
    ...ready,
    includeOriginals: false,
    confirmClean: null,
    confirmReparse: null,
    confirmRestore: false,
    books: [],
  },
};
export const aboutSamples: Record<string, AboutState> = {
  normal: { ...ready, demo: false, development: true, version: '0.0.1' },
  demo: { ...ready, demo: true, development: true, version: '0.0.1' },
};

function completeSamples<
  T extends {
    loading: boolean;
    saving: boolean;
    error?: string;
    notice?: string;
  },
>(samples: Record<string, T>) {
  samples.empty ??= { ...samples.normal };
  samples.loading ??= { ...samples.normal, loading: true };
  samples.error ??= { ...samples.normal, error: '设置暂时无法读取，请重试' };
  samples.long ??= {
    ...samples.normal,
    notice: '服务设置和学习偏好只保存在当前设备。'.repeat(8),
  };
}
completeSamples(meSamples);
completeSamples(mineruSamples);
completeSamples(aiSamples);
completeSamples(aiEditSamples);
completeSamples(prefsSamples);
completeSamples(storageSamples);
completeSamples(aboutSamples);
