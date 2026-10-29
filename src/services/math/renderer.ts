import type {
  MathBridge,
  MathCacheStore,
  MathRender,
  MathRenderer,
} from './types';
export type {
  MathBridge,
  MathCacheStore,
  MathRender,
  MathRenderer,
} from './types';

export class MathRenderError extends Error {
  constructor(
    public readonly reason: 'timeout' | 'unavailable' | 'invalid' | 'closed',
  ) {
    super('公式暂时无法渲染');
    this.name = 'MathRenderError';
  }
}

/* eslint-disable no-bitwise -- SHA-1 requires 32-bit rotates, masks and XORs for the specified cache key. */
/** SHA-1 is only a deterministic cache identifier, never a credential or security signature. */
export function mathCacheKey(tex: string, display: boolean): string {
  const bytes: number[] = [];
  for (const char of (display ? 'display:' : 'inline:') + tex) {
    let code = char.codePointAt(0)!;
    if (code >= 0xd800 && code <= 0xdfff) code = 0xfffd;
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >>> 6), 0x80 | (code & 63));
    else if (code < 0x10000)
      bytes.push(
        0xe0 | (code >>> 12),
        0x80 | ((code >>> 6) & 63),
        0x80 | (code & 63),
      );
    else
      bytes.push(
        0xf0 | (code >>> 18),
        0x80 | ((code >>> 12) & 63),
        0x80 | ((code >>> 6) & 63),
        0x80 | (code & 63),
      );
  }
  const length = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let shift = 7; shift >= 0; shift--)
    bytes.push(Math.floor(length / 2 ** (shift * 8)) & 255);
  let h0 = 0x67452301,
    h1 = 0xefcdab89,
    h2 = 0x98badcfe,
    h3 = 0x10325476,
    h4 = 0xc3d2e1f0;
  const rotate = (value: number, count: number) =>
    (value << count) | (value >>> (32 - count));
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const words: number[] = [];
    for (let index = 0; index < 16; index++)
      words.push(
        (bytes[offset + 4 * index] << 24) |
          (bytes[offset + 4 * index + 1] << 16) |
          (bytes[offset + 4 * index + 2] << 8) |
          bytes[offset + 4 * index + 3],
      );
    for (let index = 16; index < 80; index++)
      words.push(
        rotate(
          words[index - 3] ^
            words[index - 8] ^
            words[index - 14] ^
            words[index - 16],
          1,
        ),
      );
    let a = h0,
      b = h1,
      c = h2,
      d = h3,
      e = h4;
    for (let index = 0; index < 80; index++) {
      const f =
        index < 20
          ? (b & c) | (~b & d)
          : index < 40
          ? b ^ c ^ d
          : index < 60
          ? (b & c) | (b & d) | (c & d)
          : b ^ c ^ d;
      const k =
        index < 20
          ? 0x5a827999
          : index < 40
          ? 0x6ed9eba1
          : index < 60
          ? 0x8f1bbcdc
          : 0xca62c1d6;
      const next = (rotate(a, 5) + f + e + k + words[index]) | 0;
      e = d;
      d = c;
      c = rotate(b, 30);
      b = a;
      a = next;
    }
    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
  }
  return [h0, h1, h2, h3, h4]
    .map(value => (value >>> 0).toString(16).padStart(8, '0'))
    .join('');
}

/* eslint-enable no-bitwise */

