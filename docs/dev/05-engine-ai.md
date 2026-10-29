# 05 · 伴读引擎与 AI

规则来源是 [STUDY_ENGINE.md](../STUDY_ENGINE.md)。本文规定落地方式：哪些在 `core`（纯函数，可测），哪些在 `app/study`（编排、IO），以及和模型的约定（标记、工具、提示词）。

## 1. 分工

| 模块 | 位置 | 职责 |
| --- | --- | --- |
| 标记解析 | `core/markup` | 模型输出文本 → `RichDoc` AST；容忍流式半截文本 |
| 引用校验 | `core/citations` | 给 AST 里的引用打上 verified / unverified |
| 上下文组装 | `core/context` | 按 6 层拼请求内容、估 token、按预算压缩 |
| 路线图 | `core/lesson` | 校验模型给的路线图、兜底切分 |
| 岔路 | `core/detour` | 主线 / 岔路栈的状态机（纯 reducer） |
| 复习 | `core/review` | Leitner 调度 |
| 会话编排 | `app/study/StudySession.ts` | 一本书的听讲 / 读书会话：读写库、调 AI、工具循环、把结果写进 `study` 店铺 |
| AI 网关 | `services/ai` | 协议适配、流式、错误、用量（从 AShareSim 复制） |
| 公式渲染 | `services/math` | TeX → SVG |

## 2. AI 输出标记与 RichDoc

### 2.1 标记语法（写进系统提示）

| 标记 | 含义 | 渲染 |
| --- | --- | --- |
| `**粗体**` | 强调 | 粗体 |
| `$…$` / `$$…$$` | 行内 / 独立公式（LaTeX） | `MathView` |
| `- ` / `1. ` 行首 | 列表 | 列表 |
| `[[b:103005]]` | 引用内容块 seq=103005 | 引用胶囊「p.103」（EPUB 显示位置标签） |
| `[[q:103005]]`（独占一行） | 整段引用原文 | 原文卡「原文 · p.103」+ 原书衬线体文字 |
| `[[fig:104002]]`（独占一行） | 显示原书的图 | 图 + 说明，点开看大图 |
| `[[derive]]…[[/derive]]` | AI 补充的推导 | 补充推导块（derive 色 + 标签「补充推导」） |
| `[[example]]…[[/example]]` | AI 自己举的例子 | AI 举例块（example 色 + 标签「AI 举例」） |
| `[[check]]…[[/check]]` | 每步结尾的检查问题 | 检查卡「检查一下」 |

其他 Markdown（标题、表格、代码块）：代码块按等宽显示；`#` 标题降级为粗体段落；表格按纯文本显示。

### 2.2 AST（`core/markup/types.ts`）

```ts
type RichDoc = Block[];
type Block =
  | { t: 'p'; c: Inline[] }
  | { t: 'list'; ordered: boolean; items: Inline[][] }
  | { t: 'math'; tex: string }
  | { t: 'quote'; ref: number; verified: boolean }       // [[q:]]
  | { t: 'figure'; ref: number; verified: boolean }      // [[fig:]]
  | { t: 'aux'; kind: 'derive' | 'example'; body: Block[]; open: boolean }   // open=流式中还没收到结束标记
  | { t: 'check'; c: Inline[] }
  | { t: 'code'; text: string };
type Inline =
  | { t: 'text'; v: string } | { t: 'b'; c: Inline[] } | { t: 'math'; tex: string }
  | { t: 'cite'; ref: number; verified: boolean; detour: boolean }
  | { t: 'unverified' };                                  // 「未核实」小标记，挂在句末
```

### 2.3 解析要求

