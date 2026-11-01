# 阅读体验首批改进与验收 · 2026-11-02

基于 [PM 与 UI 审查](../../.impeccable/critique/2026-11-01T15-39-26Z__src-app-tsx.md)，在 `codex/reading-experience` 实现首批改进。基线 `1d3a5a4`，此阶段基于 `0.0.14` 验收。本轮重点是导入后进入正文、目录可信度和阅读空间。

以下保留首批改进的历史验收记录。随后已按用户授权完成六本 PDF 全量云端解析、真实 AI 验证与追加修复，最终版本为 **v0.0.15**；最新结果和安装包以 [六本书验收](downloads-books-audit-20261102.md) 与 [v0.0.15 发布说明](releases/v0.0.15.md) 为准。

## 已实现

| 改动 | 用户现在得到的行为 |
| --- | --- |
| 学习路线与原书目录分开 | 默认跳过封面、版权、目录、索引、参考文献；前言和附录默认选读，习题与实质 Introduction 保留。完整目录始终可访问，小节可手动纳入或移出路线。 |
| 完成进度与自动下一节一致 | 书架进度、开始学习和自动下一节使用同一学习范围。调整范围不删除原文、笔记、对话或学习状态；覆盖设置随书保存。 |
| 章节编号检查 | 提示相邻编号缺口、重复编号，展开后可跳到相邻原文核对。疑问默认收起，使用警告图标，避免抢占目录空间或给出“已学”的错误无障碍说明。 |
| 修复显式换章 | “从这里开始讲”明确进入所选章节的伴读模式，并清除之前的原文临时目标；同时更新章节、位置和对话。 |
| EPUB 连续阅读 | 自动进入重排，即使旧记录存的是原版；隐藏无效原版选项，正文段落间不再插入重复的长位置标签。选段与引用定位仍使用原始块。 |
| 伴读界面减负 | 常驻两个快捷动作，其余进入“更多”；对话、模型和上下文入口集中到菜单。键盘弹出时收起步骤条和快捷动作，保留输入框。 |
| 可读、可点与一致性 | 五种皮肤统一“伴读 / 原文”的名称和顺序；讲解步骤统一用“步”，原书学习分段继续用“段”。纸感快捷操作点击高度至少 48dp。修正辅助文字和阅读位置标签的对比度。 |
| 闪卡评分 | 评分固定在底部，答案区域可滚动；编辑、暂停收进“管理卡片”，原文入口与撤回暂停能力保留。 |

PDF 书前页识别使用目录上下文：第 1 章之前、与书名一致的短标题页；或书名前言组下存在前言/版权/目录证据；或明确 Cover 书签所在页的短正文。没有把所有“第 1 章之前的内容”一律删除。`Copyrightpage` 等实际书签写法也纳入识别。规则识别不改变原书章节树，用户可覆盖。

## 真实书籍验证

| 样本 | 本轮验证方式 | 结果 |
| --- | --- | --- |
| Alice’s Adventures in Wonderland | 系统文件选择器选择真实 EPUB，手机本地解析；另有 ZIP/OPF/nav/XHTML 自动化回归 | 17 个有内容的原目录条目，默认 12 个正文学习小节；从第一章开始。手动纳入 Contents 后为 13，重启仍保留，移出后恢复 12。 |
| Artificial Intelligence: A Modern Approach | 复用已有 2,145 页、15,651 个真实解析块，以当前 `buildMap` 重建并装入独立验收库；原 PDF 在模拟器实际渲染 | 586 个有内容的叶子小节中，540 个进入默认路线，46 个选读/资料小节不计进度。起点为第 1 章导读，PDF 物理第 29 页。103 段 Bibliography 保留在完整目录。 |
| ML-Trading | 复用已有 827 页、8,859 个真实解析块，同样重建并验证手机目录 | 868 个有内容的叶子小节中，848 个进入默认路线，20 个不计进度。起点为第 1 章导读，PDF 物理第 42 页。14 段目录、19 段索引不再进入默认路线。 |

AIMA 检出 6 处编号疑问，包括 `20.3.1` 可能缺失和 `26.2` 重复。前者可直接打开 `20.3-intro` 对应的真实原页，后者保留“请核对原书是否也重复”的说明。其余提示是待核对候选，没有被当作已经证实的解析错误。ML 仍保留原来的 9 处标题标记。

