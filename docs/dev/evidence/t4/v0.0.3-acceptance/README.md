# v0.0.3 续验证据索引

结论见 [续验报告](../acceptance-v0.0.3.md)。135 张原生截图、128 份 XML UI 树、6 份 TalkBack JSON 树及 12 张接触图；截图文件名表示实际采集场景，失败画面同样保留。

## 四主题页面

| 主题 | 导入 / 地图 / 笔记（10 个场景） | 学习 / 阅读 / 浮层（9 个场景） | 复习 / 设置（6 个场景） |
| --- | --- | --- | --- |
| Paper 浅色 | [接触图](contacts/paper-light-library-contact.png) | [接触图](contacts/paper-light-study-contact.png) | [接触图](contacts/paper-light-other-contact.png) |
| Paper 深色 | [接触图](contacts/paper-dark-library-contact.png) | [接触图](contacts/paper-dark-study-contact.png) | [接触图](contacts/paper-dark-other-contact.png) |
| Apple 浅色 | [接触图](contacts/apple-light-library-contact.png) | [接触图，含 N1 修复前画面](contacts/apple-light-study-contact.png) | [接触图](contacts/apple-light-other-contact.png) |
| Apple 深色 | [接触图](contacts/apple-dark-library-contact.png) | [接触图，含 N2 失败画面](contacts/apple-dark-study-contact.png) | [接触图](contacts/apple-dark-other-contact.png) |

原始全尺寸 PNG 和同名 XML 位于 [native](native/)。场景名称及失败 / 修复后补充画面的标记见 [manifest.json](manifest.json)。旧主页面 44 张复用 [final](../final/README.md)；旧 Apple 文件前缀为 `glass`，本轮为 `apple`。

场景清单：

- `library`：import-sheet、import-settings、import-settings-bottom、import-confirm、map-final、section-sheet、parse-progress、notes-book、note-detail、notes-export。
- `study`：listen-final、context-sheet、roadmap-sheet、reader-final、paragraph-menu、note-dialog、study-menu、current-note-detail、section-done。
- `other`：review-final、card-front、card-answer、ai-edit、mineru-final、about-final。

## 专项与流程

- 图片尺寸、alpha 与菜单测量：[native-measurements.json](native-measurements.json)。2 倍字号起点 / 终点和外缘触控在 `native/apple-light-menu-*`；另一种图片比例为 `native/apple-light-f310-reader.*`。
- N1 修复前：`apple-light-current-note-detail`、`apple-light-current-note-stable-*`。修复后：`apple-light-note-reopened-after-fix`、`apple-dark-note-focus-fix-final`。`current-note-focus-fix-1/2` 仍有开发警告条，只用于复现对照。
- N2 未通过：`apple-dark-listen-reopen-final`、`apple-dark-reader-reopen-final`。`apple-dark-map-reopen-final` 为重开后恢复正常的地图。
- TalkBack：[交互结果](talkback-result.json)，六步截图与 JSON 树位于 `native/talkback-*`。[开书录音](speech/talkback-open.m4a)、[听讲录音](speech/talkback-listen.wav)、[提问录音](speech/talkback-question.wav) 已采集，未做语音听验。
- [流程结果](flows.json)、[复习逐卡评分](review-flow.json)。小结保存、下一节及书架进度见 `native/apple-light-section-*`、`native/apple-light-shelf-progress-saved.*`；新增卡片原生回读尚未完成。

## 验证与清理

- 云端：[原始 CI](ci.json)、[Jest 计数](ci-quality-summary.txt)。对应 c9ea930；79 suites passed / 1 skipped，1197 tests passed / 2 skipped，15 snapshots passed。
- 本地补丁：[验证结果](validation.json)、[学习回归 18 tests](focus-fix-test.txt)、[其余相关回归 24 tests](focus-fix-related-tests.txt)、[ESLint](focus-fix-lint.txt)、[TypeScript](focus-fix-typecheck.txt)、[arm64 release 构建](focus-fix-release-build.txt)。ESLint 成功无输出，日志为空文件。
- [环境恢复回执](cleanup.json)、[观察到的外部设计修改](design-observed-external-changes.json)。后者用于保留并行设计工作，不是本轮改动清单。
