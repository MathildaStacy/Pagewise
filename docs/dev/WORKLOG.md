# Pagewise 开发与验收工作记录

更新日期：2026-10-29。本文记录已观察到的问题、修复依据和验证结果，供后续 Opus / Astra review。**验收尚在继续；此文件不表示 T0–T12 已全部完成。**

## 本轮范围与约定

- 分支：`codex/android-scaffold`；PR：[#1](https://github.com/MathildaStacy/Pagewise/pull/1)，当前为 draft。
- 已提交基线：`640d128`（T4/T6/T7a 集成）；本轮 T7 后续、T8–T11 和原型对齐仍在工作区，需在 review 时同时看未提交改动。
- UI 依据用户最新要求，纸感严格对齐 `docs/design/prototype.html`，苹果风严格对齐 `docs/design/prototype-apple.html`，两套都不能自行改设计。纸感模式「伴读 / 原文」，苹果风「读书 / 听讲」，内部状态仍为 listen/read。
- 用户指定验收书：下载目录的 *Machine Learning for Trading* PDF，827 页、39,604,867 bytes；SHA-256 `ddcbddd989a5813d16a4e7da0969d6f38b0e2629dac04a7b13c7c0ab21cd16f0`。EPUB 使用可提交的公版 Alice 夹具。
- 私有 PDF、MinerU 返回正文和临时凭据均不提交。`fixtures/private/` 已被忽略。日志与验收 JSON 只保留状态、计数、ID、耗时等必要信息。
- 工作区中产品文档、原型与其他探索稿有用户已有改动；提交时须明确区分，不能批量全部暂存。

## 已发现的问题与处理

### 1. 本机 Node 版本导致测试工具无法加载

现象：系统 Node 25 / x64 加载 `unrs-resolver` 失败。使用本机已安装的 Node 24.22.0 后正常，未修改业务以绕过错误。构建与测试统一显式设置该 Node 的 PATH。Android 使用 Android Studio 自带 JBR 和现有 SDK。

验证：完整 `npm run check` 已通过 72 suites / 1069 tests / 15 snapshots（后续新增修复仍需再跑）。原生新文件模块及恢复重启接口的 debug APK 构建成功，最近一次为 26 秒。

### 2. EPUB HTML 依赖在 Metro 中选到了不能执行的入口

现象：`htmlparser2` 的 ESM `export * as ElementType` 在 Android bundle 中失败，Node 测试没有暴露该问题。

处理：`metro.config.js` 对该包明确使用 CommonJS 入口，保留包本身的正常 Node 测试方式。

验证：Android 已能启动；公版 EPUB 的真实文件解析集成测试通过。设备上的 EPUB 导入、阅读和听讲尚待完成。

Review 入口：`metro.config.js`、`src/services/epub/parser.ts`、`__tests__/services/epub/`。

### 3. MinerU 签名上传 URL 对请求头有严格要求

现象：本机探测上传签名 URL 时，隐式添加表单 Content-Type 的请求返回 403；不带该头的 PUT 返回 200。

处理：签名上传直接流式传文件，不附加 API Bearer Token 或 Content-Type；鉴权仅用于 MinerU API。核对 BlobUtil Android 实现，空 MIME 不会被补成表单类型。

验证：真实 10 页样本上传、解析、下载成功；随后整本 827 页通过应用原生流程上传并解析完成。

Review 入口：`src/platform/mineruFiles.ts`、`src/services/mineru/client.ts` 及其协议/取消测试。

### 4. 真实 MinerU 输出与合成数据存在结构差异

观察：真实 10 页样本使用 0–1000 坐标，layout 页面为 540×666 pt；包含标题、图、表、公式和页眉页脚，印刷页码比 PDF 页序号少 41。

处理：适配器归一化 bbox，区分坐标系；过滤页眉页脚；保留图、非空表和公式；块号固定为 `PDF页序号*1000+页内序号`，后续分片不重编号。

验证：样本 148 条 content_list，17 标题、10 图片、5 非空表、3 公式；图片路径均存在。全书最终入库 8859 块，包含 431 图、120 表、227 公式；推断页码偏移为 41。详情见 `evidence/t8/full-import.json`。30 个原版位置框人工对齐尚待验收。

Review 入口：`src/services/mineru/adapter.ts`、`src/core/map/`、`__tests__/services/mineru/`、`__tests__/core/{map,migration}.test.ts`。

### 5. 整书地图构建让 Android 长时间停在“建地图”

现象：前两片已从 MinerU 返回，但设备停在 importing，数据库尚无已提交块；JS 线程持续占用 CPU。Node 小夹具测试未暴露整书规模问题。

原因：reconcile 对每条书签先与全书所有标题计算编辑距离，然后才筛选页码 ±1。1030 条书签时执行了大量无用比较。

处理：按页索引候选标题，先筛相邻页；缓存标题归一化结果；保留原先匹配排序与稳定 tie 顺序。增加合成和可选私有规模回归。临时安全里程碑仅输出固定阶段、块数和耗时，便于确认 Android 的实际阶段。

验证：真实前 200 页为 2185 块、347 标题、1030 书签；Node 地图构建约 895ms → 55–72ms，实际编辑距离比较 2922 次；完整 SQLite 导入约 399ms。重启应用后队列继续，最终 5 片全部 done、ready_to_page=827，8859 块 / 1343 章节入库。第 5 片先完成时 ready_to_page 仍停在连续就绪的第 400 页，未错误宣布整书可学。

限制：Node 时延不等于 Android 时延；设备 debug 环境的地图阶段仍可能耗时数秒，不能用 Node 结果宣称 UI 性能达标。地图层级/书签质量检查仍在继续。

Review 入口：`src/core/map/index.ts`、`__tests__/core/mapPerformance.test.ts`、`src/app/usecases/importResults.ts`。

### 6. 清理缓存、重新解析与应用生命周期容易互相干扰

问题：清理后自动恢复队列可能触发用户未明确请求的重传；reparse 替换队列实例后，AppState 监听若捕获旧对象，会暂停错误实例。重新解析时还必须保留引用、手动目录及学习状态。

处理：清理只删除派生数据，先停止队列、会话和 reader；显式 `reparseBook` 才重建任务。生命周期每次获取当前队列，不持有旧实例。旧块按已成功解析页范围逐片消耗，旧章节状态保留至整书重建完成。同 SHA 补回缺失原文件后清除 backup missing-original 标记。

验证：导入/迁移/存储联合回归覆盖；设备经历断网和杀进程后完成整书，已完成分片状态保留。清理→实际重新解析→高亮/便签迁移的完整原生操作尚待完成。

Review 入口：`src/app/useImportLifecycle.ts`、`src/app/usecases/{parseQueue,importBooks,importResults,storage}.ts`。

### 7. AI 中继的非流式响应只有 heartbeat

现象：配置的真实服务 HTTP 200，但非流式正文只有 `: keepalive`；流式 SSE 正常。

处理：仅当非流式响应为空且只有 heartbeat 时重试一次流式。没有将所有 complete/test 请求强制改成流式；正常路径保持原协议行为，第二次截断仍报错。

验证：网关回归覆盖该重试与第二次截断；真实学习评测可正常完成。

Review 入口：`src/services/ai/http.ts`、`__tests__/services/ai/gateway.test.ts`。

### 8. AI 评测曾出现 90%，且 explain 输入与生产不一致

现象：一次 20/20 后复验只有 18/20，失败为 plan 的不可拆分组、explain 引用。排查还发现 eval 给 explain 传了全 blocks，并错误使用 tidy；生产传单个 block 且使用 teach。

处理：逐任务对齐生产输入与用途；plan 显式给出合法不可拆分组、边界和允许步数；强化各 JSON schema 字段/引用类型提示与校验。未放宽成功判据。保留 90% 历史结果，不以旧的通过报告替代最新失败。

验证：修复后只跑 1 轮，20/20 结构任务、5/5 真实 flow 通过，引用错误 0。岔路实际调用 load_section，小测实际调用 show_quiz。Chat 五轮均报告真实 cacheRead>0；**未获得 Anthropic 服务，因此 Anthropic 专项缓存验收仍 unavailable，不能勾选通过。**

证据：`evidence/t7/live-eval-2026-10-29T02-16-48-637Z.json`；历史失败 `live-eval-2026-10-29T01-23-01-534Z.json`。Review 入口：`src/app/study/prompts/index.ts`、`scripts/eval-live.test.ts`、prompt snapshots。

### 9. UI 与 prototype 存在明显几何差异

发现：快捷操作 ScrollView 的 flexGrow 抢占剩余高度，学习页中部出现大空白；进度出现额外数字行；模式胶囊、快捷 chips、发送按钮、复习评分卡片、地图和笔记列表与原型不一致。

处理：快捷区域禁止伸展；进度收敛为单行标签/短线/上下文入口；可见控件尺寸按原型，触摸范围保留 48；修正书架蓝色渐变续学卡、复习评分、封面与列表层次。继续逐页截图核对，不将“能渲染”当成“原型一致”。

验证：组件/页面测试和主题对比度门禁已通过；早前原生复习 8 卡完成页已验证。最新页面双皮肤四主题截图及完整交互仍在补。整书地图曾把 846 个内部节点 ID 全部写入警告，挤占整屏；已收敛为数量和简短核对提示，新增有界长度回归。

Review 入口：`src/ui/kit/base/{controls,content}.tsx`、`src/ui/screens/`、`src/ui/skins/`、`evidence/t4/`。

### 10. 备份恢复失败时可能覆盖原文件；release 无法用 DevSettings 重启

处理：恢复前验证 manifest、schema、完整性和文件清单，备份将被覆盖的原文件；复制或数据库替换失败时回滚，并重新打开原库。数据库替换使用 prepared/previous 文件。备份快照清除敏感设置，KeyStore 不进备份。重启改为原生 ReactHost.reload，避免依赖仅 debug 可用的 DevSettings.reload。

验证：真实 SQLite + ZIP 的 disk-full 回归验证原文件回滚和重启；storage/export/backup/study/VM 共 112 项相关测试通过。新增原生重启接口已编译。设备“备份→卸载→重装→恢复”和 release 恢复重启尚待实测。

Review 入口：`src/app/usecases/storage.ts`、`src/services/backup/`、`src/platform/storageFiles.ts`、`android/.../files/FileToolsModule.kt`。

### 11. 原版页缓存与原生渲染验证

实现：系统 PdfRenderer 单线程串行访问，最多 2 个打开的 PDF；PNG 磁盘缓存上限 100MB、最大宽 1440；JS reader LRU 为 7 张，预取相邻 ±2 页。原版与重排使用相同稳定块号与注释数据。

验证：设备对真实书 p.51–100 连续渲染 50 页，总 2641ms，中位 45ms、p95 66ms、最大 337ms；缓存 18,990,055 bytes。证据 `evidence/t9/native-render.json`。

限制：这是渲染 API 验证，**不代表滚动已达到 55fps**；30 个框人工对齐、连续滚动帧率仍待验收。

### 12. 双原型 UI 的实现约束与偏差收敛

用户连续明确两套 UI 均须一模一样，因此最终依据是两份原型当前源码，不能将苹果风仅当作颜色主题。共享组件增加语义 presentation（分组布局/复习翻面），View 无需读取 skin ID；页面仍经 VM 使用相同功能状态。

发现并修正：Paper 主/小按钮应为 42/30，而非可见 48；Apple 为 50/34。48dp 触控范围由 hitSlop 补足。模式分别为 30/32 高；Paper 单行短线进度、Apple 38 高路线图胶囊；Apple 浮动 Tab 62 高与大标题，Paper 通栏 Tab58。移除原型没有的顶部 Demo 横幅，保留关于页/开发菜单退出。Reader 重排改为按页成组，复用稳定块引用和选择操作。

原型颜色与旧对比度门禁有明确冲突：Apple light 的 secondary label 约 3.62、白字/蓝按钮约 4.02、绿图标约 2.22，dark 白字/蓝按钮约3.65。按用户最新指令恢复原型；对比度测试明确列出原型差异，其他配对保留既有门槛。**这些配对不能宣称 WCAG AA 已通过。** 后续评审若改变颜色需另行决定，不能悄悄把深色替代值当成原型。

页面细项对照见 `evidence/t4/{library,settings,notes-review}-ui-fidelity.md`；当前已补原生苹果风外观/我的/书架截图；发现改为悬浮 Tab 后导入 FAB 仍沿用旧底距18，与 Tab 重叠，已修为原型 bottom104 并修正其蓝色。完整原生最终截图还在补。原型 Demo 的固定书名/章节数据与真实书内容不同，真实数据不能替换为写死示例来制造视觉一致。

### 13. 真实三节学习完整链路

设备通过生产 StudySession 与已配置真实 AI，学习 Machine Learning for Trading 第3章前三个正文小节（PDF88–91）。三节全部通过，耗时375581ms；回答23、引用58、无效引用0；每节10轮read/listen切换后持久位置一致；各完成小测、摘要保存、进度保存；共保存15张闪卡。证据 `evidence/t7/native-real-study.json`。

边界：这是原生进程内生产会话的自动验收，不等于所有点击路径和 TalkBack 已通过；引用的实际页框仍需人工核对。

### 14. 第二轮原型和真实导出检查

最后源码核对发现 Reader 仅定位到页、上报固定中间块，Apple 重排分卡、Sheet 头尾随正文滚动、听讲 dock 未悬浮、小结提示未居中。逐项记录在 `evidence/t4/final-source-audit.md`（修复前），按两套原型分别修复；后续以最终原生截图为准。

本机离线地图重建已通过：1343→1342 section，8859 blocks 不变；误识别 St Paul's Square 删除；message87/card15/stuck2/study_state1/lesson_plan4 与 parse parts5 的整表哈希重建前后均相同。第一次实测全部 root.no 为空，不能报告已显示27章；定位为 outline 的 `Chapter 03:` 未解析且正文匹配未继承no，第二次离线重建已实测恢复27章，章号1–27及页面42/62/88…786均正确；1342sections与8859blocks不变，PDF所有学习表及5分片整表哈希保持不变。证据`evidence/t8/native-map-numbered-rebuild.json`。

EPUB + 真实 AI + 原生 Downloads 导出通过：Alice 17节/858块/1图片全部存在、858 loc完整；guide保存，model路线图2步，explain引用1/无效0。真实PDF有3节笔记/15卡，生成实际Markdown ZIP、Anki CSV（3行Anki指令+15条3列卡片）和2本书原件备份。报告 `evidence/t11/native-storage-epub.json`。这不替代商业EPUB、Anki桌面实际导入与负责人Markdown样例确认。

检查实际ZIP发现两个问题：导出把global ord+1当章号生成“第136章”，已改为无章号时用标题；备份仅带原件却不带已解析图片，会在卸载后丢失重排图表，已补manifest可选imageFiles、逐图复制/恢复、快照绝对EPUB路径改为书相对路径；兼容旧备份。增加图片恢复和覆盖失败回滚，10项backup/storage回归通过。完整原生卸载恢复将在新备份生成后验证。

设备截图发现隐藏Tabs的原生BlurView仍采样后续push页，造成整页白色叠层（dark #000变#333/#606060）。RootNavigator在Tabs失焦时卸载TabBar，重进外观页实测恢复纯黑/正确蓝色。之前受污染截图不得作为最终色彩依据；已重拍外观四主题。

最新完整check：79 suites / 1148 tests / 15 snapshots通过；Android debug/release arm64均构建成功（58s）；329个变更文件与本机真实凭据字节比对无泄漏。原生后续验收继续。

### 15. 空 alt EPUB 图片引用迁移误失效

设备严格验收失败时，858个block逐字段相同、学习记录计数也相同，但message的图片引用/allowed_refs/raw被更改。根因是文本迁移器将空alt图片判为unmatched。现仅在同seq、loc、image_path、type及内容完全相同的空文本图片上保留身份映射；图片资源或位置变化仍判失效，未放宽严格断言。

修复前恢复了备份中的原始记录，8张学习表逐行与快照一致，再执行生产clearParseCache→reparseBook。设备复验通过：858→0→858，preservedBlocks858；17节，1图片可读取；messages/guides/summaries/userNotes/highlights/pins/cards逐记录不变，changesAfterClear/changesAfterReparse为空。证据 `evidence/t11/native-epub-reparse-{before,after}-fix.json` 和 `native-baseline-restore.json`；54项迁移相关回归、typecheck及lint通过。

### 16. 全文搜索打开到当前续学小节

设备在真实书地图搜liquidity，点Intraday liquidity patterns p.488，Reader却显示续学小节p.50–51。搜索结果ref正确，但standalone Reader的blockRef只提供高亮/锚点，没有推导目标section，沿用了当前reader/main小节。已修复VM入口的目标block→section解析，增加冷开/已续学状态及主线保持回归（58项相关测试通过）。release设备复验同一结果：正确打开目标小节p.488–489（PDF529–530），原版与重排均实际看见目标标题。证据 `evidence/t9/native-search-reader.json` 与两张仅含header/目标短标题的截图；完整书页截图留在仓库外。

### 17. 新备份卸载重装恢复与最终回归

使用修复后的真实原生导出：2本原件+552个图片资源，新ZIP47,943,402bytes。逐个manifest图片存在，快照无安装绝对image_path，真实凭据字节不存在；Markdown已为第03章目录，不再有第136章，Anki文件15张/每张3列。证据 `evidence/t11/native-storage-epub-with-images.json`、`native-export-inspection.json`。

将ZIP保存到App外后，实际卸载、重装debug，观察空书库，再用生产restoreBackup恢复并自动重载。13张书籍/解析/学习表与ZIP快照逐行一致，2原件及552图片全部哈希匹配；恢复后MinerU未配置Token、AI编辑Key栏为空，需重新填写。证据 `native-uninstall-restore.json`。另在release的正式设置页打开系统文件选择器选择新版备份，实际完成生产restoreBackup与ReactHost.reload；回到书架后原地换debug仅作run-as检查，13表、2原件、552图再次全匹配。证据 `native-release-restore.json`。

最终check曾有queue-full测试5000ms超时；单测仍需3913ms，确认是Jest时钟与注入clock独立，提前推进造成1ms重调度循环。仅修测试同步时钟，并等attempt/stage/error/next_poll_at完整状态；59.999秒不重试、边界1ms触发、5次后失败断言均保留，未增加timeout或改生产语义。修后整套中该case5ms。最新完整check79 suites /1153 tests /15 snapshots通过；Android debug/release arm64构建54s通过。

### 18. Release 冷启动实测尚未达到目标

已安装真实release APK（不依赖Metro），Android am start -W 三次COLD为9320/3828/4323ms；首个为安装后首次启动。该值是Activity首帧，不是完全可交互时间，更不能代表实体机达标。证据 `evidence/t12/release-cold-start-emulator.json`。不将此次性能标为通过，需实体机剖析/验证。

### 19. 最后标题行为和30块源坐标核对

第二轮源码审查发现我的页用普通View手写标题，未进入Screen的固定AppBar处理，Apple滚动后缺紧凑标题；已改共享AppBar。地图当前节点700改回原型600。我的页外观摘要改为当前皮肤/主题/正文档，关于显示真实版本，双语关闭文案改为“只用中文术语”。独立Reader按Paper加“原文 · ”前缀，两套副标题均只页码，与听讲副标题书名分开；文档明确两套mode顺序不同。

用固定seed20261029从真实MinerU块中随机抽30块，Poppler125dpi渲染原书叠加库中归一化bbox，逐块目视核对：30/30对应正确内容，偏差不超过一行。证据 `evidence/t9/bbox-source-review.json` 仅保存坐标/类型/结论，完整书页与裁图在仓库外。此项证明源坐标；不冒称已走完30条原生点击路径。

### 20. 最终双原型细节与原生复查

继续按两份原型修正实际差异：Apple 大标题移入滚动正文，顶栏覆盖正文，超过36dp显示紧凑标题，超过2dp启用20 blur与0.5分隔；Paper保持固定48dp导航。Apple设置分段复用已有滑块，正文小/中/大精确为AI 15/17/19、原文15/17/19.5。Paper模式选中背景在设备上出现方角，改为原型独立圆角滑块与260ms过渡；Paper学习页切原文补页码副标题。

学习浮层将操作放入Sheet.actions，Apple固定纵向footer、Paper保持正文内横排；笔记使用Dialog，补键盘适配、serif引用、草稿保持和空白拦截。补原文顶栏占位/返回、Apple thread上下距、ReadEnd单层padding；Composer拆开引用标签与serif摘录；小结完成图标补原型阴影/500ms pop并遵循reduceMotion。Demo图由两份原型相同SVG精确栅格化为本地PNG data URI，避免原生Image不显示SVG；仅影响隔离演示库。

本轮使用ego-browser获准新建space2，打开两份本地prototype捕获参考画面；Paper/Apple主页面四主题44张重新拍摄。旧Apple浅色Notes/Review截图各有一行深色底残留；JS同实例dark/light三轮样式均正确，最新原生dark→light复现两页均无残留，未臆测根因或加remount。实际截图索引见evidence/t4/final/README.md，浏览器参考见evidence/t4/reference/。

TalkBack服务已实际绑定，Tab绿色焦点、书架继续进入听讲已观察；输入问题和回主线没有可靠完成，语音未人工听验，故仅记partial。原始关闭设置已恢复并读回null/0，证据evidence/t12/talkback-keyboard-partial.json。

最终本地npm run check为80 suites/1191 tests/15 snapshots，通过；Paper页码副标题追加断言后Reader26项再次通过。arm64 debug/release最终构建49s通过。最新release安装并启动真实书架成功；release隐藏开发Demo入口，故原型示意截图仍用debug，避免为验收新增产品入口。

最后串行执行Apple深色Demo的“地图→书架→我的”，实际层级确认书架和我的页均正确出现。此前并发UIAutomator与错误页面状态导致的无响应判断未复现为产品问题；未为此新增导航重置或remount。

用户要求使用stop-that-shit skill：按change责任仅修已确认原型差异与必要调用者/测试，不新增产品功能。用户选择先完成模拟器可验证项目；实体机与Anthropic专项继续独立列未验证。

### 21. v0.0.1 发布准备

用户要求最后commit、push并发布release版tag。发现Android模板versionName仍为1.0，与package.json和关于页0.0.1不一致，已统一为0.0.1，versionCode保留1；没有改动签名方案或增加发布框架。

重新构建arm64 release成功（50s，616 tasks），apksigner验证通过，output-metadata确认为release/0.0.1，APK仅含arm64-v8a。发布文件为Pagewise-v0.0.1-android-arm64.apk，45,674,752bytes，SHA-256为6768613124d107f8c53ea8614b5e6ae7b7935f7783be95d6e4f143b757ca3d71；APK解包逐文件比对本次真实凭据，匹配0。JS源码未变，沿用§20完整check证据。

发布说明见releases/v0.0.1.md；计划以v0.0.1 tag附APK与SHA256SUMS发布GitHub预览版，沿用当前开发签名，并如实列出未完成验收，不能将发布等同于整体验收通过。版本提交及远端发布结果以Git与GitHub实际状态为准。

### 22. v0.0.1 双原型检查（未修代码）

用户询问还有哪些实际问题。本轮检查两份原型、现有四主题截图、当前原生Demo和对应调用链，确认6项：Reader图像点击为空操作；段落无障碍名称缺正文；Apple段落菜单两行而非原型单行滚动；封面尺寸/字号及Paper深色字色偏差；Apple已讲标记误用实蓝左边框；Paper底栏仍使用近似Lucide图标。报告及复现/原因/修正方向见evidence/t4/review-v0.0.1.md。

原生图像点击无响应后，同页普通段落点击可正常打开菜单；无障碍名称由原生树确认，未冒称完成TalkBack语音操作。旧报告为修复前快照，未重复当作当前缺陷。视口与滚动位置差异未列作bug。本轮只记录检查结论，不修改产品代码，也不移动已发布v0.0.1 tag。

### 23. v0.0.1 补查（未修代码）

用户追问是否还有问题。本轮继续限定检查地图状态、Paper Dialog、复习大字号及笔记/设置调用链，新增确认2项：两套地图学习中状态使用圆点而非原型半填充圆；Paper Dialog边距、字号、行高及按钮分隔不符。连同§22累计8项，复现依据、原因和修正方向已补入evidence/t4/review-v0.0.1.md。

Paper Demo首次在系统2倍字号进入复习时出现仅标题的空白页，第二次同路径题面/答案/按钮正常，故未列为稳定缺陷，也未将固定高度推测写成事实。Apple翻转卡2倍字号仍未验证。笔记返回flush、设置事务已存在，相关猜测排除。本轮临时字号最终恢复并读回1.0，不修改产品代码；只提交检查文档，不移动v0.0.1发布tag，不重复运行源码未变的完整测试。

## 待完成 / 不得提前宣称通过

- 地图27/27正文章首页、章号与偏移已确认；全图1342节层级及845个黄色核对项仍需人工质量复核。长词全文搜索→Reader原版/重排已设备通过，短词路径仍待补验。
- 真实三节生产会话已通过；原生公式SVG、30个引用框位置、高亮/便签及杀进程恢复的最终界面走查仍待完成。
- EPUB设备导入与真实AI、清缓存/重解析严格迁移已通过；目录/图片的完整阅读界面走查仍待完成。
- 新版Markdown/Anki原生文件已生成，章号已修；Anki程序实际导入和Markdown样例确认仍待完成。卸载重装恢复与release正式入口恢复/自动重载均已严格通过。
- 两皮肤×浅深色最终逐页截图、TalkBack实际操作、隔3天续学与滚动性能仍待补；模拟器冷启动未达标，不能替代中端实体机结论；Anthropic专项需可用服务。
- 最新完整check和debug/release构建已通过；最终提交的GitHub CI状态以PR #1最新提交检查为准。

## Review 建议

优先看事务和恢复边界、稳定块号迁移、队列取消/重试、真实 AI schema 与引用校验，再核对原型截图。请将新增 debug 验收 harness 视为测试入口，不作为产品功能。每项未验证状态以此记录、`07-plan.md` 与 `evidence/` 的实际结果为准；有冲突时不能只依据复选框认定通过。

## v0.0.2 八项原型问题修复

根据 `evidence/t4/review-v0.0.1.md` 修复八项：阅读图片让段落菜单处理点击，富文本生成可区分的无障碍名称；Apple 菜单改为横向滚动、已讲标记改为外侧淡色细线；封面、Paper 底栏 SVG、学习中半填充图形及 Paper 对话框按原型修正。图片有独立回调时仍保留查看大图入口，新增双皮肤交互回归。

完整检查 80 suites / 1195 tests / 15 snapshots 通过；版本元数据更新后存储测试另行通过。Android arm64 debug / release 构建通过。TalkBack 和四主题完整验收仍未完成，发布继续标为预览版。
