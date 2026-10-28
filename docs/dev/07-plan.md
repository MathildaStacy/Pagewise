# 07 · 实施计划与验收

按顺序做。每个任务开始前读「依据」里列的章节；结束时满足「验收」全部条目，`npm run check` 全绿，提交。任务内可以再拆小提交。

顺序的考虑：**先把皮肤和页面用演示数据做出来**（T2–T6），负责人能尽早在手机上看 UI、比较两套皮肤；再接真 AI（T7）和真书（T8–T10）。

## 任务总览

| 任务 | 内容 | 对应里程碑 |
| --- | --- | --- |
| T0 | 工程脚手架、lint 边界、CI | — |
| T1 | 移植 AShareSim 基础件（数据库、AI 网关、密钥、日志） | — |
| T2 | 设计系统 kit + paper / glass 两套皮肤 + SkinGallery + 外观设置 | — |
| T3 | 数据层：迁移 0001、仓库、Demo 种子数据 | — |
| T4 | 导航 + 书架、地图、复习、笔记、我的（Demo 数据） | — |
| T5 | 引擎纯函数：标记解析、引用校验、岔路、路线图校验、上下文组装、复习调度 | — |
| T6 | 听讲 + 读书（重排）+ 小结，接假 AI 完整走通 | — |
| T7 | 接真 AI：服务设置、网关、提示词、工具循环、整理任务 | M3 |
| T8 | 导入、MinerU 解析队列、地图构建、书签核对、全文搜索 | M1 |
| T9 | 原版页阅读（PdfRenderer + 位置框）、高亮、笔记、便签 | M2 |
| T10 | EPUB 本地解析 | M1 |
| T11 | 复习闭环、续学、笔记导出、存储清理、备份 | M4 |
| T12 | 真书验收走查、性能、无障碍 | M1–M4 验收 |

---

### T0 工程脚手架

依据：01 §2–§4。

- `npx @react-native-community/cli init Pagewise --version 0.87.1`，包名 `com.pagewise`，放在仓库根（与 `docs/` 并列）。
- 照 AShareSim 配：`.nvmrc`、`tsconfig`（strict + 路径别名）、`babel module-resolver`、`jest.config.js`、`.eslintrc.js`（`@react-native` + `import/no-restricted-paths` zones + `react-native/no-color-literals` 只对 `src/ui/screens`）、`.prettierrc`、`package.json` scripts（`check` = lint + typecheck + test）。
- 建好 01 §4 的空目录，每个目录一个 `index.ts` 或 README 一句话说明。
- `__tests__/arch/boundaries.test.ts`（01 §3）。
- `.github/workflows/ci.yml` 照 AShareSim（quality + Android debug APK）。
- `.gitignore` 加 `fixtures/private/`。
- 新建 `docs/dev/QUESTIONS.md`（已有初始条目，见文末）。

验收：
- [ ] `npm run check` 通过；`npm run android` 能在模拟器上跑出空白 App。
- [ ] 故意在 `src/ui/screens` 写一个 `import '@data/db'` 和一个 `color: '#fff'`，lint 和边界测试都报错（验证后删掉）。
- [ ] CI 在 PR 上跑通，产出 debug APK。

### T1 移植基础件

依据：04 §1，05 §3，01 §5、§8、§9。

- 复制 `db.ts`、两个 driver、`migrations/index.ts`（迁移列表先空）。
- 复制 AI 文件（05 §3 列表）和测试，改名空间、删股票逻辑；实现「多缓存断点」改动和 `AiGateway`；`fake.ts` 先只做录制模式。
- `services/secrets.ts`（Keychain + 内存实现）、`app/log.ts`（含 `redact`）、`app/errors.ts`、`app/events.ts`、`app/clock.ts`、`app/container.ts`（device / test 两种）。

验收：
- [ ] 复制过来的 AI 协议、流式测试全部通过；新增测试：三种协议下 `contextBlocks` 的缓存断点位置正确（Anthropic 的 `cache_control` 出现在 system 和 cache=true 的块上，总数 ≤ 4）。
- [ ] `redact` 测试：Key、Token、Authorization 头、`sk-…`、`mnr_…` 都被抹掉。
- [ ] `createTestContainer()` 能在 jest 里建出内存库并迁移。

### T2 设计系统与两套皮肤

依据：02 全文；原型 `shell.html`；`explore/src/apple.html`。

