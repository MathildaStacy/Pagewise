/** 从真实 /models 响应获取模型；先完成所有分页，失败时不覆盖用户原来的模型与标注。 */
// 来源：AShareSim/src/ai/catalog.ts，GPL-3.0-only；已适配 Pagewise。
import {
  AiError,
  defaultFetch,
  httpError,
  redact,
  type FetchLike,
} from './http';
import { endpointOf, errorMessageOf, headersOf } from './protocol';
import type { AiProvider, ModelCapabilities, ModelEntry } from './types';
import { inferCapabilities } from './models';

/** 只采用接口明确声明的能力；不通过付费生成请求逐个探测模型。 */
export function modelMetadata(item: any): Partial<ModelCapabilities> {
  const result: Partial<ModelCapabilities> = {};
  const caps = item.capabilities;
  const declared = Array.isArray(caps) ? caps : null;
  const read = (...keys: string[]): boolean | undefined => {
    for (const key of keys) {
      if (typeof caps?.[key] === 'boolean') return caps[key];
      if (typeof caps?.[key]?.supported === 'boolean')
        return caps[key].supported;
      if (typeof item[key] === 'boolean') return item[key];
      if (declared?.includes(key)) return true;
    }
    return undefined;
  };
  const context =
    item.context_length ?? item.context_window ?? item.max_input_tokens;
  if (typeof context === 'number' && Number.isFinite(context) && context > 0)
    result.context = context;
  for (const [field, keys] of [
    ['chat', ['chat', 'text_generation']],
    [
      'tools',
      [
        'tools',
        'tool_calling',
        'function_calling',
        'supports_tools',
        'supports_function_calling',
      ],
    ],
    [
      'search',
      ['search', 'web_search', 'supports_web_search', 'supports_search'],
    ],
    ['vision', ['vision', 'image', 'supports_vision', 'supports_image_input']],
    ['audio', ['audio', 'supports_audio']],
    ['video', ['video', 'supports_video']],
  ] as const) {
    const value = read(...keys);
    if (value !== undefined) result[field] = value;
  }
  const modalities =
    item.architecture?.input_modalities ??
    item.input_modalities ??
    (typeof item.architecture?.modality === 'string'
      ? item.architecture.modality.split('->')[0].split('+')
      : undefined);
  if (Array.isArray(modalities)) {
    result.vision ??= modalities.includes('image');
    result.audio ??= modalities.includes('audio');
    result.video ??= modalities.includes('video');
  }
  const params = item.supported_parameters;
  if (Array.isArray(params))
    result.tools ??= params.includes('tools') || params.includes('tool_choice');
  // 一些 /models 接口提供完整的推理档位，直接用于选择器。
  const efforts =
    caps?.thinking?.efforts ?? caps?.thinking ?? item.reasoning_efforts;
  if (Array.isArray(efforts)) {
    const allowed = new Set([
      'off',
      'on',
      'minimal',
      'low',
      'medium',
      'high',
      'xhigh',
      'max',
    ]);
    const levels = [
      ...new Set(
        efforts
          .map((v: any) => (v === 'none' ? 'off' : v))
          .filter((v: any) => allowed.has(v)),
      ),
    ];
    if (levels.length || !efforts.length) {
      result.thinking = levels as ModelCapabilities['thinking'];
      const known = inferCapabilities(item.id ?? '');
      result.thinkingStyle = levels.length
        ? known.thinkingStyle === 'none'
          ? 'reasoning'
          : known.thinkingStyle
        : 'none';
    }
  }
  if (read('reasoning', 'thinking', 'supports_reasoning') === false) {
    result.thinking = [];
    result.thinkingStyle = 'none';
  }
  return result;
}

export async function listModels(
  provider: AiProvider,
  key: string,
  opts: { fetchImpl?: FetchLike; signal?: AbortSignal } = {},
): Promise<ModelEntry[]> {
  const fetchImpl = opts.fetchImpl ?? defaultFetch;
  const ctl = new AbortController();
  const abort = () => ctl.abort();
  opts.signal?.addEventListener('abort', abort);
  if (opts.signal?.aborted) {
    ctl.abort();
  }
  const timer = setTimeout(abort, 45_000);
  const entries = new Map<string, ModelEntry>();
  const cursors = new Set<string>();
  let after = '';
  try {
    for (let page = 0; page < 20; page++) {
      const url =
        endpointOf(provider.protocol, provider.baseUrl, 'models') +
        (after ? '?after_id=' + encodeURIComponent(after) : '');
      const res = await fetchImpl(url, {
        method: 'GET',
        headers: headersOf(provider, key),
        body: '',
        signal: ctl.signal,
      });
      const text = await res.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
      if (res.status < 200 || res.status >= 300) {
        throw httpError(
          res.status,
          redact(errorMessageOf(json, text.slice(0, 150)), key),
        );
      }
      if (!Array.isArray(json?.data)) {
        throw new AiError(
          'protocol',
          '模型列表响应里没有 data 数组，检查协议和 Base URL',
        );
      }
      for (const item of json.data) {
        const id = typeof item.id === 'string' ? item.id.trim() : '';
        if (!id || /\s/.test(id)) {
          continue;
        }
        const old = provider.models.find(m => m.id === id);
        entries.set(id, {
          id,
          name: typeof item.name === 'string' ? item.name : undefined,
          enabled: old?.enabled ?? false,
          price: old?.price ?? null,
          detected: modelMetadata(item),
          overrides: old?.overrides,
        });
      }
      if (!json.has_more) {
        // 手动添加但未出现在列表里的模型仍保留，避免供应商暂时隐藏模型时丢配置。
        for (const old of provider.models) {
          if (!entries.has(old.id)) {
            entries.set(old.id, old);
          }
        }
        return [...entries.values()].sort((a, b) => a.id.localeCompare(b.id));
      }
      if (typeof json.last_id !== 'string' || cursors.has(json.last_id)) {
        throw new AiError('protocol', '模型列表分页游标无效，请重试或手动添加');
      }
      after = json.last_id;
      cursors.add(after);
    }
    throw new AiError(
      'protocol',
      '模型列表超过 20 页，未覆盖已有配置；请手动添加需要的模型',
    );
  } catch (e) {
    if (e instanceof AiError) {
      throw e;
    }
    if (ctl.signal.aborted) {
      throw new AiError(
        opts.signal?.aborted ? 'cancelled' : 'timeout',
        opts.signal?.aborted
          ? '已取消获取模型'
          : '获取模型超时，请检查地址后重试',
      );
    }
    throw new AiError(
      'network',
      '获取模型列表失败：' +
        redact(e instanceof Error ? e.message : String(e), key),
    );
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', abort);
  }
}
