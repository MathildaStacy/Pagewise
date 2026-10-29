# Library UI 原型对照（2026-10-29）

本轮按当前 `docs/design/prototype.html`、`prototype-apple.html` 及其可维护源逐项核对。原型源未修改；真实书库、解析队列、文件选择、FTS 和学习状态继续由现有用例提供。

参考源：

- Paper：`docs/design/prototype/shell.html`、`ui-shelf.js`、`ui-map.js`。
- Apple：`docs/design/prototype-apple/base.css`、`pages.css`、`ui-shelf.js`、`ui-map.js`。
- 共享差异使用 `Tokens.layout.groupedLists` / `kit.usePresentation()`，页面不读取 skin ID 或导入 skins。

## 逐项修正

| 页面 / 项目               | 原差异                                                                    | 本轮修正与源对应                                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shelf 续学卡              | 两皮肤共用 margin12/padding16 和普通标题；多余边框；深色前景跟随 onAccent | Paper margin12、r16、padding16；Apple margin0/16/26、r26、padding18/18/16；使用中央 continue 色和字号角色，按源还原二段/三段渐变、白字、白继续按钮与阴影          |
| Shelf 续学内部            | 复习提示背景过深；卡片间距、短线、按钮共用尺寸                            | Paper recap mt10/p7×9/r8、短线 18×4、继续 34；Apple mt12/p9×12/r14、短线 22×6、继续 36；标题 mt4/mb2，footer mt12/14                                              |
| Shelf 单位                | Paper 显示“步”                                                            | Paper 页面转换为“第 n/m 段”和 recap“段”；Apple 保留“步”，学习数据模型不变                                                                                         |
| Shelf 书列表              | Apple 未使用 prominent 标题、书标题 21px、全宽分隔线且少 chevron          | 标题按源 Paper15/Apple20；书名 15/16、meta12/13、status mt6；Apple top inset separator left84、尾部 chevron；Paper 保持满宽底分隔与无 chevron                     |
| Shelf 书架搜索            | 通用 Field 高度、额外 label 与普通 Row                                    | 40 高输入、Apple 灰底搜索图标/圆角 12、搜索书籍封面行和作者；保留真实按书名作者筛选与路由                                                                         |
| 导入浮层                  | 格式出现在右侧、额外 chevron、“其他位置”左对齐                            | Paper42×52 / Apple40×50 的左侧格式 badge；文件名与大小/页数；无 chevron；“从其他位置选择…”居中；Apple 分组与 68 inset 分隔线；提示按源放在下方                    |
| 导入列表数据              | 文件名优先取 PDF 元数据 title，meta 含 author                             | `listImportDrafts` 展示原始 `info.name`，meta 为大小和页数；不改变草稿或导入行为                                                                                  |
| ImportSettings 头部       | Apple 也使用 PDF 格式 badge 和 14px 标题                                  | Paper 保持 badge 与作者·原文件名；Apple 使用 lg Cover、20/700 标题、作者及原文件名分行、padding4/20/18                                                            |
| ImportSettings facts      | 48%宽导致未精确填满；Apple 仍是纸感底色/小圆角/字号                       | 两列 flex 等宽、gap8；Paper p8×10/r8/值 14；Apple margin0/16/24、p11×14/r18/值 17；绿色文字使用 okInk                                                             |
| ImportSettings 解析选项   | 两皮肤共同满宽 section；Apple 分片值拥挤在右侧                            | Apple 使用分组标题“解析方式 · MinerU 精准解析 API”、分片范围在 subtitle、上传说明作为 group footer；Paper 保留左右标题与范围右对齐                                |
| ImportSettings 数字与额度 | 优先页输入、额度与 helper 未区分两皮肤                                    | Paper64×32/r6、Apple68×34/r10 灰底；真实分片数和超过额度时的说明；上传确认含真实书名/大小/页数及配置 Token 说明                                                   |
| EPUB 设置                 | facts 文案与原型不同，按钮上方间距共用 PDF 值                             | facts 目录“有”（仅有目录时）、解析位置“本机”；保留原型本机解析说明；Paper 按钮上方 4px、Apple 按 pad 结构                                                         |
| ParseProgress 头部        | 显示作者·PDF，Apple 封面和标题尺寸不符                                    | metadata 显示真实“页数 · MinerU · model”；Paper 普通 54×74 封面/书名角色；Apple lg 封面/20 标题/4-20-18 头部布局                                                  |
| ParseProgress 分片        | part 整体 gap 增加进度条/阶段条外间距；Apple 分隔线满宽                   | Paper p12×14，Apple p14×16 和 left16 top separator；标题与状态按源对齐，进度条后间距交由 StageStrip 的 P8/A10 负责                                                |
| ParseProgress 状态/操作   | 完成色、错误提示与按钮间距不符，footer 文案缩写                           | 使用 okInk/badInk、tabular nums；error 及 actions mt8/10、gap8；保留真实 ready/partial 数据，footer 与“查看书的地图”按源；无书签时不虚称已核对书签                |
| Map 检查条                | Apple 采用 Paper 几何，全部 846 个内部 ID 会挤满屏                        | Paper margin10/12、r10、p10×12；Apple margin0/16/16、r20、p12×16；核对主文与有限长度警告分两层，数量来自实际地图                                                  |
| Map 章节                  | Apple 仍是满宽白块；badge 与章节标题尺寸共用                              | Paper 满宽/badge30/r8；Apple margin0/16/10、r20、badge34/r11；对应 mapTitle；章节 meta 省略原型未显示的“未开始”和零子节数                                         |
| Map 子节                  | 每行额外分隔线、gap/缩进不符，展开箭头散开                                | 移除子节底分隔；Paper 左 22/52、pY9/gap10；Apple 左 18/50、min44/pY8/gap11；count 与展开箭头一起，Apple 旋转 chevron；当前/flag 按源优先级使用 accentBg/mapFlagBg |
| Map 详情                  | facts 左对齐、Apple 缺少圆角表；空问答和无笔记入口常驻                    | Paper 紧凑 13px 右对齐 kv；Apple r18/逐行 0.5 分隔/p11×16；0 条问答隐藏；无 QA/摘要/用户便签时隐藏“看笔记”，存在真实便签时保留入口                                |
| Map 搜索                  | 强制 full detent、helper 一直显示，Apple 无 icon、列表结构不符            | auto detent；Paper40 高圆输入与输入为空时的 helper；Apple 灰底搜索 icon/副标题；结果标题含章节编号、右侧页码、serif 摘要/命中高亮，空结果使用原型文案             |
| Map / Shelf 页码          | 内部 section ID 或 PDF 页序号可能作为展示文字                             | 章节与书架状态优先展示 no/title；FTS 结果使用 pageRange 和真实 pageLabels，跳转继续保存 PDF 坐标与稳定块 ref                                                      |

