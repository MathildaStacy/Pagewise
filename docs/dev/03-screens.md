# 03 · 页面与 ViewModel 契约

## 0. 约定

- 每个页面 = `features/<f>/XxxScreen.tsx`（容器）+ `useXxxVM()` + `ui/screens/XxxView.tsx`（纯展示）。
- VM 返回 `{ state, intents }`。`state` 是可直接渲染的数据（文案已格式化）；`intents` 是无参数或简单参数的函数，返回 `void`（异步结果通过 state 变化体现）。
- 类型写在 `features/<f>/types.ts`，页面只 `import type`。
- 每个 VM 旁边有 `samples.ts`：导出若干**示例状态**（正常、空、加载中、出错、长文本），用于 SkinGallery 和页面渲染测试，intents 用空函数。
- 浮层统一描述：

```ts
type Overlay<K extends string, P = {}> = { kind: K } & P;   // VM.state.overlay: 当前页面的浮层，null 表示没有
// 页面根据 kind 渲染 kit 的 Sheet / Dialog / SelectionMenu；关闭一律调 intents.closeOverlay()
```

- 全局提示走 `toast` 店铺，页面不用管。
- 下文「区域」= 两套皮肤共用的布局区域（02 §2 规定位置不能变）；「paper 参考」指向原型里的函数，样式以它为准。
- 文案：表格里写的文案原样使用。

---

## 1. 书架 `Shelf`（Tab 1）

paper 参考：`ui-shelf.js` `SCREENS.shelf`。

区域：
```
顶栏      Pagewise（根页标题）                      右：搜索书架
继续学习卡  继续学习 · 书名 / 小节名 / 章 · 页码 / 回顾一句（≥1 天且有卡点）/ 步骤点 + 第 k/n 步 / 继续 ›
我的书     分区标题「我的书  n 本」；每本：封面 · 书名 · 作者 · 格式 · 页数 · 状态行
右下      ＋ 导入（悬浮）
底部      Tab 栏
```

```ts
interface ShelfState {
  continueCard: null | {
    kicker: string;          // '继续学习 · 人工智能：现代方法（第4版）'
    title: string;           // '3.5.2 A*搜索'
    meta: string;            // '第 3 章 通过搜索进行问题求解 · p.102–106'
    recap?: string;          // '上次 3 天前，讲完了第 1 步。卡点：…'
    steps: { done: boolean }[]; stepLabel: string;   // '第 2/4 步' 或 '新的一节'
  };
  books: {
    id: string; title: string; meta: string;        // '罗素 等 · PDF · 1136 页'
    cover: { title: string; color: string };
    status: { tone: 'accent' | 'stuck' | 'bad' | 'muted'; text: string };
    // 在学 3.5.2 · 已学 12/96 个小节 | 解析中 · 解析 · 46% · p.1–200 可学 | 解析暂停：Token 已过期 | 已就绪 · 未开始 | EPUB · 本地解析 · 已就绪 · 未开始
  }[];
  empty: boolean;             // 没有书时：空状态「导入第一本书」+ 说明
  overlay: null | Overlay<'import', ImportSheetState> | Overlay<'search', { query: string; results: { id: string; title: string; meta: string }[] }>;
}
interface ShelfIntents {
  openContinue(): void; openBook(id: string): void; openImport(): void;
  openSearch(): void; setSearch(q: string): void; closeOverlay(): void;
  // 导入浮层
  pickRecent(fileKey: string): void; pickOther(): void;
}
```

行为：
- `openBook`：解析中 / 暂停 → `ParseProgress`；其他 → `BookMap`。
- 书架搜索（V1）：按书名、作者本地过滤，在浮层里显示。
- `continueCard` 来自最近一次打开的书的 `study_state`；没有在学的书时为 null，整卡不显示。

### 1.1 导入浮层（Sheet）

paper 参考：`openImport()`。

```ts
interface ImportSheetState {
  recent: { key: string; name: string; meta: string; format: 'PDF' | 'EPUB' }[];  // 下载目录里最近的 PDF/EPUB（见 06 §1；拿不到权限时为空，不显示该分组）
  note: string;   // '支持 PDF 和 EPUB。也可以在其他 App 里把文件"分享到 Pagewise"。同一本书按文件内容识别，不会重复解析。'
  busy: boolean;  // 复制文件 / 计算哈希中
}
```
选文件后：复制到私有目录 → 算 SHA-256 → 已有同哈希的书则 toast「这本书已经在书架上了」并打开它 → 否则读元信息、建导入草稿 → 跳 `ImportSettings`。

