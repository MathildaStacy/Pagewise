import { useEffect, useState } from 'react';
import {
  readUiEnvironment,
  subscribeUiEnvironment,
  type UiEnvironment,
} from '@platform/environment';

export function useUiEnvironment(): UiEnvironment {
  const [environment, setEnvironment] = useState<UiEnvironment>({
    lowRam: false,
    powerSave: false,
    blurAllowed: false,
  });
  useEffect(() => {
    let active = true;
    const update = (value: UiEnvironment) => {
      if (active) setEnvironment(value);
    };
    const unsubscribe = subscribeUiEnvironment(update);
    readUiEnvironment().then(update);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  return environment;
}