- `ui/kit`：tokens 类型、`SkinProvider`、`useTokens`、`makeStyles`、组件代理、`Icon`、`ToastHost`；`ui/kit/base/` 实现 02 §5 的全部组件。
- `ui/skins/paper`（tokens light/dark、图标映射）、`ui/skins/glass`（tokens、图标、02 §3 列出的覆盖组件、`Glass` 材质含 blur 降级）。
- `MeAppearance` 页（先挂在一个临时入口）、设置持久化（T3 前先存内存）。
- `SkinGallery` 页（02 §9）。
- 对比度、Token 完整性、组件契约测试（02 §8）。

验收：
- [ ] SkinGallery 里每个组件在 2 皮肤 × 2 深浅色下都能显示，截图（`adb exec-out screencap`）放进 PR 描述：至少 Button、QuickActions、Composer、StepProgress、Sheet、SelectionMenu、Row 分组、TabBar、AppBar（root / push）。
- [ ] paper 浅色和原型 `shell.html` 对照：颜色值逐个一致（写一个测试把 shell.html 的 `:root` 变量和 paper light tokens 做对照）。
- [ ] 对比度测试全过（不过就调 paper 深色和补齐的 glass 值，并在 PR 里列出调整）。
- [ ] 在 SkinGallery 打开一个 Sheet，切换皮肤 / 深浅色，Sheet 不关闭、内容不丢、样式立即变。
- [ ] 系统字号 2.0 倍时按钮、行、chips 文字不被截断。

### T3 数据层与 Demo 种子

依据：04 全文；原型 `data.js`、explore `data.js`。

- 迁移 0001（04 §2 的 DDL 一字不差，有改动先记 QUESTIONS）、全部仓库、`setting` 读写。
- `app/demo/seed.ts`：把原型 `data.js` 的书（AIMA、统计学习方法、DDIA）、AIMA 第 1–3 章目录、示意内容块（转成 `seq = page*1000+i`）、闪卡、卡点、问答、高亮，以及 explore `data.js` 的 3.5.2 路线图写进库。块文本标注「示意内容」。
- `createDemoContainer()`。

验收：
- [ ] 每个仓库方法有测试（node:sqlite 内存库）；04 §6 的完整性规则各有测试。
- [ ] FTS：≥ 3 字走 FTS、≤ 2 字走 LIKE，两条路径都有测试（FTS 不可用时跳过并打印原因）。
- [ ] Demo 种子跑完后：AIMA 有地图（第 3 章 6 节 26 小节）、3.5.2 有 4 步路线图、闪卡和卡点数量与原型一致。

### T4 导航与外围页面

依据：01 §7；03 §1、§4、§8–§11；原型对应 `SCREENS.*`。

- RootStack + Tabs；容器 / VM / View 三件套：Shelf（含导入浮层的界面，选择文件先接假实现）、BookMap（含小节浮层、搜索浮层、flag 对话框）、Review、ReviewSession、Notes、NotesBook（导出浮层先只显示）、NoteDetail、Me 及全部子页（MeAI 表单接 T1 的解析和 Keychain；测试连接接 T7）。
- 每个 VM 的 `samples.ts`，并接进 SkinGallery 的「页面」列表。

验收：
- [ ] Demo 模式下，原型控制台里的这些场景都能在 App 里走通：书架 → 地图 → 小节浮层；复习闪卡（翻面、三种评分、做完页）；卡点「已掌握」；笔记按节 → 详情 → 写自己的笔记（重进还在）；我的各子页开关和分段能改并持久化。
- [ ] 两套皮肤下逐页截图对照原型（paper）/ 02 §7（glass），放 PR 描述。
- [ ] VM 测试：每个 VM 至少测 presenter 文案（如书架状态行的 4 种情况、我的页 Token 将过期变色）和一个意图（调用了正确的用例 / 导航）。

### T5 引擎纯函数

依据：05 §2、§4、§5.2、§7.1、§8、§11；STUDY_ENGINE §11。

- `core/markup`（含流式）、`core/citations`、`core/detour`、`core/lesson`（校验 + 兜底）、`core/context`（6 层、预算压缩、token 估算）、`core/review`。

验收：
- [ ] 覆盖率 ≥ 90%（行）。
- [ ] 标记解析：05 §2.3 列的所有情况；10k 字解析基准 < 8ms（Node 上 < 3ms 作为 CI 断言）。
- [ ] 岔路：进入 → 嵌套 → 超深度提示 → 回主线 → 从岔路改主线，指针和效果序列正确。
- [ ] 路线图：合法输入原样通过；切开公式组的会被修正；空 / 越界 / 重叠 / 不连续的退回兜底；兜底结果自身满足校验。
- [ ] 上下文：给定输入的输出快照稳定（同输入同字节，保证缓存）；超预算时按 05 §4 的顺序压缩。
- [ ] 复习：盒子升降、到期日、跨午夜、时区变化、每日上限顺延。

### T6 听讲、读书（重排）、小结——假 AI

