# T7 真实 AI 验收

2026-10-29，本机已配置 Chat 协议的测试服务；凭据保存在仓库外，不进入报告。

- 最新：`live-eval-2026-10-29T02-16-48-637Z.json`，20/20 结构任务、5/5 生产 StudySession 流程通过，引用错误 0。
- 历史：`live-eval-2026-10-29T01-23-01-534Z.json`，18/20；保留用于 review，不覆盖失败历史。
- 修复：plan 不可拆分组与合法边界；explain 评测改为与生产相同的单块输入和 teach 用途；schema 校验没有放宽。
- Chat 五轮均报告真实缓存读取。Anthropic 专项没有可用服务，状态明确为 unavailable，不能据此判定通过。
- 复现：`PAGEWISE_AI_CONFIG=/本机受限路径/ai.json npm run eval:live`。每轮自动保留带时间戳报告，`live-eval.json` 为最新副本。

问题定位、方案与限制见 [工作记录](../../WORKLOG.md)。
