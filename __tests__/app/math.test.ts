import { getMathRuntime } from '@app/math';
import { createTestContainer } from '@app/testing';
import { mathCacheKey } from '@services/math/renderer';
it('isolates runtimes by container and reuses SQLite SVG after closing memory caches', async () => {
  const one = await createTestContainer(),
    two = await createTestContainer();
  const runtime = getMathRuntime(one),
    other = getMathRuntime(two),
    send = jest.fn();
  try {
    expect(getMathRuntime(one)).toBe(runtime);
    expect(other).not.toBe(runtime);
    runtime.bridge.attach(send);
    runtime.bridge.receive('{"type":"ready"}');
    const result = {
      svg: '<svg fill="currentColor"/>',
      width: 4,
      height: 2,
      baseline: 1,
    };
    const request = runtime.renderer.render('x', true);
    // SQLite cache lookup occurs before bridge dispatch.
    await new Promise(resolve => setImmediate(resolve));
    const id = JSON.parse(send.mock.calls[0][0]).id;
    runtime.bridge.receive(
      JSON.stringify({ id, svg: result.svg, w: 4, h: 2, baseline: 1 }),
    );
    expect(await request).toEqual(result);
    expect(await one.repos.math.get(mathCacheKey('x', true))).toMatchObject(
      result,
    );
    expect(await two.repos.math.get(mathCacheKey('x', true))).toBeNull();
    runtime.close();
    runtime.close();
    const reopened = getMathRuntime(one);
    expect(reopened).not.toBe(runtime);
    expect(await reopened.renderer.render('x', true)).toMatchObject(result);
    reopened.close();
  } finally {
    runtime.close();
    other.close();
    await Promise.all([one.close(), two.close()]);
  }
});
