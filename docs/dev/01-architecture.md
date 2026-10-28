# 01 · 架构

## 1. 总体

- React Native 0.87 + TypeScript，新架构（Fabric + TurboModules，0.87 默认开启），Hermes。
- 本地优先，没有后端。只有三类网络请求：MinerU 官方 API、用户配置的 AI 服务、MinerU 结果包下载。
- 业务逻辑（引擎、用例、数据）全部是**与皮肤无关**的 TypeScript；UI 由「设计系统（kit）+ 皮肤（skins）+ 页面（screens）」组成，通过 ViewModel 拿数据。换皮肤 = 换 Token 和组件实现，业务代码一行不动。

```
┌──────────────────────── UI（随皮肤变化） ────────────────────────┐
│ ui/screens   纯展示页面：props = ViewModel 的 state + intents       │
│ ui/kit       设计系统 API：组件代理、Token 类型、主题 Provider        │
│ ui/skins     皮肤：paper（默认）、glass（苹果风）                   │
└───────────────────────────────▲──────────────────────────────────┘
                                │ 只通过 VM 契约（features/*/types.ts）
┌───────────────────────────────┴──────────────────────────────────┐
│ features/*   页面容器 + ViewModel 钩子 + presenter（格式化文案）     │
├──────────────────────────────────────────────────────────────────┤
│ app/         用例（use case）、会话编排（StudySession）、zustand 店铺 │
├──────────────┬───────────────┬───────────────┬───────────────────┤
│ core/        │ data/         │ services/     │ platform/          │
│ 纯 TS 领域与 │ SQLite 仓库   │ AI、MinerU、  │ 原生模块封装        │
│ 引擎，无 IO  │ 与迁移        │ EPUB、公式渲染│ （PDF、文件、分享） │
└──────────────┴───────────────┴───────────────┴───────────────────┘
```

## 2. 依赖清单

版本：与 AShareSim 一致的直接写死；其他取「与 RN 0.87.1 兼容的最新稳定版」，安装后把实际版本写回本表。

T0（2026-10-29）已安装 React Native 0.87.1、React 19.2.3、TypeScript 6.0.3、safe-area-context 5.11.0；其余运行时依赖按后续任务引入。精确依赖树固定在 `package-lock.json`，项目 `.npmrc` 使用公共 npm registry，避免本机镜像缺包影响 CI。

| T0 工具链 | 实际版本 |
| --- | --- |
| Node（`.nvmrc`） | 24.22.0 |
| React Native CLI / Android CLI | 20.2.0 |
| RN Babel / Metro / ESLint / Jest / TS 配置 | 0.87.1 |
| Jest / react-test-renderer | 29.7.0 / 19.2.3 |
| ESLint / Prettier | 8.57.1 / 2.8.8 |
| babel-plugin-module-resolver | 5.0.2 |
| eslint-plugin-import / eslint-import-resolver-typescript | 2.32.0 / 3.10.1（见 Q-8） |
| Gradle / AGP / Kotlin | 9.4.1 / 9.2.1 / 2.2.0 |
| Android compile / target / min SDK | 37 / 36 / 24 |
| Android Build Tools / NDK | 37.0.0 / 27.1.12297006 |

| 用途 | 包 | 说明 |
| --- | --- | --- |
| 框架 | `react-native@0.87.1`、`react@19.2.3`、`typescript@6.0.3` | 同 AShareSim |
| 导航 | `@react-navigation/native@^7`、`native-stack`、`bottom-tabs`、`react-native-screens`、`react-native-safe-area-context@5.11.0` | safe-area 已于 T0 安装，导航在 T4 引入 |
| 状态 | `zustand@^5` | 只做缓存和 UI 会话状态，真相在 SQLite |
| 数据库 | `@op-engineering/op-sqlite@^18` | `package.json` 里开启 `"op-sqlite": { "fts5": true }`；测试用 `node:sqlite` |
| 密钥 | `react-native-keychain@^10` | Token、Key |
| 图形 | `react-native-svg@^15` | 图标、公式 SVG、进度、封面 |
| 图标 | `lucide-react-native` | 默认图标集；皮肤可以换图标映射（[02 §4.4](02-skins.md)） |
| 手势动画 | `react-native-gesture-handler`、`react-native-reanimated@^4`（+ `react-native-worklets`） | 底部浮层、开关滑块、步骤动效 |
| 底部浮层 | `@gorhom/bottom-sheet@^5` | 只在 kit 的 `Sheet` 实现里用，页面不直接 import |
| 文件选择 | `@react-native-documents/picker` | `keepLocalCopy` 复制到 App 私有目录 |
| 上传下载 | `react-native-blob-util` | 大文件 PUT 上传（从文件流式读）、结果包下载到文件 |
| 解压 | `react-native-zip-archive` | MinerU 结果包、EPUB；导出时打 zip |
| WebView | `react-native-webview` | 只用于：公式渲染服务（隐藏 WebView）、HTML 表格查看浮层 |
| XML/HTML | `fast-xml-parser`、`htmlparser2` | EPUB 的 OPF / nav / XHTML |
| 毛玻璃 | `@react-native-community/blur` | 只在 glass 皮肤的 `Glass` 组件里用；设备不支持或省电模式时退回半透明填充 |
| ID | `ulid` | 书 ID 等 |
| 测试 | `jest@29.7.0`、`@react-native/jest-preset@0.87.1`、`react-test-renderer@19.2.3` | T0 已安装 |
| 原生（Gradle） | `com.tom-roush:pdfbox-android`（Apache-2.0） | PDF 书签目录、文字层判断、按页拆分；**渲染**用系统 `android.graphics.pdf.PdfRenderer` |

