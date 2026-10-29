# v0.0.5 三项补验

2026-10-30，接续 [v0.0.3 续验](acceptance-v0.0.3.md)。本轮从 `main / 635c0cb` 开始，只处理 Apple 灰蒙、TalkBack 播报和新增闪卡回读；已有图片、菜单、四主题逐页及导入/备份证据继续按原报告列明的范围复用。

## 结果

| 项目 | 结论 | 证据 |
| --- | --- | --- |
| Apple 整屏灰蒙 | 已复现并修复。Android 使用已有 Token 半透明填充，停止挂载原生 BlurView；iOS 的原生模糊路径保留。浅深色书架、地图、听讲、重排阅读、上下文浮层及返回后画面均复验 | [截图与原生树](v0.0.5-acceptance/README.md)、[色值](v0.0.5-acceptance/native-colors.json) |
| 新增闪卡原生回读 | 通过。原生编辑正反面→保存修改→保存本节→进入 3.5.3；推进隔离 Demo 时钟一天，在复习第 10/12 张重新打开新卡并翻面，两个唯一标记均与原生 SQLite 读回一致 | [正面](v0.0.5-acceptance/native/new-card-native-reopened-front.png)、[答案](v0.0.5-acceptance/native/new-card-native-reopened-back.png)、[数据库](v0.0.5-acceptance/new-cards-db.json)、[操作记录](v0.0.5-acceptance/card-readback-flow.json) |
| TalkBack 语音内容 | 已通过录音转写核对下列书名、操作顺序和角色。保留原始音频；人工音质、语调和长篇连续听感仍未完成 | [录音与转写索引](v0.0.5-acceptance/README.md#talkback) |

## 灰蒙修复与原生复验

隔离进程中，限制模糊色层的候选方案仍出现整屏 `#646464`，因此撤回，没有纳入产品。关闭原生模糊后冷启动，同一听讲背景恢复为 `#000000`、卡片恢复为 `#1C1C1E`。本轮只在 `SkinProvider` 禁用 Android 的原生模糊，复用组件已有的半透明填充，不改变页面结构或皮肤配色。

最终代码的冷启动及页面往返结果：深色背景 `#000000`、Reader 纸面 `#1C1C1E`；浅色背景 `#F2F2F7`、纸面 `#FFFFFF`。浮层打开时的背景压暗属于浮层遮罩，关闭后恢复上述背景；没有整屏残留灰色。代价是 Android 材质不再实时模糊背后内容。iOS 路径有既有 renderer 检查，本轮没有 iOS 设备实测。

## TalkBack

使用 TalkBack `17.0.0.889642762`、Google TTS 中文本地语音包，探针确认默认语言 `zho_CHN`。原生探针设置 `FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES`，采集前后均确认 TalkBack 保持绑定。

- 书架录音转写为“打开人工智能，现代方法第四版，Button. Double Tap to Activate.”；原生双击后打开“书的地图”。
- 听讲页依次聚焦“伴读菜单”“懂了，下一步”“不懂就问…”“发送”。录音转写顺序相同，角色分别为 button、button、edit box、button disabled；空提问框时发送禁用符合页面状态。
- 本地 Whisper small 转写把“伴读菜单”记成同音的“半读彩丹”，把返回后的“书架”记成“输价”。原始结果保留，没有改写成完全匹配。系统界面语言为英文，因此角色和手势提示为英文。

这些证据核对可辨识的播报内容、顺序和控件状态，不将自动转写等同于人工音质听验，也不重复宣称覆盖全 App TalkBack。

## 隔离、验证与提交范围

原生最终证据来自 Android 17 arm64、1280×2856、density 480 的 Pixel 10 Pro 配置模拟器。使用独立包 `com.pagewise.acceptance`、内存 SQLite Demo，不向真实书库写入数据。闪卡验证只调整 Demo 的 `Clock`，没有改设备日期或直接修改卡片到期日。新卡 id 13、盒 1、到期日 2026-10-31，正反面分别保留 `_native_v005_front` / `_native_v005_back`。

本轮产品源码只修改 `SkinProvider` 和两项相关回归，并将版本更新为 0.0.5 / versionCode 5。开始时三份未提交的历史验收准确性补充予以保留；已有设计文档已在 main，另一 worktree 的新皮肤开发未合入。

完整 ESLint、TypeScript、83 个 Jest 套件 / 1253 tests / 15 snapshots，以及正式入口 arm64 release 构建记录见 [验证结果](v0.0.5-acceptance/validation.json)。`635c0cb` 的 [云端 CI](https://github.com/MathildaStacy/Pagewise/actions/runs/40892642803) 已成功；最终发布提交的 CI 链接记录在 [v0.0.5 发布页](https://github.com/MathildaStacy/Pagewise/releases/tag/v0.0.5)，不以旧 CI 代替新源码验证。

临时入口和 debug applicationIdSuffix 已恢复；借用设备的测试包、语音包、反向端口及本轮 Metro 已清理，TalkBack/TTS/字号已恢复，见 [清理回执](v0.0.5-acceptance/cleanup.json)。先前 emulator-5554 在清理前退出，该离线 AVD 内的测试包没有再次启动清除；其真实 App 数据未清空。

本轮剩余项为人工音质/语调听验。其他历史验收缺口继续见 [状态矩阵](../t12/acceptance-status.md)，不扩大本轮排查范围。