- `parse(text, { streaming })`：`streaming=true` 时，结尾没闭合的 `**`、`$`、`[[derive]]`、`[[b:12` 不报错：未闭合的公式先按文本显示，未闭合的 `[[derive]]` 生成 `open: true` 的块，半截的 `[[…` 隐藏。
- 每次流式刷新都对全文重新解析（不做增量），保证最终结果和非流式一致。性能要求：10k 字 < 8ms（Hermes 中端机），写基准测试。
- 引用 → 页码标签由 VM 层用 `pageLabel(book, block.page)`（06 §5.4，印刷页码）得到；AST 只存 seq。第 3、5 层 `<block page="…">` 里写的也是印刷页码。
- 测试：每种标记的正常 / 嵌套（aux 里有引用和公式）/ 截断 / 非法（`[[b:abc]]` 当文本）/ 中英文混排；用 explore `data.js` 的 LESSON 文本做回归。

### 2.4 公式渲染（`services/math`）

```ts
interface MathRenderer { render(tex: string, display: boolean): Promise<{ svg: string; width: number; height: number; baseline: number }> }
```

- 实现：一个**常驻隐藏 WebView**（App 根部挂载，0×0），加载离线打包的 `android/app/src/main/assets/math/index.html` + MathJax 3 `tex-svg` 组件（构建时从 npm `mathjax@3` 复制，脚本 `scripts/copy-mathjax.js`）。RN 通过 `postMessage({id, tex, display})` 请求，WebView 回 `{id, svg, w, h, baseline}`（单位 ex，RN 侧按字号换算成 dp）。
- SVG 用 `currentColor`，`MathView` 渲染时传皮肤的文字颜色。
- 缓存：内存 LRU 500 → `math_cache` 表 → WebView。同一 tex 并发请求合并。
- 失败（超时 3s / MathJax 报错）：显示 TeX 原文（等宽、ink2 色），不阻塞消息。
- 可选的后续优化（不在 V1 范围）：在 Hermes 里直接跑 `mathjax-full` 去掉 WebView；接口不变即可替换。

## 3. AI 网关（从 AShareSim 复制）

复制 `AShareSim/src/ai/` 的这些文件到 `src/services/ai/`，连同对应测试和 fixtures：`types.ts`、`http.ts`、`protocol.ts`、`stream.ts`、`messageText.ts`、`evidence.ts`、`models.ts`、`catalog.ts`，`services.ts` 里的 `KeyStore`/`keychainStore`、表单解析（`parseServiceForm` 等）。**不复制** `chat.ts`、`mcp.ts`、`flows.ts`、`tools/`、`context.ts`、`prompt.ts`、`provenance.ts`、`search.ts`、`quick.ts`（股票业务）。

需要改的地方：

1. **多个缓存断点**。AShareSim 的 `RequestInput` 只有 `system` + `context` 两个断点。改成：

```ts
interface RequestInput {
  service; tools: ToolDef[]; effort; cacheKey; cache: boolean; stream?: boolean;
  system: string;                                  // 第 1 层（断点 1）
  contextBlocks: { text: string; cache: boolean }[];  // 第 2、3 层各一块，cache=true 的块后面打断点（最多 3 个，加 system 共 4 个，Anthropic 上限）
  history: StoredMessage[];                        // 第 4–6 层 + 本轮
}
```
   Anthropic：`system` 用块数组，`contextBlocks` 放在第一条 user 消息的前面几个 content 块，带 `cache_control: {type:'ephemeral'}`。OpenAI Responses：拼成 `instructions` + 开头的 `input` 项，用 `prompt_cache_key`（前缀稳定即可命中）。Chat Completions：拼成 system + 第一条 user。
2. **工具 schema** 换成本文 §6.4 的工具。
3. `AiGateway` 门面（`services/ai/gateway.ts`）：

```ts
interface AiGateway {
  stream(purpose: 'teach' | 'tidy', req: Omit<RequestInput, 'service' | 'cacheKey' | 'cache' | 'effort'>,
         h: { signal: AbortSignal; onText(full: string): void; onProgress?(p: ModelProgress): void }): Promise<ParsedResponse & { usage: Usage }>;
  complete(purpose, req): Promise<ParsedResponse & { usage: Usage }>;     // 非流式（整理任务）
  test(providerId: string, model: string): Promise<ConnectionResult>;
}
```
   `purpose` 决定用讲解模型还是整理模型（`setting ai.assign`）。每次调用写 `ai_usage`。服务不认缓存参数时自动降级（AShareSim 已有 `compatOf` 逻辑）。

