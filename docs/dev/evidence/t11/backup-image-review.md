# Backup imageFiles 功能复核

结论：本次范围内未确认功能缺陷。只读复核实现与测试，未修改代码、数据库或操作设备。

- 导出：逐书籍去重复制已引用图片；绝对路径和 `file://` 路径去除当前书籍根目录后，仅在 SQLite 备份快照中改为 `images/...`，活动数据库不变；图片不依赖 `includeOriginals` 开关。
- 恢复：声明的图片先校验存在；覆盖前保留原件与图片副本；复制或数据库替换失败时恢复旧文件，原先不存在的目标会删除，再重启。现有图片覆盖回滚测试通过。
- 兼容：`imageFiles` 可省略，旧 manifest 按空列表处理；路径校验拒绝绝对路径、反斜杠、`.`/`..` 段和重复项。
- Android 复制语义：已检查安装版本 `react-native-blob-util` 的 `ReactNativeBlobUtilFS.java:520–568`；`cp` 使用 `new FileOutputStream(dest)`，会截断覆盖现有文件，正常完成后回调成功。应用已为导出、覆盖和回滚目标创建父目录。
- 只读真实库检查：`device-current.db` 的 551 个图片引用均为 `images/...` 相对路径，属于本次支持的路径形式。

验证：`__tests__/app/storage.test.ts` 与 `__tests__/services/backup/manifest.test.ts` 共 10 项通过，包括图片随备份恢复、绝对路径转相对路径、图片/原件覆盖回滚和旧 manifest 校验。原生备份恢复由 root 继续实测；本报告不把源码复核视为设备验收。
