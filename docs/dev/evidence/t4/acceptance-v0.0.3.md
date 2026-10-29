# v0.0.3 剩余验收续验

2026-10-29。接续 [v0.0.3 修复记录](review-v0.0.3.md)，应用基线为 `main / c9ea9301ce9febbb20a14f517f11d954c2502774 / v0.0.3`。本轮指定项目已完成下列检查，**验收尚未全部通过**：Apple 部分页面仍有整屏灰蒙，TalkBack 语音未听验，新增闪卡未完成原生回读。

使用 Pixel_10_Pro / Android 17 arm64 模拟器，1280×2856px、density 480，即 3px/dp。原生操作使用 `createDemoContainer` 内存隔离 Demo；真实导入、学习和备份恢复复用已有通过证据。新截图、UI 树、录音及日志见 [证据索引](v0.0.3-acceptance/README.md)。

## 云端 CI：通过

[CI 40834556345](https://github.com/MathildaStacy/Pagewise/actions/runs/40834556345) 的 `headSha` 与上述基线完全一致，Quality 和 Android build 均为 success。Quality 于 07:19:37Z 完成，Android build 于 07:24:14Z 完成。

- Jest：79 suites passed、1 skipped，80 total；1197 tests passed、2 skipped，1199 total。
- 15 snapshots passed；lint、TypeScript 和 Android debug APK 构建均通过。
- [CI 原始结果](v0.0.3-acceptance/ci.json)、[测试计数](v0.0.3-acceptance/ci-quality-summary.txt)。此 CI 不覆盖本轮尚未提交的笔记页修复；补丁本地验证列于下文。

## Apple 图片与菜单：指定检查通过

| 检查 | 原生结果 | 证据 |
| --- | --- | --- |
| 菜单视觉 / 触控高度 | 浅色按钮目标 y=1266–1410，144px=48dp；材质背景 y=1278–1398，120px=40dp。深色同为 48dp / 40dp | [浅色](v0.0.3-acceptance/native/apple-light-menu-font1.png)、[深色](v0.0.3-acceptance/native/apple-dark-menu-reopen.png) |
| 视觉背景外的触控区域 | 点击 x=120、y=1268，处于背景外、目标内，成功打开解释 | [外缘点击](v0.0.3-acceptance/native/apple-light-menu-outer-hit.png) |
| 系统字号 2.0 | 六项保持单行；横向滑动可到达完整“笔记”并打开对话框。测得目标仍为 48dp、背景 40dp | [起点](v0.0.3-acceptance/native/apple-light-menu-font2-start.png)、[终点](v0.0.3-acceptance/native/apple-light-menu-font2-end.png)、[打开笔记](v0.0.3-acceptance/native/apple-light-note-dialog-font2.png) |
| f318 图片比例 | 源图 960×450；浅深色均显示 1064×499px，符合比例取整 | [浅色](v0.0.3-acceptance/native/apple-light-reader-final.png)、[深色稳定画面](v0.0.3-acceptance/native/apple-dark-reader-reopen.png) |
| f310 不同比例 | 源图 960×360；显示 1064×399px | [另一张图片](v0.0.3-acceptance/native/apple-light-f310-reader.png) |
| 透明背景 | 两张 PNG 的 alpha 范围均为 0–255；上述稳定画面中透明部分露出白色 / `#1C1C1E` 纸面，没有额外边框或不透明图片底板 | [原生尺寸与 alpha 数据](v0.0.3-acceptance/native-measurements.json) |

封面、复习卡大字号和 Paper 菜单复用 [v0.0.3-fixes](v0.0.3-fixes/) 已通过记录。图片容器通过不代表下述整屏灰蒙问题已解决。

## 四主题逐页核对：已执行，Apple 存在未通过项

复用 [final](final/README.md) 的四主题各 11 张主页面 / 地图布局证据；旧关于页不用于确认版本，本轮四主题关于页均显示 0.0.3。另补齐每个主题 25 个详情页、浮层和流程状态，共 100 张；连同专项与复现画面，本目录保留 135 张原生截图。

| 本轮页面 / 状态 | Paper 浅色 / 深色 | Apple 浅色 / 深色 |
| --- | --- | --- |
| 导入浮层、解析设置顶部 / 底部、确认、地图、小节浮层、解析进度 | 已核对，无新增明确问题 | 已核对；首次打开地图部分画面发灰，重开深色地图恢复正常，见 N2 |
| 书籍笔记、小节详情、导出选项 | 已核对，无新增明确问题 | 已核对；学习入口的小节笔记发白已按 N1 修复复验 |
| 复习概览、闪卡正面 / 答案 | 已核对，无新增明确问题 | 已核对，无新增明确问题 |
| 听讲、上下文、路线图、重排阅读、段落菜单、笔记对话框、伴读菜单、小结 | 已核对，无新增明确问题 | 已核对；部分听讲 / Reader 整屏灰蒙仍可复现，N2 未通过 |
| 添加 AI 服务、解析服务、关于 | 已核对，无新增明确问题 | 已核对，无新增明确问题 |

Apple 浅色的 25 场景先在基线上采集，随后追加修复后笔记、编辑和保存截图；其余三主题的这批场景在补丁后采集。完整命名和失败画面的标记见 [manifest.json](v0.0.3-acceptance/manifest.json)，各主题接触图见 [索引](v0.0.3-acceptance/README.md)。逐页核对包含发现的失败，不作为四主题全部通过的声明。

## TalkBack 与流程

| 流程 | 结果及实际范围 | 证据 |
| --- | --- | --- |
| TalkBack 交互 | 17.0.0.889642762 保持绑定；Tab / Enter 从书架打开书，探索 / 双击继续听讲、聚焦提问框、输入中文问题、发送进入 3.4.2 岔路、双击返回 3.5.2 主线。返回后岔路折叠为 3 条记录 | [交互记录](v0.0.3-acceptance/talkback-result.json)、[返回主线](v0.0.3-acceptance/native/talkback-return-main.png) |
| TalkBack 语音 | 已录到非静音音频；当前代理环境不支持音频听验，发音和播报顺序仍待人工核对 | [开书](v0.0.3-acceptance/speech/talkback-open.m4a)、[听讲](v0.0.3-acceptance/speech/talkback-listen.wav)、[提问](v0.0.3-acceptance/speech/talkback-question.wav) |
| 导入 | 四主题 Demo 的 PDF 设置→确认→已有书地图通过；Demo 明示不会重复导入。真实 PDF 827 页导入、断网 / 进程恢复和 EPUB 导入复用既有通过证据 | [T8 全书导入](../t8/full-import.json)、[EPUB](../t11/native-storage-epub-with-images.json) |
| 阅读 / 听讲 | 两模式切换、段落菜单、上下文 / 路线图、提问岔路及回主线实际操作通过；显示上的 N2 单独保留。真实书三个小节的生产会话复用既有记录 | [三节真实学习](../t7/native-real-study.json)、[本轮流程](v0.0.3-acceptance/flows.json) |
| 笔记 | 3.4.2 写入 `Acceptance_v003_f=g+h`，返回后重开内容一致；“原文”回到同一节 3.4.2 | [重开笔记](v0.0.3-acceptance/native/apple-light-note-reopened-after-fix.png)、[来源](v0.0.3-acceptance/native/apple-light-note-source-after-fix.png) |
| 小结保存 | 编辑闪卡草稿后保存本节，页面进入 3.5.3、第 1/2 步；书架显示已学 25/35 节。新增卡片的再次打开未完成，不能据此宣称原生回读通过 | [草稿修改](v0.0.3-acceptance/native/apple-light-card-edit-saved.png)、[下一节](v0.0.3-acceptance/native/apple-light-section-saved-next.png)、[书架](v0.0.3-acceptance/native/apple-light-shelf-progress-saved.png) |
| 复习 | 原生完成 8 张卡，实际操作三种评分；结果为记得 6、模糊 1、忘了 1，完成页提示忘了的加入卡点清单 | [完成页](v0.0.3-acceptance/native/apple-light-review-complete.png)、[逐卡记录](v0.0.3-acceptance/review-flow.json) |
| 备份 / 恢复 | 复用完整卸载恢复和 release 正式入口恢复：13 表逐行一致、2 个原件及 552 张图片哈希匹配。隔离 Demo 没有设备 StorageIO，本轮未在真实书库重复恢复 | [卸载恢复](../t11/native-uninstall-restore.json)、[release 恢复](../t11/native-release-restore.json)、[归档检查](../t11/native-export-inspection.json) |

TalkBack 期间使用保留无障碍服务的独立原生探针，未用会抑制 TalkBack 的常规 UIAutomator；[记录](v0.0.3-acceptance/talkback-result.json) 区分了交互与语音听验。

## 发现的问题与最小修复

**N1：学习页推入本节笔记后发白 / 空白，已修复并复验。** 同一路径重开两次、等待后仍可复现，无障碍树中内容存在。[修复前](v0.0.3-acceptance/native/apple-light-current-note-detail.png)、[等待后的空白画面](v0.0.3-acceptance/native/apple-light-current-note-stable-late.png)。

仅在 `StudyScreen` 失去导航焦点时关闭其子树的原生 blur，保留 VM、会话和页面实例。修复后浅深色笔记可读，返回听讲保持 3.5.2、第 2/4 步；随后编辑、重开笔记通过。[浅色复验](v0.0.3-acceptance/native/apple-light-note-reopened-after-fix.png)、[深色复验](v0.0.3-acceptance/native/apple-dark-note-focus-fix-final.png)。新增回归验证失焦期间无 blur、输入草稿不丢、主线不变且会话只打开一次。

补丁本地验证：修改文件 ESLint、全项目 TypeScript、4 个相关套件 / 42 tests、arm64 release 构建通过。release 在恢复原始 `index.js` 后构建。见 [验证记录](v0.0.3-acceptance/validation.json) 及其日志。

**N2：Apple 部分原生页面整屏灰蒙，未通过。** 地图首次打开时有发灰画面，重开地图恢复；深色听讲和 Reader 在重开、等待后仍出现整屏灰色覆盖，颜色不符合设计 Token。[正常重开的地图](v0.0.3-acceptance/native/apple-dark-map-reopen-final.png)、[仍发灰的听讲](v0.0.3-acceptance/native/apple-dark-listen-reopen-final.png)、[仍发灰的 Reader](v0.0.3-acceptance/native/apple-dark-reader-reopen-final.png)。N1 的改动没有解决此现象；根因尚未确认，本轮没有扩展为全局模糊库或主题改造。

## 未完成项与收尾

1. N2 对应 Apple 页面颜色验收未通过。
2. TalkBack 录音的人工听验未完成。
3. 新增闪卡保存后的原生再次打开未完成：补充读取时原生探针未取得活动窗口根节点；本轮只确认编辑保存反馈和下一节 / 书架进度，事务与卡片持久化有相关自动回归。

临时 Demo 入口已恢复，独立探针包和设备临时文件已移除，本轮启动的 Metro 已停止；字号恢复 1.0，无障碍服务恢复为原始空值 / 关闭。设备已安装包含 N1 修复的正式入口 release 0.0.3（versionCode 3、非 debuggable），没有清空 App 数据。见 [清理回执](v0.0.3-acceptance/cleanup.json)。

本轮没有写入设计文件。期间另一项设计工作将 HEAD 推进至 `2424c7f`，与基线的提交差异仅为 Win11 设计文档；该提交及现有未提交设计内容均保留。本轮产品改动仅为 N1 的源码和相应测试；未创建提交、PR 或新 tag。