## 4. 上下文组装（`core/context`）

输入：书的地图、当前段内容块、学习记录、按需加载的内容、对话、偏好、当前步。输出：`{ system, contextBlocks, history, estimate: LayerEstimate[] }`。

| 层 | 放哪里 | 内容 | 缓存 |
| --- | --- | --- | --- |
| 1 讲解规则 | `system` | §12.1 系统提示 + 讲解偏好 + 用户补充要求 | ✓ |
| 2 书的地图 | `contextBlocks[0]` | 全书目录（每行 `id 标题 p.x–y [状态]`，章节太多时只列到二级、当前章列到三级）+ 已学小节摘要 | ✓ |
| 3 当前原文 | `contextBlocks[1]` | 主线当前段全部块，格式见下 | ✓（同一段内不变） |
| 4 学习记录 | `history` 第一条 user 消息里的 `<study_record>` | 进度、本节和相关节的卡点、最近 10 个问题 | |
| 5 按需加载 | 工具结果（history 里的 tool 消息） | `load_section` / `search_book` 等返回 | |
| 6 最近对话 | `history` | 当前段的对话；更早的段只保留段摘要；已折叠的岔路只保留一行摘要 | |

块的格式（第 3、5 层一样）：

```
<block id="b10400205" page="103" type="text">原文……</block>
<block id="b10400206" page="103" type="equation">f(n) = g(n) + h(n)</block>
<block id="b104002" page="104" type="image">图 3.18 …（说明文字）</block>
```

- 第 4 层放在 history 开头而不是 system，是为了不破坏前 3 层的缓存前缀。
- 本轮「操作」放在最后一条 user 消息末尾的 `<turn>` 里（见 §6.3），不进 system。
- 预算：估算输入 > 24k tokens 时，先把第 6 层更早的轮次换成摘要（`in_context=0`，摘要由整理模型生成并缓存），再把第 5 层最早的岔路原文换成该节摘要。估算：CJK 字符 × 1.0 + 其他字符 ÷ 3.5（只用于预算和面板显示，面板同时显示上一轮服务返回的真实用量）。
- 图片默认只给说明文字；用户问到图本身、且讲解模型支持视觉（AShareSim `models.ts` 的能力表）时，把图片作为 image 块附在本轮。

## 5. 路线图（LessonPlan）

### 5.1 生成

进入一段时（或段的路线图不存在时），`phase='planning'`，用**整理模型**、非流式、要求只输出 JSON：

```json
{ "steps": [ { "title": "f(n) = g(n) + h(n) 的含义", "kind": "intuition|definition|derivation|example|check", "from": 103005, "to": 103011 } ] }
```

提示词见 §12.2。thread 里先显示 `tools` 项「整理本节路线图」。

### 5.2 校验（`core/lesson/validate.ts`）

1. 2–5 步；`from`/`to` 都在本段范围内。只有一个块或不可拆的公式组时保留一步；空正文不生成路线图。
2. 按顺序首尾相接：第一步 `from` = 段首，最后一步 `to` = 段尾，前一步末块与下一步首块在实际正文块列表中相邻。稳定块号跨页存在空洞，不能用 `seq + 1` 判断邻接。
3. 不能把「公式 / 图 / 表 / 算法框图（code）」和它紧挨着的说明（caption、前一段引导句）拆到两步：如果切点落在 `equation|image|table|code` 前后一块之内，把切点挪到这一组之后。
4. 标题非空、≤ 24 字。

可以修好的（第 3 条）自动修；修不好就**兜底切分**：按段内的标题块切；没有标题就按字数平均切成 `clamp(round(chars/800), 2, 5)` 步，切点对齐段落边界并满足第 3 条；标题用该步第一块文本的前 16 字。`source='fallback'`。

