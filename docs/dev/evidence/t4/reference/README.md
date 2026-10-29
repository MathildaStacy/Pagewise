# 浏览器原型画面

2026-10-29，ego lite space2，用户同意在原任务空间消失后新建。源文件保持不变。

- `paper-light-*`：prototype.html，11页。
- `glass-light-*`、`glass-dark-*`：prototype-apple.html，各13页。

按手机区域裁图：Paper (214,24) / Apple (218,28)，390×844 CSS px。原型解析进度每650ms重绘造成snapshot ref过期/元素断开，后续捕获仅临时暂停该原型的parseTimer；未改CSS、内容或源文件。静态Demo数值与原生演示库的实际模拟进度可能不同。完成后已调用task.finish({keep:[]})关闭空间。

原生对应画面在[final](../final/)，视口/系统栏和字形不同，不能将捕获数量当作像素验收结论。
