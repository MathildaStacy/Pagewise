# Me / Map 最后源码对照修复

2026-10-29。范围：`MeView`、`BookMapView`、设置概览 VM、共享 `Screen`、`SkinProvider` 与现有样例／回归。原型未修改；本次未操作设备或浏览器。原生四主题截图由主任务重新采集。

## 修复及原型依据

- **我的固定导航与滚动大标题**：移除自制标题，使用共享 `AppBar variant="root"`。Paper 保留 48 高固定导航标题；Apple 的 44 导航条覆盖正文，34 大标题作为正文第一项向上滚动，超过 36dp 出现 17 紧凑标题。共享 Screen 使用导航实测高度留出顶部空间，保留 110 底部悬浮 Tab 避让。依据：Paper `prototype/shell.html:35–51`；Apple `prototype-apple/base.css:68–83`、`ui-base.js:31–44` / `52–55`。共享 Apple AppBar 的分区、动画与材质由主任务一并整合。
- **设置分段控件与字号**：Apple 设置页复用 Kit 的滑动分段控件，保留 Paper 原有独立几何。Apple 小／中／大字号分别是讲解 15／17／19、原书 15／17／19.5；行高保持原有 1.65／1.85 比例，外观样文继续使用原型的 1.8。Paper 档位比例及界面字体不变。依据：Apple `prototype-apple/ui-base.js:65–69`、`base.css:152–155`、`ui-me.js:86–90`。
- **Paper 模式控件圆角**：外层与轨道半径设为 15，选中底色半径设为 13，与原型 `prototype/shell.html:41–49` 一致。只替换原先的 999 半径，没有改变布局；Android 端的显示由主任务复拍确认。
- **地图当前小节字重**：当前节点用独立 600 字重，普通节点保持 400，不再取 Apple 700 的 headline。依据：Apple `prototype-apple/pages.css:69–77`，Paper `prototype/shell.html:154–163`。源码：`src/ui/screens/BookMapView.tsx:595`。
- **我的概览文案**：外观行订阅容器的 appearance store，展示当前皮肤、深浅色设置和正文档位，切换后无需刷新；关于行显示实际包版本与协议；双语关闭时使用“只用中文术语”。依据：Apple `prototype-apple/ui-me.js:11–14`，Paper `prototype/ui-me.js:16–20`。版本复用 `package.json`，About VM 同源，不把原型演示版本当真实版本。源码：`src/features/settings/useSettingsVM.ts:105` / `185`。

## 验证

- `npm test -- --runInBand __tests__/features/settings.test.tsx __tests__/ui/settingsFidelity.test.tsx __tests__/features/library.test.tsx __tests__/ui/skin.test.tsx`：4 suites、53 tests 全部通过。
- 新增四主题 Me 回归：导航标题位于 ScrollView 外；Apple 大标题位于 ScrollView 内，36dp 时紧凑标题仍隐藏、37dp 显示，80dp 时大标题仍保留本身行高并随正文滚走，保留 110 底距；Paper 只有 20/600 的固定标题。
- 新增概览回归：修改持久化 appearance store 后，概览即时由“纸感 · 跟随系统 · 正文中”切为“苹果风 · 深色 · 正文大”及“苹果风 · 浅色 · 正文小”；版本与关闭双语文案正确。
- 现有两皮肤地图渲染回归增加当前节点 600 / 普通节点 400 断言；最后样式整理后复跑这 2 项通过。
- `npm run typecheck` 通过；本次 7 个源码／测试文件的 scoped ESLint `--max-warnings 0` 通过。

后续共享顶栏／字号修正的验证：

- `settingsFidelity`、`skin`、`features/settings`、`features/appearance` 4 suites、50 tests 通过；覆盖导航测量从 44 到 52dp 后正文顶部避让、Apple 36／37dp 阈值、大标题无高度裁切、两皮肤各 3 个字号及 1.3 倍字体缩放、设置选项回调。
- 设置编辑页切换 `paper/light → glass/dark → paper/dark` 保留输入草稿和 Screen 滚动状态，编辑子树不重新挂载；push 页无大标题。
- TypeScript 与本轮 4 个源码／测试文件的 scoped ESLint `--max-warnings 0` 通过。

以上是源码与 React 渲染回归，不能作为原生像素验收结论。

## 只读核对结果

顶部模式当前分别符合原型：Paper 左“伴读”右“原文”；Apple 左“读书”右“听讲”。`docs/dev/README.md` 已由主任务改为分开声明，未残留“几乎”等宽松标准。字体 `sans-serif / serif` 是 `docs/dev/02-skins.md:89–90`、`141` / `177` 明确规定的 Android 映射，本次不替换或添加字体。