### 5.3 段的切分

在建地图时完成（06 §5.3），这里只消费 `section_part`。

## 6. StudySession（`app/study/StudySession.ts`）

一本书一个实例（`StudySessionRegistry` 按 bookId 缓存），负责把用户意图变成：写库 → 调 AI → 更新 `study` 店铺。所有 AI 调用都可以 `stop()`（AbortController）。

### 6.1 会话状态（店铺里的形状，VM 由此派生）

```ts
interface SessionState {
  bookId: string; main: { sectionId: string; part: number; step: number };
  plan: LessonPlan | null; phase: 'idle' | 'planning' | 'teaching' | 'quiz' | 'ready';
  detours: DetourFrame[];                      // core/detour
  mode: 'listen' | 'read'; readerView: 'orig' | 'flow'; readAnchor: number | null;
  thread: ThreadEntry[];                       // 已持久化的消息 + 卡片（含 detour_id、step_no）
  streaming: null | { entryId: string; text: string };
  busy: boolean; pendingQuote: number | null;
  unverifiedStreak: number;                    // 连续出现未核实引用的轮数
  lastUsage?: Usage; contextEstimate?: LayerEstimate[];
}
```

### 6.2 打开一本书 `open(bookId, opts)`

1. 读 `study_state`；没有则初始化：主线 = 第一个 `status!='done'` 的叶子小节（就绪范围内）。
2. 读主线小节的段、路线图、当前段的 thread（最近 200 条）。
3. 距 `last_active_at` ≥ 1 天且偏好开了「续学回顾」且本次没生成过 → 生成续学卡（§10.1）。
4. 没有路线图 → 生成（§5.1）→ 从第 1 步开始讲。
5. 有 `opts.blockRef` → 按 §9 切到对应位置。

### 6.3 意图 → 动作

每次发给模型的 user 消息 = 可见文本 + 结尾的 `<turn>`（JSON，模型可见、界面不显示）：

```
懂了，继续
<turn>{"intent":"next","section":"3.5.2","part":1,"parts":2,"step":2,"steps":4,"step_blocks":[103005,103011],"step_title":"f(n) = g(n) + h(n) 的含义","skipped":[],"reminder":null}</turn>
```

| 意图（QuickKey / 操作） | 可见文本 | 引擎动作 |
| --- | --- | --- |
| `next` | 懂了，下一步 | 当前步 `done`，`step+1` 写库；thread 加 `stepHeader`；请求讲新的一步 |
| `skip` | 这步熟，跳过 | 当前步 `skipped`；thread 加 divider「跳过了第 k 步」；`step+1`；`<turn>` 的 `skipped` 带上被跳过的步，模型按规则用一句话交代 |
| `alt` / `example` / `derive` | 换个说法 / 举个例子 / 展开推导 | 不动指针；请求；`alt` 时把当前步标题加入卡点候选 |
| `quiz` | 考考我 | 请求模型调用 `show_quiz`（`<turn>` 里写 `"want_tool":"show_quiz"`） |
| 答测验 | 我选 B：… | 本地判对错；卡片锁定；对 → 模型给反馈；错 → 模型换角度重讲 + 引擎追加 `proposal`「AI 建议 · 记为卡点」；是本节小测则 → `ready` |
| `nextPart` | 懂了，下一段 | 当前段最后一步 `done`；`part+1`、`step=0`；本段对话生成段摘要（整理模型，后台）；生成下一段路线图 |
| 本节最后一步「懂了」 | 懂了 | 开了小测 → 请求 `show_quiz`（`final:true`），`phase='quiz'`；否则 `ready` + `done` 卡 |
| `nextSection` / 结束本节 / 读完这一节 | — | 生成小结草稿（§10.2）→ `SectionDone` |
| `reteachSection` | 再讲一遍这一节 | 所有步重置 `todo`，`step=0`，旧对话 `in_context=0`，从第 1 步讲 |
| `ask`（自由提问） | 用户原文（带引用条时 `quote_seq`） | 请求；模型可能调工具（岔路由工具触发，§7） |
| `backMain` | 回到主线 | §7.2 |
| `source` | — | 不发请求，切读书模式（§9） |
| `jumpStep(i)` | 从第 i 步开始讲 | 当前步若是 `current` 改回 `todo`；`step=i`；请求讲第 i 步 |
| `resume go` / `review` | 直接继续 / 先复习卡点 | §10.1 |

