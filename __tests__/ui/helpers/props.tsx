import { Text } from 'react-native';
import type { KitProps, RichDoc } from '../../../src/ui/kit/contracts';

export type ComponentSamples = { [K in keyof KitProps]: KitProps[K] };
export const imageUri =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6r0AAAAASUVORK5CYII=';
export const sampleDoc: RichDoc = [
  {
    t: 'p',
    c: [
      { t: 'text', v: '这是示意讲解。' },
      { t: 'b', c: [{ t: 'text', v: '重要概念' }] },
      { t: 'math', tex: 'f(n)=g(n)+h(n)' },
      { t: 'cite', ref: 103001, verified: true, detour: false, label: 'p.103' },
      { t: 'unverified' },
    ],
  },
  { t: 'math', tex: 'a^2+b^2=c^2' },
  {
    t: 'list',
    ordered: true,
    items: [[{ t: 'text', v: '第一点' }], [{ t: 'text', v: '第二点' }]],
  },
  { t: 'list', ordered: false, items: [[{ t: 'text', v: '补充说明' }]] },
  {
    t: 'quote',
    ref: 103001,
    verified: true,
    label: '原文 · p.103',
    text: '示意原文，与真实书籍无关。',
  },
  {
    t: 'figure',
    ref: 104001,
    verified: true,
    uri: imageUri,
    label: '示意图',
    text: '示意搜索树',
  },
  {
    t: 'aux',
    kind: 'derive',
    open: true,
    body: [{ t: 'p', c: [{ t: 'text', v: '补充推导示意。' }] }],
  },
  {
    t: 'aux',
    kind: 'example',
    open: false,
    body: [{ t: 'p', c: [{ t: 'text', v: '举例示意。' }] }],
  },
  { t: 'check', c: [{ t: 'text', v: '现在能解释这个概念吗？' }] },
  { t: 'code', text: 'frontier.push(node)' },
];