## 2. 解析设置 `ImportSettings`

paper 参考：`SCREENS.importSet`、`confirmUpload()`。

```ts
interface ImportSettingsState {
  file: { title: string; sub: string; format: 'PDF' | 'EPUB' };
  facts: { label: string; value: string; tone?: 'ok' | 'warn' }[];   // 页数 / 大小 / 文字层 / 书签目录；EPUB：章节 / 大小 / 目录 / 解析位置
  epub: boolean;
  // 仅 PDF：
  model: 'vlm' | 'pipeline'; modelHint: string;
  ocr: boolean; ocrHint: string;                // 扫描版自动打开
  priorityFrom: number;                         // 从第几页开始解析
  parts: string;                                // 'p.1–200、p.201–400…'，说明「单个文件最多 200 页，拆成 n 片，合并后保持原书页码」
  quota: { text: string; warn: boolean };       // '412 → 1156 / 1000'（额度数字见 06 §2.1）
  uploadNote: string;
  confirmUpload: boolean;                       // 设置里「上传前确认」
  overlay: null | Overlay<'confirmUpload', { body: string }>;
  submitting: boolean; error?: string;
}
interface ImportSettingsIntents {
  setModel(m: 'vlm' | 'pipeline'): void; setOcr(v: boolean): void; setPriorityFrom(p: number): void;
  start(): void;            // PDF：需要确认时先弹 confirmUpload；EPUB：直接本地导入
  confirm(): void; closeOverlay(): void;
}
```
成功后：导航栈改为 `[Tabs(Shelf), ParseProgress]`（EPUB：`[Tabs, BookMap]`，toast「已导入，地图已建好」）。

## 3. 解析进度 `ParseProgress`

paper 参考：`SCREENS.parse`。

```ts
interface ParseProgressState {
  book: { title: string; meta: string; cover: CoverProps };
  parts: {
    label: string;                     // '第 1 片 · p.1–200'
    statusText: string; tone: 'muted' | 'ok' | 'bad';     // '解析 46%' / '完成' / '已暂停'
    progress: number;                  // 0..1
    stages: { label: '上传' | '排队' | '解析' | '下载结果' | '建地图'; state: 'done' | 'current' | 'error' | 'todo' }[];
    error?: { text: string; actions: ('updateToken' | 'retry' | 'reparseOcr' | 'tomorrow')[] };
  }[];
  footer: { kind: 'background'; text: string } | { kind: 'ready'; text: string; cta: '查看书的地图' };
}
interface ParseProgressIntents { retryPart(i: number): void; goUpdateToken(): void; reparseWithOcr(i: number): void; openMap(): void }
```

## 4. 书的地图 `BookMap`

paper 参考：`ui-map.js`。

区域：顶栏（书名 + 副标题「书的地图」，右：全书搜索）→ 核对结果条 → 章列表（可展开）→ 节 → 小节。

```ts
interface BookMapState {
  title: string;
  check: { ok: boolean; text: string; sub?: string; tone: 'muted' | 'stuck' };  // '已和 PDF 书签核对：28 章 + 2 个附录一致' / '2 处需要你确认 · 3.5.4、…'
  chapters: MapChapter[];
  scrollToSectionId?: string;           // 进入时把当前小节滚到屏幕中间
  overlay: null
    | Overlay<'section', SectionSheetState>
    | Overlay<'flag', { title: string; body: string; confirm: string; cancel: string }>
    | Overlay<'search', SearchSheetState>;
}
interface MapChapter { id: string; no: string; title: string; meta: string; status: 'new' | 'learning' | 'done'; current: boolean; expanded: boolean; children: MapNode[] }
interface MapNode {
  id: string; label: string;   // '3.5.2 A*搜索'
  level: 2 | 3; status: 'new' | 'learning' | 'done'; current: boolean;
  pageLabel: string;           // 'p.102' 或 节的 '3/6 ▾'
  tags: { tone: 'stuck'; label: '需确认' | '卡点' }[];
  flagged: boolean; expandable: boolean; expanded: boolean; children?: MapNode[];
}
interface SectionSheetState {
  title: string; subtitle: string;                    // 小节名 / 上级节名
  facts: { k: string; v: string }[];                  // 页码、状态（在学 · 第 2/4 步）、问答 n 条
  summary?: string; stuck: string[];
  actions: { key: 'read' | 'notes' | 'start'; label: string; primary?: boolean }[];  // 看原文 / 看笔记 / 继续讲 | 再讲一遍 | 从这里开始讲
}
interface SearchSheetState { query: string; hint: string; results: { ref: string; title: string; snippet: { text: string; hit: boolean }[]; page: string }[]; empty?: string }
interface BookMapIntents {
  toggle(id: string): void; openSection(id: string): void; sectionAction(key: 'read' | 'notes' | 'start'): void;
  confirmFlag(): void; rejectFlag(): void; openSearch(): void; setQuery(q: string): void; openResult(ref: string): void; closeOverlay(): void;
}
```

