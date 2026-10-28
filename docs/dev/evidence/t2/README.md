# T2 原生验收记录

2026-10-29，Pixel_10_Pro / Android 17 / arm64 模拟器，debug APK + Metro。

- `npm run check`：24 suites / 550 tests 通过；58 个组件各有 paper/glass × light/dark 契约渲染测试。
- Android arm64 APK 构建成功；UiEnvironment TurboModule codegen 与注册通过，App 实际启动并创建 SQLite。
- paper light 的 19 个原型颜色逐项一致；四套主题对比度测试通过。glass 调整值见 [02-skins](../../02-skins.md) Q-12 说明。
- 原生 Sheet 中输入 `QA42`，依次切换 glass light → paper light → paper dark → glass dark，浮层保留且文字未丢。
- Android `settings system font_scale=2.0` 实测按钮、行、chips可显示/换行；测试后恢复1.0。修正了 glass AppBar 在短模式标签上挤字的问题，增加系统2倍与预览2倍的布局回归测试。
- 截图只有合成预览内容；PageOrig 的示意图由本地合成生成，没有真实书籍或密钥。
- 模拟器软件渲染很慢，本阶段截图不作为 T9/T12 的真机帧率或启动性能验收。

| 界面 | paper light | paper dark | glass light | glass dark |
| --- | --- | --- | --- | --- |
| AppBar、Button、QuickActions、步骤、TabBar | [截图](paper-light-top.png) | [截图](paper-dark-top.png) | [截图](glass-light-top.png) | [截图](glass-dark-top.png) |
| Composer / 材质 | [截图](paper-light-bottom.png) | [截图](paper-dark-bottom.png) | [截图](glass-light-bottom.png) | [截图](glass-dark-bottom.png) |
| Sheet 保留草稿 | [截图](paper-light-sheet-draft.png) | [截图](paper-dark-sheet-draft.png) | [截图](glass-light-sheet-draft.png) | [截图](glass-dark-sheet-draft.png) |

[glass 分组 Row](glass-dark-rows.png) · [SelectionMenu](glass-dark-selection.png) · [系统2倍 glass按钮](glass-dark-system-font2.png) · [系统2倍 glass行](glass-dark-system-font2-rows.png) · [系统2倍 paper行](paper-dark-system-font2-rows.png)

后续 PR 使用这里的图片；负责人对整套页面的视觉确认与 TalkBack 留在 T12。
