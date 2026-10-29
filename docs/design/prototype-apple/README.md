# 苹果风（glass）原型源文件

`../prototype-apple.html` 是由这里的文件拼出来的单文件原型，直接用浏览器打开即可（不联网）。纸感（paper）原型 `../prototype.html` 和它的源文件 `../prototype/` 保持原样。

依据：`docs/dev/02-skins.md` §2（皮肤之间什么必须一样）、§5（组件契约）、§7（glass 逐页要点）；Token 取自 `explore/src/apple.html`；听讲 / 读书的交互以 `explore/src/app.js` 为准，页面清单、导航和文案与纸感原型一致（叫法按需求文档改成「听讲 / 读书」「步」，MinerU 数字按 06 §2.1 用 200 页 / 1000 页）。

| 文件 | 内容 |
| --- | --- |
| `shell.html` | 页面骨架（手机外框、玻璃顶栏、悬浮 Tab 栏、浮层层） |
| `base.css` | L1 Token（浅色 + 深色）、顶栏 / 大标题、Tab 栏、分组列表、按钮、分段控件、开关、Sheet、Alert、HUD、编辑菜单、控制台 |
| `pages.css` | 各页面样式 |
| `icons.js` | 图标（lucide 风格、圆头） |
| `data.js` | 演示数据（同纸感原型；3.5.2 的讲解改成按「步」组织：`STEPS`、`LESSON`、`ALT`、`QUIZ`、`GUIDE`、`PINS`） |
| `core.js` | 状态、书的地图、复习调度、上下文估算、解析模拟 |
| `ui-base.js` | 路由、顶栏（根页大标题随滚动收起）、浮层（下滑关闭）、富文本、流式输出 |
| `ui-shelf.js` | 书架、书架搜索、导入、解析设置、解析进度 |
| `ui-map.js` | 书的地图（章卡片弹性展开）、小节详情、全书搜索 |
| `ui-listen.js` | 听讲流程：按步讲解、跳过、换个说法 / 举例 / 推导、考考我、本节小测、续学、岔路与折叠、自由提问、读书 ⇄ 听讲切换 |
| `ui-study.js` | 听讲 / 读书页：路线图胶囊、岔路条、thread、悬浮快捷动作和输入框、原文预览、AI 看到的内容 |
| `ui-reader.js` | 读书：原版 / 重排、本节导读、讲过的段落、问答便签、段落编辑菜单、单独打开的读书页 |
| `ui-done.js` | 本节小结 |
| `ui-review.js` | 复习（闪卡 3D 翻面、卡点清单）、笔记、导出 |
| `ui-me.js` | 我的（iOS 设置页风格）及子页、外观（新增） |
| `ui-console.js` | 原型控制台（场景 / 页面 / 深浅色）、启动 |

```bash
python3 build.py   # 生成 ../prototype-apple.html
```

打开 `prototype-apple.html#听讲`、`#读书`、`#书的地图` 等可以直接跳到某个页面（名称见控制台的「页面」列表）。
