/**
 * AI 服务配置（PRODUCT_DESIGN §6.5、M4 界面清单「编辑服务」）：配置存在 settings 表（aiServices），
 * API Key 存 Android Keystore（react-native-keychain），代码、日志、记忆、上下文页都不出现 Key。
 */
// 来源：AShareSim/src/ai/services.ts，GPL-3.0-only；仅保留纯表单解析。
import { endpointOf } from './protocol';
import { PROVIDER_PRESETS } from './models';
import type {
  AiProvider,
  AiService,
  Effort,
  Price,
  Protocol,
  ProviderKind,
} from './types';

// ---------- 表单 ----------

export interface ServiceForm {
  name: string;
  protocol: Protocol;
  baseUrl: string;
  model: string;
  effort: Effort;
  cache: 'auto' | 'off';
  auth: 'x-api-key' | 'bearer';
  /** 新填的 Key；空表示不改（编辑时）。 */
  key: string;
  /** 价格（美元 / 百万 tokens），空表示不填。 */
  priceInput: string;
  priceCacheRead: string;
  priceCacheWrite: string;
  priceOutput: string;
}

export type ServiceField = 'name' | 'baseUrl' | 'model' | 'key' | 'price';

export const SERVICE_FIELD_NAME: Record<ServiceField, string> = {
  name: '名称',
  baseUrl: 'Base URL',
  model: '模型',
  key: 'API Key',
  price: '价格',
};

export const DEFAULT_BASE_URL: Record<Protocol, string> = {
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com/v1',
  chat: 'https://api.openai.com/v1',
};

export function emptyForm(protocol: Protocol = 'anthropic'): ServiceForm {
  return {
    name: '',
    protocol,
    baseUrl: DEFAULT_BASE_URL[protocol],
    model: '',
    effort: 'low',
    cache: 'auto',
    auth: 'x-api-key',
    key: '',
    priceInput: '',
    priceCacheRead: '',
    priceCacheWrite: '',
    priceOutput: '',
  };
}

const milliText = (v: number) => String(v / 1000);

export function formOf(s: AiService): ServiceForm {
  return {
    name: s.name,
    protocol: s.protocol,
    baseUrl: s.baseUrl,
    model: s.model,
    effort: s.effort,
    cache: s.cache,
    auth: s.auth,
    key: '',
    priceInput: s.price ? milliText(s.price.input) : '',
    priceCacheRead: s.price ? milliText(s.price.cacheRead) : '',
    priceCacheWrite: s.price ? milliText(s.price.cacheWrite) : '',
    priceOutput: s.price ? milliText(s.price.output) : '',
  };
}

/** 美元 → 千分之一美元（整数）。 */
function parseUsd(text: string): number | null {
  const t = text.trim();
  if (!/^\d+(\.\d{1,3})?$/.test(t)) {
    return null;
  }
  return Math.round(Number(t) * 1000);
}

export type ServiceParse =
  | { ok: true; service: Omit<AiService, 'id' | 'keyTail'>; key: string | null }
  | { ok: false; errors: Partial<Record<ServiceField, string>> };

/**
 * 校验表单。hasKey：编辑已有服务时 Key 已经存过了，可以不填。
 * 价格要么都不填，要么 4 项都填。
 */
export function parseServiceForm(
  f: ServiceForm,
  hasKey: boolean,
): ServiceParse {
  const errors: Partial<Record<ServiceField, string>> = {};
  const name = f.name.trim();
  if (!name) {
    errors.name = '起个名字，例如「Claude 中转」';
  } else if ([...name].length > 20) {
    errors.name = '名字最多 20 个字';
  }
  const baseUrl = f.baseUrl.trim();
  try {
    endpointOf(f.protocol, baseUrl);
  } catch (e) {
    errors.baseUrl = (e as Error).message;
  }
  const model = f.model.trim();
  if (!model) {
    errors.model = '填模型名，例如 claude-sonnet-5-5';
  } else if (/\s/.test(model)) {
    errors.model = '模型名里不能有空格';
  }
  const key = f.key.trim();
  if (!key && !hasKey) {
    errors.key = '填 API Key（只存在本机 Android Keystore）';
  } else if (key && /\s/.test(key)) {
    errors.key = 'Key 里不能有空格或换行';
  }
  const texts = [
    f.priceInput,
    f.priceCacheRead,
    f.priceCacheWrite,
    f.priceOutput,
  ];
  let price: Price | null = null;
  if (texts.some(t => t.trim())) {
    const v = texts.map(parseUsd);
    if (v.some(x => x == null)) {
      errors.price =
        '价格要 4 项都填（美元 / 百万 tokens，最多 3 位小数），或者都不填';
    } else {
      price = {
        input: v[0]!,
        cacheRead: v[1]!,
        cacheWrite: v[2]!,
        output: v[3]!,
      };
    }
  }
  if (Object.keys(errors).length) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    service: {
      name,
      protocol: f.protocol,
      baseUrl,
      model,
      effort: f.effort,
      cache: f.cache,
      auth: f.protocol === 'anthropic' ? f.auth : 'bearer',
      price,
    },
    key: key || null,
  };
}

export const newServiceId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const keyTailOf = (key: string) => key.slice(-4);

export function emptyProvider(kind: ProviderKind): AiProvider {
  const preset = PROVIDER_PRESETS[kind];
  return {
    id: newServiceId(),
    kind,
    name: kind === 'custom' ? '' : preset.name,
    protocol: preset.protocol,
    baseUrl: preset.baseUrl,
    auth: kind === 'anthropic' ? 'x-api-key' : 'bearer',
    cache: 'auto',
    keyTail: '',
    models: [],
  };
}
