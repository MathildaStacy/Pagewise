# AI 文档精修：设计继承与文档检查

检查日期：2026-10-30。项目：`/Users/boren.fang/.codex/worktrees/ai-document-refinement/Pagewise`。发布基线：v0.0.8，`4d1a462`（检查时 HEAD）。

**结论：普通界面扩展的设计文档要求已满足。** 最终实现继承现有 Android Operate / Read 界面、五套皮肤、组件契约和 token 角色；本次检查未发现新增或改写持久设计系统的变更。本文仅记录对照结果，不建立新的视觉规范。

## 范围与依据

本次是当前小节的可选 AI 精修：先预览、逐项选择、采纳，再允许撤销；解析原文和原版 PDF 保留。原页复核明确说明会把本节对应的 PDF 页面发送给所选 AI。方向约束为继承现有皮肤、kit 控件和语义 token，通过可读的对照和明确状态完成操作，不引入新的视觉身份、依赖或服务端。

已读取 `PRODUCT.md`、`docs/dev/ai-refinement.md`、本目录 `README.md`，以及 Impeccable 的 `reference/document.md`、`reference/new-work.md` 完成段、`reference/craft-floor.md`、`reference/android.md`。本次遵循 new-work 对普通扩展的要求：对照既有系统、保留其文件、记录检查证据；已有漂移仅报告。

## 源码与既有系统对照

| 已检查位置 | 最终实现与既有系统的关系 |
| --- | --- |
| `src/ui/screens/RefinementSheet.tsx:1–17,44–179,182–231` | 复用 `Sheet`、`Button`、`CheckRow`、`Segmented`、`Note`、`ProgressBar` 与既有 `SettingsSelect`。范围、模式、模型、进度、疑点、停止 / 继续 / 采纳 / 撤销均在同一可关闭的面板内；PDF 页面发送说明位于原页复核模式中。 |
| `src/ui/screens/RefinementSheet.tsx:236–292` | 对照内容按文本、公式、表格分别展示；公式使用既有 `MathView`，表格使用可横向滚动的单元格。文本、间距和分隔线来自 `t.type.body / label / bookBody`、`t.space`、`t.color.ink / ink2 / line`；没有新增色板、字体、材质或动画系统。表格的 170 宽单元格沿用 Reader 的既有尺寸。 |
| `src/ui/screens/ReaderView.tsx:94–118,751–772,1125–1132,1319–1325,1399–1410` | 「精修本节」与既有对话、翻译工具并列，工具条可换行；采纳内容显示可操作的「AI 精修」来源标记。标题修订使用现有 `title / bookBody / paperInk` 角色。既有代码、表格及原版 / 重排阅读界面继续使用原控件。 |
| `src/ui/screens/StudyView.tsx:174–187,326`；`src/features/study/useStudyVM.ts:923–931,972–984` | Study 的读书工具条及菜单接入同一精修流程；查看疑点原文关闭面板并沿用已有定位入口。未建立独立导航或另一套阅读布局。 |
| `src/features/study/useRefinementVM.ts:52–63,68–109,129–171,200–215` | 同一 run 重开面板保留本地选择；切换范围、载入不同 run 或生成结果时初始化选择。采纳和撤销仍为显式动作，前后内容通过同一类型化 presenter 提供。 |
| `src/features/study/presenters.ts:479–500`；`src/features/study/types.ts:328–364` | 文本 / 公式 / 表格使用判别类型；表格复用已有 `tableRows`，避免把 HTML 或 LaTeX 字符串作为唯一核对界面。 |
| `src/ui/skins/index.ts`、`src/ui/skins/paper/tokens.ts`、`src/ui/kit/tokens.ts` | 五套既有皮肤仍由同一注册和 token 契约提供。截图中的纸感浅色白面板、深色炭黑面板、蓝色操作及衬线阅读正文与现有纸感 token 一致。 |
| `src/ui/kit/base/overlays.tsx:303–405`、`src/ui/kit/base/controls.tsx:1219–1259`、`src/ui/kit/base/content.tsx:261–310` | 新界面继承已有 Sheet 的 Android Back、系统边距、键盘避让与减少动态效果处理；选择项继承 checkbox 语义，公式继承现有渲染器和系统字体缩放处理。没有复制一套基础控件。 |
| `__tests__/features/refinement.test.tsx:72–83,195–286` | 已有本次回归覆盖同 run 保留选择 / 新 run 重置、类型化公式与表格对照，以及五套皮肤深浅色下的面板操作与保存状态。文档检查未修改或重跑测试。 |

## 原生视觉证据