type Pending = {
  payload: string;
  resolve(value: MathRender): void;
  reject(error: MathRenderError): void;
  timer: ReturnType<typeof setTimeout>;
};
function validRender(value: unknown): value is MathRender {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<MathRender>;
  return (
    typeof result.svg === 'string' &&
    result.svg.trim().startsWith('<svg') &&
    typeof result.width === 'number' &&
    Number.isFinite(result.width) &&
    result.width > 0 &&
    typeof result.height === 'number' &&
    Number.isFinite(result.height) &&
    result.height > 0 &&
    typeof result.baseline === 'number' &&
    Number.isFinite(result.baseline) &&
    result.baseline >= 0 &&
    result.baseline <= result.height
  );
}
/** The hidden WebView owns its lifecycle; queued requests share a strict 3s deadline. */
export function createMathBridge(timeoutMs = 3000): MathBridge {
  let send: ((payload: string) => void) | undefined;
  let ready = false,
    closed = false,
    failed = false,
    sequence = 0;
  const pending = new Map<string, Pending>();
  function rejectAll(reason: 'unavailable' | 'closed') {
    for (const task of pending.values()) {
      clearTimeout(task.timer);
      task.reject(new MathRenderError(reason));
    }
    pending.clear();
  }
  function dispatch(id: string, task: Pending) {
    try {
      send!(task.payload);
    } catch {
      clearTimeout(task.timer);
      pending.delete(id);
      task.reject(new MathRenderError('unavailable'));
    }
  }
  return {
    attach(value) {
      if (closed) return () => {};
      send = value;
      failed = false;
      ready = false;
      return () => {
        if (send === value) {
          send = undefined;
          ready = false;
          rejectAll('unavailable');
        }
      };
    },
    render(tex, display) {
      if (closed || failed)
        return Promise.reject(
          new MathRenderError(closed ? 'closed' : 'unavailable'),
        );
      const id = String(++sequence);
      return new Promise<MathRender>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new MathRenderError('timeout'));
        }, timeoutMs);
        const task: Pending = {
          payload: JSON.stringify({ id, tex, display }),
          resolve,
          reject,
          timer,
        };
        pending.set(id, task);
        if (ready && send) dispatch(id, task);
      });
    },
    receive(payload) {
      if (closed) return;
      let value: Record<string, unknown>;
      try {
        value = JSON.parse(payload) as Record<string, unknown>;
      } catch {
        return;
      }
      if (!value || typeof value !== 'object') return;
      if (value.type === 'fatal') {
        ready = false;
        failed = true;
        rejectAll('unavailable');
        return;
      }
      if (value.type === 'ready') {
        ready = true;
        failed = false;
        if (send) for (const [id, task] of pending) dispatch(id, task);
        return;
      }
      if (typeof value.id !== 'string') return;
      const task = pending.get(value.id);
      if (!task) return;
      pending.delete(value.id);
      clearTimeout(task.timer);
      const result = {
        svg: value.svg,
        width: value.w,
        height: value.h,
        baseline: value.baseline,
      };
      if (value.error || !validRender(result))
        task.reject(new MathRenderError('invalid'));
      else task.resolve(result);
    },
    fail() {
      ready = false;
      failed = true;
      rejectAll('unavailable');
    },
    close() {
      closed = true;
      ready = false;
      send = undefined;
      rejectAll('closed');
    },
  };
}

export interface CachedMathRenderer extends MathRenderer {
  close(): void;
}
export function createMathRenderer({
  bridge,
  cache,
  maxEntries = 500,
  onCacheError,
}: {
  bridge: MathRenderer;
  cache?: MathCacheStore;
  maxEntries?: number;
  onCacheError?(): void;
}): CachedMathRenderer {
  const memory = new Map<string, MathRender>();
  const inFlight = new Map<string, Promise<MathRender>>();
  let closed = false;
  const cacheFailure = () => onCacheError?.();
  function remember(key: string, result: MathRender) {
    memory.delete(key);
    memory.set(key, result);
    if (memory.size > maxEntries) memory.delete(memory.keys().next().value!);
  }
  return {
    render(tex, display) {
      if (closed) return Promise.reject(new MathRenderError('closed'));
      const key = mathCacheKey(tex, display);
      const hit = memory.get(key);
      if (hit) {
        remember(key, hit);
        return Promise.resolve(hit);
      }
      const active = inFlight.get(key);
      if (active) return active;
      const task = (async () => {
        let stored: MathRender | null = null;
        if (cache) {
          try {
            stored = await cache.get(key);
            if (stored && !validRender(stored)) stored = null;
          } catch {
            cacheFailure();
          }
        }
        if (closed) throw new MathRenderError('closed');
        const result = stored ?? (await bridge.render(tex, display));
        if (!validRender(result)) throw new MathRenderError('invalid');
        if (closed) throw new MathRenderError('closed');
        remember(key, result);
        if (cache) {
          try {
            if (stored) await cache.touch(key);
            else {
              await cache.put(key, result);
              await cache.prune(5000);
            }
          } catch {
            cacheFailure();
          }
        }
        return result;
      })();
      inFlight.set(key, task);
      const forget = () => {
        if (inFlight.get(key) === task) inFlight.delete(key);
      };
      task.then(forget, forget);
      return task;
    },
    close() {
      closed = true;
      memory.clear();
      inFlight.clear();
    },
  };
}
