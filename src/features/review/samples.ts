import type { ReviewState, ReviewSessionState } from './types';
export const reviewSamples: Record<string, ReviewState> = {
  normal: {
    hero: { due: 12, stuck: 3, total: 42 },
    boxes: [1, 3, 7, 15, 30].map((days, index) => ({
      label: `盒 ${index + 1} · ${days} 天`,
      count: 8,
      ratio: 1,
    })),
    start: { enabled: true, label: '开始复习 12 张' },
    stuckList: [
      {
        id: '1',
        text: '一致代价搜索为什么能保证最优？',
        where: '3.4.2 一致代价搜索',
        resolved: false,
      },
    ],
    loading: false,
  },
  empty: {
    hero: { due: 0, stuck: 0, total: 0 },
    boxes: [],
    start: { enabled: false, label: '今天没有要复习的卡片' },
    stuckList: [],
    loading: false,
  },
  loading: {
    hero: { due: 0, stuck: 0, total: 0 },
    boxes: [],
    start: { enabled: false, label: '正在读取复习卡片…' },
    stuckList: [],
    loading: true,
  },
  error: {
    hero: { due: 0, stuck: 0, total: 0 },
    boxes: [],
    start: { enabled: false, label: '今天没有要复习的卡片' },
    stuckList: [],
    loading: false,
    error: '出了点问题，请重试',
  },
};
export const reviewSessionSamples: Record<string, ReviewSessionState> = {
  front: {
    title: '复习 1/12',
    card: {
      source: '3.5.2 A*搜索',
      box: '盒 1',
      front: 'A* 的评价函数是什么？',
      flipped: false,
      tip: '先在心里回答，再点卡片看答案',
      canOpenSource: true,
    },
    rate: null,
    finished: null,
    loading: false,
    busy: false,
  },
  finished: {
    title: '复习',
    card: null,
    rate: null,
    finished: {
      title: '今天复习完了',
      text: '记得 8 · 模糊 3 · 忘了 1\n忘了的已加入卡点清单',
    },
    loading: false,
    busy: false,
  },
};

reviewSamples.long = {
  ...reviewSamples.normal,
  stuckList: [
    {
      id: 'long',
      text: '当图搜索中存在多个具有相同评价函数值的节点时，应该如何选择扩展顺序，并说明为什么这个选择仍然保留搜索算法的最优性？'.repeat(
        2,
      ),
      where: '3.5.2 A*搜索 · 关于边界条件和实现细节的补充问题',
      resolved: false,
    },
  ],
};
reviewSessionSamples.answer = {
  ...reviewSessionSamples.front,
  card: {
    ...reviewSessionSamples.front.card!,
    flipped: true,
    back: 'f(n) = g(n) + h(n)，同时考虑已经付出的路径代价与到目标的估计代价。',
  },
  rate: [
    { key: 'again', label: '忘了', sub: '1 天后' },
    { key: 'hard', label: '模糊', sub: '1 天后' },
    { key: 'good', label: '记得', sub: '3 天后' },
  ],
};
reviewSessionSamples.loading = {
  ...reviewSessionSamples.finished,
  finished: null,
  loading: true,
};
reviewSessionSamples.error = {
  ...reviewSessionSamples.finished,
  finished: null,
  error: '出了点问题，请重试',
};
reviewSessionSamples.long = {
  ...reviewSessionSamples.answer,
  card: {
    ...reviewSessionSamples.answer.card!,
    front:
      '请结合一个具有多条可选路径的搜索图，解释 A* 如何综合已经付出的代价与剩余代价估计值，并说明可容许启发函数与一致性启发函数之间的区别。'.repeat(
        2,
      ),
    back: '搜索过程需要同时考虑路径代价与对剩余距离的估计。'.repeat(8),
  },
};