依据：03 §5–§7；05 §6、§7.2、§9、§10、§13；explore `app.js`。

- `StudySession` 全部意图（05 §6.3 表格每一行）、假 AI 脚本模式。
- `StudyView`：两种模式、进度区、岔路条、thread 全部项、快捷动作规则（03 §5.3）、引用条、输入框（发送 / 停止）、全部浮层（03 §5.5）。
- `ReaderView`（重排模式）：块列表、讲过 / 当前标记、高亮、便签、导读、读完这一节、块菜单；`Reader` 单独页。
- `MathView` + 公式渲染 WebView 服务；`RichView`。
- `SectionDone` 页与保存事务。

验收（Demo 模式，两套皮肤都要过）：
- [ ] explore 页面侧栏「可以试试」的 5 条全部能做到：点 p.103 弹出原文预览 → 在读书模式打开并闪烁；「懂了，下一步」「这步熟，跳过」进度正确；问「这跟前面的 3.4.2 有什么关系」进入岔路 → 回到主线后折叠成「已解决：…（n 条）」并记进 3.4.2 笔记；读书模式点段落「从这里开始讲」跳到对应步；点便签打开问答。
- [ ] 原型控制台的场景：续学（隔 3 天回顾 + 先复习卡点）、小测（答错出「记为卡点」建议）、学完一节（摘要 / 卡点 / 闪卡勾选 → 保存 → 进度移到 3.5.3 并自动开始）。
- [ ] 读书 ⇄ 听讲来回切 10 次，位置都符合 05 §9；杀进程重开，模式和位置还在。
- [ ] 流式回答中切皮肤、切深浅色、切到读书再切回来：回答继续、不重复、不丢。
- [ ] 流式中点「停止」：保留已生成部分，末尾「（已停止）」。
- [ ] 公式：行内和独立公式都渲染成 SVG，颜色随皮肤和深浅色；断开 WebView（模拟失败）时显示 TeX 原文。

### T7 接真 AI

依据：05 §3、§4、§6、§10、§12；03 §11（MeAI）。

- `MeAI` / `MeAIEdit` 完整（读取模型列表、测试连接、模型分配）；用量统计。
- 提示词模板全部写完（05 §12.3 列的每一个）；工具定义与执行器；工具次数限制；路线图生成 + 校验 + 兜底；续学回顾、小结草稿、解释、翻译、导读、岔路标题、便签标题、段摘要、对话压缩。
- 「AI 看到的内容」面板接真实估算 + 上一轮真实用量。
- 没配服务时的引导（03 §12）。

验收：
- [ ] 录制模式测试覆盖：一次讲解、一次带 `load_section` 的岔路、一次 `show_quiz`、一次 `mark_stuck` 提议、一次超工具次数、一次 401、一次中途断流。
- [ ] `npm run eval:live`（本机、负责人的 Key）：用 Demo 的 3.5.2 原文跑「讲第 1 步 / 下一步 / 问岔路问题 / 出小测 / 生成小结」，检查：输出能被解析、引用全部通过校验、路线图通过校验、JSON 任务一次成功率 ≥ 95%（跑 20 次）。
- [ ] 同一段内连续 5 轮请求，Anthropic 服务报告的 `cache_read` 从第 2 轮起 > 0。
- [ ] 日志里搜不到 Key。

### T8 导入与 MinerU 解析（M1）

依据：06 §1–§3、§5；03 §1.1、§2、§3。

- 原生 `FileTools`、`Intake`、`PdfPages`（本任务先做 info / outline / pageLabels / textLayer / split）。
- 导入流程、解析设置页、解析队列、结果包适配器、地图构建、书签核对、页码偏移、全文搜索（地图页搜索 + `search_book` 工具）。
- 先做 06 §2.5 的「T8 第一件事」：抓真实样本。

验收：
- [ ] 合成夹具测试：适配器、地图构建、偏移、分片顺序、阶段推进（假 MinerU 客户端按脚本返回各种 state 和错误码）。
- [ ] 真机：导入《人工智能：现代方法》整本 PDF，分片、上传、解析、入库全部完成；中途关网 / 杀进程后能接着走，不重复上传已完成的片。
- [ ] 第 3 章地图 = 6 节 26 小节，页码与书签和纸书一致；地图页标黄的地方能确认 / 修正。
- [ ] 解析完成前，已就绪的章节能进入听讲。
- [ ] Token 过期（手动填一个错的）：进度页显示原因和「去更新 Token」，更新后从失败片继续。
- [ ] 全书搜索「一致代价」「A*」「启发」（两字）都有结果，点结果跳到正确位置。

### T9 原版页阅读（M2）

