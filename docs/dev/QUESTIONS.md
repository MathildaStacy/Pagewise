# 待定问题

实现中遇到需求不清楚的地方追加在这里：编号、问题、采用的默认做法、状态。负责人答复后改状态并同步改相关文档。

| 编号 | 问题 | 默认做法 | 状态 |
| --- | --- | --- | --- |
| Q-1 | MinerU 官方文档（2026-10-29 核对）的限制是单文件 ≤ 200 页、每天 1000 页高优先级；PRODUCT_DESIGN 写的是 600 页 / 2000 页 | 按官方现行值，做成常量 | 待负责人确认后改 PRODUCT_DESIGN |
| Q-2 | 模式开关的顺序：原型是「伴读 \| 原文」（AI 在左），PRODUCT_DESIGN 和 explore 是「读书 \| 听讲」 | 按 PRODUCT_DESIGN：「读书 \| 听讲」，位置在顶栏右侧（原型位置） | 待确认 |
| Q-3 | paper 皮肤的深色、补充推导 / AI 举例 / 便签的颜色原型里没有 | 02 §4.2 的初稿值，过对比度测试 | T2 后负责人看 SkinGallery 定 |
| Q-4 | STUDY_ENGINE 说分片合并后块要按页码重新编号；边解析边学时重编号会让引用指错 | 块号稳定：`seq = PDF 页序号 × 1000 + 页内序号`，不重编号 | 已采用，待确认后改 STUDY_ENGINE |
| Q-5 | 「划词」：RN 里做块内任意文字范围选择成本高 | V1 以整块为单位（点段落），范围选择放 M5 | 待确认 |
| Q-6 | 「我的」里新增「外观」入口（选皮肤、深浅色、正文字号），原型里没有 | 放在第二组第一行（存储与备份之前） | 待确认 |
| Q-7 | MinerU Token 有效期 API 拿不到 | 更新 Token 时可选填有效期；收到 A0211 时标记过期 | 已采用 |
| Q-8 | T0 的路径别名和分层 lint 需要额外构建依赖，01 §2 未逐项列出 | 增加开发依赖 `babel-plugin-module-resolver@5.0.2`、`eslint-plugin-import@2.32.0`、`eslint-import-resolver-typescript@3.10.1`，不增加运行时能力；沿用 RN 模板的 Babel/Metro/ESLint/Jest/类型工具链 | T0 已采用 |
| Q-9 | 01 §3 写页面只能 import kit 和 VM 类型，但 TSX 需要 React / React Native 展示 API | 允许 React / RN 纯展示 API、同目录展示组件；禁止 RN 的存储、网络、原生模块等副作用入口，业务仍通过 VM；页面不得 import 皮肤 | T0 已采用，待确认 |
| Q-10 | T1 要求 AI 网关记录用量，但 setting / ai_usage 在 T3 才建表 | T1 网关通过注入的 AiConfiguration 读配置/记用量，设备默认使用未配置的内存适配器；T3 接入 SQLite 仓库后持久化，T1 不提前建表 | T1 采用，T3 替换 |
| Q-11 | 把 createTestContainer 和 Node SQLite 驱动静态导出在设备组合根会让 Metro 尝试打包 node:sqlite | 测试工厂单独从 app/testing.ts 导入；app/container.ts 仅包含设备与共用组装逻辑 | T1 已采用 |
| Q-12 | glass 原稿若干语义色与辅助文字未达到 WCAG AA；paper 原色必须与原型一致 | paper 四套原始颜色保持；glass 亮色 ink2/accent/stuck/ok/bad/derive/example 与深色 detour/bad 按 02 记录微调；ok/stuck 保留给图标，小字用 ink/stuckInk，引用小字用 accentInk | T2 自动门禁通过 |
| Q-13 | Glass 低端/省电自动降级不能只依赖手工 blurEnabled prop | T2 增加轻量 Android UiEnvironment TurboModule，读取 low-RAM / Power Save 并监听省电切换，应用层将结果传入 SkinProvider | T2 已实现并完成原生构建；降级分支有测试 |
