# Reader 最后对齐与定位修复

2026-10-29。依据两份当前原型。初轮修改 `src/ui/screens/ReaderView.tsx`、`__tests__/ui/readerFidelity.test.tsx`；后续获 root 授权补齐 `contracts.ts`、base overlays 与 glass Dialog 的窄范围内容契约。修复前发现见 `final-source-audit.md` 第1–4项。共享 Sheet 几何 / Study dock / 小结保存区由 root 处理。

## 行为修复

- 重排按 block 虚拟化，保留原有稳定引用、段落菜单、Pin 和注释状态。通过自定义 CellRenderer 的真实内容坐标记录 y / height，避免误用 row-local 的 `onLayout.y=0`。
- 引用目标尚未挂载时先让 FlatList 挂载对应 block，再按测得的段落 y 精确定位到视口30%处。未测量窗口的临时滚动不写成阅读锚点；用户主动拖动可以取消待定位请求；retry timer 在退出时清理。
- 阅读锚点取视口中部实际可见的 block，替代原先「当前 PDF 页中间的 block」。引用、搜索、笔记与模式切换继续走同一个 scrollTo / reportAnchor 意图。
- 原版模式增加导读后，测得的导读高度纳入 PDF 页 getItemLayout / 跳转 offset；导读移除时不保留旧 header 偏移。

## 原型结构与几何

- Apple 重排在视觉上为整节一张连续阅读纸面：各虚拟 cell 无页间空隙，仅整节首尾有24圆角；页码插在连续内容之间。Paper 使用透明分页面、左右16内距、底14，页码左对齐带虚线，准确使用 root 补入的 `readerPageLabel` / `readerPageRule`（#A8A196 / #DDD6C8）。
- 标题从普通 RichView 改为语义 heading：Paper 1.25×书本字号，Apple 1.3× / 1.4行高 / -.01em tracking，均为sans / 700；标题底距8 / 12只计一次。
- Apple 导读在原版与重排均显示；固定 spark +「本节导读」标签，与单行次要描述分开，展开后正文换行。左右16、顶部2、内距11×14、圆角20、字号12/14/15分别对应原型。Paper 保留已有 GuideBar 意图。
- Paper 阅读工具条恢复8×12、间距10、segment150；Apple 保持0/16/10、间距12、segment140。

## 验证

- `jest --runInBand __tests__/ui/readerFidelity.test.tsx __tests__/features/study.test.tsx __tests__/ui/PageOrig.test.tsx __tests__/ui/math.test.tsx`：4 suites / 33 tests通过，其中11项新Reader回归。
- scoped ESLint（Reader与新测试）、`git diff --check`通过。Reader修复后全量 `tsc --noEmit`曾通过；交付前最后一轮仅报并行新增的 `__tests__/ui/sheetFidelity.test.tsx:266` 的null参数类型错误，已通知root处理，Reader与新Reader测试无类型错误。
- 本 worker 未操作浏览器/模拟器，也未提交。原生渲染、跳转目标的实际视觉位置与最终双皮肤截图由 root 继续验证；此记录不表示原生像素验收完成。

## Sheet / 笔记 Dialog 后续修复

- StudyOverlays 把 peek / explain / translate / pin 的操作传给共享 `Sheet.actions`，使 Apple 操作留在固定 footer，Paper 操作仍随正文滚动。业务正文移除重复横向 padding。
- Apple explain 按原型使用纵向「带到听讲里继续问」主按钮、「好的」、「记为卡点」；Paper 使用横向「记为卡点」、「带到伴读里继续问」。Apple 翻译只保留主操作「好的」，Paper 翻译无 footer。Pin 以问题作为标题，Apple 副标题带「问答便签」。
- Sheet action 契约补充 disabled 并透传给 Button；答案尚未返回或仍在流式输出时，Apple「好的」禁用，回调也不会提前贴便签。已有 ask / stuck / ok 业务意图不变。
- 两皮肤记笔记均使用 Dialog，包含引用与多行编辑器，标题「记笔记 · p.X」、取消/保存。Dialog body 支持 ReactNode，字符串调用保留原有排版；键盘 inset、交互收起与点击透传配置补齐。空白草稿不会保存，内容继续由 VM 的 overlay 状态控制，切换皮肤/明暗后保留。
- 本轮新增8项回归，覆盖真实 footer 所在区域与顺序、主次样式、未完成答案禁用、各皮肤翻译操作、Dialog 与 Sheet 类型、键盘配置、空白保存拦截和跨皮肤草稿。`readerFidelity` / `sheetFidelity` / `glassDialog` / `features/study`：4 suites / 46 tests通过；`tsc --noEmit`、本 worker 变更的 scoped ESLint、`git diff --check`通过。
- 本轮仍为源码与组件回归验证，未增加原生截图或声明像素验收完成。模态与 Sheet 引用字体已在后续收尾中修正。

