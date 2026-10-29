# 最终界面截图索引

2026-10-29，Pixel_10_Pro / Android17 / arm64。主页面与Demo学习/浮层为最终源码的debug+Metro。最新release已安装启动；其生产关于页隐藏开发Demo入口，因此Demo截图继续用debug并手动关闭警告条，未为截图增加生产入口。系统屏幕1280×2856、density480，原型手机390×844 CSS px；不同宽度/系统状态栏及平台字形不能据截图数量判定逐像素通过。

## 四主题主页面

`paper-light`、`paper-dark`、`glass-light`、`glass-dark`各11张：`shelf`书架、`map`地图、`review`复习、`notes`笔记、`me`我的、`mineru`解析服务、`ai`AI服务、`prefs`讲解偏好、`storage`存储备份、`about`关于、`appearance`外观，共44张。大标题已进入Apple滚动正文；Paper仍固定导航。

Apple浅色旧批次两行出现黑底，最新两页与dark→light复验未复现。保留`*-after-switch`作为该次复验。没有据此加入页面重挂载或声称定位原生根因。

## 学习与浮层

旧版Apple学习/浮层截图与含警告遮挡的画面已移出最终目录。额外文件按`主题-场景.png`命名：`study-resume`续学、`study`听讲、`reader`重排原文、`paragraph-menu`段落菜单、`note-dialog`记笔记、`study-menu`更多、`section-sheet`小节浮层。仅文件实际存在的组合表示已拍摄，不能推导四主题全场景通过。截图中原文和图均为标注的隔离Demo示意数据。

## 浏览器原型参考

[reference目录](../reference/)来自ego lite实际打开`prototype.html`及`prototype-apple.html`，截取手机区域；Paper浅色11张，Apple浅色13张、深色13张。为避免解析进度定时重画导致元素断开，部分捕获临时暂停原型650ms定时器，未修改源文件或样式。

完整原型逐页/长内容/全部浮层、流式过程中切肤与停止、30条原生引用路径、完整TalkBack仍须按[验收状态矩阵](../../t12/acceptance-status.md)继续。当前截图是review材料，不表示负责人已确认“一模一样”。

[构建与完整检查](build-check.json)
