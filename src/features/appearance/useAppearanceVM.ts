import { useStore } from 'zustand';
import { appearanceStore, setAppearance } from '@app/appearance';
import type { AppearanceState, AppearanceIntents } from './types';

export function useAppearanceVM(back: () => void): {
  state: AppearanceState;
  intents: AppearanceIntents;
} {
  const appearance = useStore(appearanceStore);
  return {
    state: {
      ...appearance,
      skinOptions: [
        { key: 'paper', label: '纸感' },
        { key: 'glass', label: '苹果风' },
      ],
      schemeOptions: [
        { key: 'system', label: '跟随系统' },
        { key: 'light', label: '浅色' },
        { key: 'dark', label: '深色' },
      ],
      sizeOptions: [
        { key: 's', label: '小' },
        { key: 'm', label: '中' },
        { key: 'l', label: '大' },
      ],
    },
    intents: {
      setSkin: value => {
        if (value === 'paper' || value === 'glass')
          setAppearance({ skin: value });
      },
      setScheme: value => {
        if (value === 'system' || value === 'light' || value === 'dark')
          setAppearance({ scheme: value });
      },
      setSize: value => {
        if (value === 's' || value === 'm' || value === 'l')
          setAppearance({ readingSize: value });
      },
      back,
    },
  };
}