不用：Expo、Redux、styled-components / NativeWind（皮肤系统自己做，见 02）、任何 UI 组件库（Paper、Tamagui 等，会把视觉锁死）。

## 3. 分层与依赖规则

| 层 | 目录 | 能 import | 不能 import |
| --- | --- | --- | --- |
| 领域与引擎 | `src/core/**` | 只能 import `src/core/**` | 任何 RN、React、zustand、`data`、`services`、`platform` |
| 数据 | `src/data/**` | `core` | `app`、`features`、`ui`、`services` |
| 服务 | `src/services/**` | `core`、`platform`（类型和接口） | `app`、`features`、`ui`、`data` |
| 平台 | `src/platform/**` | RN、原生模块 | 业务层 |
| 应用 | `src/app/**` | `core`、`data`、`services`、`platform` | `features`、`ui` |
| 功能 | `src/features/**` | `app`、`core`（类型和 presenter 用的纯函数）、`ui/kit`、`ui/screens` | `data`、`services`、`platform` 直接调用 |
| 页面 | `src/ui/screens/**` | `ui/kit`、`features/*/types.ts`（只 import type） | 其余一切 |
| 设计系统 | `src/ui/kit/**`、`src/ui/skins/**` | RN、svg、手势动画、blur、bottom-sheet | 业务层 |

用 `eslint-plugin-import` 的 `import/no-restricted-paths` 写成 zones（T0 完成），再加一个测试 `__tests__/arch/boundaries.test.ts`：扫描 `src/ui/screens` 和 `src/core` 的 import，违反就失败（双保险，防止有人关掉 lint）。

## 4. 目录

