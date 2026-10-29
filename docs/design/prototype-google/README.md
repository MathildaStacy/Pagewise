# 新谷歌风（Material 3 · Google Play）原型源文件

`../prototype-google.html` 是由这里的文件拼出来的单文件原型，直接用浏览器打开即可（不联网）。纸感原型 `../prototype.html`（源文件 `../prototype/`）和苹果风原型 `../prototype-apple.html`（源文件 `../prototype-apple/`）保持原样。

这套是从 `prototype-apple/` 复制出来改的：**页面、功能、操作流程、文案和每个按钮所在的区域和原版一致**（`docs/dev/02-skins.md` §2），只把组件形态、材质、字体、动效换成 Android / Google Play 的习惯。没有照搬 explore 稿里「读书 / 听讲」单独一行标签页的布局：模式切换仍在顶栏右侧。

Token 取自 `explore/src/play.css`（Google 蓝 #0B57D0 的 M3 色调方案）。CSS 变量名沿用苹果风原型（`--tint`、`--label2`…），因为 JS 里直接引用；取值换成 M3 的。

| 和苹果风的区别 | 新谷歌风的做法 |
| --- | --- |
| 顶栏 | M3 small top app bar：左「←」（不带上一页标题）、左对齐标题；滚动后底色换成 surface-container；根页没有大标题 |
| Tab 栏 | 贴底的 M3 navigation bar，选中项图标外有药丸指示器 |
| 书架「导入」 | 右下扩展 FAB（16 圆角、primary-container） |
| 列表 | 通栏列表、主色分组标题、无 chevron、图标不带色块 |
| 按钮 / 分段 / 开关 | 描边按钮 + 实心主按钮，按下圆角变小；segmented button（选中项带对勾）；M3 开关（开时圆点带对勾） |
| 浮层 | 贴底 bottom sheet（28 圆角、拖动条），按钮横排靠右、主按钮在最右；对话框 28 圆角、文字按钮靠右 |
| 提示 | 底部 Snackbar（贴在导航栏 / 输入区 / FAB 上方） |
| 段落菜单 | Android 文字选择工具栏 |
| 按下反馈 | 涟漪（`ui-base.js` 统一挂在可点元素上） |
| 听讲 | 路线图是 filter chip；提问气泡是 Google Messages 的浅蓝；「AI 举例」用 Gemini 渐变；已解决的岔路是 Play 列表行（圆角方图标） |
| 读书 | 书页是 elevation 1 的卡片；问答便签是黄色小标签 |

语义色：主线蓝、岔路紫、补充推导青、AI 举例 Gemini 渐变（洋红）、卡点橙、对绿、错红、高亮 / 便签黄。

| 文件 | 内容 |
| --- | --- |
| `shell.html` | 页面骨架（Android 外框、挖孔状态栏、手势条、浮层层） |
| `base.css` | L1 Token（浅色 + 深色）、涟漪、顶栏、导航栏、FAB、列表、按钮、分段、开关、文本框、Sheet、Dialog、Snackbar、选择工具栏、控制台 |
| `pages.css` | 各页面样式 |
| `icons.js` | 图标（2px 线宽；返回、更多、发送、闪光等换成 Material 形状） |
| 其余 `*.js` | 同苹果风原型（数据、状态、各页面）；`ui-base.js` 改了顶栏 / 导航栏 / 分段 / Snackbar 位置并加了涟漪，`ui-me.js` 的外观页列出四套皮肤 |

```bash
python3 build.py   # 生成 ../prototype-google.html
```

打开 `prototype-google.html#听讲`、`#读书`、`#书的地图` 等可以直接跳到某个页面（名称见控制台的「页面」列表）。