- 「从这里开始讲」：如果当前主线是别的小节，弹 Dialog「从 3.6.1 开始学？当前进度 3.5.2 会保留为在学」，确认后改主线、进 `Study`。
- 标黄小节点开是 `flag` 对话框（文案模板见原型 `openSec` 的 `s.flag` 分支）；V1 支持：保持合并 / 拆成两个、补上漏识别的小节、调整层级。手动修改后 `source=manual`。
- 搜索结果点开 → `Reader { blockRef }`。

## 5. 听讲 / 读书 `Study`

这是核心页面。两种模式共用顶栏，模式切换不换页面（位置不丢，见 05 §9）。

区域（两套皮肤都一样）：
```
顶栏        ‹ 返回（到地图）  小节名 / 书名 · 页码   [读书 | 听讲]  ⋯
── 听讲模式 ──────────────────────────────
进度区      第 k/n 步（· 第 i/m 段）  步骤进度  AI 看到的内容 ›
岔路条      ● 岔路 · 3.4.2 一致代价搜索            [回到主线 3.5.2]     （只在岔路里）
对话区      thread（滚动）
快捷动作    横向滚动 chips（主操作在最左）
引用条      引用 p.103 · 原文开头……  ✕                                   （带着段落提问时）
输入框      [不懂就问…              ] [发送 / 停止]
── 读书模式 ──────────────────────────────
工具条      [原版 | 重排]   讲到第 2 步　点段落可解释、提问
内容        本节导读折叠条 → 页面 / 块列表（讲过的段左侧细线、当前段加粗线、高亮、问答便签）→ 读完这一节
```

### 5.1 状态

```ts
interface StudyState {
  header: { title: string; subtitle: string; backLabel: string };   // backLabel '地图'（只有 glass 显示）
  mode: 'listen' | 'read';
  listen: ListenState;
  read: ReaderState;              // §5.4，与 Reader 页共用
  overlay: StudyOverlay | null;
}
interface ListenState {
  progress: {
    label: string;                // '第 2/4 步' 或 '第 2/4 步 · 第 1/2 段'
    steps: { title: string; state: 'done' | 'current' | 'skipped' | 'todo' }[];
    contextLabel: 'AI 看到的内容';
  };
  detour: null | { title: string; backLabel: string };              // '岔路 · 3.4.2 一致代价搜索' / '回到主线 3.5.2'
  thread: ThreadItem[];
  scroll: { toEndToken: number; toItemId?: string };                // token 变化时滚到底
  quickActions: { key: QuickKey; label: string; kind?: 'primary' | 'detour' }[];
  composer: { value: string; placeholder: string; canSend: boolean; streaming: boolean; quote: null | { label: string } };
  busy: boolean;
}
type QuickKey = 'next' | 'nextPart' | 'nextSection' | 'alt' | 'example' | 'derive' | 'skip' | 'quiz' | 'source'
  | 'backMain' | 'detourSource' | 'reviewOk' | 'reviewAgain' | 'reteachSection';
```

### 5.2 thread 项

