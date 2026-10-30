# 产品体验改善与并行开发验证

体验分支：`codex/feature-product-experience`。独立工作目录：`/Users/boren.fang/.codex/worktrees/product-experience/Pagewise`。从 `bd9366bfe661f0657fdd8705350aa10098389eb1` 创建，功能提交 `414f56a6e665017f1084ffc1b70a2fd8c9a45b2e`。未合入 main，未修改其他会话的工作目录。

## 改善的取舍

按“影响核心学习路径、用户可控制、能验证收益”排序。收益依据是现有实现、真实书籍样本和操作验证；尚未经过真实用户长期使用验证。

| 优先级 | 原来的阻碍                                             | 已实现                                                                                                | 对用户的实际帮助                                                         |
| ------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1      | 目录里大量仅由字号产生的层级警告，前言出现负页码       | 有编号的真实冲突仍保留；无编号标题采用匹配书签层级；旧库只过滤已确认的字号误报；前言使用物理 PDF 页码 | 用户不必逐项处理误报，页码可与文件对应；不重分小节、不改变学习位置       |
| 2      | 回来后只知道停在哪一节，不知道刚才在思考什么           | 继续学习卡显示当前节最近问题、未解决卡点和下一步；回到书架自动刷新                                    | 直接恢复上下文，不必等待模型生成回顾                                     |
| 3      | 笔记只能按书逐节翻找；问答摘要无法还原完整解释         | 本机搜索摘要、问答、个人笔记及卡点；根据原消息 ID 打开完整问答并保留引用                              | 能找回自己的学习记录，并直接核对原文；不把笔记上传到搜索服务             |
| 4      | 不合适的闪卡反复出现，又没有纠错入口                   | 编辑问题/答案、暂停/恢复、当前会话撤回暂停、先复习 5 张                                               | 用户能维护卡片质量并控制一次复习的量；保留原复习进度与历史               |
| 5      | 不会答测验时被卡在交互里                               | 给提示、暂时跳过；普通提问及复习卡返回提问正确配对工具结果；原题仍可作答                              | 不会答时可以继续学习；跳过不记为答对或已掌握                             |
| 6      | 连接测试不能证明 MinerU 可用，所有解析失败都指向 Token | 使用实际连接测试；仅认证类失败显示 Token 操作；明确后台/锁屏会暂停本地传输                            | 能区分认证与其他故障，减少无效换 Token；不会误认为后台一直在传输         |
| 7      | 备份是否成功不清楚，恢复前无法辨认备份                 | 显示最近本机成功备份；先选择、校验并预览时间/书数/原文件数，再确认恢复                                | 用户能确认恢复对象；预览保存独立文件，避免重复选择导致预览与恢复内容错配 |

没有加入新的学习模式、强制掌握测验、知识图谱、云账号或新视觉系统。新增页面使用现有 kit 和 tokens，原皮肤保持各自的表现。

## 数据与兼容边界

闪卡暂停状态需要 schema 2，迁移默认为未暂停。旧 schema 1 备份会按现有恢复迁移流程升级。新版本数据库应由支持 schema 2 的整合版本打开。备份不包含 API Key 和 Token；恢复不会把其他设备的导出记录显示为本机最近成功备份。

目录修复的真实样本包含 8,859 个内容块与 1,030 个书签。旧库 846 个标记中，显示为待核对的数量降至 145；其中一条仍保留合并疑点。重建前后均为 1,342 个小节，所有非标记字段与 parts 完全相同；没有通过减少小节数掩盖问题。

## 独立分支验证

- `npm run check`：ESLint、TypeScript 通过；89 个测试套件通过，1 个套件跳过；1,296 个测试通过，2 个测试跳过；15 份快照通过。
- Android `:app:assembleRelease` 成功。
- 使用单独的只读 AVD 实例 `emulator-5588`，未操作其他会话使用的模拟器。数据验证使用本机已有书籍副本及明确的合成问答。
- 原生操作已验证：笔记搜索 → 详情 → 完整问答 → 点击引用进入对应原文；5 张复习入口 → 编辑并保存 → 暂停 → 撤回；管理页筛选暂停项并恢复；导出备份后显示成功时间；选择同一备份出现准确预览并可取消。原生地图由基线截图的 843 个待确认提示降至 146 个，前言显示物理 PDF 页码；该模拟器与前述私有样本为不同数据库。
- 恢复流程的回归包含真实 ZIP/SQLite、旧/新备份、预览不替换数据库、导出失败不更新成功时间、双击/取消/卸载后的异步结果处理。