### 6.4 工具

只读工具（模型直接调用；每轮最多 4 次，超过后返回错误结果「本轮工具调用次数已用完，请直接回答」；工具轮次上限沿用 AShareSim `MAX_TOOL_ROUNDS=6`）：

| 工具 | 参数 | 返回 | 界面 tools 行 |
| --- | --- | --- | --- |
| `load_section` | `{ id: string, part?: number }` | 该节（段）的全部块，§4 格式；不存在 → 错误 + 最接近的 3 个小节 | 读取 3.4.2 Dijkstra算法或一致代价搜索（p.90–93） |
| `search_book` | `{ query: string, chapter?: string }` | 前 8 个命中：块 id、页码、小节、片段 | 在全书搜索「一致代价」· 找到 5 处 |
| `get_figure` | `{ id: string }` | 图片（模型支持视觉时为 image 块）+ 说明 | 查看图 3.18（p.104） |
| `get_notes` | `{ section_id: string }` | 摘要、问答、卡点 | 读取 3.4.2 的学习记录 |

界面工具（模型调用，引擎渲染成卡片，结果在用户操作后作为工具结果回传）：

| 工具 | 参数 | 卡片 |
| --- | --- | --- |
| `show_quiz` | `{ question, options: string[3..4], answer: number, explain: string, final?: boolean }` | `quiz` 卡。工具结果：`{"picked":1,"correct":false}` |

写操作提议（模型只能提议，卡片确认后才写库）：

| 工具 | 参数 | 卡片 / 确认后 |
| --- | --- | --- |
| `mark_stuck` | `{ text: string }` | 「AI 建议 · 记为卡点」记下 / 不用 → 写 `stuck(source='ai')` |
| `advance_progress` | `{ to: 'next_step' \| 'next_part' \| 'section_done', reason }` | 「AI 建议 · 进入下一步」好 / 继续这一步 → 等同对应意图 |
| `propose_summary`、`propose_cards` | — | V1 只在小结流程里由整理模型以 JSON 输出（§10.2），讲解模型不开放这两个工具 |

工具定义写在 `services/ai/tools.ts`（JSON Schema），执行器写在 `app/study/toolExec.ts`；只读工具执行时把返回的块 seq 加入本轮「允许引用」集合。

### 6.5 流式与落库

- 请求开始：thread 加 `typing`（`busy=true`）；收到第一个字后换成 `ai` 项（`streaming:true`）。
- 每次 `onText(full)`：更新店铺 `streaming.text`（节流 50ms）；VM 解析成 RichDoc 并做引用校验（允许集合已知）。
- 收到工具调用：thread 加 `tools` 行（`running:true`），执行完改 `false`，继续下一轮。
- 结束：写 `message`（assistant，`content`=原文、`raw_json`、`allowed_refs_json`、`unverified` 数、`usage_json`）；`busy=false`。
- 停止：保留已收到的文本，末尾加「（已停止）」，照常落库。
- 出错：thread 加 `error` 项，可重试（重试 = 用同样的历史再发一次，不重复写 user 消息）。

## 7. 主线与岔路（`core/detour`）

### 7.1 状态机

```ts
type DetourFrame = { sectionId: string; detourId: number; reviewStuckId?: number };
type DetourEvent =
  | { t: 'load'; sectionId: string }      // 模型调用 load_section，或用户带着其他小节的块提问
  | { t: 'review'; sectionId: string; stuckId: number }
  | { t: 'back' } | { t: 'rebase' };       // 从岔路改主线
function reduce(s: { main: string; stack: DetourFrame[] }, e: DetourEvent):
  { next; effects: ('startDetour' | 'endDetour' | 'askReturnFirst' | 'changeMain' | 'none')[] }
```