```ts
type ThreadItem =
  | { kind: 'history'; id: string; label: string; expanded: boolean }        // '3 天前 · 第 1 步 · 3 条消息 ▾'；展开后它前面的旧消息才显示
  | { kind: 'divider'; id: string; text: string; tone: 'main' | 'detour' }    // '第 2 步 · …'、'岔路 · 3.4.2 …'、'回到主线 · 3.5.2 A*搜索'、'3.5.1 已学完 · 新增 3 张闪卡'
  | { kind: 'stepHeader'; id: string; step: number; label: string; title: string; pages: string }   // '第 2 步' 'f(n) = g(n) + h(n) 的含义' 'p.103'
  | { kind: 'user'; id: string; text: string; quote?: string; detour: boolean }
  | { kind: 'ai'; id: string; doc: RichDoc; streaming: boolean; detour: boolean }
  | { kind: 'tools'; id: string; lines: { text: string; running: boolean }[]; detour: boolean }   // '读取 3.4.2 Dijkstra算法或一致代价搜索（p.90–93）'
  | { kind: 'resume'; id: string; title: string; lines: string[]; actions: { key: 'go' | 'review'; label: string; primary?: boolean }[] }  // 续学 · 距上次 3 天
  | { kind: 'fold'; id: string; title: string; count: string; expanded: boolean; items: ThreadItem[] }   // '已解决：A* 和一致代价搜索的关系' '3 条'
  | { kind: 'detourRun'; id: string; items: ThreadItem[] }                    // 进行中的岔路，左侧岔路色竖线
  | { kind: 'quiz'; id: string; title: string; question: string; options: { label: string; state: 'idle' | 'right' | 'wrong' | 'muted' }[]; locked: boolean }
  | { kind: 'proposal'; id: string; title: string; body: string; state: 'pending' | 'accepted' | 'dismissed'; resultText?: string; actions: { key: 'accept' | 'dismiss'; label: string }[] }
  | { kind: 'done'; id: string; title: '本节讲完了'; text: string }
  | { kind: 'typing'; id: string }
  | { kind: 'error'; id: string; text: string; retry: boolean };
```
`RichDoc` 见 05 §2。补充推导、AI 举例、原文引用卡、检查问题都在 `RichDoc` 里（块级节点），由 `RichView` 渲染。

### 5.3 快捷动作规则（VM 里算）

| 状态 | chips（第一个是主操作） |
| --- | --- |
| 讲解中，不是本段最后一步 | 懂了，下一步 · 换个说法 · 举个例子 · 展开推导 · 这步熟，跳过 · 考考我 · 看原文 |
| 讲解中，本段最后一步，后面还有段 | 懂了，下一段 · 换个说法 · 举个例子 · 展开推导 · 考考我 · 看原文 |
| 讲解中，本节最后一步 | 懂了 · 换个说法 · 举个例子 · 展开推导 · 考考我 · 看原文（「懂了」后：开了「一节讲完做小测」就出本节小测，否则进入 ready） |
| 有未答的测验 | 换个说法 · 举个例子 · 看原文 |
| ready（本节讲完） | 懂了，下一节 · 再讲一遍这一节 · 看原文 |
| 岔路中 | 回到主线 3.5.2（detour 样式）· 看 3.4.2 原文 |
| 复习卡点（从续学或卡点清单进入的岔路） | 清楚了，继续 3.5.2（detour）· 还是不太懂 |
| 续学卡片未处理 | 无 chips（按钮在卡片里） |

- `busy`（AI 正在回答）时 chips 仍显示但点了 toast「正在回答…」；发送按钮变「停止」。
- 「这步熟，跳过」在最后一步不出现。「展开推导」只在当前步 `kind` 为 derivation/definition 或该步块里有公式时出现。
- 「看原文」= 切到读书模式定位到当前步（05 §9）。

### 5.4 读书（与 `Reader` 页共用 `ReaderState`）

paper 参考：`ui-reader.js`；新交互参考 `explore/src/app.js` 的 `readerView`、`blockMenu`、`explain`、`openPin`。

```ts
interface ReaderState {
  view: 'orig' | 'flow';
  hint: string;                   // '讲到第 2 步　点段落可解释、提问' / '已学　点段落可解释、提问'
  guide: { oneLine: string; full?: string; expanded: boolean; loading: boolean } | null;   // 本节导读，首次展开时生成
  items: ReaderItem[];            // 按页顺序
  scrollTo?: { ref: string; flash: boolean; token: number };
  readEnd: { visible: boolean; label: '读完这一节'; hint: '和听讲一样生成摘要和闪卡草稿' };
  selection: null | { ref: string; anchor: Rect; items: { key: BlockMenuKey; label: string }[] };
}
type ReaderItem =
  | { kind: 'pageOrig'; page: number; image: { uri: string; w: number; h: number } | null; marks: BlockMark[]; runningHead: [string, string] }
  | { kind: 'block'; ref: string; type: BlockType; doc: RichDoc; marks: MarkKind[]; pin?: { id: string; label: string } }   // 重排模式
  | { kind: 'pageBreak'; page: number };                                                                                    // 重排模式的页码分隔
interface BlockMark { ref: string; rect: { x: number; y: number; w: number; h: number }; marks: MarkKind[]; pin?: { id: string; label: string } }  // rect 是 0..1 相对页面
type MarkKind = 'heard' | 'now' | 'highlight' | 'selected' | 'flash';
type BlockMenuKey = 'explain' | 'translate' | 'ask' | 'startHere' | 'highlight' | 'unhighlight' | 'note';
```

