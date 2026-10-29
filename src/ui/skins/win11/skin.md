# Win11 风组件覆盖

视觉、页面与交互以 [Win11 原型](../../../../docs/design/prototype-win11.html) 和 [README](../../../../docs/design/prototype-win11/README.md) 为准。该稿明确新增「今天」、问书架、学习记录、新手引导；这四项随原稿实现，Paper / Apple / Meta / 新谷歌保留四 Tab。

| 来源 | 原生实现 |
| --- | --- |
| `prototype-win11/base.css` / `pages.css` | [tokens.ts](tokens.ts) 的 L1：Mica、半透明卡片、亚克力、语义色、Copilot 彩虹、阴影 |
| `icons.js` / `shell.html` 的线条、彩色图标与渐变定义 | `../brand/glyphs.ts`、`colorGlyphs.ts`、`../brand/icons.tsx`；线条与 Fluent 彩色图标分开，SVG id 按实例隔离 |
| `ui-base.js`、`ui-study.js`、`ui-reader.js` 等 | `../brand/components.tsx` 和共享页面的品牌分支 |
| `ui-today.js` / `ui-welcome.js` | `features/home/`、`app/usecases/home.ts` 与 `TodayView` / `AskShelfView` / `LearningStatsView` / `WelcomeView` |
| `pages.css` 的书封 | `../brand/Cover.tsx`；已知演示书还原源渐变，用户书保留自己的颜色与元信息 |

## L1 · Token 与材质

- Mica 底 → 半透明卡片（低 / 中 / 高三档）→ 悬浮亚克力导航与浮层；浅色主线 `#0067C0`，深色 `#4CC2FF`，岔路紫、卡点橙、推导青、高亮黄。AI 区域保持蓝 → 紫 → 粉 → 橙的 Copilot 彩虹。
- 根标题 30/600、push 标题 16/600、AI 正文 15.5/1.7、原书 16.5/1.9。Android 用系统 `sans-serif` / `serif`，不假定安装 Segoe UI、宋体或 Cambria Math；公式沿用现有 MathRenderer。
- 卡片 16–20dp、Sheet 24dp，按钮和 AI 输入框保持胶囊形。源稿桌面壁纸、模拟手机状态栏、原型控制台和任务栏不进入原生 App；Mica 作为真实页面底层。
- TabBar、Sheet、Glass 通过原生 BlurView 表达亚克力；关闭模糊、降低透明度或平台不支持时使用 `acrylicSolid` 实色兜底。卡片仍使用 Token 中的描边和分层。
- 阴影优先保留源稿多层 `boxShadow`：Android 9（API 28）支持外阴影，Android 10（API 29）起加入内阴影；更旧 Android 由 `fluentShadow()` 返回传统阴影字段 / `elevation`。按钮底部内阴影、卡片和悬浮层阴影不混为一档。

## L2 · 组件

| 覆盖 | 实际形态 |
| --- | --- |
| AppBar / IconButton | 根页小字副标题 + Display 大标题、圆角方形操作；push 页居中标题；滚动后亚克力色填充 |
| TabBar / ModeSwitch | 五项悬浮亚克力条，选中项下方短条；模式切换置于学习页顶栏下的 SelectorBar，右侧上下文入口 |
| Button / Segmented / Switch | 药丸主按钮、半透明次按钮、紫色岔路按钮；保留源稿的圆角分段与紧凑开关 |
| ListSection / Row / Field / Fab | 细描边半透明卡片，彩色图标行首；胶囊导入 FAB |
| StepProgress / StepHeader | 分段进度条，当前步用彩虹；AI 回答无气泡，步骤旁彩虹头像；用户提问是蓝气泡 |
| QuickActions / Composer / Note | 彩虹描边输入框、聚焦时辉光增强、渐变发送按钮；AI 说明块使用低透明度彩虹底 |
| Dialog / Toast / SelectionMenu | 居中对话框、底部 Toast、锚点选择菜单，动作仍走同一契约 |
| Cover / Glass / UserBubble | 原稿书封、亚克力材质、蓝色用户与紫色岔路气泡 |

Win11 的 `IconButton` 默认 `variant="push"`，静止时透明；书架搜索和网格 / 列表操作显式传 `variant="root"`：视觉尺寸 40dp、圆角 12dp，使用 `cardHi` 填充、`stroke` 描边与卡片阴影，`hitSlop={4}` 扩到 48dp。根页操作间距按原稿为 6dp（`t.space.gap / 2`）；root 的涟漪在前景绘制并限制在按钮内，push 保留 borderless 涟漪。

Sheet 复用 base 的同一函数：贴底、24dp 顶圆角、把手、可下滑关闭；正文切换皮肤不重建。其他富文本、原文、引用、小测、小结和复习组件继续复用 kit/base。

## L3 · 页面与业务边界

没有注册 L3 slots。既有书架、地图、学习、读书、我的页面按 `brand.kind` 做原稿要求的局部适配；新增四页是 Win11 原稿的功能扩展，由 `features/home` 提供 VM，不替换 Paper / Apple 页面。导航、真实 API、本地持久化与引用编号映射见 [03-screens §13](../../../../docs/dev/03-screens.md#13-win11-原稿新增页面)。

- 学习时长只记录前台读书 / 听讲时间；目标、最近提问与引导完成状态本地保存。真实「每天提醒」开关禁用，尚无通知调度；演示库只预览。
- 问书架检索已解析块，经用户配置的 AI 服务回答；命中编号映射到具体书、章节、页码与 Reader 块。保存答案需用户点击「存到笔记」。
- 引导复用模型列表、连接测试、服务 / Token 保存和偏好 API。欢迎可先逛，AI 与 MinerU 配置可跳过；不会在真实书库自动植入示例书。
- 学习页「拍一张图」保留源稿 `M5` 占位；真实外部 PDF 解析和 AI 调用需要用户自己的服务配置。
- 原生安全区、系统字号、48dp 触控范围、SVG alpha 与胶囊几何适配见 [02-skins §4.5](../../../../docs/dev/02-skins.md#45-meta--google--win11-与原生适配)。
