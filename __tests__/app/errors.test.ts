import { toAppError } from '@app/errors';
import { AiError } from '@services/ai/http';
import { MineruError } from '@services/mineru/types';

test.each([
  'A0202',
  'missing_token',
  '-60005',
  '-60009',
  '-60018',
  '-60003',
  'network',
  'timeout',
  'cancelled',
  'protocol',
])('maps MinerU %s to its actionable message without raw detail', code => {
  const source = new MineruError(code);
  const error = toAppError(source);
  expect(error.code).toBe(`mineru.${source.kind}`);
  expect(error.message).toBe(source.message);
  expect(error.detail).toBeUndefined();
});

test.each([
  ['auth', false],
  ['not_found', false],
  ['rate_limit', true],
  ['server', true],
  ['bad_request', false],
  ['network', true],
  ['timeout', true],
  ['cancelled', false],
  ['protocol', true],
] as const)('maps AI %s to actionable Chinese text', (code, retry) => {
  const error = toAppError(
    new AiError(code, 'service error sk-secret-value mnr_token-value'),
  );
  expect(error.code).toBe(`ai.${code}`);
  expect(error.message).toMatch(/[\u4e00-\u9fff]/);
  expect(error.retry).toBe(retry);
  expect(error.detail).not.toContain('sk-secret');
  expect(error.detail).not.toContain('mnr_token');
});

test('expired MinerU token explains where to update and how parsing resumes', () => {
  const error = toAppError({ code: 'A0211', message: 'secret' });
  expect(error.code).toBe('A0211');
  expect(error.message).toContain('我的 → 解析服务');
  expect(error.message).toContain('失败的那一片');
  expect(error).not.toHaveProperty('detail');
});

test.each([null, 'secret text', new Error('private question and custom-key')])(
  'unknown errors do not expose original messages',
  error => {
    expect(toAppError(error)).toEqual({
      code: 'unknown',
      message: '出了点问题，请重试',
      retry: true,
    });
  },
);
