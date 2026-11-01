# 标题与正文结构精修验收

验证对象：`feature/refine-structure-redesign`，AIMA 第四版的 2,145 页真实 MinerU 解析结果。原书及完整解析结果保存在本机私有夹具中，不随代码提交。

## 已验证

- 完整 `npm run check`：ESLint、TypeScript、108 个测试套件、2,034 项测试、15 个快照通过；1 个既有套件 / 1 项测试因缺少其私有输入跳过。AIMA 私有夹具测试实际运行。
- Android arm64 Debug 构建通过：`:app:assembleDebug --no-daemon --max-workers=2 -PreactNativeArchitectures=arm64-v8a`。
- v0.0.11 → v0.0.13 覆盖安装与冷重启通过。3 本书、25,368 个解析块、2,109 个章节、9 条精修记录的数量，以及 4 个已采纳运行的状态、批次和 token 用量均保持一致；21.3 的 5 个旁注和 2 处续段仍生效，见 [upgrade.json](upgrade.json)。最终检查摘要见 [check-summary.json](check-summary.json)。
- 全书地图的前后统计见 [map-metrics.json](map-metrics.json)。28 个编号章及两个附录均可定位；页边术语不再承接编号小节。
- Pixel_10_Pro 原实例中保存的运行记录确认：第 21 章导读，DeepSeek 完成 4 / 4 批、4 项修改已采纳；21.1.1，DeepSeek 完成 12 / 12 批、9 项修改曾采纳，后由原页复核替代；21.1.1 原页复核使用备用 gpt-6.1-sol，完成 6 / 6 批、21 项修改已采纳、0 条疑点。
- 21.1.1 的重排视图实际确认公式 21.1 编号、行内公式及续段显示，截图见 [21.1.1-equation.png](21.1.1-equation.png)。重新进入重排后可恢复公式的现象，触发本次补充的慢启动修复：TeX 占位不丢弃当前公式稍后到达的成功结果。
- 公式冷启动、缓存读取延迟、旧公式结果隔离的自动回归通过；无效公式继续回退 TeX。
- 19.6.2：备用 gpt-6.1-sol 结构精修完成 7 / 7 批、6 项修改曾采纳；原页复核最终完成 3 / 3 批、20 项修改已采纳。标题保持 3 级，Gradient descent、Learning rate、Chain rule 等术语显示为旁注，同页算法行没有误续段。原页复核恢复了被 `sub` 标签打碎的三行算法文字，截图见 [结构结果](19.6.2-structure.png) 和 [原页复核结果](19.6.2-vision.png)。
- 21.3 导读：备用 gpt-6.1-sol 结构精修完成 5 / 5 批、7 项修改已采纳；CNN、Kernel、Convolution、Stride、Receptive field 共 5 个旁注，两处跨页续段连续显示。实测撤销后旁注和续接均消失，Stride 恢复源标题类型；再次采纳后恢复 5 个旁注和两处续接。截图见 [旁注与续段](21.3-notes.png)。
- 21.3 的公式 21.9 抽检发现 Android 对 MathJax 嵌套 SVG 视口剪裁错误，导致七行向量括号中段缺失；转换为等价分组与剪裁路径后原生复验通过，见 [公式与续段](21.3-equation-continuation.png)。回归比较转换前后栅格像素，并验证已保存的旧公式缓存直接修正，不重新生成。
- [online-runs.json](online-runs.json) 保存了数据库实际运行摘要及 token 用量，不包含 API 密钥、模型原始响应或整本书解析内容。`undone` 的旧运行由后续原页复核替代，未丢失历史结果。

## 服务故障与环境

第 19.6.2 节的 DeepSeek 实机调用遇到 HTTP 502，点击「继续精修」后遇到 HTTP 524；两次都没有完成第一批，状态和规则建议仍保存。按用户在原对话中提供的备用配置，后续抽检实际使用 gpt-6.1-sol；未将备用模型结果记作 DeepSeek 成功。

原模拟器被另一项 Pagewise 评审占用后，按用户要求新建独立 `Pagewise_Refine` AVD：4 GB userdata、2 核、2 GB RAM，使用 `emulator-5590` / Metro 8097。迁移了现有书籍、解析数据库与图片，未重新调用 MinerU；这不是原 10 GB AVD 的克隆。用户清理磁盘后可正常启动，原 `emulator-5554` 留给其他评审。

## 原始解析的边界

20.3.1 标题及部分页边术语没有被 MinerU 产出，26.2.1 被识别为第二个 26.2。当前统计和回归不把这些源解析缺失算作已恢复；不补写无法由源块确认的内容。

19.6.2 的一个源块把 Epoch、SGD、Minibatch 等旁注合成表格，目前修订模型不能把一个源块拆成多个块，因此保留 1 条疑点。21.3 结构模式的 13 条疑点包含源文本变量错位、上下标和重复标点；需要原页复核才能改字，结构模式继续保留源文。