## 三分支整合

整合验证在另外的 `codex/integration-product-experience` 分支及 `/Users/boren.fang/.codex/worktrees/product-experience-integration/Pagewise` 中进行。合并顺序与固定快照：

1. 体验功能 `414f56a6e665017f1084ffc1b70a2fd8c9a45b2e`。
2. 架构 `bcca59134cc2b157fa0deac26f8f6077eb3dd380`，合并提交 `54d4a01`。
3. UI `53f2d70786a4ea62512c0ff755b8bea25f56f072`，合并提交 `dfaf4e6`。
4. 组合回归与清理 `c5cebe1d4fa0dab9f6e818b287880399dbce235d`。

实际冲突发生在 `StudySession.ts`、`features/notes/presenters.ts`、`features/study/useStudyVM.ts`、`StudyView.tsx`。整合同时保留了架构侧 StudyHarness、轻量笔记查询、历史加载/reader 拆分，以及 UI 侧品牌控件、草稿提问和焦点行为，未用整文件覆盖任一方改动。

整合后的 `npm run check` 通过：ESLint、TypeScript、101 个套件、1,951 个测试、15 份快照；保留已有 1 个套件/2 项跳过。新增组合验证覆盖五皮肤 × light/dark：闪卡编辑、保存、暂停/恢复、撤回与 5 张入口；笔记搜索、完整问答与引用；七个设置页及备份预览/恢复控件。

架构会话当时仍有未提交改动，它们和快照之后的新提交不在本次验证范围内。后续合并以这个整合分支为已解决冲突的参考，重新运行完整检查。

整合与体验提交间的 Android 原生代码、platform、依赖版本没有差异。原生抽查使用相同 Release 原生壳，加上整合快照的正式 Metro bundle（dev=false/minify=true）、Hermes 字节码及重新签名安装包；没有声称重新编译未变化的原生代码。

原生抽查覆盖了五套皮肤：纸感浅色的完整路径、苹果风深色（系统字号 1.3 与大正文）的管理页、Meta 深色的编辑/保存、新谷歌浅色的搜索/完整问答/引用、Win11 浅色的暂停/恢复与 PDF 原版页面。整合后的原文页已成功渲染，日志未见 AndroidRuntime / ReactNativeJS 错误。

本机整合验证包：[pagewise-integration-review.apk](/Users/boren.fang/.codex/worktrees/product-experience-integration/Pagewise/android/app/build/outputs/apk/release/pagewise-integration-review.apk)。SHA-256：`d911991a1d0812624b7e0ed0c2a335f066568fc756c10fe1cf5e8c258bb0a5c2`。

## 原生截图

- [笔记搜索](evidence/product-experience/notes-search-paper.png)
- [完整问答与引用](evidence/product-experience/full-qa-paper.png)
- [闪卡编辑](evidence/product-experience/card-editor-paper.png)
- [暂停与撤回](evidence/product-experience/card-paused-paper.png)
- [暂停闪卡管理](evidence/product-experience/card-management-paper.png)
- [备份恢复预览](evidence/product-experience/backup-preview-paper.png)
- [目录与前言页码](evidence/product-experience/map-labels-paper.png)
- [苹果风深色、大字号管理页](evidence/product-experience/card-management-glass-dark-large.png)
- [整合：Meta 深色编辑](evidence/product-experience/integration-meta-card-editor-dark.png)
- [整合：新谷歌浅色搜索](evidence/product-experience/integration-google-notes-light.png)
- [整合：新谷歌浅色问答](evidence/product-experience/integration-google-full-qa-light.png)
- [整合：Win11 浅色卡片管理](evidence/product-experience/integration-win11-cards-light.png)
- [整合：Win11 原文页面](evidence/product-experience/integration-win11-source-light.png)
