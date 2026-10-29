设计系统 Token、组件契约与代理（T2）。

## 流式输出（新增皮肤须知）

新皮肤默认继承全部效果：逐字吐出、新字从模糊变清晰、markdown 结构始终完整、生成结束后可「显示全部」。

| 环节             | 位置                                     | 负责                                                                                                 | 皮肤需要做什么                                                             |
| ---------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 防止露出半截语法 | `@core/markup` 的 `stableStreamText`     | 流式时暂不显示尚未闭合的 `**`、`$`/`$$` 和单独的列表/标题/代码围栏标记，闭合后再出现                 | 无                                                                         |
| 落库交接         | `StudySession`                           | 流式条目与落库消息在同一次更新中交接，并沿用列表 key（`streamKeys`），组件不重挂载，吐字从原位置继续 | 无                                                                         |
| 逐字吐出         | `useReveal(doc, streaming)`（`reveal/`） | 按「可见字符」截断已解析的文档，公式、引用卡、图片整体出现；积压越多吐得越快                         | 调 `tokens.motion.reveal`：`fadeMs`、`blur`、`minRate`、`maxRate`、`lagMs` |
| 模糊 → 清晰      | `revealTextStyle`、`RevealFadeIn`        | 新字透明度上升、模糊光晕收拢；整块元素淡入                                                           | 同上；`blur: 0` 只做透明度渐显                                             |
| 生成中 / 跳过    | `Kit.Typing`、`Kit.RevealSkip`           | 生成中显示提示；生成结束但剩余内容还要等超过约 1.2 秒时，显示「显示全部」                            | 可选：覆盖 `Typing`（光标、呼吸点）或 `RevealSkip`（按钮样式）             |

覆盖 `AiMessage` 时，调用 `useReveal(doc, streaming)`，把返回的 `doc` 交给 `Kit.RichView`，用 `RevealContext` 包住正文，并在 `canSkip` 时渲染 `Kit.RevealSkip onPress={skip}`；参考 `base/content.tsx` 的实现。系统开启「减少动态效果」时 `useReveal` 直接返回完整文档。

页面或新布局复用两个与皮肤无关的 hook：

- `useStickToBottom(listRef, { resumeWhen, disabled, animated })`：把返回的 `listProps` 展开到 `FlatList` / `ScrollView`。内容增长时贴底；用户上滑阅读即暂停，滑回底部或 `resumeWhen` 由假变真（新一轮开始）时恢复。
- 跟随状态只由手势滚动更新，自动滚动的惯性结束事件不会取消跟随；用户拖动期间暂停程序滚动，避免把正在阅读的位置拉回底部。
- `useStableHandlers(intents)`：身份恒定、总调用最新实现的回调集合，配合 `memo` 过的列表行，流式刷新时只有正在生成的那一行重渲染。注意：它对任意键都返回函数，可选回调请勿用真假判断是否存在。