规则（全部有单测）：
- `load` 的 `sectionId` 是主线小节或当前岔路小节 → 不变（`none`）。
- 否则深度 < 2 → 入栈（`startDetour`）；深度 = 2 → 不入栈，`askReturnFirst`：工具返回「已在第 2 层岔路，先请用户决定是否回主线」，界面弹 `switchMain` 对话框「要不要先回主线？」。
- `back` → 出栈到底（直接回主线，不是回上一层；需求「回到主线」），`endDetour` 对每一层。
- `rebase`（用户在岔路说「从这里开始学」，或点岔路条菜单）→ 主线改为栈顶小节，栈清空，原主线保持 `learning`。

### 7.2 进出岔路的副作用（StudySession）

- 进入：写 `detour` 行；thread 加 divider「岔路 · 3.4.2 …」（detour 色）；之后的消息带 `detour_id`，渲染在 `detourRun` 里；进度区下方出现岔路条；主线指针不动。
- 回答结束：把这轮问答写进**被问小节**的 `qa`（`from_section` = 主线）：`q` = 用户问题原文（截断 60 字），`a` = 整理模型压缩的 ≤ 80 字结论（后台生成，生成前先存回答前 80 字）；toast「这段问答已记入 3.4.2 的学习记录」。
- 回到主线：
  1. 整理模型给这次岔路起标题（≤ 16 字）。
  2. thread 里把这次岔路的项折叠成 `fold`「已解决：<标题>」「n 条」；divider「回到主线 · 3.5.2 A*搜索」。
  3. 这次岔路的消息 `in_context=0`，第 6 层改放一行 `<detour_summary section="3.4.2">标题：结论</detour_summary>`。
  4. 发一轮 `intent:"backMain"`，模型按规则一句话接上（「回到 A\*：刚才讲到……」）。
  5. toast「岔路已折叠，问答记进了 3.4.2 的笔记」。

### 7.3 复习卡点（特殊岔路）

从续学卡「先复习卡点」或复习页「让 AI 重讲」进入：`review` 事件，岔路帧带 `reviewStuckId`；chips 变成「清楚了，继续 3.5.2」「还是不太懂」。「清楚了」→ 卡点 `resolved_at` = now，toast「卡点「…」已标为掌握」，回主线。

## 8. 引用校验（`core/citations`）

- 允许集合 = 本轮第 3 层的块 + 本轮所有工具结果里出现的块（`allowed_refs_json` 持久化，历史消息重绘时用当时的集合）。
- `cite`/`quote`/`figure` 的 ref 在集合里 → `verified=true`；岔路小节的块 `detour=true`（胶囊用岔路色）。
- 不在集合里 → 去掉胶囊，在所在句子末尾插 `unverified`（灰色「未核实」）；`quote`/`figure` 不在集合 → 整块替换为一行「（引用的原文未核实）」。
- 标记外、没有任何引用、长度 > 40 字的段落，计入 `unverified` 统计（不显示标记，只计数）。
- 一轮回答有任何未核实引用 → `unverifiedStreak+1`，否则清零；到 3 时下一轮 `<turn>` 带 `"reminder":"只能引用本轮上下文里出现过的块，引用格式 [[b:<id>]]"`，然后清零。
- 测试：越界 id、不存在的 id、重复引用、aux 内的引用、流式半截引用。

## 9. 读书 ⇄ 听讲（位置不丢）

