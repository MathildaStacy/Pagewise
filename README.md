# Pagewise · 带着整本书的 AI 伴读

在 Android 手机上一节一节读懂一本技术书的 App（先做 Android，iOS 后补）。
用 [MinerU](https://github.com/opendatalab/MinerU) 把 PDF 解析成带页码和位置的内容块，切出"章 → 节 → 小节"的地图；AI 拿着当前小节的完整原文给你讲：先讲直觉，再讲公式，举例、提问，懂了再讲下一节。

- **不懂就问**：回答里的说法都带页码，点一下跳回原文对应段落。
- **能回头**：讲 A\* 时问"这跟前面的一致代价搜索有什么关系"，AI 会自己翻回 3.4.2 的原文来答，答完回到主线。
- **接得上**：每节学完留下摘要、卡点和闪卡；隔几天打开，AI 知道上次讲到哪、你在哪卡过。

## 当前状态

已进入开发（2026-10-29）：T1 基础件、T2 双皮肤组件库与 T3 数据层及演示书库已实现。SQLite 保存书籍、学习记录、外观和 AI 配置，Demo 使用独立内存库；T4 导航与外围页面正在开发。实施顺序和验收见 [开发计划](docs/dev/07-plan.md)。

| 文档 | 内容 |
| --- | --- |
| [docs/PRODUCT_DESIGN.md](docs/PRODUCT_DESIGN.md) | 产品目标、核心场景、信息架构、功能清单、技术方案、里程碑、待决定的问题 |
| [docs/STUDY_ENGINE.md](docs/STUDY_ENGINE.md) | 伴读引擎规格：数据模型、解析流水线、地图构建、讲解协议、上下文组装、工具、岔路状态机、引用校验、复习调度 |
| [docs/design/prototype.html](docs/design/prototype.html) | 可交互原型，用浏览器直接打开（源文件在 [docs/design/prototype/](docs/design/prototype/)） |
| [docs/dev/](docs/dev/README.md) | Android 实现规格：架构分层、换肤系统（纸感 / 苹果风）、页面与 ViewModel 契约、数据表、引擎与 AI、导入解析、任务拆分与验收 |

在线看原型：<https://htmlpreview.github.io/?https://github.com/MathildaStacy/Pagewise/blob/main/docs/design/prototype.html>

## 本地开发

使用 `.nvmrc` 指定的 Node 24.22.0、JDK 17+ 和 Android SDK（API 37、Build Tools 37.0.0、NDK 27.1.12297006）。V1 仅搭建 Android 工程。

```sh
nvm use
npm ci
npm run check
```

配置 `ANDROID_HOME`、`JAVA_HOME`，把 Android SDK 的 `platform-tools` 加进 `PATH`。macOS 可以使用 Android Studio 自带的 JDK：

```sh
export ANDROID_HOME="$HOME/Library/Android/sdk"
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
```

启动模拟器后，在两个终端分别运行：

```sh
npm start
npm run android
```

`npm run android:build` 构建 debug APK，输出在 `android/app/build/outputs/apk/debug/app-debug.apk`（调试运行需连接 Metro）。CI 会在 PR 和 main 推送时运行质量检查、构建并保存 APK。

## 技术栈

沿用 AShareSim 的组合：React Native 0.87 + TypeScript、zustand、op-sqlite（内容块、地图、学习记录、FTS5 全文搜索）、react-native-keychain（MinerU Token 和 AI Key）。
本地优先，没有后端：PDF 用你自己的 Token 调 MinerU 官方精准解析 API，EPUB 在本机解析；AI 直接用你自己的 Base URL + API Key，支持 OpenAI Responses 和 Anthropic Messages 两种协议。

## 说明

Pagewise 只用来学习你自己拥有的书。PDF 会在你确认后上传到 MinerU 解析，讲解时当前小节的原文会发给你配置的 AI 服务。
原型里的书名和章节目录来自《人工智能：现代方法（第4版）》；页码、"原文"、讲解和闪卡都是为原型写的示意内容，不是原书文字。

## License

GPL-3.0-only
