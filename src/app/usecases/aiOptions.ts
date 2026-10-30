import type { Container } from '../container';
import { Linking } from 'react-native';
import { readAssignments, readProviders } from './settings';
import {
  capabilitiesOf,
  EFFORT_NAME,
  normaliseConfig,
  searchAvailability,
} from '@services/ai/models';
import type { AiProvider, ConversationConfig } from '@services/ai/types';
export type { ConversationConfig } from '@services/ai/types';

export interface AiOptionsState {
  config: ConversationConfig | null;
  models: { key: string; label: string; providerId: string; model: string }[];
  selected: string;
  efforts: { key: ConversationConfig['effort']; label: string }[];
  search: { ok: boolean; reason: string };
}

export async function loadAiOptions(c: Container, purpose: 'teach' | 'tidy') {
  const [providers, assignments] = await Promise.all([
    readProviders(c),
    readAssignments(c),
  ]);
  const a = assignments[purpose];
  const config = a
    ? normaliseConfig(
        { ...a, effort: a.effort ?? 'low', search: false },
        providers,
      )
    : null;
  return { providers, config };
}

export const normalizeAiOptions = normaliseConfig;

export async function openExternalSource(url: string) {
  if (!/^https?:\/\//i.test(url)) throw new Error('来源地址无效');
  await Linking.openURL(url);
}

export function presentAiOptions(
  providers: AiProvider[],
  value: ConversationConfig | null,
): AiOptionsState {
  const models = providers.flatMap(p =>
    p.models
      .filter(m => m.enabled && capabilitiesOf(p, m).chat)
      .map(m => ({
        key: JSON.stringify([p.id, m.id]),
        label: p.name + ' · ' + (m.name ?? m.id),
        providerId: p.id,
        model: m.id,
      })),
  );
  const selected = models.find(
    m => m.providerId === value?.providerId && m.model === value.model,
  );
  const config = selected && value ? normaliseConfig(value, providers) : null;
  const p = providers.find(item => item.id === config?.providerId);
  const m = p?.models.find(item => item.id === config?.model);
  const caps = p && m ? capabilitiesOf(p, m) : null;
  return {
    config,
    models,
    selected: selected?.key ?? '',
    efforts: (caps?.thinking ?? []).map(key => ({
      key,
      label: EFFORT_NAME[key],
    })),
    search:
      p && m
        ? searchAvailability(p, m)
        : { ok: false, reason: '请先配置并分配 AI 模型' },
  };
}