| 方向 | 规则 |
| --- | --- |
| 读书 → 听讲（切换开关） | 取 `read_anchor`；找到包含它的步 k（不在当前段 → 在主线小节内则切段，不在主线小节 → 只切模式，不改位置）。k 已讲过（done/skipped/current）→ 滚到第 k 步的 `stepHeader`，toast「听讲 · 第 k 步」；k 没讲过 → 等同 `jumpStep(k)`（之前没讲的步保持 `todo`） |
| 「从这里开始讲」 | 同上，但锚点 = 被点的块 |
| 「问 AI」 | 切听讲，不改步骤，composer 引用条 = 这块 |
| 听讲 → 读书（切换开关 / 看原文） | 定位到当前步 `block_from`，该步块范围 `flash` 2 秒 |
| 点引用 → 「在读书模式打开」 | 定位到被引用的块并 `flash` |
| 读书滚动 | 停止 500ms 后上报屏幕中线处的块为 `read_anchor`（写库节流） |
| 读书模式标记 | `heard` = 已 done 的步的块（和已学小节的全部块）；`now` = 当前步的块；`highlight` = 高亮表 |
| 问答便签 | 一次问答结束后：问题是从某块发起的（引用条）→ 贴那块；否则贴答案里第一个属于主线小节的已核实引用块；都没有不贴。便签文字「已解决：<问题标题>」，问题标题由整理模型压缩（≤ 18 字），先用问题原文截断 |
| 每本书记住模式 | `study_state.mode`，下次打开同一本书用上次的模式 |

## 10. 整理类任务（整理模型）

全部非流式、JSON 输出、失败可重试；提示词见 §12。

### 10.1 续学回顾

输入：主线小节已讲步骤的标题、上一段摘要、未解决卡点（本节 + 被引用过的小节）、最后 3 个问题、离开天数。输出 `{ "lines": ["…", "…", "…"] }`（≤ 3 句：讲到哪 / 卡点 / 问要不要先复习）。显示为 `resume` 卡（标题「续学 · 距上次 3 天」），按钮「直接继续第 k 步」+（有卡点时）「先复习卡点」。不计入第 6 层。

### 10.2 本节小结草稿

输入：本节原文块（全文，或各段摘要 + 卡点相关块）、本节全部问答、岔路记录、答错的测验、卡点候选（换个说法 / 答错 / AI 建议过但没记的）。输出：

```json
{ "summary": "≈100 字", "stuck": ["…"], "cards": [ { "front": "…", "back": "…", "from_detour": false } ] }
```

3–5 张卡；卡片默认全勾；来自岔路的卡带标签。保存规则见 03 §7。

### 10.3 解释 / 翻译 / 本节导读

| 任务 | 模型 | 输出 |
| --- | --- | --- |
| 解释这段 | 讲解模型（流式） | ≤ 200 字，必须引用该块；在 `explain` 浮层里显示 |
| 翻译 | 整理模型 | 中 ⇄ 英，术语用书的地图里的译名 |
| 本节导读 | 整理模型 | `{ "one_line": "≤ 30 字", "full": "3–4 句", "prereq": ["3.4.2"] }`，存 `section.guide` |

## 11. 复习调度（`core/review`）

- 盒子间隔 `[1, 3, 7, 15, 30]` 天。新卡盒 1，`due_on = today + 1`。
- 评分：记得 → `box = min(5, box+1)`；模糊 → 不变；忘了 → `box = 1`，并且如果没有同文字的未解决卡点，加一条 `stuck(source='card')`。`due_on = today + 间隔[box]`。
- 今天到期 = `due_on <= today`，按 `due_on`、`id` 排序，取前 `review.dailyLimit`（默认 30）张，其余顺延。
- `today` 用设备本地时区（`Clock.today()`）；测试覆盖：跨午夜、时区变化（东八区 → UTC）、夏令时日。

## 12. 提示词

放在 `src/app/study/prompts/*.ts`，导出模板函数；改提示词必须同步更新 `__tests__/prompts` 的快照。下面是 V1 初稿。

### 12.1 讲解系统提示（第 1 层）

