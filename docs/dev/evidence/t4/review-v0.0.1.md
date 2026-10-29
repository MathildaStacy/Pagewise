# v0.0.1 双原型检查

日期：2026-10-29。应用源码基线：541f411 / v0.0.1。范围：两份 prototype、当前原生 Demo、已有四主题截图及相关调用链。只检查并记录，未修产品代码。

## 确认的问题

### 1. P1：重排阅读中的图片点击无响应

- 模拟器 Apple 深色 Demo，书架继续学习 A*，读书 / 重排；点击图 3.18 图像中心，没有大图或段落菜单出现。同页点击普通段落，解释 / 翻译等菜单正常出现，排除页面整体不响应。
- 调用链：ReaderView.tsx:694 将 doc 交给 BlockView；content.tsx:1042 调用 RichView 时没有传 onFigure；content.tsx:168 却总是给 FigureView 创建一个回调，onFigure 缺失时实际为空操作。FigureView 内层 Pressable 接收点击，且无障碍名称仍宣称“查看大图”。
- 修正方向：明确 Reader 图像的点击入口，将其连接到图片查看或原型定义的段落菜单；不要留下覆盖外层操作的空回调。

### 2. P1：重排段落无障碍名称缺少正文

- 同一原生页面的无障碍树中，多个不同段落名称均为“当前段落，原文段落”或“原文段落”。
- ReaderBlockRow 仅传 doc，不传 text；BlockView 在 content.tsx:1066–1068 仅从 text 构建显式 accessibilityLabel。按钮的名称因此没有该段正文，无法凭控件名称区分段落。
- 修正方向：从 RichDoc 提取可读正文或提供专门的无障碍文本；保留当前 / 已讲状态。此项是原生语义树和源码确认，未冒称实际听完 TalkBack 播报或完整 TalkBack 流程。

### 3. P2：Apple 段落菜单变成两行

- 原生实测：第一行“解释 / 翻译 / 问 AI / 从这里开始讲”，第二行“高亮 / 笔记”。
- prototype-apple.html:231–235 为单行 flex、overflow-x:auto、按钮不收缩；overlays.tsx:644–695 使用 flexWrap:wrap、minWidth:72、flexGrow:1，产生多行网格。按钮的视觉高度和字号也不同。
- 修正方向：Apple 菜单恢复单行横向滚动，并将可见尺寸与触控区域分开处理。

### 4. P2：书封面大小、字样和深色字色不符

- controls.tsx:1071 将 Apple 中号封面设为54×76，原型是54×74。
- controls.tsx:1079 使用通用 micro 字体，Paper 为11号、Apple 为12号，原型封面均为10号；Apple 原型的书脊光泽层也未实现。
- controls.tsx:1080 取 onAccent 作为封面文字颜色；Paper 深色该值是#0E1A30，而原型封面文字为白色。深色有色封面上的字会变暗。
- 修正方向：封面使用自己的尺寸与文字样式，封面文字颜色不复用主题按钮前景色。

### 5. P2：Apple 已讲段落与当前段落的细线区分不符

- prototype-apple.html:499–502 将细线放在文字外侧，已讲使用35%透明度的蓝色，当前使用实蓝。
- content.tsx:1053–1055 使用整段的左边框，已讲使用 stepCur；glass/tokens.ts:75 的 stepCur 是不透明#007AFF。已讲与当前因而均是实蓝，位置与线段上下留白也不同。
- 修正方向：将阅读标记与步骤条颜色区分，按原型绘制外侧短细线及已讲透明度。

### 6. P2：Paper 底栏图标仍是另一套图形

- prototype.html:741–746 定义书架、重叠卡片、笔记页和人物的 SVG。
- icons.tsx:168 仅对 glass 优先采用 prototypePaths；Paper 的 cards / note / shelf 仍走 Lucide Layers / StickyNote / Library。现有原生截图也能看见复习图标为叠层，笔记为便签，与原型卡片 / 文档不同。
- 修正方向：为 Paper 使用它自己的原型 SVG，不共用一套近似图标。

## 确认边界

- 已在 ego lite 实际打开两份本地原型；本次 TaskSpace 3 已 finish，未更改原型文件。
- 原生环境：Pixel_10_Pro / Android17 / 1280×2856 / density480 / system font_scale=1.0，隔离 Demo。未改变屏幕尺寸、系统字号或无障碍设置。
- 两套截图的视口宽度、系统栏及滚动位置不同，不能把拼图直接当作像素差异证据；上面各项均有具体源码或原生交互支持。
- Android 系统 sans-serif / serif 与浏览器 macOS 字体仍是已知适配差异（02-skins.md:141/177），不是本轮新发现的回归，但严格逐像素一致尚未成立。
- 完整 TalkBack「打开书→听讲→提问→回主线」、四主题全部长内容 / 浮层 / 流式切换仍缺完整记录。它们是未完成验收，不能直接列为已确认 bug。
- 历史 final-source-audit.md 明确是修复前报告，不作为当前未修问题清单。本轮未重复运行源码未变的完整测试。