## 四项既有差异收尾

- Paper Study 切到 read 后显示「原文 · 小节名」，右侧的更多按钮换成40宽占位；顶栏返回回到伴读。Apple Study 内嵌读书继续保留原型的更多按钮与原有返回行为。独立 Reader 的右侧按两份原型增加40 / 44宽占位。
- Apple thread 使用4 / 20 / 24的上/左右/下间距；悬浮 dock 的滚动预留合并原型 view 的 `dockHeight + 8` 与 thread 的24底距，不重复覆盖。
- Reader 重排和原版 footer 直接使用 ReadEnd，移除外层重复 padding。ReadEnd 自己包含提示：Apple22 /16 /8间距、gap8，提示12号居中，按钮移除额外 check 图标。
- RichView 新增可选 `typography="dialogQuote"`，仅笔记 Dialog 使用：13号 serif、1.8行高、次要文字色，保留既有富文本/数学渲染。Paper 引用补2垂直 padding，Apple保留12左距。未修改 VM 或 glass 顶栏。
- 新增5项 Reader/Study 渲染回归并补充既有两皮肤笔记用例的引用字体验证。最终范围的 `readerFidelity`（26）/ `features/study` / `ui/components` / `ui/math` 合计4 suites /293 tests通过（Reader 用例首次只因 RN wrapper/host 的 testID 重复计数失败，修正断言后26/26通过）。`tsc --noEmit`、scoped ESLint、`git diff --check`通过。

## 最后三项既有原型差异

- Composer quote 增加可选 page / excerpt 字段，原 label 与 label-only 调用继续可用。VM 传完整摘录供单行省略，旧 label 保留70字截断；Paper 拆为「引用」标签与「p.X · 摘录」，Apple 为600 tint「引用 p.X」与独立13号 serif 摘录，并保留清除引用动作。Paper 引用条使用6×12内距与24关闭图标目标，Apple补齐4垂直内距。
- Apple SectionDone 完成图标使用原型的 `0 10px 24px` 绿色40%阴影，500ms pop 从0.9缩放与0透明度进入；reduceMotion 下直接显示最终状态，effect退出时停止动画。标题采用-.01em tracking，统计上距为0，Paper保持原先4上距。
- explain/translate Sheet 引用使用窄 `typography="sheetQuote"`：Paper13号/23.4行高，Apple15号/27行高，均为serif和次要文字色；引用左侧3高亮色细线、左右距与垂直距按各自原型设置。RichView 的数学与引用处理保留。
- 新增 `studyFinishingFidelity.test.tsx` 8项回归，验证双皮肤引用拆分/清除与旧label兼容、Apple明暗阴影/标题/统计、reduceMotion启停；已有Reader回归增加解释/翻译引用字体检查，已有VM主题切换回归验证完整摘录和组合label兼容。最终针对范围 `readerFidelity` / `studyFinishingFidelity` / `features/study` / `ui/components` / `ui/math`：5 suites /301 tests通过；`tsc --noEmit`、本轮全部变更的 scoped ESLint、`git diff --check`通过。未增加原生验收声明。


## 最后原生反馈

- Paper切到原文时副标题还保留书名；VM提供独立readSubtitle页码，Paper使用它，Apple内嵌读书仍保留原型书名副标题。既有双皮肤渲染回归补断言，Reader26项通过。
- 原生观察Paper选中背景为方角；改为原型独立13dp圆角滑块（48dp宽、260ms过渡、减弱动态直接定位），原生重拍已看到正确圆角，见final/paper-light-reader.png。
- 最新完整check为80 suites/1191 tests/15 snapshots；arm64 debug/release构建通过。
