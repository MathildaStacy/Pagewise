import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Db } from '@data/db';
import { createSettingsRepo, type SettingsRepo } from '@data/repos/settings';

export interface Appearance {
  skin: 'paper' | 'glass';
  scheme: 'system' | 'light' | 'dark';
  readingSize: 's' | 'm' | 'l';
}
export interface AppearanceStore extends Appearance {
  error: string | null;
}
export interface AppearanceSettings {
  store: StoreApi<AppearanceStore>;
  update(patch: Partial<Appearance>): Promise<void>;
  flush(): Promise<void>;
}
const defaults: Appearance = {
  skin: 'paper',
  scheme: 'system',
  readingSize: 'm',
};
function skin(
  value: unknown,
  fallback: Appearance['skin'],
): Appearance['skin'] {
  return value === 'paper' || value === 'glass' ? value : fallback;
}
function scheme(
  value: unknown,
  fallback: Appearance['scheme'],
): Appearance['scheme'] {
  return value === 'system' || value === 'light' || value === 'dark'
    ? value
    : fallback;
}
function readingSize(
  value: unknown,
  fallback: Appearance['readingSize'],
): Appearance['readingSize'] {
  return value === 's' || value === 'm' || value === 'l' ? value : fallback;
}

/** 控制器由容器持有，缓存只在SQLite事务提交后更新；不同容器不共享外观状态。 */
export async function createAppearanceSettings(
  settings: SettingsRepo,
  db: Db,
): Promise<AppearanceSettings> {
  const [savedSkin, savedScheme, savedSize] = await Promise.all([
    settings.get<unknown>('ui.skin', defaults.skin),
    settings.get<unknown>('ui.scheme', defaults.scheme),
    settings.get<unknown>('ui.readingSize', defaults.readingSize),
  ]);
  const store = createStore<AppearanceStore>(() => ({
    skin: skin(savedSkin, defaults.skin),
    scheme: scheme(savedScheme, defaults.scheme),
    readingSize: readingSize(savedSize, defaults.readingSize),
    error: null,
  }));
  let queue = Promise.resolve();
  return {
    store,
    update(patch) {
      // 在队列执行时读取最近一次提交的值，连续三个局部修改不会互相覆盖。
      const task = queue.then(async () => {
        const previous = store.getState();
        const next: Appearance = {
          skin: skin(patch.skin, previous.skin),
          scheme: scheme(patch.scheme, previous.scheme),
          readingSize: readingSize(patch.readingSize, previous.readingSize),
        };
        try {
          await db.transaction(async tx => {
            const transactional = createSettingsRepo(tx);
            await transactional.set('ui.skin', next.skin);
            await transactional.set('ui.scheme', next.scheme);
            await transactional.set('ui.readingSize', next.readingSize);
          });
          store.setState({ ...next, error: null });
        } catch {
          // 不把原生数据库异常或请求内容暴露给界面，也不制造未处理的Promise rejection。
          store.setState({ error: '外观设置没有保存，请重试' });
        }
      });
      queue = task;
      return task;
    },
    async flush() {
      await queue;
    },
  };
}
