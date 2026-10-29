import { createHash } from 'node:crypto';
import {
  createMathBridge,
  createMathRenderer,
  mathCacheKey,
  type MathCacheStore,
  type MathRender,
} from '@services/math/renderer';
const result: MathRender = {
  svg: '<svg><path fill="currentColor"/></svg>',
  width: 4,
  height: 2,
  baseline: 1.5,
};
const response = (id: string, value: Partial<MathRender> = result) =>
  JSON.stringify({
    id,
    svg: value.svg,
    w: value.width,
    h: value.height,
    baseline: value.baseline,
  });
const cache = (): MathCacheStore => ({
  get: jest.fn().mockResolvedValue(null),
  put: jest.fn().mockResolvedValue(undefined),
  touch: jest.fn().mockResolvedValue(undefined),
  prune: jest.fn().mockResolvedValue(undefined),
});
afterEach(() => jest.useRealTimers());
it.each(['x^2+\\frac{1}{2}', '数学 😀 𝑥', '\ud800', 'a'.repeat(200)])(
  'uses a stable mode-sensitive SHA-1 identifier for %s',
  tex => {
    for (const display of [false, true])
      expect(mathCacheKey(tex, display)).toBe(
        createHash('sha1')
          .update((display ? 'display:' : 'inline:') + tex)
          .digest('hex'),
      );
    expect(mathCacheKey(tex, false)).not.toBe(mathCacheKey(tex, true));
  },
);
it('queues until ready, correlates out-of-order replies and ignores unrelated messages', async () => {
  const bridge = createMathBridge(),
    send = jest.fn();
  bridge.attach(send);
  const one = bridge.render('x', false),
    two = bridge.render('y', true);
  expect(send).not.toHaveBeenCalled();
  for (const text of [
    'bad JSON',
    'null',
    '42',
    '{}',
    JSON.stringify({ id: 'unknown' }),
    JSON.stringify({ id: 3 }),
  ])
    bridge.receive(text);
  bridge.receive(JSON.stringify({ type: 'ready' }));
  const first = JSON.parse(send.mock.calls[0][0]),
    second = JSON.parse(send.mock.calls[1][0]);
  expect(first).toMatchObject({ tex: 'x', display: false });
  expect(second).toMatchObject({ tex: 'y', display: true });
  bridge.receive(response(second.id, { ...result, width: 8 }));
  bridge.receive(response(first.id));
  expect(await two).toEqual({ ...result, width: 8 });
  expect(await one).toEqual(result);
  bridge.close();
});
it('times out after 3s even when a WebView never becomes ready', async () => {
  jest.useFakeTimers();
  const bridge = createMathBridge();
  const request = bridge.render('x', false);
  const rejected = request.catch(error => error);
  jest.advanceTimersByTime(2999);
  expect(jest.getTimerCount()).toBe(1);
  jest.advanceTimersByTime(1);
  expect(await rejected).toMatchObject({ reason: 'timeout' });
  bridge.receive(response('1'));
  bridge.close();
});
it.each([
  { svg: 'not SVG' },
  { width: 0 },
  { height: -1 },
  { baseline: -1 },
  { baseline: 99 },
  { svg: '<svg/>', width: 1, height: 1, baseline: NaN },
])('rejects invalid WebView metrics %o', async partial => {
  const bridge = createMathBridge(),
    send = jest.fn();
  bridge.attach(send);
  bridge.receive('{"type":"ready"}');
  const request = bridge.render('x', true);
  bridge.receive(
    response(JSON.parse(send.mock.calls[0][0]).id, { ...result, ...partial }),
  );
  await expect(request).rejects.toMatchObject({ reason: 'invalid' });
  bridge.close();
});
it('rejects MathJax parse errors, detaches cleanly and supports a replacement host', async () => {
  const bridge = createMathBridge(),
    send = jest.fn();
  const detach = bridge.attach(send);
  bridge.receive('{"type":"ready"}');
  const invalid = bridge.render('invalid', false);
  bridge.receive(
    JSON.stringify({
      id: JSON.parse(send.mock.calls[0][0]).id,
      error: 'render',
    }),
  );
  await expect(invalid).rejects.toMatchObject({ reason: 'invalid' });
  const pending = bridge.render('next', false);
  detach();
  await expect(pending).rejects.toMatchObject({ reason: 'unavailable' });
  const nextSend = jest.fn();
  bridge.attach(nextSend);
  detach();
  bridge.receive('{"type":"ready"}');
  const next = bridge.render('x', false);
  bridge.receive(response(JSON.parse(nextSend.mock.calls[0][0]).id));
  expect(await next).toEqual(result);
  bridge.close();
  bridge.attach(send)();
  await expect(bridge.render('closed', false)).rejects.toMatchObject({
    reason: 'closed',
  });
  bridge.receive('{"type":"ready"}');
});
it('reports host failures and transport exceptions without waiting for the deadline', async () => {
  const bridge = createMathBridge();
  bridge.attach(() => {
    throw new Error('host lost');
  });
  bridge.receive('{"type":"ready"}');
  await expect(bridge.render('x', false)).rejects.toMatchObject({
    reason: 'unavailable',
  });
  bridge.attach(() => {});
  const one = bridge.render('1', false);
  bridge.fail();
  await expect(one).rejects.toMatchObject({ reason: 'unavailable' });
  await expect(bridge.render('2', false)).rejects.toMatchObject({
    reason: 'unavailable',
  });
  bridge.attach(() => {});
  const two = bridge.render('3', false);
  bridge.receive('{"type":"fatal"}');
  await expect(two).rejects.toMatchObject({ reason: 'unavailable' });
  bridge.attach(() => {});
  const three = bridge.render('4', false);
  bridge.close();
  await expect(three).rejects.toMatchObject({ reason: 'closed' });
});
it('merges identical concurrent work and caches by mode, persisting only successful results', async () => {
  const storage = cache(),
    bridge = { render: jest.fn().mockResolvedValue(result) };
  const renderer = createMathRenderer({ bridge, cache: storage });
  const first = renderer.render('x', false),
    second = renderer.render('x', false);
  expect(first).toBe(second);
  expect(await first).toEqual(result);
  expect(bridge.render).toHaveBeenCalledTimes(1);
  expect(storage.get).toHaveBeenCalledTimes(1);
  expect(storage.put).toHaveBeenCalledWith(mathCacheKey('x', false), result);
  expect(storage.prune).toHaveBeenCalledWith(5000);
  await renderer.render('x', false);
  expect(bridge.render).toHaveBeenCalledTimes(1);
  await renderer.render('x', true);
  expect(bridge.render).toHaveBeenCalledTimes(2);
  renderer.close();
});
it('reads persisted SVG before rendering, touches recency, and evicts memory by LRU', async () => {
  const storage = cache();
  jest.mocked(storage.get).mockResolvedValue(result);
  const bridge = { render: jest.fn().mockResolvedValue(result) };
  const renderer = createMathRenderer({
    bridge,
    cache: storage,
    maxEntries: 2,
  });
  await renderer.render('a', false);
  await renderer.render('b', false);
  await renderer.render('a', false);
  await renderer.render('c', false);
  expect(storage.get).toHaveBeenCalledTimes(3);
  await renderer.render('a', false);
  expect(storage.get).toHaveBeenCalledTimes(3);
  await renderer.render('b', false);
  expect(storage.get).toHaveBeenCalledTimes(4);
  expect(storage.touch).toHaveBeenCalledWith(mathCacheKey('b', false));
  expect(bridge.render).not.toHaveBeenCalled();
  expect(storage.put).not.toHaveBeenCalled();
});
it('uses the renderer when storage is corrupt or unavailable and tolerates failed cache writes', async () => {
  const storage = cache(),
    onCacheError = jest.fn(),
    bridge = { render: jest.fn().mockResolvedValue(result) };
  jest
    .mocked(storage.get)
    .mockResolvedValueOnce({ ...result, width: -1 })
    .mockRejectedValueOnce(new Error('read failure'));
  jest.mocked(storage.put).mockRejectedValue(new Error('disk failure'));
  const renderer = createMathRenderer({ bridge, cache: storage, onCacheError });
  expect(await renderer.render('a', false)).toEqual(result);
  expect(await renderer.render('b', false)).toEqual(result);
  expect(bridge.render).toHaveBeenCalledTimes(2);
  expect(onCacheError).toHaveBeenCalledTimes(3);
});
it('does not cache failed renders and rejects use after close', async () => {
  const bridge = {
    render: jest
      .fn()
      .mockRejectedValueOnce(new Error('bad TeX'))
      .mockResolvedValueOnce(result),
  };
  const renderer = createMathRenderer({ bridge });
  await expect(renderer.render('x', false)).rejects.toThrow('bad TeX');
  expect(await renderer.render('x', false)).toEqual(result);
  expect(bridge.render).toHaveBeenCalledTimes(2);
  renderer.close();
  await expect(renderer.render('x', false)).rejects.toMatchObject({
    reason: 'closed',
  });
});
it('does not cache invalid renderer responses or results completed after closing', async () => {
  const invalid = createMathRenderer({
    bridge: { render: async () => ({ ...result, svg: 'bad' }) },
  });
  await expect(invalid.render('x', false)).rejects.toMatchObject({
    reason: 'invalid',
  });
  let complete!: (value: MathRender) => void;
  const renderer = createMathRenderer({
    bridge: {
      render: () =>
        new Promise(resolve => {
          complete = resolve;
        }),
    },
  });
  const pending = renderer.render('x', false);
  renderer.close();
  complete(result);
  await expect(pending).rejects.toMatchObject({ reason: 'closed' });
  const storage = cache();
  let read!: (value: MathRender | null) => void;
  jest.mocked(storage.get).mockImplementation(
    () =>
      new Promise(resolve => {
        read = resolve;
      }),
  );
  const cached = createMathRenderer({
    bridge: { render: async () => result },
    cache: storage,
  });
  const reading = cached.render('x', false);
  cached.close();
  read(null);
  await expect(reading).rejects.toMatchObject({ reason: 'closed' });
});
