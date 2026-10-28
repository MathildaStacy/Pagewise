import { AiError, type AiErrorCode } from '@services/ai/http';
import { redact } from './log';

export type ErrorCode = `ai.${AiErrorCode}` | 'A0211' | 'unknown';
export interface AppError {
  code: ErrorCode;
  message: string;
  detail?: string;
  retry?: boolean;
}

const aiMessages: Record<AiErrorCode, { message: string; retry: boolean }> = {
  auth: {
    message: 'AI 服务的 Key 无效或已过期，请在「我的 → AI 服务」更新',
    retry: false,
  },
  not_found: {
    message: '找不到这个 AI 模型，请检查服务地址和模型名称',
    retry: false,
  },
  rate_limit: { message: 'AI 服务请求太多，请稍后重试', retry: true },
  server: { message: 'AI 服务暂时出错，请稍后重试', retry: true },
  bad_request: {
    message: 'AI 服务不接受这个请求，请检查模型和服务设置',
    retry: false,
  },
  network: { message: '连不上 AI 服务，请检查网络后重试', retry: true },
  timeout: { message: 'AI 服务响应超时，请重试', retry: true },
  cancelled: { message: '已停止', retry: false },
  protocol: {
    message: 'AI 服务返回了无法读取的内容，请检查协议设置后重试',
    retry: true,
  },
};

export function toAppError(error: unknown): AppError {
  if (error instanceof AiError) {
    return {
      code: `ai.${error.code}`,
      ...aiMessages[error.code],
      detail: redact(error.message),
    };
  }
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'A0211'
  ) {
    return {
      code: 'A0211',
      message:
        'MinerU Token 已过期，请在「我的 → 解析服务」更新，更新后会从失败的那一片继续',
      retry: false,
    };
  }
  // 未知异常的 message 可能含请求正文或未登记的凭据，不进入 UI/日志详情。
  return { code: 'unknown', message: '出了点问题，请重试', retry: true };
}