块菜单（点段落出现，顺序固定）：解释 · 翻译 · 问 AI · 从这里开始讲 · 高亮（已高亮时为取消高亮）· 笔记。标题块不弹菜单。

V1 的「划词」以**整块**为单位（点段落选中整块）；块内任意文字范围选择放到 M5。

### 5.5 浮层

```ts
type StudyOverlay =
  | Overlay<'menu', { rows: { key: 'map' | 'notes' | 'context' | 'finish'; title: string; sub: string }[] }>      // 原型 studyMenu：书的地图 / 本节笔记 / AI 看到的内容 / 结束本节
  | Overlay<'roadmap', { title: string; steps: { title: string; pages: string; state: StepState; kindLabel: string }[] }> // 本节路线图：点某步 → 从这一步开始讲
  | Overlay<'jumpStep', { title: string; body: string }>                // '从第 3 步开始讲？' / '「一致性」· p.104。中间没讲的步骤会留着，随时可以回来讲。'
  | Overlay<'context', ContextPanelState>
  | Overlay<'peek', { title: string; subtitle: string; blocks: { ref: string; doc: RichDoc; target: boolean }[]; actions: ('openInReader' | 'close' | 'ok')[] }>  // 原文预览：'原书 p.103'
  | Overlay<'figure', { uri: string; caption: string; page: string }>
  | Overlay<'explain', { quote: RichDoc; answer: RichDoc | null; streaming: boolean; subtitle: string }>   // 按钮：记为卡点 / 带到听讲里继续问 / 好的（贴成便签）
  | Overlay<'translate', { quote: RichDoc; answer: RichDoc | null; streaming: boolean; subtitle: string }>
  | Overlay<'pin', { title: string; answer: RichDoc; subtitle: string }>   // 问答便签：在听讲里继续问 / 好的
  | Overlay<'note', { quote: RichDoc; value: string }>                     // 记笔记 · p.103
  | Overlay<'switchMain', { body: string }>                                // 岔路深度到 2 / 从岔路改主线的确认
  | Overlay<'table', { html: string; caption: string }>;                   // 查看表格（WebView）
interface ContextPanelState {
  subtitle: '本轮请求 · 预计输入 token';
  layers: { name: string; detail: string; tokens: string; cached: boolean; color: 'l1' | 'l2' | 'l3' | 'l4' | 'l5' | 'l6' }[];  // 颜色由皮肤映射
  total: { tokens: string; detail: string };   // '其中 4.3k 命中缓存 · Claude 官方 · claude-sonnet-5-5'
  lastActual?: string;                         // '上一轮实际：输入 3.1k · 缓存读 4.2k · 输出 0.6k'
  note: string;
}
```

### 5.6 意图

```ts
interface StudyIntents {
  back(): void; setMode(m: 'listen' | 'read'): void; openMenu(): void; menuSelect(k: string): void;
  // 听讲
  quick(k: QuickKey): void; setText(t: string): void; send(): void; stop(): void; clearQuote(): void;
  pressStep(i: number): void; openRoadmap(): void; openContext(): void;
  pressCite(ref: string): void; pressFigure(ref: string): void; pressTable(ref: string): void;
  toggleFold(id: string): void; toggleHistory(): void;
  answerQuiz(itemId: string, option: number): void;
  resolveProposal(itemId: string, accept: boolean): void;
  resumeAction(k: 'go' | 'review'): void; retry(itemId: string): void;
  // 读书
  setView(v: 'orig' | 'flow'): void; toggleGuide(): void;
  pressBlock(ref: string, anchor: Rect): void; menuAction(k: BlockMenuKey): void;
  reportAnchor(ref: string): void;          // 滚动停止后上报屏幕中间的块（VM 内节流 500ms）
  pressPin(id: string): void; finishReading(): void;
  // 浮层
  overlayAction(k: string): void; setNoteText(t: string): void; closeOverlay(): void;
}
```