```
你是 Pagewise 的伴读老师，带用户一节一节读懂一本技术书。用户是{偏好.背景，默认"后端工程师"}，在手机上用碎片时间学习。

## 讲解规则
1. 每一步按这个顺序讲：{先讲直觉 → 再讲定义、公式和算法 → 举书里的例子 | 先讲定义和公式 → 再讲直觉 → 举书里的例子}{→ 最后用 [[check]]…[[/check]] 提一个检查问题（偏好关闭时省略）}。
2. 只讲 <turn> 里指定的这一步（step_blocks 范围内的原文）。这一步讲完前不要讲后面的步。
3. 篇幅：{短：半屏以内 | 中：一屏半以内 | 长：完整展开}。中文为主{，术语第一次出现时中英对照，例如"可容许的（admissible）"}。
4. 引用：每个依赖书中内容的说法，后面写 [[b:<块 id 的数字>]]，例如 [[b:103005]]。只能引用本轮上下文里 <block> 出现过的块。需要整段展示原文时单独一行写 [[q:<id>]]，展示书里的图单独一行写 [[fig:<id>]]。
5. 书里没有、你自己补充的推导写在 [[derive]]…[[/derive]] 里，自己举的例子写在 [[example]]…[[/example]] 里。
6. 用户答错检查题时，换一个角度重讲，不要重复原话。
7. 用户问到其他小节的内容时，先调用 load_section 读那一节原文，不要凭记忆回答。不知道在哪一节时先调用 search_book。
8. <turn> 的 intent 含义：next 讲下一步；skip 用户跳过了 skipped 里的步，用一句话交代跳过的内容后讲当前步；alt 换个角度重讲当前步；example 举一个书里的例子（书里没有时用 [[example]] 自己举）；derive 展开当前步的推导；quiz 调用 show_quiz 出一道选择题；backMain 用一句话接回主线（"回到 A*：刚才讲到……"）；ask 回答用户的问题。
9. 发现用户明显没懂某个点时，可以调用 mark_stuck 提议记为卡点；认为这一步已经讲透时可以调用 advance_progress 提议往下走。这些只是提议，由用户确认。
10. 公式用 $…$ 和 $$…$$。不要用 Markdown 标题。

{用户的补充要求}
```

### 12.2 路线图（整理模型）

```
把下面这段教材原文切成 2–5 个讲解步骤。要求：
- 各步按顺序首尾相接，覆盖全部块：第一步 from={段首}，最后一步 to={段尾}。
- 公式、图、表、算法框图和紧挨着它们的说明不能拆到两步。
- 每步一句话标题（≤ 24 字，说清这一步讲什么），kind 取 intuition|definition|derivation|example|check。
只输出 JSON：{"steps":[{"title":"…","kind":"…","from":数字,"to":数字}]}
<book_map>{第 2 层的二级目录}</book_map>
{本段全部 <block>}
```

### 12.3 其他

`recap`（§10.1）、`sectionDraft`（§10.2）、`detourTitle`（≤ 16 字标题 + ≤ 80 字结论）、`pinTitle`、`explain`、`translate`、`guide`、`partSummary`、`compact`（第 6 层压缩，沿用 AShareSim `COMPACT_PROMPT` 的思路）：每个都写成「任务说明 + 输入 + 只输出 JSON 及其 schema」，T7 实现时补全，并为每个写一个用假模型跑的解析测试和一个可选的真模型 eval（`npm run eval:live`，需要环境变量里的 Key，CI 不跑）。

## 13. 假 AI（Demo 与测试）

`services/ai/fake.ts` 实现 `AiGateway`：
- **脚本模式**（Demo）：按 `intent` + 小节 + 步骤取 explore `data.js` 的 LESSON / ALT 文本和原型 `data.js` 的 SCRIPT / DETOURS（转成本文的标记语法），逐字流式吐出（18ms/4 字，和原型一样）；「这跟前面的一致代价搜索有什么关系」这类问题返回一个 `load_section("3.4.2")` 工具调用，走真实的岔路流程。
- **录制模式**（测试）：按请求哈希回放 fixtures（AShareSim 的 SSE fixture 格式）。
- 这样 T5 的所有页面和交互可以在没有 Key、没有真书的情况下完整走通。