/** 显式映射全部 KitProps；新增组件遗漏样本会直接产生类型错误。 */
export function makeComponentSamples(): ComponentSamples {
  return {
    Screen: { scroll: true, children: <Text>页面示例</Text> },
    AppBar: {
      title: '组件展示',
      subtitle: '纯展示状态',
      variant: 'root',
      onBack: jest.fn(),
      right: <Text>操作</Text>,
    },
    TabBar: {
      items: [
        { key: 'shelf', label: '书架', icon: 'shelf' },
        { key: 'review', label: '复习', icon: 'cards', badge: 3 },
        { key: 'notes', label: '笔记', icon: 'note' },
        { key: 'me', label: '我的', icon: 'person' },
      ],
      active: 'shelf',
      onSelect: jest.fn(),
    },
    ModeSwitch: { value: 'listen', onChange: jest.fn() },
    Segmented: {
      options: [
        { key: 'orig', label: '原版' },
        { key: 'flow', label: '重排' },
      ],
      value: 'flow',
      onChange: jest.fn(),
      accessibilityLabel: '阅读排版',
    },
    Switch: {
      value: true,
      onChange: jest.fn(),
      accessibilityLabel: '显示续学回顾',
    },
    Button: {
      label: '保存',
      variant: 'primary',
      icon: 'check',
      onPress: jest.fn(),
    },
    IconButton: {
      icon: 'search',
      label: '搜索全书',
      onPress: jest.fn(),
      badge: 1,
    },
    QuickActions: {
      items: [
        { key: 'next', label: '懂了，下一步', kind: 'primary', icon: 'next' },
        { key: 'example', label: '举个例子', icon: 'spark' },
        { key: 'back', label: '回到主线', kind: 'detour' },
      ],
      onPress: jest.fn(),
    },
    Composer: {
      value: '这一节是什么意思？',
      onChange: jest.fn(),
      placeholder: '不懂就问',
      onSend: jest.fn(),
      sendDisabled: false,
      quote: { label: 'p.103 · 当前段落', onClear: jest.fn() },
      micAvailable: false,
    },
    StepProgress: {
      steps: [
        { title: '先讲直觉', state: 'done' },
        { title: '理解定义', state: 'current' },
        { title: '这一步已熟', state: 'skipped' },
        { title: '检查理解', state: 'todo' },
      ],
      label: '第 2/4 步',
      onPressStep: jest.fn(),
      onPressBar: jest.fn(),
      right: <Text>AI 看到的内容</Text>,
    },
    DetourBanner: {
      title: '这一节与前面的关系',
      onBack: jest.fn(),
      backLabel: '回到主线',
    },
    ListSection: {
      title: '学习偏好',
      note: '这些设置只影响讲解方式。',
      children: <Text>分组内容</Text>,
    },
    Row: {
      title: '外观',
      subtitle: '纸感 · 跟随系统',
      right: <Text>纸感</Text>,
      chevron: true,
      onPress: jest.fn(),
    },
    Field: {
      label: '服务名称',
      value: '我的服务',
      onChange: jest.fn(),
      placeholder: '填写名称',
    },
    Note: { tone: 'accent', children: '这里是提示内容。' },
    Tag: { label: '示意内容', tone: 'accent' },
    ProgressBar: { value: 0.6 },
    StageStrip: {
      stages: [
        { label: '上传', state: 'done' },
        { label: '解析', state: 'current' },
        { label: '入库', state: 'todo' },
        { label: '可重试', state: 'error' },
      ],
    },
    Cover: { title: '示意书籍', color: '#2F5AA8', size: 'md' },
    StatusDot: { tone: 'ok' },
    SectionStatusIcon: { status: 'learning' },
    CheckRow: {
      checked: true,
      title: '保存本节摘要',
      subtitle: '可以稍后再修改。',
      tag: '摘要',
      onToggle: jest.fn(),
    },
    Sheet: {
      visible: true,
      title: '原文预览',
      subtitle: 'p.103',
      onClose: jest.fn(),
      actions: [{ label: '在读书中打开', kind: 'primary', onPress: jest.fn() }],
      children: <Text>示意原文</Text>,
    },
    Dialog: {
      visible: true,
      title: '确认操作',
      body: '这是一条示意说明。',
      confirm: '确认',
      cancel: '取消',
      onConfirm: jest.fn(),
      onCancel: jest.fn(),
    },
    Toast: { message: '已保存', tone: 'ok' },
    SelectionMenu: {
      anchor: { x: 30, y: 160, w: 260, h: 80 },
      visible: true,
      items: [
        { key: 'explain', label: '解释' },
        { key: 'highlight', label: '高亮' },
      ],
      onSelect: jest.fn(),
      onDismiss: jest.fn(),
    },
    Fab: { label: '导入', icon: 'add', onPress: jest.fn() },
    Glass: { strength: 'strong', children: <Text>材质内容</Text> },
    Empty: {
      title: '还没有书',
      body: '导入一本自己拥有的书。',
      action: <Text>导入</Text>,
    },
    RichView: { doc: sampleDoc, onCite: jest.fn(), onFigure: jest.fn() },
    MathView: {
      tex: 'a+b',
      display: true,
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="24"><text fill="currentColor" x="1" y="18">a+b</text></svg>',
      width: 80,
      height: 24,
    },
    CiteChip: { label: 'p.103', tone: 'main', onPress: jest.fn() },
    FigureView: { uri: imageUri, caption: '示意图 3.18', onPress: jest.fn() },
    UserBubble: { text: '能换个说法吗？', quote: 'p.103 当前段落' },
    AiMessage: {
      doc: sampleDoc,
      streaming: false,
      onCite: jest.fn(),
      onFigure: jest.fn(),
    },
    ToolSteps: {
      lines: [
        { text: '读取 3.4.2 的原文', running: false },
        { text: '整理本节路线图', running: true },
      ],
    },
    StepHeader: {
      step: 2,
      label: '第 2/4 步',
      title: '理解定义',
      pages: 'p.103–104',
    },
    SourceCard: {
      label: '原文 · p.103',
      text: '示意原文，使用衬线体。',
      onPress: jest.fn(),
    },
    AuxBlock: {
      kind: 'derive',
      open: true,
      children: <Text>补充推导内容</Text>,
    },
    CheckCard: { text: '能用自己的话解释吗？' },
    ResumeCard: {
      title: '接着上次读',
      lines: ['上次读到这一节。', '有一个卡点。'],
      actions: [
        { key: 'go', label: '直接继续', primary: true },
        { key: 'review', label: '先复习卡点' },
      ],
      onAction: jest.fn(),
    },
    FoldCard: {
      title: '已解决：这一节与前面的关系',
      count: '3 条',
      expanded: true,
      onToggle: jest.fn(),
      children: <Text>折叠后的问答内容</Text>,
    },
    QuizCard: {
      title: '小测',
      question: '下面哪个说法正确？',
      options: [
        { label: '第一个说法', state: 'idle' },
        { label: '第二个说法', state: 'idle' },
        { label: '第三个说法', state: 'idle' },
      ],
      locked: false,
      onPick: jest.fn(),
    },
    ProposalCard: {
      title: 'AI 建议 · 记为卡点',
      body: '这个定义还不太清楚。',
      state: 'pending',
      actions: [
        { key: 'yes', label: '记下' },
        { key: 'no', label: '不用' },
      ],
      onAction: jest.fn(),
    },
    DoneCard: {
      title: '这一节学完了',
      text: '整理一下摘要和卡点。',
      onPress: jest.fn(),
    },
    SysDivider: { text: '跳过了第 3 步', tone: 'main' },
    Typing: { label: '正在讲解' },
    PageOrig: {
      uri: imageUri,
      width: 700,
      height: 1000,
      blocks: [
        { ref: 103001, x0: 0.1, y0: 0.1, x1: 0.9, y1: 0.25, state: 'current' },
        {
          ref: 103002,
          x0: 0.1,
          y0: 0.3,
          x1: 0.9,
          y1: 0.5,
          state: 'highlight',
          pin: true,
        },
      ],
      onBlock: jest.fn(),
    },
    BlockView: { text: '原书示意段落。', current: true, onPress: jest.fn() },
    PinChip: { label: '问答 · 为什么这样定义？', onPress: jest.fn() },
    GuideBar: {
      title: '本节导读',
      body: '这一节先讲直觉，再介绍定义。',
      expanded: true,
      onToggle: jest.fn(),
    },
    ReadEnd: { label: '读完这一节', onPress: jest.fn() },
    FlashCard: {
      front: '什么是启发式函数？',
      back: '这里是示意答案。',
      flipped: false,
      onFlip: jest.fn(),
    },
    RateBar: { onRate: jest.fn() },
    BoxChart: { boxes: [12, 6, 3, 2, 1] },
    StackBar: {
      layers: [
        { value: 1000, tone: 'accent' },
        { value: 3000, tone: 'detour' },
        { value: 1200, tone: 'derive' },
      ],
    },
    LayerRow: {
      name: '当前原文',
      detail: '整段原文',
      tokens: '3000',
      cached: true,
    },
  };
}