- `pressStep(i)`：已讲过的步 → 滚到那步的 `stepHeader`；没讲过 → `jumpStep` 确认浮层。
- `pressCite(ref)`：打开 `peek`。主线引用的动作是「在读书模式打开」「关闭」；岔路引用的动作是「好的」（不跳走）。
- `menuAction('ask')`：切到听讲，设置 composer 引用条为这块，聚焦输入框。
- `menuAction('startHere')`：按 05 §9 的规则切到听讲。
- `finishReading` / `quick('nextSection')` / 菜单「结束本节」→ 生成小结草稿 → `SectionDone`。

## 6. `Reader`（单独打开）

同 §5.4。顶栏：「‹」+ 小节名 / 页码，右侧 `ModeSwitch` 当前为「读书」，点「听讲」→ 如果上一页是 `Study` 就返回它，否则跳 `Study`（主线）。单独打开的 `Reader` 不显示 `readEnd`（除非打开的就是主线小节）。

## 7. 本节小结 `SectionDone`

paper 参考：`SCREENS.done`；glass 参考 app.js `finish()` 的视觉（但仍是独立页面，不是浮层）。

```ts
interface SectionDoneState {
  hero: { kicker: string; title: string; stats: string };   // 章名 / '3.5.2 A*搜索 · 讲完了' / '4 步 · 跳过 1 步 · 5 次提问 · 岔路 1 次'
  summary: { value: string; hint: 'AI 起草，可以改' };
  stuck: { id: string; text: string; checked: boolean }[];
  cards: { id: string; front: string; back: string; checked: boolean; fromDetour: boolean }[];
  detours: { q: string; where: string }[];                  // '已记入 3.4.2 Dijkstra算法或一致代价搜索 的笔记'
  next: null | { label: string; hint: string };            // '保存，开始 3.5.3 搜索等值线' / '保存后主线进度移到 3.5.3'；最后一节时 label='保存'
  loading: boolean;   // 草稿生成中：骨架屏 + '正在整理摘要和闪卡…'
  error?: string;     // 生成失败：可重试，也可以手写后保存
  saving: boolean;
}
interface SectionDoneIntents {
  setSummary(t: string): void; toggleStuck(id: string): void; toggleCard(id: string): void;
  editCard(id: string, front: string, back: string): void;   // 长按卡片打开编辑对话框
  retry(): void; save(): void;
}
```
保存 = 一个事务：写摘要、卡点、闪卡（盒子 1）、小节 `done`、主线指针移到下一叶子小节并标 `learning`；然后 `replace('Study')`，新小节自动开始（先生成路线图）。

## 8. 复习 `Review`（Tab 2）

paper 参考：`SCREENS.review`、`reteach()`。

```ts
interface ReviewState {
  hero: { due: number; stuck: number; total: number };
  boxes: { label: string; count: number; ratio: number }[];   // '盒 1 · 1 天'
  start: { enabled: boolean; label: string };                  // '开始复习 12 张' / '今天没有要复习的卡片'
  stuckList: { id: string; text: string; where: string; resolved: boolean }[];   // where: '3.4.2 一致代价搜索 · 复习时答错'
}
interface ReviewIntents { start(): void; reteach(id: string): void; markResolved(id: string): void }
```
`reteach`：进入该卡点所在书的 `Study`，以「复习卡点」岔路的方式让 AI 重讲（05 §7.3）；讲懂后用户点「清楚了」划掉。

## 9. 复习闪卡 `ReviewSession`

paper 参考：`SCREENS.rv`。

```ts
interface ReviewSessionState {
  title: string;                 // '复习 3/12'
  card: null | { source: string; box: string; front: string; back?: string; flipped: boolean; tip: string; canOpenSource: boolean };
  rate: null | { key: 'again' | 'hard' | 'good'; label: '忘了' | '模糊' | '记得'; sub: string }[];   // sub: '1 天后'
  finished: null | { title: '今天复习完了'; text: string };   // '记得 8 · 模糊 3 · 忘了 1\n忘了的已加入卡点清单'
}
interface ReviewSessionIntents { flip(): void; rate(k: 'again' | 'hard' | 'good'): void; openSource(): void; askAi(): void; done(): void }
```
`askAi`：进入对应书的 `Study`，composer 预填「关于这张卡：<正面>」并把卡片所在小节作为岔路加载。