依据：06 §3；03 §5.4；05 §9。

- `PdfPages.render` + 位图缓存；`PageOrig` 组件：位图 + 位置框叠加层（讲过 / 当前 / 高亮 / 选中 / 闪烁 / 便签）；点框弹块菜单。
- 原版 ⇄ 重排切换保持位置；`read_anchor` 上报。

验收：
- [ ] 任意块从引用 / 搜索 / 笔记高亮跳过去，都落在正确的页、高亮框和原书段落重合（随机抽 30 个块人工核对，偏差 ≤ 一行高）。
- [ ] 连续翻 50 页不卡（中端机滚动 ≥ 55fps，无 OOM）；页缓存不超过上限。
- [ ] 高亮、笔记、便签在原版和重排两种模式下一致。

### T10 EPUB（M1）

依据：06 §4。

验收：
- [ ] 用一本公版 EPUB（如 Project Gutenberg 的书，作为可提交夹具）测试：目录树、块、图片、表格；导入后能听讲、读书（重排）、引用显示位置标签。
- [ ] DDIA 等商业 EPUB 本机手测（不提交）。

### T11 复习闭环与导出（M4）

依据：05 §10.1、§11；03 §8–§10；04 §5；PRODUCT_DESIGN §6.5–§6.6。

- 复习完整闭环（忘了 → 卡点；卡点「让 AI 重讲」→ 复习卡点岔路 → 清楚了 → 划掉）；闪卡「回到原文」「问 AI」。
- 笔记导出：Markdown（目录结构与 `aima4e-markdown/课程讲义/` 一致，去掉大段原文的选项）、Anki CSV；导出到「下载 / Pagewise导出」或分享。
- 存储页：每本书占用、清理解析缓存（04 §6 第 5 条）；备份导出 / 恢复。

验收：
- [ ] 导出的 Markdown 放进 `aima4e-markdown/课程讲义/` 结构正确（负责人确认一份样例）；Anki 能导入 CSV。
- [ ] 清理解析缓存后：学习记录、笔记、闪卡都在；重新解析后引用、高亮、便签迁移正确（06 §5.6）。
- [ ] 备份 → 卸载 → 重装 → 恢复：学习记录完整，Key 和 Token 需要重新填。

### T12 验收走查

- [ ] 用真书学完第 3 章的 3 个小节（两种模式都用），引用全部能跳对（PRODUCT_DESIGN G2）。
- [ ] 中断 3 天（拨系统时间）后打开，1 分钟内接上（G3）。
- [ ] 两套皮肤 × 浅深色，逐页截图给负责人确认。
- [ ] TalkBack 能走完「打开书 → 听讲一步 → 提问 → 回到主线」。
- [ ] 冷启动 < 1.5s（中端机，release 包）。

---

## 测试策略

| 层 | 工具 | 要求 |
| --- | --- | --- |
| core | jest | 覆盖率 ≥ 90%；纯函数，无 mock |
| data | jest + node:sqlite | 每个仓库方法；完整性规则 |
| services | jest + 假 fetch / 录制 fixture | 协议、错误码、重试、适配器 |
| app（用例、StudySession） | jest + `createTestContainer` + 假 AI | 05 §6.3 每个意图至少一个测试 |
| features（VM） | jest + react-test-renderer（`renderHook`） | presenter 文案 + 关键意图 |
| ui | jest + react-test-renderer | 组件契约、页面示例状态渲染、对比度 |
| 架构 | jest | 边界扫描 |
| 端到端 | 手测清单（每个任务的验收） | V1 不上自动化 E2E；M5 可加 Maestro |

夹具：
- `fixtures/mineru-synthetic/`：手写小结果包（可提交）。
- `fixtures/epub/`：公版 EPUB。
- `fixtures/ai/`：录制的 SSE（来自 AShareSim 格式，内容用 Demo 示意文本）。
- `fixtures/private/`：真书解析结果，**git 忽略**；依赖它的测试 `if (!exists) describe.skip`。

## 完成标准（每个任务）

1. 验收清单全部勾上，PR 描述里逐条写怎么验证的（含截图）。
2. `npm run check` 通过，CI 绿。
3. 没有新增 `// @ts-ignore`、`eslint-disable`（确实需要时写原因）。
4. 有新的待定问题就写进 `QUESTIONS.md`。
5. 文档和代码不一致的地方，改文档（同一个 PR）。

## 不在 V1 范围（M5）

语音提问与朗读（通勤模式）、自建 MinerU 服务、扫描版专项打磨、块内文字范围选择、后台解析（WorkManager）、更多皮肤、iOS。架构上已留好接口（皮肤、`MathRenderer`、`MineruClient` 可换实现），不要提前实现。
