# 翻译与对话列表验收（2026-10-31）

本地 `main`，基于 `6046987`，保留 AI 原文精修功能。

翻译采用原文在上、中文在下的整段对照。原文默认显示短预览，可展开全文；译文使用真实网络流，新增文字从模糊渐显到清晰，已读文字保持稳定。模型选项收为一行，支持停止并保留当前译文、重新翻译、失败重试；仅完整译文进入缓存。减少动态效果设置沿用现有阅读组件。

首页和书架的最近对话按书籍分组，标题、章节与消息时间分层，默认显示少量条目，可展开全部。本节切换器独立提供新建入口，当前对话用轻色底与勾选标记。翻译和对话面板使用实色底，避免玻璃主题透出的原文干扰阅读。

`npm run check` 全部通过：105 个测试套件、1,992 项测试、15 个快照，包含 ESLint 和 TypeScript 检查。覆盖流式输出、JSON 分片与转义、取消、失败及截断时不缓存、关闭后忽略迟到响应、停止保留译文、对话展开及导航，以及五套皮肤的深浅色和 1.3 字号组件交互。Android arm64 Debug 与 Release 构建通过；最终 Release 在原生模拟器中重新安装验证。

截图来自任务专属的只读 Pixel 10 Pro 模拟器（1280 × 2856）。纸感浅色使用系统字号 1.0；苹果深色使用 1.3。原文、译文与对话标题为自写验收样本，翻译请求通过本机 SSE 服务返回，用于检查流式交互和排版。

| 截图 | 场景 |
| --- | --- |
| [预览](preview.png) | 两张原生截图等比缩放拼接，未改动界面内容 |
| [纸感翻译](paper-light-translation.png) | 上下对照、紧凑模型入口与译文渐显 |
| [纸感对话](paper-light-conversations.png) | 对话层级、当前标记与新建入口 |
| [深色大字号翻译](glass-dark-large-translation.png) | 实色阅读底、原文预览和中文正文 |
| [深色大字号对话](glass-dark-large-conversations.png) | 长标题、当前状态与独立操作 |

## v0.0.10 发布验证

- `package.json`、lockfile 和 Android versionName 统一为 `0.0.10`，versionCode 为 `10`。
- 版本更新后的 `npm run check` 通过：105 个套件、1,992 项测试、15 个快照；Android arm64 Debug 与 Release 同次构建通过。
- Release APK 的包名为 `com.pagewise`，最低 API 24，仅含 `arm64-v8a`。签名校验通过，证书 SHA-256 与已发布的 v0.0.9 相同，见 [安装包校验](package-verification.json)。
- 在任务专属只读模拟器中，先安装已发布且 SHA-256 匹配的 v0.0.9，再使用 `adb install -r` 升级为 v0.0.10，没有清空数据。两本书、五条对话的标题 / 章节 / 消息数、两本书的学习进度逐项一致。
- 关闭模拟器 Wi-Fi 和移动数据后，强制停止并重新启动 Release，书架正常加载，当前应用进程的 ReactNativeJS / AndroidRuntime 错误数为 0，见 [升级校验](native-upgrade.json)。
- 发布文件为 `Pagewise-v0.0.10-android-arm64.apk`（46,194,744 bytes），附 `SHA256SUMS`。
- APK SHA-256：`58418a85d4757aa6dbb3e186f2291d5cbeb0ef8bc7aa9bb26af9f0755f2d2317`。
