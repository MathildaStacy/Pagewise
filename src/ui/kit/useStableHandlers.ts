import { useLayoutEffect, useMemo, useRef } from 'react';

type Handlers = { [key: string]: ((...args: never[]) => unknown) | undefined };

/**
 * 返回身份恒定、但总是调用最新实现的处理函数集合；每个键的函数身份也恒定。
 * 传给 memo 过的列表行，流式刷新时未变化的行就不会重渲染。
 * 注意：任意键都会返回函数，可选回调不要用真假判断是否存在。
 */
export function useStableHandlers<T extends object>(handlers: T): T {
  const latest = useRef(handlers);
  useLayoutEffect(() => {
    latest.current = handlers;
  });
  return useMemo(() => {
    const cache = new Map<string, (...args: never[]) => unknown>();
    return new Proxy({} as T, {
      get: (_target, key) => {
        if (typeof key !== 'string') return undefined;
        let handler = cache.get(key);
        if (!handler) {
          handler = (...args: never[]) =>
            (latest.current as Handlers)[key]?.(...args);
          cache.set(key, handler);
        }
        return handler;
      },
    });
  }, []);
}
