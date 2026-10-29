# 开发验收状态矩阵

2026-10-29，依据 [07-plan](../../07-plan.md) 与下列实际证据。**整体验收尚未完成。**「代码通过」只表示自动回归；「模拟器通过」注明实际执行范围；两者均不替代逐页视觉、手工点击、TalkBack 或实体机性能验收。历史失败保留，旧阶段截图不能证明最后一版一致。

| 计划 / 验收项 | 当前状态 | 实际证据 | 已证明的范围 / 仍缺什么 |
| --- | --- | --- | --- |
| T0 工程、边界、CI/APK | 基线已证实；最终改动待集成 | [07-plan T0](../../07-plan.md)、[CI 40745561296](https://github.com/MathildaStacy/Pagewise/actions/runs/40745561296)、[WORKLOG §14](../../WORKLOG.md) | 早期远端 Quality / Android APK通过；本轮最新完整check为79 suites / 1153 tests / 15 snapshots，debug / release arm64构建通过（54s）。不能据此宣称当前全部未提交改动已有最终提交及远端CI。 |
| T1 基础件、T3 数据仓库、T5 纯函数 | 代码通过 | [07-plan T1/T3/T5](../../07-plan.md) | 协议、迁移/事务、FTS/LIKE、Demo隔离、标记/引用、路线图、岔路、上下文和复习调度有回归；T5行覆盖100%。不等于全部原生交互通过。 |
| T2 四主题组件、Sheet草稿、系统字号2倍 | 模拟器阶段通过；最终样式待复验 | [T2记录和截图](../t2/README.md) | Pixel_10_Pro / Android17 / arm64 / debug+Metro；58组件、四主题、草稿切换保留与font_scale=2.0有记录。之后共享组件与页面持续修改，不能复用为最终全量验收。 |
| T2 原型颜色 / 对比度 | 原型色恢复；不能宣称全部AA通过 | [WORKLOG §12/14](../../WORKLOG.md) | Apple原型部分文字/按钮/图标配对低于既定对比度门槛；测试显式容纳原型差异。隐藏TabBar Blur曾污染push页截图，旧污染截图不得用于最终色彩确认。 |
| T4/T6 两套UI严格对应两份原型 | **尚未验收完成** | [修复前源码审计](../t4/final-source-audit.md)、[书库](../t4/library-ui-fidelity.md)、[设置](../t4/settings-ui-fidelity.md)、[复习/笔记](../t4/notes-review-ui-fidelity.md)、[听讲内容](../t4/study-content-ui-fidelity.md)、[Reader](../t4/reader-ui-fidelity.md) | 有逐项源码/数值与renderer回归，也有已修偏差；仍须在最终原生构建核对布局、字体、文案、间距、浮层、键盘和交互，并由负责人确认。不能写「一模一样已通过」。 |
| T4/T12 两皮肤×浅深色完整逐页截图 | **待补齐** | [T2截图索引](../t2/README.md)、[t4已有截图目录](../t4/) | 已有组件及书架/地图/学习/复习完成/我的/外观等部分画面；缺少覆盖全部页面、长内容与浮层状态的最终四主题对照清单。重拍的外观页不等于全产品截图完成。 |
| T4/T6 Demo导航、复习/笔记、全部学习点击场景 | 部分模拟器验证；完整走查待补 | [WORKLOG §9/13](../../WORKLOG.md)、[UI回归证据](../t4/) | 早前复习8卡完成页与页面/VM回归已验证；原型全部「可以试试」、卡点重讲闭环、笔记重进持久、流式中切主题/模式及停止等最终手工路径未有完整通过记录。 |
| T6/T12 真实书三个小节学习 | 模拟器生产会话通过 | [native-real-study.json](../t7/native-real-study.json) | ML Trading第3章PDF88–91，3节、23回答、58引用/无效0、每节10轮模式切换、小测/摘要/进度保存、15闪卡。是原生进程内生产会话harness；不证明每个点击入口、可见引用框或TalkBack。 |
| T6 Reader位置、公式、进程恢复 | 代码已修；最终原生界面待验 | [Reader修复记录](../t4/reader-ui-fidelity.md)、[三节会话](../t7/native-real-study.json) | 精确block offset、可见anchor、Apple连续纸面、原版导读高度有回归；会话模式位置持久已查。仍需最新构建实际引用/搜索/笔记跳转、原版⇄重排、长页目标可见性、公式SVG/主题色/降级、杀进程恢复走查。 |
| T7 真实AI结构任务与工具流程 | 本轮服务实测通过 | [最新live eval](../t7/live-eval-2026-10-29T02-16-48-637Z.json)、[T7说明](../t7/README.md) | Chat服务20/20结构任务、5/5生产流程、引用错误0，实际调用load_section/show_quiz。历史18/20失败仍保留；最新报告是修复后1轮，不代表所有服务/模型均通过。 |
| T7 Anthropic专项缓存 | **需要外部条件** | [eval cache.status](../t7/live-eval-2026-10-29T02-16-48-637Z.json) | 当前为anthropic-acceptance-unavailable。Chat五轮cacheRead>0不能替代Anthropic专项；需可用Anthropic协议服务及凭据后验证连续5轮。 |
| T8 整本PDF导入 / 恢复队列 | 模拟器实测通过相应范围 | [full-import.json](../t8/full-import.json)、[WORKLOG §3–6](../../WORKLOG.md)、[部分就绪截图](../t8/partial-ready.png) | 用户指定ML Trading827页，5片done、ready_to_page827、8859块；经历断网/杀进程后完成。该替代书不使用AIMA「6节26小节」假定；错误Token→更新→失败片继续的最终界面路径待验。 |
| T8 地图 / 印刷页码 | 核心数据复核通过；全图人工质量待验 | [map-quality.json](../t8/map-quality.json)、[最终27章重建](../t8/native-map-numbered-rebuild.json) | 27/27正文章首页匹配、偏移41；最终1342节，误识别章删除，学习表及5片记录不变。早期map-quality中的deviceRebuildPending已由后续重建证据更新；1342节层级与全部黄色核对项不能据27个章首页全部判通过。 |
| T8 全文搜索→正确原文位置 | 路由修复与代码回归通过；release设备复测中 | [书库回归说明](../t4/library-ui-fidelity.md)、[Reader回归](../t4/reader-ui-fidelity.md) | blockRef→section路由缺陷已修，58项相关测试通过；真实书短词/长词搜索到原文段落的release设备复测尚未有通过报告，不能提前标设备验收通过。 |
| T9 30个bbox / 引用位置框 | **待人工核对** | [native-render.json](../t9/native-render.json)、[Reader修复记录](../t4/reader-ui-fidelity.md) | 已有PDF位图/框交互代码与渲染API证据；缺随机30块在原书上偏差≤一行的逐块记录，以及高亮/笔记/便签在原版与重排一致的界面证据。 |
| T9 50页渲染 / 缓存 | 模拟器API通过；滚动性能待验 | [native-render.json](../t9/native-render.json) | 50页总2641ms、中位45ms、p95 66ms、缓存18,990,055bytes。渲染调用耗时不能推导滚动≥55fps、无OOM或实体机性能。 |
| T10 公版EPUB导入与真实AI | 模拟器harness通过；阅读界面待验 | [首次导入](../t11/native-storage-epub.json)、[修复后复验](../t11/native-storage-epub-with-images.json) | Alice17节/858块/1图，图片存在、loc858、导读保存；最新复验模型路线图3步、explain引用1/无效0。尚缺目录、图片与重排阅读的最终人工走查；商业EPUB仍需可用书籍样本。 |
| T11 Markdown / Anki导出 | 修后原生文件与归档内容通过；消费端确认待验 | [修后原生导出](../t11/native-storage-epub-with-images.json)、[实际导出检查](../t11/native-export-inspection.json) | 新Markdown实际为第03章，不再有错误第136章；Anki实际15张卡且各3列，归档中未发现凭据字节。Markdown样例仍需负责人确认；**缺Anki程序中的实际导入结果**，CSV检查不能替代。 |
| T11 清缓存→重新解析→迁移 | 修后EPUB模拟器逐记录通过；PDF迁移待验 | [历史失败](../t11/native-epub-reparse-before-fix.json)、[修后通过](../t11/native-epub-reparse-after-fix.json) | 历史learning-records-changed保留。修后858块→清理0→重建858、preservedBlocks858，图片1/解析1；清理与重解析后逐记录严格保留，changes数组均空、retainedAfterReparse=true。该通过范围为EPUB；PDF重新解析后的引用/高亮/便签迁移须单独验证。 |
| T11 备份 / 卸载重装恢复 | 修后模拟器完整卸载恢复通过 | [新备份生成](../t11/native-storage-epub-with-images.json)、[归档检查](../t11/native-export-inspection.json)、[卸载恢复](../t11/native-uninstall-restore.json)、[代码复核](../t11/backup-image-review.md) | 新备份实际含2本原件和552图、图片路径可迁移且无凭据字节。观察卸载后新安装空库，再恢复并重启；13表逐行一致、2原件与552图片哈希全匹配，AI Key / MinerU Token需重填。报告未记录构建类型，不延伸认定release专项恢复已验。 |
| T12 隔3天续学 / TalkBack | **待实际操作验收** | [计划T12](../../07-plan.md)、[WORKLOG待完成](../../WORKLOG.md) | 无拨时3天后1分钟接上的完整设备记录；无TalkBack完成「打开书→听讲→提问→回主线」记录。无障碍属性与renderer测试不能替代屏幕阅读器操作。 |
| T9/T12 中端实体机55fps / release冷启动<1.5s | **需要外部条件** | [T2设备限制](../t2/README.md)、[WORKLOG §11](../../WORKLOG.md) | 当前证据来自模拟器/debug或原生API；需中端实体Android设备、release构建及实际帧率/冷启动测量。模拟器结果不作实体性能结论。 |

收尾顺序：保留重新解析历史失败及修后通过证据，完成搜索release设备复测、PDF重新解析迁移，以及最终构建的Reader/bbox、完整四主题逐页对照、TalkBack与续学走查；外部服务/样本/实体机项目单独保留待验。最后按变更范围提交、核对最终check/build与远端CI，不能仅按原计划复选框宣告全部完成。