以下八张文件均实际打开检查，尺寸均为 1280 × 2856。捕获来源按 [验收记录](README.md) 为任务专属 Pixel 10 Pro 模拟器、Android API 37.2，约 426 dp 宽；不是浏览器模拟图。MinerU CLI 在本会话不可用，现有 PNG 使用本地图像查看工具直接检查。

| 文件 | 本次看到的证据 |
| --- | --- |
| [phone-comparison-light.png](phone-comparison-light.png) | 浅色结构建议以「解析原文 / 精修建议」分组，保留断词对照、疑点定位和「采纳 2 处修改」操作；界面为正常滚动位置。 |
| [phone-vision-formula-light.png](phone-vision-formula-light.png) | 浅色对照显示渲染后的 `x = O` / `x = 0` 与 Item / Count 单元格，公式和表格可直接阅读。 |
| [phone-reader-light.png](phone-reader-light.png) | 采纳后显示「AI 精修」、合并后的段落、修正公式和表格；原版 / 重排切换、对话、翻译和代码操作仍在。 |
| [phone-undone-light.png](phone-undone-light.png) | 撤销后恢复断词和原公式；既有语法高亮、复制和全屏代码阅读控件仍在。 |
| [phone-dark-large.png](phone-dark-large.png) | 深色、系统字号 1.3；小节范围、PDF 页面发送说明、模型、推理强度、状态和批次进度可读。 |
| [phone-vision-formula-dark-large.png](phone-vision-formula-dark-large.png) | 深色、字号 1.3 的公式与表格对照使用现有正文和分隔线角色；表格建议未勾选，疑点入口可见。 |
| [phone-dark-actions.png](phone-dark-actions.png) | 原文核对返回后的表格仍未勾选，底部操作为「采纳 3 处修改」；大字号下操作完整可见。 |
| [phone-original-dark-large.png](phone-original-dark-large.png) | 原版 PDF 页面保留其自身白纸内容；外围沿用既有深色阅读工具与定位界面，原页独立于解析和精修投影。 |

设备视觉证据覆盖纸感浅色 1.0 与深色 1.3；其余四套皮肤的证据为 renderer 交互检查。原生流程使用本地合成 PDF、明确标记的本机验收服务和模拟 AI 返回，支持交互、渲染、请求与结果保存链路的结论；尚未评价真实在线模型的识别准确率或实体设备手势。

本次为原生界面，未运行 HTML / CSS detector。

## 保留的持久文件与已有漂移

- `PRODUCT.md` 完整保留，SHA-256 为 `3e7c9738cc3ea59c848e91cc31960ed9c6d82217b67e9954fe0f4332bb22f1fa`。第 11 行仍写「计划 React Native 0.87」及「现阶段只有 … 单文件 HTML 原型」，而仓库已有可运行的 React Native Android 实现。这是本次之前的产品文档漂移，未修复。
- 根 `DESIGN.md`、`.impeccable/config.json` 和 `.impeccable/design.json` 均不存在；保持原状。本次没有获批的设计系统变更，普通扩展无需在完成阶段新建一套设计系统。
- 现有 `.impeccable/decision-payload.json`、`mocks/decision/`、`refs/`，全部 `docs/design/` 文档 / 原型 / 品牌资产，以及 `src/ui/skins/`、`src/ui/kit/` 均保留。历史决策资料没有被提升为本功能的新视觉方向。
- 对 `4d1a462` 执行 `git diff --name-only`，检查 `PRODUCT.md`、`DESIGN.md`、`.impeccable/`、`docs/design/`、`src/ui/skins/`、`src/ui/kit/`、`package.json` 和 `package-lock.json`，没有这些既有已跟踪文件的差异。新增 review 证据不属于持久设计系统变更；依赖清单和锁文件未变。

## 完成状态

[独立完整复核](finish-review.md) 的初始处置为 `fix`，指出选择在原文核对后重置，以及公式 / 表格对照只显示源码两项问题。[同一复核者的修复裁定](finish-verdict.md) 将两项均评为 resolved，`remaining: clear`，处置为 `ship`；该裁定范围仅为这两项已评分修复，不扩写为另一次全界面认证。

按 [验收记录](README.md)，最终 `npm run check` 通过 103 个套件、1972 项测试、15 个快照，保留 1 个套件 / 2 项既有跳过；Android Debug 构建通过。复核修复后没有后续 UI 编辑。本轮唯一写入文件为本文，普通扩展所需的继承对照、证据记录与漂移报告均已完成；后续若再修改 UI，应重新检查相应结论。
