# Meta 风组件覆盖

视觉与交互以 [Meta 原型](../../../../docs/design/prototype-meta.html) 及其 [README](../../../../docs/design/prototype-meta/README.md) 为准；保留 Facebook / Messenger / Meta AI 的组件形态、原稿色值、四个 Tab 和既有流程。

| 来源 | 原生实现 |
| --- | --- |
| `prototype-meta/base.css` 的浅深色变量、`pages.css` | [tokens.ts](tokens.ts) 的 L1；前景色与实心按钮填充色分开，深色不混用 `accent` / `accentFill` |
| `icons.js` 的线条与实心图标 | `../brand/glyphs.ts`、`../brand/icons.tsx`；2.2 线宽，Tab 选中用实心版 |
| `ui-base.js`、各页 `ui-*.js` | `../brand/components.tsx` 的 L2 和共享页面的品牌分支；沿用同一 VM 与 intents |
| `pages.css` 的封面 | `../brand/Cover.tsx`；用户书沿用书籍自身的封面颜色 |

## L1 · Token

- 灰底白卡（浅色 `#F0F2F5` / `#FFFFFF`，深色 `#18191A` / `#242526`）；主线蓝、岔路紫、推导青、卡点橙、高亮黄的语义保持原稿。Meta AI 渐变为蓝 → 紫 → 粉。
- 根标题 26/700、push 标题 18/600、AI 正文 17/1.65、原书 17/1.85。Android 使用系统 `sans-serif` / `serif`，不假定设备安装 Optimistic 或桌面字体。
- 页面横向留白 12dp，卡片以 10–12dp 圆角为主；按钮 6dp，Sheet 16dp，chip 与模式切换是胶囊。浅深色的完整值以 `tokens.ts` 为准。

## L2 · 组件

| 覆盖 | 实际形态 |
| --- | --- |
| AppBar / IconButton | 根页粗标题、书架蓝色 Pagewise 字标；push 页左箭头与左对齐标题；灰圆操作按钮，滚动后细分隔线 |
| TabBar / ModeSwitch | 贴底通栏，选中蓝色 + 顶部短条；「读书 / 听讲」仍在顶栏右侧，使用筛选胶囊 |
| Button / Segmented / Switch | 蓝色主按钮、灰色次按钮、紫色岔路；分段为胶囊；开关蓝轨白点 |
| ListSection / Row / Field / Fab | 灰底上的白色分组卡，卡外粗标题；行可随文字增高，保留 chevron；矩形导入按钮 |
| StepProgress / StepHeader | 快拍式步骤轨道、当前步与标题旁的 Meta AI 渐变环 |
| UserBubble / QuickActions / Composer | Messenger 蓝色或岔路紫气泡；实色贴底输入区、灰输入框、蓝色纸飞机 |
| Dialog / Toast / SelectionMenu | 白色居中卡与等宽动作；底部 snackbar；深色长按菜单条 |
| Cover / Glass / Note | 原稿封面；实色材质；说明内容继续走共享组件契约 |

Sheet 复用 `kit/base/overlays.tsx` 的同一个函数：贴底、16dp 顶圆角、居中标题、灰圆关闭键；动作竖排全宽，主动作在前。切换五套皮肤不会重建已打开的 Sheet 正文或丢失输入草稿。

## L3 · 页面与边界

没有注册 L3 slots，也没有整页替换。`ShelfView`、`BookMapView`、`StudyView`、`ReaderView`、`MeView` 的局部品牌分支还原原稿：继续学习卡顶部渐变细条、通栏书页、评论式问答便签。阅读、解析、引用、小结确认与本地记录沿用原业务。

原生适配见 [02-skins §4.5](../../../../docs/dev/02-skins.md#45-meta--google--win11-与原生适配)：系统安全区、字体缩放、48dp 触控范围，以及 SVG 渐变透明度和胶囊几何修正。保留原稿视觉，不引入其他主题的悬浮导航或材质。