手机复现“看 Alice 第一章原文 → 返回地图 → 第二章从这里开始讲”，标题和伴读目标均为第二章。未配置 AI 时显示配置恢复入口。本轮没有新调用付费模型，也没有重新上传 PDF 到 MinerU；伴读长回答与闪卡排版使用应用自带演示数据。

详细计数：[real-books-summary.json](evidence/reading-experience-20261102/real-books-summary.json)。

## UI 与发布构建验收

- Android `emulator-5590`，1280 × 2856，480dpi；系统字体 100% 和 130%。使用独立包 `com.pagewise.pminspect`，原应用书库与凭据未写入。
- 伴读默认字体下，内容视口由约 585dp 增至 674dp，约增加 15%。130% 字体且键盘展开时，由约 218dp 增至 408dp，约增加 87%。这是同一模拟器、对应界面状态下的测量，不是所有设备的统一增幅。
- 实测更多动作、模型设置、闪卡管理可达；闪卡原生文本警告已修复并复测消失。130% 字体时评分区域仍位于屏幕内。
- 纸感、苹果风、Meta、新谷歌、Win11 在 Release 包中完成换肤及同一学习章节的“原文 → 伴读 → 原文”；深色下真实 EPUB 正文可读，没有无效的原版切换项。
- 新增对比度回归覆盖五皮肤的深浅色：`ink3` 对 `surface/bg`、阅读位置标签对阅读背景均不低于 4.5:1。未声称所有历史配色组合均已满足 AA。
- 续学卡、外观预览和苹果风关于页的相关渐变改为现有 SVG 渐变组件；伴读列表关闭 Android 原生子视图裁剪。对应发布包路径本轮没有再观察到原生中断；这不是对所有设备的稳定性保证，也没有把此前两种不同异常宣称为同一根因。
- Release 安装后断开 Metro，验证打包代码可独立运行；测试窗口内未记录到 `com.pagewise.pminspect` 崩溃。

## 自动化结果与安装包

`npm run check`：ESLint、TypeScript、**113 个测试套件 / 2,081 个测试 / 15 个快照全部通过**。`git diff --check` 通过。

回归覆盖真实 Alice 的 12 章、AIMA 默认正文起点与编号问题、书前页书签变体、学习范围持久化/重建、自动跳过资料、显式换章、EPUB 旧原版状态，以及五皮肤控件与对比度。

Android `:app:assembleRelease` 成功，架构 `arm64-v8a`。验收时通过临时 Gradle init script 将 applicationId 覆盖为 `com.pagewise.pminspect`，使用仓库现有签名配置。未修改生产包名、版本或发布到外部。

- APK：`android/app/build/outputs/apk/release/app-release.apk`
- SHA-256：`026553b6edf5c0e56383f7c41768dcab4538852c4377998ae737cdb972d5aebb`
- 构建环境：Android Studio 自带 JBR；新增的 `.claude/` 忽略项防止隐藏 worktree 被 ESLint、Jest、Metro 重复扫描。

## 验收截图

| 内容 | 证据 |
| --- | --- |
| Alice 默认 12 章与连续正文 | [学习路线](evidence/reading-experience-20261102/alice-learning.png) · [连续正文](evidence/reading-experience-20261102/alice-flow.png) |
| 两本真实 PDF 默认正文路线 | [AIMA](evidence/reading-experience-20261102/aima-learning.png) · [ML-Trading](evidence/reading-experience-20261102/ml-learning.png) |
| 编号检查与原页核对 | [编号疑问](evidence/reading-experience-20261102/aima-structure-checks.png) · [PDF 原页](evidence/reading-experience-20261102/aima-source-check.png) |
| 阅读空间与评分 | [伴读](evidence/reading-experience-20261102/study-content-first.png) · [130% + 键盘](evidence/reading-experience-20261102/study-font130-keyboard.png) · [闪卡](evidence/reading-experience-20261102/review-fixed-ratings.png) |
| 五皮肤 Release 深色阅读 | [皮肤对照](evidence/reading-experience-20261102/release-skins.png) |

## 下一批范围

结构检查目前交付“发现疑问 → 对照原文”。完整的补标题、调整父章节、拆分/合并预览、撤销和按页重新解析，尚未作为一套结构编辑流程实现。PDF/图表缩放、学习时长估算与按主题选段、封面生成的进一步美化也未包含在本批。

下一批优先完善结构修正闭环，再做 PDF 图表缩放。继续保留真实书作为回归样本，避免只对人工构造的小目录验证。
