# Pagewise 应用图标

![Pagewise](../../../android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png)

原创矢量标记：展开的两页书和一枚书签，表达逐页理解、下次接着读。
墨蓝 `#24467F` 与米白 `#FBF8F1` 取自纸感皮肤，书签使用琥珀色 `#E7B66B`。
不添加文字或细小的装饰，保证桌面尺寸下的辨识度。

- [SVG](pagewise-icon.svg) 与 [512px PNG](pagewise-icon.png)：完整方形画布，可用于发布素材。
- Android 7.x：五种密度的圆角方形和圆形 PNG。
- Android 8+：独立背景和矢量前景，由启动器裁切形状；前景位于中央 66dp 安全圆内。
- Android 13+：单色图标保留书签负形，颜色跟随系统主题。

图形和颜色统一维护在 [生成脚本](../../../scripts/generate-app-icons.cjs)；执行 `npm ci && npm run android:icons` 重新生成全部资源。
PNG 由固定版本的 `@resvg/resvg-js` 渲染，矢量和位图共用同一组路径。
图标为本项目原创，随项目采用 GPL-3.0-only。
