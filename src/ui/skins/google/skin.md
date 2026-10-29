# 新谷歌风组件覆盖

视觉与交互以 [新谷歌原型](../../../../docs/design/prototype-google.html) 及其 [README](../../../../docs/design/prototype-google/README.md) 为准；使用原稿的 Material 3 / Google Play 形态、四个 Tab 与既有流程。「读书 / 听讲」保留在顶栏右侧。

| 来源 | 原生实现 |
| --- | --- |
| `prototype-google/base.css` 的 M3 色调和浅深色变量、`pages.css` | [tokens.ts](tokens.ts) 的 L1；保留 primary / primary-container / secondary-container 的不同用途 |
| `icons.js` 的 Material 形状 | `../brand/glyphs.ts`、`../brand/icons.tsx`；使用源 SVG 路径与 2px 线宽 |
| `ui-base.js`、各页 `ui-*.js` | `../brand/components.tsx` 的 L2 和共享页面品牌分支；同一 VM、同一确认与引用行为 |
| `pages.css` 的封面 | `../brand/Cover.tsx`；用户书保留自身封面颜色 |

## L1 · Token

- Google 蓝（浅色 `#0B57D0`，深色 `#A8C7FA`）、白底与 surface-container 色调分层；主线蓝、岔路紫、推导青、AI 举例 Gemini 渐变、卡点橙、高亮及便签黄保持原稿角色。
- 根标题 24/400、push 标题 20/400、AI 正文 16/1.65、原书 17/1.85。Android 使用系统 `sans-serif` / `serif`，不打包或假定安装 Google Sans。
- 页面横向留白 16dp；卡片 16dp、继续学习卡及 Sheet / Dialog 28dp、FAB 16dp。完整浅深色、字体与动效值以 `tokens.ts` 为准。

## L2 · 组件

| 覆盖 | 实际形态 |
| --- | --- |
| AppBar / IconButton | small top app bar，左箭头与左对齐标题；滚动后切换 surface-container 填充，无苹果式大标题收起 |
| TabBar / ModeSwitch | 贴底 M3 navigation bar，选中图标外有药丸指示器；顶栏模式为描边分段 |
| Button / Segmented / Switch | 实心主按钮、描边或文字次按钮，按下时收小按钮圆角；分段选中带勾；开关打开时圆点带勾 |
| ListSection / Row / Field / Fab | 通栏列表、主色分组标题、无 chevron；右下 primary-container 扩展 FAB；原生 Pressable 涟漪 |
| StepProgress / StepHeader | filter chip 路线图；普通步骤标题，保留已讲、当前、跳过的状态 |
| UserBubble / QuickActions / Composer | Google Messages 浅蓝气泡；灰色输入容器；AI 举例保留 Gemini 渐变 |
| Dialog / Toast / SelectionMenu | 28dp 居中对话框与右侧文字动作；底部 Snackbar；Android 文字选择工具栏 |
| Cover / Glass / Note | 原稿封面、实色材质与共享说明契约 |

Sheet 复用 `kit/base/overlays.tsx` 的同一个函数：贴底、28dp 顶圆角与拖动条，动作横排、主按钮在右。共享 Sheet 正文层级保持稳定，五皮肤切换保留表单草稿。

## L3 · 页面与边界

没有注册 L3 slots，也没有整页替换。共享 `ShelfView` 使用 primary-container 继续学习卡与通栏列表；`ReaderView` 使用独立书页卡与黄色便签，`BookMapView` / `StudyView` / `MeView` 仅按原稿调整局部形态。解析、学习、引用及本地记录仍走现有业务。

原生适配见 [02-skins §4.5](../../../../docs/dev/02-skins.md#45-meta--google--win11-与原生适配)。系统字体、安全区、可增长容器、48dp 触控范围及原生涟漪代替浏览器实现；SVG 渐变保留源 alpha，圆角按实际尺寸限制。完整 AA 认证不在现有自动化覆盖内，不能把调色板来源测试当作对比度认证。