## 保留的真实约束

- Paper 原型的 600 页/2000 页额度已过时；按之前确认继续使用真实 200 页/片、1000 页最高优先级，范围和片数来自实际分片计划。
- 不将演示样例当作可上传原文件，不向正式书库写示例。现有 Demo 仅种入 AIMA 前 3 章；Demo 导入浮层重用已种入书籍，未伪造原型的三本 IMPORTABLE 文件。完整原型演示目录/导入样例属于 Demo 数据后续工作。
- demo 提醒、实际错误与扫描件 OCR 重试等真实状态保留；这些在无错误的原型静态画面中不存在。
- 共享 AppBar、Button、Cover、Note、ListSection、Sheet、StageStrip、SectionStatusIcon 与中央 tokens 由主任务同步修正。本轮页面没有本地复制共享实现。

## 验证

- scoped ESLint：四个 View、library presenters/types/VM、两处 app 只读展示映射及 library tests 通过。
- 全局 `npm run typecheck` 通过。
- `jest __tests__/features/library.test.tsx __tests__/app/import/import.test.ts --runInBand`：2 suites / 40 tests 通过。覆盖 Paper/Apple 样例渲染、原始文件名/大小/页数、空问答与真实便签、搜索章节编号与印刷页码、超长核对警告有界、导入/迁移边界。
- 本 worker 按任务约束未操作设备或浏览器；以上是源逐项核对和自动测试结果，不能作为两皮肤原生截图逐像素验收。原生字体度量、长标题换行、Sheet 键盘和动态高度、四主题最终画面对照由主任务接续。

## 原生验收回归：续学卡无编号根（2026-10-29）

设备真实 PDF 的当前小节 `u91001` 曾显示“第 null 章 Cover · p.50–51”。原因是 presenter 通过数组中第一个满足 ord/range 的 level1 根推断章节，Cover 的开放范围也能命中。

修正为沿当前小节的真实 `parent_id` 链找到 level1 祖先；不再通过全局范围选择其他根。祖先有 no 时保留“第 n 章 标题”，无 no 时只显示祖先标题，缺少祖先时只显示页码。本修复不修改地图数据或上传/解析行为。

回归构造 Cover 无编号/开放范围、正确第 3 章、嵌套父节和 `u91001`，验证显示真实第 3 章；另验证无编号祖先只显示标题和断链仅页码，均不会拼接 null/undefined。原生画面复验由主任务继续。

本次追加验证：presenters 与 library tests 的 scoped ESLint 通过，library 13 tests 通过。全局 typecheck 运行时共享 `content.tsx` 正在修改，因 sourceText/auxText 等新增 style 定义尚未写完失败；已交接主任务收尾后重跑，本次未在该共享文件做修改。
