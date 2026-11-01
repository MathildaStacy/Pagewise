Pagewise UI 补充审查证据，2026-11-02。

源码基线：1d3a5a4；APK：0.0.14 debug，独立 applicationId com.pagewise.pminspect。设备：emulator-5590，1280×2856，480 dpi（3 px/dp），竖屏。

本目录书架、伴读、原文与复习截图均来自内置演示书库，用于检查界面状态。真实书籍解析与章节组织证据位于相邻的 2026-11-01-pagewise 目录。ui-review-board.png 第三栏使用该目录下的真实 alice-reflow.png，其他栏使用本目录截图。

paper-shelf、paper-study 使用系统字体 100%；文件名带 font130 的截图使用 130%。native-mount-error 是运行异常页，不是产品正常界面。PNG 对应的 XML 来自同一状态的 UIAutomator 层级。

measurements.json 的正文窗口使用 ScrollView 边界，px 按 3 换算 dp；比例分母为应用安全内容区，排除状态栏、底部系统区域与键盘。只描述这些留存状态。键盘截图使用普通键盘状态，排除了首次字体变更提示条。

contrast.json 使用当前皮肤 token、WCAG sRGB 相对亮度公式；RGBA 先在相应背景上合成。ink3_on_surface 不是全页所有文字的通过率；未覆盖渐变所有像素、禁用态或真实图像的色彩。

native-gradient-crash.txt 仅保留 pminspect PID 11392 的 AndroidRuntime 异常栈；exit-info.txt 为该测试包的进程退出记录。模拟器日志时间使用其自身时区，不作为报告日期依据。native-mount-error 为另一次视图挂载异常，两条异常不能视作同一个根因或稳定复现。

完整方法、建议、验收与适用范围见上两级的 2026-11-01T15-39-26Z__src-app-tsx.md。
