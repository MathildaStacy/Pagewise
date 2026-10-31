# main 全面审查 · v0.0.11

审查日期：2026-10-31。最终基线：[b213f6d83063eca67584db0be8c2b7cee74ccc93](https://github.com/MathildaStacy/Pagewise/tree/b213f6d83063eca67584db0be8c2b7cee74ccc93)。已纳入「优化翻译展示和对话列表」和「修复 PDF 书籍封面展示」两次更新。以下源码行号对应这个基线。

## 结论

原生任务流成立：书架、设置、读书/听讲切换、底部面板和系统返回能正常配合，现有皮肤方向应保留。最先需要处理的是用户记录和状态的一致性。

本轮确认 **9 类逻辑问题、4 项 UI/阅读问题**：P0 0 项、P1 3 项、P2 10 项。其中浅色对比度包含现有原型配色留下的已知债务；并非全部由新更新引入。另列 2 项需测量实际书库耗时的性能优化机会，不计入缺陷数量。

建议修复顺序：**笔记内容保留 → 已学状态与笔记页恢复 → 阅读位置 → 搜索和引用 → 会话设置与历史 → 首屏显示、触控和主题可读性**。

本次提交仅包含审查报告、复现材料与截图证据，没有修改 main 的业务代码。检查、复现和 Android 安装都在独立审查工作区/应用包中完成。

**2026-11-01 视觉设计补充已完成：** 见 [五套皮肤的视觉设计审查](VISUAL_DESIGN.md)，包含五皮肤浅深色原生对照、补充大字号样本、五项设计优先级与具体量测。以上缺陷数量仍对应本报告的功能检查轮次，不把主观设计建议重复算作逻辑缺陷。补充走查另捕获一次 Debug 包的 Android 原生渐变绘制崩溃，日志和待确认的触发范围单列在视觉报告中。

## 验证范围与结果

| 检查 | 结果 |
| --- | --- |
| 最新 main 的 ESLint / TypeScript | 通过 |
| 最新 main 原有 Jest 套件 | 104 个通过，1 个跳过 |
| 最新 main 原有 Jest 用例 | 2,004 项通过，2 项跳过；15 个快照通过 |
| 独立最小复现 | 10 个预期行为断言失败，暴露下面 9 类逻辑问题；与原有通过的测试分开运行 |
| Android arm64 Debug | 构建、安装成功，审查包 `com.pagewise.audit` |
| 原生走查 | Pixel 10 Pro 模拟器，Android API 37，1280 × 2856，480 dpi；纸感浅色 1.0、纸感深色 1.3、苹果风深色 1.3 |
| 新 PDF 封面 | 已就绪旧书自动补出物理第一页；原文件缺失时保留占位；清除页面缓存后封面文件及显示保留 |
| 新翻译/对话面板 | 原文预览、译文、当前对话标记和新建入口可用；系统返回先关闭面板 |
| 大字号输入 | 苹果风深色 1.3 字号下，软键盘弹出后输入框与发送按钮仍可见 |

代码审查覆盖导入/解析/重新解析、书架与检索、学习会话、阅读器、笔记、复习和备份。新增功能的流式翻译、取消/截断不缓存、图片失败回退及五套皮肤深浅色组件用例均包含在上述测试中。

原生封面验证使用仓库自写的两页 PDF，向空的审查包数据库放入两本验收书，模拟「已有 ready 书籍升级后首次展示」。没有调用真实 MinerU 或远程 AI。阅读/翻译走查使用演示书库；演示译文本身不作为翻译质量证据。未测真机帧率、TalkBack 完整焦点顺序、横屏/平板及真实远程服务连通性，不据此宣称这些场景通过。

## 逻辑问题

### B01 · P1 · 取消高亮会同时删除段落笔记

- **位置**：[高亮删除](/Users/boren.fang/Desktop/Personal/Pagewise/src/data/repos/notes.ts:183)、[笔记保存](/Users/boren.fang/Desktop/Personal/Pagewise/src/app/usecases/studyReader.ts:89)、[界面操作](/Users/boren.fang/Desktop/Personal/Pagewise/src/features/study/useStudyVM.ts:804)。
- **触发与影响**：给一段原文写笔记，再点「取消高亮」。笔记实际保存在 `highlight.note` 中，而取消操作删除整条记录；界面只提示「已取消高亮」，用户写下的内容随之消失。
- **复现结果**：保存「这段推导需要复看」后取消高亮，查询该段笔记得到 `undefined`。
- **建议**：将高亮状态与段落笔记分开保存；取消颜色时保留笔记。只有明确的删除笔记操作才删除用户文字。

### B02 · P1 · 回头学习会使已学状态退回「在学」

- **位置**：[切换主线](/Users/boren.fang/Desktop/Personal/Pagewise/src/app/usecases/library.ts:118)、[完成小节后的下一节处理](/Users/boren.fang/Desktop/Personal/Pagewise/src/app/study/finishSection.ts:73)。
- **触发与影响**：把已学旧节设为主线，或者给旧节保存学习小结。前者直接把目标节改成 `learning`；后者直接把相邻下一节改成 `learning`，即使下一节已经是 `done`。已学小节计数因此减少，主线也会移回旧位置。
- **复现结果**：两条独立用例均从 `done` 变为 `learning`。尤其「结束旧节后降级已经学过的下一节」不需要用户主动重置下一节进度。
- **建议**：区分「当前正在重看」与「已经完成学习」。普通切换、旧节小结保存保留完成状态；只有明确重置进度才降级。推进主线时选择合适的未完成节，并保留用户对重学路线的选择。

### B03 · P1 · 一次笔记写入失败会持续阻断笔记读取与导出

- **位置**：[笔记写队列与读取](/Users/boren.fang/Desktop/Personal/Pagewise/src/app/usecases/notes.ts:22)、[导出读取笔记](/Users/boren.fang/Desktop/Personal/Pagewise/src/app/usecases/exportNotes.ts:171)。
- **触发与影响**：一次保存因临时存储错误失败，随后底层已经恢复。`pendingWrites` 仍保留被拒绝的 Promise，之后每次读取都再次抛出同一个旧错误，连其他书的笔记读取也会受影响。
- **复现结果**：仅让一次 `userText.set` 失败，恢复后 `loadNotes` 仍失败。需再有成功写入或重启才能摆脱该状态。
- **建议**：写入错误正常呈现给保存方，同时清除/归一化已结束的队列项；读取等待尚未完成的写入后应能重新查询已存数据。保留失败草稿和重试入口。

### B04 · P2 · 滚动后立即离开会丢失新的阅读位置

- **位置**：[卸载时清理](/Users/boren.fang/Desktop/Personal/Pagewise/src/features/study/useStudyVM.ts:193)、[第一层延迟](/Users/boren.fang/Desktop/Personal/Pagewise/src/features/study/useStudyVM.ts:1207)、[第二层持久化延迟](/Users/boren.fang/Desktop/Personal/Pagewise/src/app/study/StudySession.ts:1958)。
- **触发与影响**：快速滚动后 500ms 内离开页面。VM 清掉计时器却不提交 `anchorRef`，会话根本收不到最新位置；正常情况下还要经过第二层 500ms 延迟。
- **复现结果**：滚到 seq 105001 后马上卸载，等待 1.5 秒，数据库仍为旧位置 103000。
- **建议**：保留一层持久化节流，离开页面/进入后台时提交最后一次位置；确保普通返回和应用生命周期走相同保存路径。

### B05 · P2 · 带空格的英文短语搜不到

- **位置**：[全文查询归一化](/Users/boren.fang/Desktop/Personal/Pagewise/src/data/repos/blocks.ts:154)。书内搜索和学习工具搜索都会经过这里。
- **触发与影响**：正文含 `Uniform cost search`，搜 `Uniform` 有结果，搜 `Uniform cost` 却没有结果。查询删除了所有空白，FTS 索引中的正文仍保留英文词间空格。
- **复现结果**：同一条插入文本，单词命中 1 条、完整短语命中 0 条。
- **建议**：保留英文词间空格并正确构造 FTS 短语；若需要处理中文排版空白，使用与索引一致的归一化规则。

### B06 · P2 · 跨书检索引用的页码偏移方向错误

- **位置**：[跨书结果页码](/Users/boren.fang/Desktop/Personal/Pagewise/src/app/usecases/home.ts:155)、[统一页码规则](/Users/boren.fang/Desktop/Personal/Pagewise/src/core/ids.ts:25)。
- **触发与影响**：PDF 有前置页偏移时，读者从搜索结果核对原书会看到错误印刷页码。其他页面采用 `pdfPage - page_offset`，这里用了加法，还忽略了已有精确页标签。
- **复现结果**：PDF 第 120 页、offset 为 20，检索结果显示 `p.140`，应为 `p.100`。
- **建议**：复用 `pageLabel`，统一处理精确 PDF 页标签、偏移、前言页和 EPUB 位置。

### B07 · P2 · 修改讲解偏好后，已打开过的书继续使用旧偏好

- **位置**：[只在初始化读取偏好](/Users/boren.fang/Desktop/Personal/Pagewise/src/app/study/StudySession.ts:288)、[按书缓存会话](/Users/boren.fang/Desktop/Personal/Pagewise/src/app/study/registry.ts:5)。
- **触发与影响**：先打开一本书，再修改「讲解偏好」，回到同书或开启该书的新对话。设置已保存，但当前会话不会重新读取，界面表现得像设置没有生效。
- **复现结果**：保存 `recap=false` 和「多用 Python 类比」后重新打开同书，session 中仍为旧值。
- **建议**：在重入/新对话/下一轮请求前刷新，或订阅偏好更新；同时明确当前正在生成的一轮何时采用新设置。

### B08 · P2 · 长对话重开后看不到更早的消息

- **位置**：[默认只取最新 200 条](/Users/boren.fang/Desktop/Personal/Pagewise/src/data/repos/messages.ts:100)、[会话加载未指定分页](/Users/boren.fang/Desktop/Personal/Pagewise/src/app/study/StudySession.ts:517)、[对话列表](/Users/boren.fang/Desktop/Personal/Pagewise/src/ui/screens/StudyView.tsx:249)。
- **触发与影响**：同一个章节对话累计超过 200 条数据库消息后重开。数据仍在，但页面没有「加载更早」的路径；200 条还包括工具、卡片等消息，并非 200 轮问答。
- **复现结果**：存入 205 条验收消息，数据库完整保留，重开后从第 6 条开始显示；前 5 条不在当前会话状态中。代码中没有向前分页入口。
- **建议**：利用已有 `before_id` 实现向前加载，保持滚动位置；区分展示历史与模型上下文裁剪。不要为展示完整历史而把所有消息塞进 AI 上下文。

### B09 · P2 · 已渲染好的当前 PDF 页仍需等待邻页

- **位置**：[窗口串行渲染](/Users/boren.fang/Desktop/Personal/Pagewise/src/app/readerRuntime.ts:103)、[整窗完成后才显示](/Users/boren.fang/Desktop/Personal/Pagewise/src/features/study/useStudyVM.ts:1169)。
- **触发与影响**：切到尚未缓存的 PDF 页面。尽管顺序上先渲染当前页，调用方仍要等待前后最多 4 张邻页全部完成，才能把当前页交给界面。
- **复现结果**：控制邻页渲染保持等待，当前页已生成，但 `window()` 尚未交付给界面。此结论不依赖假设的设备耗时。
- **建议**：当前页完成后立即发布，邻页后台补齐；保留当前已有的请求版本检查、缓存上限和取消过期窗口的逻辑。

## UI 与阅读体验

### U01 · P2 · 纸感皮肤的模式切换触控区域不足 48dp

- **位置**：[模式容器](/Users/boren.fang/Desktop/Personal/Pagewise/src/ui/kit/base/controls.tsx:1386)、[模式选项](/Users/boren.fang/Desktop/Personal/Pagewise/src/ui/kit/base/controls.tsx:1402)。
- **证据与影响**：原生层级中选项为 48 × 26dp。虽然设置了 `hitSlop`，父容器固定高 30dp，扩展仍受父边界限制。单手切换读书/听讲时点击余量明显不足，也不符合 PRODUCT 的 48dp 约束。
- **建议**：视觉胶囊保持现有大小，在至少 48dp 高的外层承载实际点击区域；避免与相邻菜单的触控区域重叠。建议命令：`$impeccable adapt`。
- **证据**：[纸感听讲](/Users/boren.fang/Desktop/Personal/Pagewise/docs/dev/evidence/main-audit-b213f6d/listen-paper.png)、[原生层级](/Users/boren.fang/Desktop/Personal/Pagewise/docs/dev/evidence/main-audit-b213f6d/listen-paper.xml)。这张截图在 814430e 阶段取得，相关模式切换代码到 b213f6d 未改变。

### U02 · P2 · 浅色的次级文字对比度偏低（包含已知配色债务）

- **位置**：[纸感文字色](/Users/boren.fang/Desktop/Personal/Pagewise/src/ui/skins/paper/tokens.ts:43)、[未选中导航文字](/Users/boren.fang/Desktop/Personal/Pagewise/src/ui/kit/base/controls.tsx:238)。
- **证据与影响**：`ink3 #9AA0A8` 对白底约 **2.636:1**，页码色 `#A8A196` 对纸底 `#FBF8F1` 约 **2.414:1**。这些颜色用在小字号导航、页码等文字上，低于普通文字 4.5:1。
- **约束**：仓库明确记录过原型颜色优先的选择，不能把品牌/苹果风本身当作缺陷；现有对比度测试的豁免也不能当成已达 AA。
- **建议**：保留装饰、分隔线和原有风格色；让需要阅读的文字使用更清晰的文字角色，并补足五套皮肤的实际文字/背景组合检查。建议命令：`$impeccable harden`。

### U03 · P2 · 新翻译面板的原文预览仍可能占满首屏

- **位置**：[按 180 字符截预览](/Users/boren.fang/Desktop/Personal/Pagewise/src/ui/screens/TranslationView.tsx:42)。
- **触发与影响**：苹果风深色、系统字号 1.3，翻译含段落、标题和独立公式的技术章节。原文虽处于收起状态，180 字符对应的富文本高度仍很大；本轮原生截图中原文区约占 437dp，中文译文标题直到屏幕下部才出现，正文基本需要滚动后才能阅读。
- **建议**：保持用户要求的「原文在上、译文在下」，为收起预览增加按实际高度/行数的上限，让译文正文在首次打开时就可见，完整原文仍可展开。
- **证据**：[翻译面板](/Users/boren.fang/Desktop/Personal/Pagewise/docs/dev/evidence/main-audit-b213f6d/translation-glass-dark-large.png)。这是布局问题，演示返回的文字不作为翻译质量问题。建议命令：`$impeccable layout`。

### U04 · P2 · 深色模式下透明教材图的深色标注难以辨认

- **位置**：[演示图的固定深色文字](/Users/boren.fang/Desktop/Personal/Pagewise/src/app/demo/source.ts:364)、[图像背景与展示](/Users/boren.fang/Desktop/Personal/Pagewise/src/ui/kit/base/content.tsx:1617)。
- **证据与影响**：苹果风深色下，A* 图的 `h=5`、`h=4`、`h=0` 等深色标注直接叠在深色阅读背景，明显难读。已经在随应用提供的演示图确认；没有据此断言所有导入图都存在问题。
- **建议**：给演示 SVG 提供合适的深色呈现；原书透明图可提供浅底原图查看，保持图内容不变，不自动反转或改写原图。
- **证据**：[深色阅读与图示](/Users/boren.fang/Desktop/Personal/Pagewise/docs/dev/evidence/main-audit-b213f6d/read-glass-dark-large.png)。建议命令：`$impeccable harden`。

## 新合入功能的检查结论

**PDF 封面：核心修复有效。** 新代码从物理第 1 页生成 360px 宽图片，持久化到书籍目录，且没有将派生 URI 写进数据库。多个展示入口共用并发任务；缺失原文件/渲染失败保留占位，失败能重试。独立原生验收中，书的优先页为 2，仍正确显示蓝色第一页封面；清除 `cache/pages` 后生成的 `cover.png` SHA-256 未改变。见 [封面记录](/Users/boren.fang/Desktop/Personal/Pagewise/docs/dev/evidence/main-audit-b213f6d/native-cover.json)、[浅色](/Users/boren.fang/Desktop/Personal/Pagewise/docs/dev/evidence/main-audit-b213f6d/cover-paper-light.png)、[深色大字号](/Users/boren.fang/Desktop/Personal/Pagewise/docs/dev/evidence/main-audit-b213f6d/cover-paper-dark-large.png)。

**翻译和对话列表：主流程有改善。** 原文与译文分层、面板实色底、模型入口收拢、当前对话和新建入口清楚。流式输出的部分 JSON 解码、停止保留、失败/截断不缓存和迟到响应处理均有通过的用例。新增建议主要是 U03 的富文本预览高度；此外 B08 的长对话历史缺口仍然存在。见 [对话面板](/Users/boren.fang/Desktop/Personal/Pagewise/docs/dev/evidence/main-audit-b213f6d/conversations-glass-dark-large.png)。

## 性能优化机会（需要实际书库测量）

1. **旧库首次补封面可以不阻塞书架元信息。** [loadShelf](/Users/boren.fang/Desktop/Personal/Pagewise/src/app/usecases/library.ts:21) 等待所有 `withBookPresentation`，后者等待 [封面生成](/Users/boren.fang/Desktop/Personal/Pagewise/src/app/usecases/bookCovers.ts:62)；Android PDF 操作使用单线程队列。升级后若许多旧书缺封面，列表会等这批渲染完成。建议先展示书名/进度/占位，再限量补封面并局部刷新。本轮只确认等待关系，没有给出虚构的首屏耗时。
2. **最近对话展示限制与数据加载限制可以一致。** [ConversationList](/Users/boren.fang/Desktop/Personal/Pagewise/src/ui/screens/ConversationList.tsx:77) 默认只显示 3 条，但 [仓储查询](/Users/boren.fang/Desktop/Personal/Pagewise/src/data/repos/conversations.ts:45) 仍读取全部对话并求消息数和预览，展开时也会一次挂载全部。建议先测真实积累量，再决定数据库分页/按需加载；目前不声称已经发生卡顿。

## 原生 UI 评分

评分仅针对本轮检查的 Android 手机界面，不代表业务逻辑已无缺陷。

| 维度 | 0–4 | 依据 |
| --- | --- | --- |
| 无障碍 | 2 | 控件标签/状态较完整；部分触控区域和文字对比度不足 |
| 性能 | 2 | 阅读列表已有虚拟化与缓存；当前 PDF 页交付受邻页阻塞 |
| 外观与主题 | 3 | 语义 token、多皮肤、深浅色和减少动态效果已有体系；透明图与弱文字仍需处理 |
| Android 平台一致性 | 3 | 原生导航、安全区和系统返回正常；保留用户指定的皮肤风格 |
| 自适应 | 2 | 1.3 字号下正文与主要操作可用；富文本预览的高度策略需要改进，其他设备形态未验证 |
| **合计** | **12/20** | **可用，仍有明显改进空间** |

## 值得保留的实现

- 原书、AI 内容、引用与未核实内容已有明确区分；引用检查和可逆精修值得继续沿用。
- 数据本地优先，关键写操作使用事务，已有备份预览与升级数据一致性验证。
- 阅读/对话列表已有虚拟化、图片缓存上限与过期请求检查；优先修正交付时机，不需要整体重写。
- 五套皮肤共用功能契约；新封面失败回退、翻译面板实色底和减少动态效果处理比较完整。

## 证据与复现

- [最新 main 检查日志](/Users/boren.fang/Desktop/Personal/Pagewise/docs/dev/evidence/main-audit-b213f6d/check.log)
- [Android 构建日志](/Users/boren.fang/Desktop/Personal/Pagewise/docs/dev/evidence/main-audit-b213f6d/android-build.log)
- [独立复现代码](/Users/boren.fang/Desktop/Personal/Pagewise/docs/dev/evidence/main-audit-b213f6d/repro.test.tsx.txt)
- [独立复现日志](/Users/boren.fang/Desktop/Personal/Pagewise/docs/dev/evidence/main-audit-b213f6d/repro.log)

复现代码以 `.txt` 保存，避免把预期失败的审查断言纳入 main 的正常测试。可在临时工作区把它复制到 `__tests__/mainAudit.repro.test.tsx`，执行：

```sh
npm test -- --runInBand --runTestsByPath __tests__/mainAudit.repro.test.tsx
```

本轮执行环境使用 arm64 Node 24。10 个断言覆盖 9 类问题，其中已学状态有两条独立路径。长历史断言用于暴露当前无法访问旧消息的状态；以后采用分页修复时，应改为执行「加载更早」后检查旧消息，而非要求一次加载全部历史。

## 推荐行动

1. **P1 · `$impeccable harden`**：先处理 B01–B03 的内容保留、学习状态及失败后恢复。
2. **P2 · `$impeccable harden`**：处理阅读位置、搜索/页码、偏好同步和向前加载消息。
3. **P2 · `$impeccable optimize`**：当前 PDF 页立即显示，再测封面补齐和大量对话的加载。
4. **P2 · `$impeccable adapt` / `$impeccable layout`**：扩大实际触控目标，限制富文本原文预览的首屏占用。
5. **P2 · `$impeccable polish`**：在保留皮肤风格的前提下，统一检查文字、图像及深浅色细节。

这些项可以逐项、一起或按其他顺序处理；修复后重跑 `$impeccable audit` 验证。
