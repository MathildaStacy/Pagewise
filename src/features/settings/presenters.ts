export function tokenExpiry(expiresOn: string | undefined, today: string) {
  if (!expiresOn) return { label: '未填写有效期', warn: false, expired: false };
  const days = Math.round(
    (Date.parse(expiresOn + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) /
      86400000,
  );
  if (!Number.isFinite(days))
    return { label: '未填写有效期', warn: false, expired: false };
  return {
    label:
      days < 0
        ? 'Token 已过期'
        : days === 0
        ? 'Token 今天到期'
        : 'Token ' + days + ' 天后过期',
    warn: days <= 7,
    expired: days < 0,
  };
}
export function formatBytes(value: number): string {
  if (value < 1024) return value + ' B';
  if (value < 1024 * 1024) return (value / 1024).toFixed(1) + ' KB';
  return (value / 1024 / 1024).toFixed(1) + ' MB';
}
export function tokens(value: number): string {
  return value >= 1000000
    ? (value / 1000000).toFixed(2) + 'M'
    : value >= 1000
    ? (value / 1000).toFixed(1) + 'k'
    : String(value);
}
export const modelKey = (providerId: string, model: string) =>
  JSON.stringify([providerId, model]);
export const protocolLabel = (protocol: 'anthropic' | 'openai' | 'chat') =>
  ({
    anthropic: 'Anthropic Messages',
    openai: 'OpenAI Responses',
    chat: 'OpenAI Chat Completions',
  }[protocol]);
