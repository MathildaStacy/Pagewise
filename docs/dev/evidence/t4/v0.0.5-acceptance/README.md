# v0.0.5 补验证据

结论见 [三项补验报告](../acceptance-v0.0.5.md)。最终原生验证使用独立包和内存 Demo；源代码基线为 main `635c0cb`，加本轮 Android 模糊降级修复。历史证据保留原验证范围。

## Apple 颜色

| 状态 | 深色 | 浅色 |
| --- | --- | --- |
| 书架 | [截图](native/final-apple-dark-shelf.png) | [截图](native/final-apple-light-shelf.png) |
| 地图 | [截图](native/final-apple-dark-map.png) | [截图](native/final-apple-light-map.png) |
| 听讲 | [截图](native/final-apple-dark-listen.png) | [截图](native/final-apple-light-listen.png) |
| 上下文浮层 | [截图](native/final-apple-dark-context.png) | [截图](native/final-apple-light-context.png) |
| 重排阅读 | [截图](native/final-apple-dark-reader.png) | [截图](native/final-apple-light-reader.png) |
| 浮层关闭、阅读/听讲切换后 | 深色 Reader 在关闭上下文后采集 | [浅色听讲](native/final-apple-light-listen-after-modal.png) |

各截图旁同名 `.xml` 是原生无障碍树。[颜色采样](native-colors.json) 列出坐标与 RGB；浮层打开时的遮罩颜色单独保留，不作为无浮层背景值。对照 [灰蒙画面](native/apple-dark-grey-before.png) 来自未采用的透明 tint 候选方案，不属于最终通过证据。

## 新增闪卡

[小结](native/new-card-summary.png) → [原生编辑正反面](native/new-card-native-edited.png) → [保存草稿](native/new-card-edit-saved.png) → [保存本节进入下一节](native/new-card-section-saved.png) → [次日复习概览](native/new-card-next-day-overview.png) → [重新打开正面](native/new-card-native-reopened-front.png) → [翻面回读](native/new-card-native-reopened-back.png)。

[SQLite 只读结果](new-cards-db.json)、[推进后的 Demo 时钟](demo-next-day-corrected.json)、[到期日与当前时钟](card-readback-clock.json)、[逐卡操作](card-readback-flow.json)。未修改设备时间或卡片到期日。

## TalkBack

| 场景 | 音频 | 原始转写 | 原生操作 |
| --- | --- | --- | --- |
| 书名→双击开地图 | [WAV](speech/talkback-book-final-zh.wav) | [JSON](speech/talkback-book-final-zh-asr.json) | [动作](speech/talkback-book-final-actions.json)、[地图](native/talkback-book-final-activated.png) |
| 伴读菜单→下一步→提问框→发送 | [WAV](speech/talkback-controls-zh.wav) | [JSON](speech/talkback-controls-zh-asr.json) | [动作顺序](speech/talkback-controls-actions.json)、[焦点](native/talkback-controls-focused.png) |

[服务版本](speech/talkback-version.txt)、[中文语音状态](speech/final-tts-chinese.txt)、[采集前绑定](speech/talkback-binding-before.txt)、[采集后绑定](speech/talkback-binding-after-final.txt)。转写中的同音误字保留；人工音质与长篇听感未完成。

## 构建与恢复

[验证结果](validation.json)、[全量 Jest](final-jest.txt)、[ESLint](final-lint.txt)、[TypeScript](final-typecheck.txt)、[release 构建](final-release-build.txt)、[签名](release-signature.txt)、[APK 元数据](release-badging.txt)、[清理回执](cleanup.json)。lint 和 TypeScript 成功时日志为空。最终发布提交 CI 见 [GitHub release](https://github.com/MathildaStacy/Pagewise/releases/tag/v0.0.5)。
