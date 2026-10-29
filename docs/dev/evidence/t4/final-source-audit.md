# 双原型最后源码核对

2026-10-29。范围：共享 controls / overlays，StudyView / ReaderView / SectionDoneView。以下为修复前可直接从源码确认的差异；只做源码核对，未操作浏览器或设备，不能替代原生截图验收。行号对应本次检查时工作区。

1. **P1 · 重排阅读定位和阅读锚点丢失页内段落。** `src/ui/screens/ReaderView.tsx:121`–137 只查包含目标 block 的页，再 `scrollToIndex`，没有计算该段落的页内 offset；91–95 上报该页固定的中间 block。长页中的引用目标可能仍在屏外，切换模式与恢复位置也不能反映实际可见段落。Paper `docs/design/prototype/ui-reader.js:36`–39、Apple `docs/design/prototype-apple/ui-listen.js:253`–256 均定位到具体 block。
2. **P2 · 重排页结构与两套原型不同。** `ReaderView.tsx:98`–144 按 PDF 页分组并逐页包卡片；778–804 两套均有纸色背景和居中页码。Apple `prototype-apple/ui-reader.js:29`–36 是整节一张连续 article，中间仅插页码；Paper `prototype/shell.html:250`–252 是透明重排页、左右16 / 底14 padding，左对齐页码与虚线分隔。
3. **P2 · Reader 标题只有普通正文大小。** `ReaderView.tsx:467`–470 将标题交给普通 RichView，814–818 的容器只有间距；`src/features/study/presenters.ts:80`–82 生成 paragraph + bold，而 `src/ui/kit/base/content.tsx:86`–114 使用普通 aiBody，53–57 的 bold 仅取 headline 字重。Paper `prototype/shell.html:257` 要求 sans / 700 / 1.25em；Apple `prototype-apple/pages.css:247` 为 sans / 700 / 1.3em / 1.4 行高。
4. **P2 · Apple 导读只存在重排模式，且缺标签与副文案层级。** `ReaderView.tsx:164`–186 的原版分支没有 GuideBar，209–220 才在 flow header 中渲染；213 把 oneLine 当标题。`content.tsx:1093`–1122 使用 book 图标和单一强调色标题。Apple `prototype-apple/ui-reader.js:24`–28 在模式分支之前渲染导读，固定 spark +「本节导读」标签，另列可截断的 oneLine / 展开正文；几何见 `prototype-apple/pages.css:223`–229。
5. **P2 · Apple 听讲底部缺悬浮与渐隐层。** `src/ui/screens/StudyView.tsx:155`–182 的 QuickActions / Composer 是 FlatList 之后的普通流布局；`src/ui/skins/glass/components.tsx:914`–920 仅有左右16和底30 padding。Apple `prototype-apple/pages.css:195` 为 bottom0 绝对定位 dock，顶部26渐隐渐变，thread 可以滚入底部层后方。
6. **P2 · Apple Sheet 的头尾跟随正文滚走。** `src/ui/kit/base/overlays.tsx:227`–274 将 header / body / actions 全部放进同一个 BottomSheetScrollView。Apple `prototype-apple/base.css:183`–200 的 header / footer 固定，仅 body 滚动；因此长浮层的关闭入口和操作区行为不同。另外当前255正文左右16，原型194为18；当前175操作间距12，原型200为8。Paper 原型本就整体滚动，此项滚动问题仅指 Apple。
7. **P3 · 小结保存区的提示与闪卡标签布局不同。** `src/ui/screens/SectionDoneView.tsx:134`–145、239–240 使用全向 pageX padding / token gap，提示默认左对齐；Paper `prototype/ui-study2.js:113` 为6 / 14 / 22 padding、提示居中且上距8，Apple `prototype-apple/ui-done.js:31` 与 `base.css:173` 为仅左右16、提示居中且上距10。`src/ui/kit/base/controls.tsx:1109`–1113 将「来自岔路」作为尾部独立列，而两份原型都放在题目文本之后（Paper ui-study2.js:110，Apple ui-done.js:28）。

后续处理：Reader 问题由 t4_review_notes 接管修复；shared Sheet / Study / SectionDone 由 root 集成处理。修复后的状态另见 Reader 修复证据及原生最终验收，不将此修复前报告当作当前仍未修复问题清单。
