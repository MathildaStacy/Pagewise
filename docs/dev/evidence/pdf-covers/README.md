# PDF 封面验收（2026-10-31）

基于 `main` 的 `814430e`（v0.0.10），在 `codex/feature-pdf-cover` 中完成封面修复及发布验证。

## Standards

按 `code-review` skill 的 Standards 轴审查：没有文档规范违规。发现一项非阻塞命名建议：`withPageLabels` 已同时派生封面，现已重命名为 `withBookPresentation`。分层、原生 IO 注入、展示投影和皮肤共用图片组件符合现有架构。

## Spec

按独立 Spec 轴审查：没有可执行缺陷或无关扩展。对照用户「解决解析 PDF 后书的封面展示不出来」的要求，以及 `06-import-parse.md` 的封面行为：使用物理第一页、持久保存、旧书自动补齐、不重新上传或解析；所有封面展示位置接入可选图片 URI；文件缺失或图片失败保留占位。

审查结果：Standards 0 项未解决问题（1 项命名建议已修正）；Spec 0 项问题。

## 自动检查

版本更新为 0.0.11 后，`npm run check` 通过：ESLint、TypeScript、104 个测试套件、2,004 项测试和 15 个快照。保留 1 个套件 / 2 项依赖未提供私有 MinerU fixture 的既有跳过。

新增回归覆盖新导入、已有已解析 PDF 自动补封面、多个页面并发只渲染一次、URL 解码后的原生文件复制、缺失原文件、渲染失败后重试、页面缓存与原文件删除后复用已保存封面，以及五套皮肤深浅色下的图片显示、加载失败和切换书籍。

## 原生验证

任务专属的只读 Pixel 10 Pro 模拟器，使用 [自写两页 PDF](../../../../fixtures/pdf-synthetic/cover.pdf)。第一页为蓝底封面，第二页为红底；验收记录的优先解析页为 2，书籍在升级前已是 `ready`。

- Android arm64 `:app:assembleDebug :app:assembleRelease -PreactNativeArchitectures=arm64-v8a` 同次构建通过（5 分 11 秒，989 tasks）。Release 包含 Hermes bundle，不依赖 Metro。
- 在原生 v0.0.10 Release 中复现已就绪 PDF 仍为文字占位；使用 `adb install -r` 升级 v0.0.11 Release，自动显示蓝底第一页封面。没有重建书籍或触发重新解析。
- 升级前后的 4 本书、5 条章节对话、96 条消息、16 张卡片，以及所有已存在的章节、学习状态和笔记表的整表校验值一致。数据库完整性检查为 `ok`，见 [升级校验](native-upgrade.json)。
- 原生生成的 `cover.png` 为 360 × 500 px；背景像素为第一页的蓝色，而非第二页红色。封面保存到书籍目录；删除 `cache/pages` 后，离线启动仍显示封面。缺失源文件的对照书保留文字占位。
- 原生检查覆盖纸感浅色 1.0 与 Win11 深色 1.3 字号；当前 Release 应用进程的 ReactNativeJS / AndroidRuntime 错误为 0。临时 Debug 安装仅用于停机读取数据校验值和设置测试外观，没有启动其 JS；最终截图和显示检查均来自 Release。

以下图片裁切自原生截图，仅保留两本自写验收书的区域，未修改界面内容。

| 图片 | 场景 |
| --- | --- |
| [升级前](before-v0.0.10.png) | v0.0.10，PDF 已就绪但仍为文字占位 |
| [纸感浅色](paper-light.png) | v0.0.11 自动补封面，缺失源文件的对照书保留占位 |
| [Win11 深色大字号](win11-dark-large.png) | 清除页面缓存后，1.3 字号下仍显示已保存封面 |

## 发布文件

- 安装包：`Pagewise-v0.0.11-android-arm64.apk`，46,198,228 bytes，最低 Android 7.0（API 24），versionCode 11。
- 包名、arm64 架构、内嵌 Hermes bundle 和 APK 签名校验通过。沿用既有 Android Preview 签名，证书 SHA-256 与 v0.0.10 相同，见 [安装包校验](package-verification.json)。
- APK SHA-256：`86a34900992af5d110a334d0839dca48dd5adcd53cbfdda105a34ffb4c28d366`。发布附带 `SHA256SUMS`，保持 prerelease。
