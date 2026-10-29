# Pagewise Android 实现规格（给实现者）

> 版本 0.1 · 2026-10-29 · 适用：V1（M1–M4），Android 先行
> 读者：负责写代码的 AI 实现者（以下称"实现者"）和负责人。
> 需求来源：[产品设计](../PRODUCT_DESIGN.md)、[伴读引擎规格](../STUDY_ENGINE.md)。本目录只规定**怎么实现**；需求和本目录冲突时，以需求文档为准，并在 `QUESTIONS.md` 记一条。

## 1. 文档地图

| 文件 | 内容 | 什么时候读 |
| --- | --- | --- |
| [01-architecture.md](01-architecture.md) | 技术栈、分层、目录、依赖规则、组合根、状态、导航、错误、日志 | 开工前必读 |
| [02-skins.md](02-skins.md) | 设计系统与换肤：Token、组件契约、两套皮肤（纸感默认 / 苹果风）、各皮肤允许和不允许的差异 | 写任何 UI 之前 |
| [03-screens.md](03-screens.md) | 每个页面：入口、区域布局、ViewModel 契约（状态 + 意图）、边界状态 | 做某个页面时 |
| [04-data.md](04-data.md) | SQLite 表结构（DDL）、迁移、仓库接口、全文搜索 | 做数据层时 |
| [05-engine-ai.md](05-engine-ai.md) | 伴读引擎落地：AI 输出标记、富文本 AST、上下文组装、工具、岔路、路线图、引用校验、续学、小结、提示词 | 做听讲 / 读书 / AI 时 |
| [06-import-parse.md](06-import-parse.md) | 导入、MinerU 客户端、PDF/文件原生模块、EPUB、地图构建、书签核对 | 做导入解析时 |
| [07-plan.md](07-plan.md) | 任务拆分（按顺序做）、每个任务的验收标准、测试策略、CI | 每个任务开始前 |

## 2. 设计稿怎么用

| 设计稿 | 是什么的"真相" |
| --- | --- |
| `docs/design/prototype.html`（源文件 `docs/design/prototype/`） | **默认皮肤「纸感」**的视觉、布局、页面清单、交互。所有页面都画全了。颜色、字号、圆角、间距直接取 `shell.html` 里的 CSS |
| `docs/design/prototype-apple.html`（源文件 `docs/design/prototype-apple/`） | **第二皮肤「苹果风」（glass）**的完整参考：所有页面都画全了（含「外观」页），浅色 + 深色。页面集合、导航、文案、操作区域和纸感原型一致，组件形态按 [02-skins.md](02-skins.md) §5、§7 做；听讲 / 读书已包含 app.js 的新交互。颜色、字号、圆角、间距、动效直接取 `base.css` / `pages.css` |
| `docs/design/explore/apple.html`（CSS 在 `explore/src/apple.html` 的 `<style>` 里） | 苹果风最早的探索稿，只画了听讲和读书两页；glass Token 的出处（02 §4.3）。和 `prototype-apple.html` 冲突时以后者为准 |
| `docs/design/explore/src/app.js` | 听讲 / 读书的**新交互**：路线图（步）、原文预览浮层、来源标记（补充推导 / AI 举例）、岔路折叠、问答便签、本节导读、从这里开始讲、读完这一节。纸感原型 `prototype/` 里还没有这些，以 app.js 为准（`prototype-apple/` 里已经有了） |
| explore 下其他风格（google / meta / microsoft / windows11 / play） | V1 不做，只证明换肤架构要能容纳它们 |

用户于 2026-10-29 要求两套 UI 严格遵循各自原型：顶部模式分别保持各自原型的顺序：Paper 为「伴读 / 原文」，Apple 为「读书 / 听讲」。引擎与开发文档仍用「听讲 / 读书」表示这两种模式；路线图进度用「步」（长小节分「段」，每段再分 2–5「步」，见 [05 §5](05-engine-ai.md)）。

原型里的书名、目录来自真书，**页码、原文、讲解、闪卡都是示意内容**，只能当演示数据（Demo 模式，见 [07 T3](07-plan.md)），不能出现在正式数据里。

## 3. 实现者的硬性约定（MUST）

1. **分层不越界**。依赖方向见 [01 §3](01-architecture.md)，用 ESLint 规则强制（T0 就配好）。`src/ui/**` 只能拿到 ViewModel 给的数据和意图函数，不能 import store、仓库、服务、引擎。
2. **UI 里不写业务**。判断"能不能点""显示什么文案""下一步去哪"都在 ViewModel / presenter 里算好。页面组件只做"状态 → 画面"和"手势 → 调意图"。
3. **UI 里不写样式字面量**。`src/ui/screens/**` 不允许出现颜色、字号、圆角、阴影的字面量，全部从 Token 取（ESLint `react-native/no-color-literals` + 自定义规则，见 [02 §8](02-skins.md)）。
4. **每个任务带测试**，`npm run check`（lint + tsc + jest）全绿才算完成。引擎和数据层的测试覆盖率 ≥ 85%（行）。
5. **不改需求、不加功能**。需求不清楚时：在 `docs/dev/QUESTIONS.md` 追加一条（编号 Q-n、问题、你采用的默认做法），代码里写 `// TODO(Q-n)`，按默认做法继续，不要停下来等。
6. **不加清单外的依赖**。[01 §2](01-architecture.md) 之外的 npm 包 / Gradle 依赖，要在 `QUESTIONS.md` 说明理由后再加。
7. **密钥不落地**。MinerU Token 和 AI Key 只进 Android Keystore（react-native-keychain），不进数据库、日志、导出、备份、崩溃信息。所有日志经过 `redact()`。
8. **文案**：中文、直白、不用营销腔；与原型一致的地方逐字照抄原型。
9. **提交**：一个任务一个或几个小提交，Conventional Commits（`feat(study): …`），提交信息写清做了什么、怎么验证的。
10. **从 AShareSim 复制代码时**（`~/Desktop/Personal/AShareSim`，同一负责人，GPL-3.0）：保留文件头注释并注明来源，删掉股票相关的部分，测试一起复制。

## 4. 术语

| 词 | 含义 |
| --- | --- |
| 内容块 Block | MinerU 输出的一块内容（标题 / 段落 / 公式 / 图 / 表…），带页码和位置框。对外 ID 写作 `b<seq>`，seq 是全书顺序号 |
| 小节 Section | 地图上的节点：章（level 1）/ 节（2）/ 小节（3）。叶子小节是学习单位 |
| 段 Part | 太长的叶子小节切成的若干段（每段 1500–3000 字） |
| 步 Step | 一段讲解的路线图里的一步（2–5 步），绑定一段连续的内容块 |
| 主线 / 岔路 | 主线 = 当前在学的小节；岔路 = 临时去别的小节答问题，最多 2 层 |
| 听讲 / 读书 | 同一小节的两种学法（AI 为主 / 书为主），共用主线进度 |
| 讲解模型 / 整理模型 | 用户分别配置的两个模型：讲解、岔路、解释用前者；路线图、摘要、闪卡、回顾、翻译用后者 |
| 皮肤 Skin | 一整套视觉实现：Token + 组件实现（+ 极少数页面插槽）。V1 两套：`paper`（默认）和 `glass`（苹果风） |
| ViewModel（VM） | `useXxxVM()` 钩子，返回 `{ state, intents }`，页面只依赖它 |
