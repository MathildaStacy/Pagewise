# 学习消息组件原型收敛

日期：2026-10-29。范围：`src/ui/kit/base/content.tsx` 中学习消息与卡片展示。未改原型、业务状态或 usecase。

## 对照依据

- Paper：`docs/design/prototype/ui-study2.js`、`prototype/shell.html` 的 `.m-u`、`.hist`、`.resume`、`.quiz`、`.prop`。
- Apple：`docs/design/prototype-apple/ui-study.js`、`prototype-apple/pages.css:112–181` 的 thread / message / card 规则。
- Source / Aux / Check / Fold / Done / 独立 Typing 为完整 Apple 原型已有内容；Paper 原型未画出这些新增引擎消息时，沿用 Paper 的边框、纸张、字号和紧凑控件体系，不引入 Apple 的整组外观。

## 已修正

| 组件 | Paper | Apple |
| --- | --- | --- |
| UserBubble | 15px/24，84% 最大宽，9×12 内边距，右下角 4px；引用 12px、底距4 | 16px/24，80% 最大宽，9×15 内边距，21px 全圆角；引用 13px、上2/下5 |
| StepHeader | 保留 Paper 不显示额外步骤胶囊的呈现 | 移除错误的浅底胶囊；步骤13px、标题21px/1.3，顶距14、间隔8 |
| ToolSteps | 6px圆点、顶距6、12px文字；执行中使用ink3；岔路圆点使用detour | 16px book图标、13px文字、间隔6；执行中按1200ms周期在1/.4透明度之间变化，Reduce Motion停用动效 |
| SysDivider | 12px/ink3文字，两侧1px横线、间隔8；岔路线浅紫 | 居中fill2胶囊、12px文字、12px圆角、3×10内边距、上下4外边距；岔路使用indigo底色 |
| Resume | 14px/1.7 正文、段落底距6；12×14/14px 圆角/1px 边框；次操作 ghost | 16px/1.6 正文、段落底距6；13×16×14/20px 圆角；12px 时钟标签；次操作 fill |
| Source | 纸张底色和紧凑边框；15px/1.8 衬线正文 | 原文图标使用 book；标签12px/图标15px，正文16px/1.75；上13/横16/下14，20px 圆角 |
| Aux / Check | 使用 Paper 纸面与正文规则 | 分别还原16px/1.62与16px/1.6，20px 圆角；标签图标15px与12px文字；Aux 保留点击标签展开/收起，移除原型没有的附加箭头 |
| 历史入口 | 12px、白底1px边框、14px圆角，4×12内边距 | 13px、16px圆角、6×14内边距；历史不再误显示“已解决”绿色勾选卡 |
| Fold | 沿用 Paper 边框、紧凑标题 | 20px圆角；52px标题行、22px绿色圆形勾、15px标题、13px计数；展开正文15px；分隔线.5px，内边距12×16×16 |
| Quiz | 15px/1.6问题，14px/1.5选项；1px边框、10px圆角、9×11内边距、底距6；字母以 `A.` 显示 | 16px/1.55问题，15px/1.45选项；fill2底、16px圆角、11×14内边距、底距7；24px圆形字母徽标，正确/错误使用圆徽标内check/close；其余选项透明度.5 |
| Proposal | 12px标签、13px正文、12px圆角、10×12内边距；使用共享proposalBorder | 旗帜标签使用orange-ink、正文16px；orange底、1.5px虚线、20px圆角；首操作primary，其余fill |
| Done | 保留 Paper 消息卡体系 | check与12px绿色标签、16px正文；移除额外大标题和原型没有的小结按钮，整卡保留原来的onPress与无障碍操作 |
| Typing | 保留已有等待状态语义 | 三个8px圆点、间隔5、8×2内边距；1100ms周期、180ms错峰；Reduce Motion静态显示，无额外spinner和可见文字 |

- Quiz 不再强制 `minHeight:48`，可见高度由原型内边距和内容决定；锁定、选择、正确/错误状态与回调仍由原有 props 控制。
- 字号和行高通过当前 token 的缩放比计算，保留系统字号缩放；不依赖 skin ID。
- Source / Aux / Check / Fold 使用局部 typography context，RichView 的解析、引用、图片与公式路由未改变；没有该上下文的 Reader / BlockView 继续使用原来的 book / AI 字体。
- 切换皮肤保留 Aux 展开状态；Fold、Quiz、Resume、Proposal、Source、Done 的真实交互入口仍连接原回调。
- 固定展示文案在组件内按 presentation 处理：Apple 的 `续学 · 距上次 n 天` 显示 `接着上次 · 距上次 n 天`，Paper 反向对应；已知的 `检查一下` / `考考你` 前缀按两套原型对应，标题原本存在 `第 n 步/段` 时只换展示单位、保留真实数字；Apple 的“这一节讲/学完了”对应“本节讲完了”。`本节小测` 和其他自定义标题保持原内容，没有步号的标题不添加步号，未修改VM或引擎状态。

## 验证

- `ui/components.test.tsx`、`features/study.test.tsx`、`ui/math.test.tsx`、`ui/PageOrig.test.tsx`：4 suites / 268 tests 全通过。包括四主题组件渲染、Quiz选择/锁定、学习VM、数学渲染与原版页框交互。
- `eslint src/ui/kit/base/content.tsx --max-warnings 0` 通过。
- `tsc --noEmit` 通过。
- `git diff --check -- src/ui/kit/base/content.tsx` 通过。

本次按分工未操作浏览器、模拟器或真机；上述是源码数值与现有交互回归，不是逐像素截图证明。最终视觉对照由主集成者统一完成。