```
pagewise/
├ android/                         原生工程（包名 com.pagewise）
│  └ app/src/main/java/com/pagewise/
│     ├ pdf/PdfPagesModule.kt      PdfRenderer 渲染 + PDFBox 书签 / 文字层 / 拆分（06 §3）
│     ├ files/FileToolsModule.kt   SHA-256、文件信息、导出到「下载」、分享（06 §3）
│     └ intake/IntakeModule.kt     接收「分享到 Pagewise」/「用 Pagewise 打开」（06 §3）
├ src/
│  ├ core/                         纯 TS
│  │  ├ types.ts                   领域类型（Book、Block、Section、LessonPlan、StudyState、Card…）
│  │  ├ ids.ts                     blockRef('b123') ⇄ seq、sectionId 规则
│  │  ├ map/                       地图构建、书签核对、长短小节处理（06 §5）
│  │  ├ lesson/                    路线图校验与兜底切分（05 §5）
│  │  ├ markup/                    AI 输出标记解析 → RichDoc AST（05 §2），支持流式半截文本
│  │  ├ context/                   上下文分层组装与预算（05 §4）
│  │  ├ citations/                 引用校验（05 §8）
│  │  ├ detour/                    主线 / 岔路状态机（05 §7）
│  │  ├ review/                    Leitner 调度（05 §11）
│  │  ├ export/                    Markdown / Anki CSV 生成（纯函数）
│  │  └ text/                      token 估算、中文字数、截断
│  ├ data/
│  │  ├ db.ts                      从 AShareSim 复制（Driver / Db / 事务锁）
│  │  ├ drivers/{opSqlite,nodeSqlite}.ts
│  │  ├ migrations/                0001_init.ts …（04）
│  │  └ repos/                     books、blocks、sections、study、messages、notes、cards、settings、usage
│  ├ services/
│  │  ├ ai/                        从 AShareSim 复制并裁剪（05 §3）
│  │  ├ mineru/                    MinerU v4 客户端 + 结果包适配器（06 §2）
│  │  ├ epub/                      EPUB 解析（06 §4）
│  │  ├ math/                      MathRenderer 接口 + WebView 实现 + 缓存（05 §2.4）
│  │  └ secrets.ts                 KeyStore（Keychain 实现 + 内存实现）
│  ├ platform/
│  │  ├ specs/                     TurboModule 规格（codegen 源）
│  │  ├ pdf.ts、files.ts、intake.ts、picker.ts、network.ts
│  │  └ fakes/                     测试和 Demo 用的假实现
│  ├ app/
│  │  ├ container.ts               组合根（§5）
│  │  ├ stores/                    zustand：library、study、review、notes、settings、toast
│  │  ├ usecases/                  importBook、parseQueue、openBook、search、finishSection、rateCard、exportNotes…
│  │  ├ study/StudySession.ts      听讲 / 读书会话编排（05 §6）
│  │  ├ demo/                      Demo 模式：演示数据种子 + 脚本化 AI（07 T3）
│  │  ├ errors.ts、events.ts、log.ts、clock.ts
│  ├ features/                     每个功能一个目录
│  │  └ study/
│  │     ├ types.ts                StudyViewState、StudyIntents（页面唯一能 import 的东西）
│  │     ├ useStudyVM.ts           组装 VM
│  │     ├ presenters.ts           文案 / 格式化纯函数（有单测）
│  │     └ StudyScreen.tsx         容器：const vm = useStudyVM(params); return <StudyView {...vm} />
│  ├ ui/
│  │  ├ kit/                       设计系统（02）
│  │  ├ skins/paper/、skins/glass/
│  │  ├ screens/                   StudyView.tsx 等纯展示页面
│  │  └ navigation/                RootNavigator、路由类型
│  └ App.tsx                       Provider 链：Container → Settings → Skin → Navigation
├ __tests__/                       与 src 同构
├ fixtures/                        测试夹具（见 07 §3，真书内容放 fixtures/private/，git 忽略）
└ docs/
```

路径别名：`@core/*`、`@data/*`、`@services/*`、`@platform/*`、`@app/*`、`@features/*`、`@ui/*`（tsconfig `paths` + babel `module-resolver` + jest `moduleNameMapper` 三处一致）。

## 5. 组合根与依赖注入

所有有副作用的东西都通过 `Container` 注入，测试和 Demo 模式换成假实现。

```ts
// src/app/container.ts
export interface Container {
  db: Db;
  repos: Repos;                 // data/repos 的集合
  secrets: KeyStore;            // Keychain / 内存
  ai: AiGateway;                // services/ai 的门面：stream(request) / complete(request)
  mineru: MineruClient;
  epub: EpubParser;
  math: MathRenderer;
  pdf: PdfPages;                // platform
  files: FileTools;
  intake: Intake;
  picker: Picker;
  clock: Clock;                 // now()、today(tz)；测试可拨动
  log: Logger;
  events: EventBus;
}
export function createDeviceContainer(): Promise<Container>;
export function createTestContainer(over?: Partial<Container>): Promise<Container>; // node:sqlite 内存库 + fakes
export function createDemoContainer(): Promise<Container>;  // 内存库 + 演示数据 + 脚本化 AI
```

- `App.tsx` 启动：`createDeviceContainer()` → `migrate(db)` → 读设置（皮肤、深浅色）→ 渲染。启动失败显示一个不依赖皮肤的纯文本错误页（含"导出日志"）。
- React 侧：`<ContainerProvider value={c}>`，`useContainer()` 只允许在 `features/**` 里用（lint 限制）。
- 开发菜单（`__DEV__`）里可以切到 Demo 容器，重启 JS 生效。

## 6. 状态管理

- **SQLite 是唯一真相**。zustand 店铺只是读缓存 + 进行中的会话状态（流式文本、忙碌标志、浮层开关）。
- 店铺**只被 `app/usecases` 和 `app/study` 写**；VM 只读（selector + `useShallow`）并调用用例。
- 店铺划分：

