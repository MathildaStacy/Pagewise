import { AiError, type FetchLike } from './http';

export interface RecordedResponse {
  /** 不存请求头或 Key；可选校验 URL / 方法以防误用录制。 */
  url?: string;
  method?: string;
  status: number;
  chunks: string[];
}

/** 仅回放已录制的响应字节，仍经过真实协议和 SSE 解析。T6 再增加教学脚本。 */
export function createRecordedFetch(
  recordings: readonly RecordedResponse[],
): FetchLike {
  let cursor = 0;
  return async (url, init) => {
    if (init.signal?.aborted) {
      throw new AiError('cancelled', '已停止');
    }
    const recording = recordings[cursor++];
    if (!recording) {
      throw new AiError('protocol', '没有更多 AI 录制响应');
    }
    if (
      (recording.url && recording.url !== url) ||
      (recording.method && recording.method !== init.method)
    ) {
      throw new AiError('protocol', 'AI 请求与录制响应不匹配');
    }
    for (const chunk of recording.chunks) {
      if (init.signal?.aborted) {
        throw new AiError('cancelled', '已停止');
      }
      if (recording.status >= 200 && recording.status < 300) {
        init.onChunk?.(chunk);
      }
      await Promise.resolve();
    }
    return {
      status: recording.status,
      text: async () => recording.chunks.join(''),
    };
  };
}
