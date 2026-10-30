import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useContainer } from '@app/ContainerProvider';
import {
  loadAiOptions,
  presentAiOptions,
  normalizeAiOptions,
  type ConversationConfig,
} from '@app/usecases/aiOptions';

/** 会话配置由调用方保存；模型清单在页面重新获得焦点时刷新。 */
export function useAiOptions(
  value?: ConversationConfig | null,
  purpose: 'teach' | 'tidy' = 'teach',
) {
  const c = useContainer();
  const [data, setData] = useState<Awaited<ReturnType<typeof loadAiOptions>>>({
    providers: [],
    config: null,
  });
  const [error, setError] = useState<string>();
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadAiOptions(c, purpose)
        .then(result => {
          if (active) {
            setData(result);
            setError(undefined);
          }
        })
        .catch(cause => {
          if (active)
            setError(
              cause instanceof Error ? cause.message : '读取模型配置失败',
            );
        });
      return () => {
        active = false;
      };
    }, [c, purpose]),
  );
  const state = presentAiOptions(data.providers, value ?? data.config);
  return {
    state,
    error,
    patch(patch: Partial<ConversationConfig>) {
      const config =
        state.config ??
        (state.models[0]
          ? { ...state.models[0], effort: 'low' as const, search: false }
          : null);
      return config
        ? normalizeAiOptions({ ...config, ...patch }, data.providers)
        : null;
    },
  };
}