| 店铺 | 内容 |
| --- | --- |
| `library` | 书列表（含解析状态、进度摘要）、解析任务进度；当前书的地图（按需加载） |
| `study` | 以 bookId 为键的会话：主线 / 岔路、路线图、thread 项、流式中的那条、`busy`、待确认卡片、上下文快照 |
| `review` | 今日到期卡片数、盒子分布、卡点清单 |
| `notes` | 笔记首页统计、当前书的小节笔记列表 |
| `settings` | 皮肤、深浅色、讲解偏好、MinerU 设置（不含 Token）、AI 服务列表（不含 Key）、模型分配 |
| `toast` | 提示队列（页面通过 kit 的 `ToastHost` 显示） |

- 跨店铺联动用 `events`（类型化事件总线）：`cards.changed`、`stuck.changed`、`section.status`、`book.parse` 等。用例发事件，店铺订阅后重新读库。

## 7. 导航

`RootStack`（native-stack）：

| 路由 | 参数 | 说明 |
| --- | --- | --- |
| `Tabs` | — | 底部 4 个 Tab：`Shelf` 书架、`Review` 复习、`Notes` 笔记、`Me` 我的（顺序固定，所有皮肤一样） |
| `ImportSettings` | `{ draftId }` | 解析设置 |
| `ParseProgress` | `{ bookId }` | 解析进度 |
| `BookMap` | `{ bookId }` | 书的地图 |
| `Study` | `{ bookId, mode?, blockRef? }` | 听讲 / 读书（同一个页面两种模式） |
| `Reader` | `{ bookId, sectionId?, blockRef? }` | 单独打开读书（从地图「看原文」、搜索结果、闪卡「回到原文」、笔记高亮进入）。复用 `ReaderView` |
| `SectionDone` | `{ bookId, sectionId, draftId }` | 本节小结 |
| `ReviewSession` | — | 闪卡复习 |
| `NotesBook` | `{ bookId }` | 笔记 · 按节 |
| `NoteDetail` | `{ bookId, sectionId }` | 一节的笔记 |
| `MeMineru`、`MeAI`、`MeAIEdit{ providerId? }`、`MePrefs`、`MeAppearance`、`MeStorage`、`About` | | 我的 子页面 |
| `SkinGallery` | — | 仅开发：所有组件和页面状态在两套皮肤下的对照（02 §9） |

- 浮层（Sheet、Dialog、选择菜单）不是路由，是页面内状态，由 VM 的 `overlay` 字段描述，页面用 kit 组件渲染（见 03 §0）。
- VM 不直接 import react-navigation：用 `features/nav.ts` 的 `useAppNav()`，它暴露语义化方法（`toStudy(bookId)`、`toReader(...)`、`back()`），测试里可替换。
- Android 返回键：有浮层先关浮层；听讲页流式回答中按返回 = 停止生成并返回（回答已生成的部分保留）。

## 8. 错误处理

- `AppError { code: ErrorCode; message: string(中文，给人看); detail?: string(给日志); retry?: boolean }`。
- 服务层抛具体错误（`MineruError`、`AiError`——后者从 AShareSim 复制），用例层用 `toAppError()` 统一映射成中文说明和处理办法（例如 `A0211` → "MinerU Token 已过期，请在「我的 → 解析服务」更新，更新后会从失败的那一片继续"）。
- VM 把错误放进 `state.error` 或 `toast`；不允许空 `catch`。
- 未捕获异常：全局 handler 写日志 + 显示 toast，不闪退（ErrorBoundary 在每个 Tab 根和 Study 页各一个）。

## 9. 日志与隐私

- `log.ts`：分级（debug/info/warn/error），内存环形缓冲 2000 条 + 每日文件（保留 3 天）。所有消息经过 `redact()`：去掉已知 Key/Token 的值、`Authorization` 头、`sk-…`/`mnr_…` 模式。
- 不记录：书的原文、AI 回答全文、用户提问全文（只记长度和 ID）。
- 「关于」页（仅开发版）提供「导出日志」。

## 10. 生命周期与性能

- `AppState` 变成 active：恢复解析轮询（06 §2.4）、刷新今日到期卡片（跨午夜）。
- 读书模式滚动停止 500 ms 写一次 `read_anchor`（节流写库）。
- 流式回答：网络增量随到随收，UI 刷新节流到 ≤ 20 次/秒；Markdown/标记解析在每次刷新时对全文重新解析（文本 < 10k 字，足够快，见 05 §2.3）。
- 列表：听讲 thread 和读书块列表用 `FlatList`（`inverted` 不用，手动滚到底），`getItemLayout` 不强求；图片和公式组件 `memo`。
- 公式 SVG 先查内存 LRU（500 条）再查 `math_cache` 表，最后才渲染。
- 冷启动目标：中端机 < 1.5 s 到书架首屏（迁移 + 读设置 + 书列表）。
