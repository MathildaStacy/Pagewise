import { useCallback, useRef, useState } from 'react';
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
  // React 批量渲染之前的后续修改也要保留刚选的参数。
  const latest = useRef(state.config);
  latest.current = state.config;
  return {
    state,
    error,
    patch(patch: Partial<ConversationConfig>) {
      const config =
        latest.current ??
        (state.models[0]
          ? { ...state.models[0], effort: 'low' as const, search: false }
          : null);
      latest.current = config
        ? normalizeAiOptions({ ...config, ...patch }, data.providers)
        : null;
      return latest.current;
    },
  };
}
