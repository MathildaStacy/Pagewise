import type { Container } from '../container';
import { getImportRuntime } from './importRuntime';
import { SettingsInputError } from './settings';
import { mineruFailureKind } from '@services/mineru/types';

export const requiresMineruToken = (code: string | null) =>
  !!code && mineruFailureKind(code) === 'auth';

/** Authenticate without uploading a document or creating a parsing task. */
export async function testMineruConnection(c: Container): Promise<string> {
  if (c.mode === 'demo') return '演示模式不会连接 MinerU；请在我的书库中测试。';
  const result = await getImportRuntime(c).mineru.test();
  if (!result.ok)
    throw new SettingsInputError(
      result.error?.message ?? '无法连接 MinerU，请稍后重试',
    );
  return `MinerU 连接成功 · ${Math.round(result.latencyMs)} ms`;
}