## 10. 笔记 `Notes`（Tab 3）、`NotesBook`、`NoteDetail`

paper 参考：`SCREENS.notes`、`notesBook`、`noteDetail`、`openExport()`。

```ts
interface NotesState { books: { id: string; title: string; cover: CoverProps; meta: string; hasNotes: boolean }[] }
interface NotesBookState {
  title: string;
  chapters: { title: string; sections: { id: string; label: string; status?: 'learning' | 'done'; summary?: string; tags: { tone: 'default' | 'stuck' | 'detour'; label: string }[] }[] }[];
  overlay: null | Overlay<'export', { format: 'md' | 'anki'; tree: string; desc: string; strip: boolean; stripHint: string; busy: boolean }>;
}
interface NoteDetailState {
  title: string; subtitle: string; canOpenSource: boolean;
  summary?: string;                         // 没有时显示「学完这一节后生成」
  qa: { q: string; a: string }[];
  detourQa: { from: string; q: string; a: string }[];   // '学 3.5.2 时回来问的'
  stuck: { text: string; resolved: boolean }[];
  highlights: { ref: string; text: string; page: string }[];
  pins: { ref: string; q: string; page: string }[];
  userText: string;
}
```
意图：`openBook`、`openSection`、`openExport`、`setFormat`、`setStrip`、`exportNow`、`openSource`、`openHighlight(ref)`、`setUserText`（防抖 800ms 保存）。

## 11. 我的（Tab 4）及子页

paper 参考：`ui-me.js`。

| 页面 | 内容 | 备注 |
| --- | --- | --- |
| `Me` | 分组 1：解析服务、AI 服务、讲解偏好；分组 2：**外观（新增）**、存储与备份、关于 Pagewise | 每行副标题由 VM 生成（如「MinerU 官方 API · 今日 412/1000 页 · Token 5 天后过期」，≤ 7 天变卡点色） |
| `MeMineru` | Token（只显示末 4 位 + 更新）、有效期、今日额度条、默认解析模型、上传前确认、测试连接；「自建 MinerU 服务」分组置灰（M5） | Token 有效期：API 不返回时由用户填写，见 06 §2.1 |
| `MeAI` | 服务列表、＋ 添加服务、模型分配（讲解模型 / 整理模型）、用量（每本书 token 与缓存命中率、本月合计） | |
| `MeAIEdit` | 名称、协议（Anthropic Messages / OpenAI Responses / OpenAI Chat Completions）、Base URL、API Key、模型（可「读取模型列表」）、测试连接、保存、删除 | 表单解析复用 AShareSim `parseServiceForm` |
| `MePrefs` | 先讲直觉再讲公式、每段讲解长度（短/中/长）、每段结尾提一个问题、一节讲完做小测、术语中英对照、续学回顾、补充要求（多行） | 字段见 04 `setting` |
| `MeAppearance` | 皮肤（纸感 / 苹果风，带小预览）、深浅色（跟随系统 / 浅色 / 深色）、读书正文字号（小 / 中 / 大，只影响重排和讲解正文） | 切换即时生效，不重启 |
| `MeStorage` | 每本书：原文件大小、解析结果大小、清理解析缓存（保留学习记录）；导出备份（不含 Key/Token）；从备份恢复 | 备份格式见 04 §5 |
| `About` | 名称、版本、说明（原型文案）、开源协议；开发版：导出日志、长按版本号进 SkinGallery | |

## 12. 空、加载、错误状态（所有页面）

| 情况 | 表现 |
| --- | --- |
| 列表为空 | `Empty`：一句说明 + 主要操作（如书架「导入第一本书」） |
| 首次加载 > 300ms | 骨架（皮肤实现）；< 300ms 不显示 |
| 没配 AI 服务就进听讲 | thread 里一条说明卡：「还没有配置 AI 服务」+ 按钮「去配置」；读书模式照常可用 |
| 没配 MinerU Token 就导入 PDF | 解析设置页底部按钮变「先配置 MinerU Token」→ `MeMineru` |
| 断网 | 听讲：发送时 toast「网络不可用」，消息保留在输入框；解析：暂停轮询，恢复后继续 |
| AI 出错 | thread 里 `error` 项（文案来自 `toAppError`）+ 重试；已收到的部分保留 |
