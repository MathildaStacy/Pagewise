import {
  createMathBridge,
  createMathRenderer,
  type MathBridge,
  type CachedMathRenderer,
} from '@services/math/renderer';
import type { Container } from './container';
export interface MathRuntime {
  renderer: CachedMathRenderer;
  bridge: MathBridge;
  close(): void;
}
const runtimes = new WeakMap<Container, MathRuntime>();
/** Only the composition layer knows both the cache repository and rendering service. */
export function getMathRuntime(container: Container): MathRuntime {
  const existing = runtimes.get(container);
  if (existing) return existing;
  const bridge = createMathBridge();
  const renderer = createMathRenderer({
    bridge,
    cache: {
      get: key => container.repos.math.get(key),
      put: async (key, value) => {
        await container.repos.math.put({ key, ...value });
      },
      touch: key => container.repos.math.touch(key),
      prune: async maxRows => {
        await container.repos.math.prune(maxRows);
      },
    },
    onCacheError: () => container.log.warn('公式缓存暂时不可用'),
  });
  let closed = false;
  const runtime: MathRuntime = {
    renderer,
    bridge,
    close() {
      if (closed) return;
      closed = true;
      renderer.close();
      bridge.close();
      runtimes.delete(container);
    },
  };
  runtimes.set(container, runtime);
  return runtime;
}

export function disposeMathRuntime(container: Container): void {
  runtimes.get(container)?.close();
}
