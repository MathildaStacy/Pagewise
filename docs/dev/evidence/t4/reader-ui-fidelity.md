# Reader 最后对齐与定位修复

2026-10-29。依据两份当前原型；修改范围仅 `src/ui/screens/ReaderView.tsx`、`__tests__/ui/readerFidelity.test.tsx`。修复前发现见 `final-source-audit.md` 第1–4项。共享 Sheet / Study dock / 小结保存区由 root 处理。

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
