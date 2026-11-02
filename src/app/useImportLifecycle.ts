import { useEffect } from 'react';
import { Alert, AppState } from 'react-native';
import { Intake } from '@platform/Intake';
import type { Container } from './container';
import { importBookFile, type ImportSelection } from './usecases/importBooks';
import { getParseQueue } from './usecases/parseQueue';
import { importError } from './usecases/importErrors';

export function useImportLifecycle(
  c: Container,
  enabled: boolean,
  onImport: (selection: ImportSelection) => void,
) {
  useEffect(() => {
    if (c.mode !== 'device') return;
    let mounted = true;
    const update = (state: string | null | undefined) => {
      if (enabled && state === 'active')
        getParseQueue(c)
          .resume()
          .catch(() => c.log.warn('恢复解析队列失败'));
      else getParseQueue(c).pause();
    };
    update(AppState.currentState);
    const listener = AppState.addEventListener('change', update);
    const receive = (file: Parameters<typeof importBookFile>[1] | null) => {
      if (!file) return;
      importBookFile(c, file)
        .then(selection => {
          if (mounted) onImport(selection);
        })
        .catch(error => {
          if (mounted) Alert.alert('无法导入', importError(error).message);
        });
    };
    const unsubscribe = Intake.subscribe(receive);
    Intake.initial()
      .then(receive)
      .catch(() => c.log.warn('读取外部文件失败'));
    return () => {
      mounted = false;
      listener.remove();
      unsubscribe();
      getParseQueue(c).pause();
    };
  }, [c, enabled, onImport]);
}
