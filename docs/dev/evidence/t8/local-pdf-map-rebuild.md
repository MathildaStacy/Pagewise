# T8 本地 PDF 地图重建

日期：2026-10-29。入口：`src/app/usecases/importResults.ts` 的 `rebuildLocalPdfMap(c, bookId)`。

## 行为与保留边界

- 仅接受已导入且存在当前本地 block 的 PDF。复用当前数据库中的 blocks、book.outline、`book.import.<id>.pageLabels`、`book.pageNumbers.<id>`，调用现有 `priorSections` / `buildMap` / `assignSections`。
- 先 dispose parse queue、StudySession 与 reader，等待未完成的工作退出后才开始地图事务。reader 尚未关闭时不修改地图。queue 的 dispose 会移除容器缓存；后续 `getParseQueue` 会返回新实例。本入口不调用 resume，以免本地修复顺带开始解析或上传。
- 事务只重建 section / section_part / block.section_id，并更新 page_offset 与 pageOffsetReliable。block 正文、id、seq、页码和图像引用不重写；消息与其引用、卡片、便签、高亮、学习进度、导读和总结不迁移、不删除；book 状态与 parse part 状态不改变。
- 手动 section 保持原值，手动 part 范围也保留。已用 section 的状态 / summary / guide 由 buildMap 和 section repo 沿用。
- 未使用的旧误识别 section 可以被移除。若待移除 section 有手动修改、学习状态、总结、导读、消息、问答、卡点、笔记、便签、卡片、路线图、岔路或学习进度引用，或已用 section 的角色 / 合并关系 / part 边界变化，则显式返回带 section ID 的错误，事务保留原地图。悬空的手动父节点 / 合并目标也拒绝提交。
- 写入失败整体回滚。成功后以原 book status 发出 book.parse，让页面重新读取地图。

## 回归结果

`__tests__/app/import/import.test.ts` 新增 7 项：

1. 删除未使用的旧误识别节点；逐行比较 message / card / highlight / pin / study_state / section_note / qa / stuck / detour / lesson_plan 保持一致；manual section、summary、guide、blocks 与 seq、book 状态、全部 parse part 不变。验证 reader 关闭完成前不写入，StudySession 及 queue 已 dispose，后续 queue / session 可重新取得新实例。所有 runtime 文件 / PDF / MinerU 调用次数为 0。
2. 有 summary 的旧节点不可安全移除时拒绝，数据原样保留。
3. 有 card 的旧节点不可安全移除时拒绝，数据原样保留。
4. 有学习进度的旧节点不可安全移除时拒绝，数据原样保留。
5. 在 section 替换后的 book 更新注入 SQLite 失败，验证 section 和 block 事务回滚。
6. 已学 section 的 part 边界发生变化时拒绝，保留原 part 与进度。
7. 无 PDF pageLabels 时使用已存 printed-page samples 推断印刷页偏移。

验证命令与实际结果：

- 全 import 文件首轮：33/33 通过（当时新增 5 项，既有 28 项）。
- 补齐最后 2 项后定向执行 `npm test -- --runInBand __tests__/app/import/import.test.ts -t 'local.*map'`：7/7 通过，既有 28 项未重跑。
- 最后一次 `npm run typecheck`：通过。
- 目标用例与 import 测试 ESLint：0 errors / 0 warnings。

设备修复及修复前后 counts / 实际章节质量比对由主流程执行，本工作单未操作设备或修改 App/debug 菜单，也未重新上传 PDF。
