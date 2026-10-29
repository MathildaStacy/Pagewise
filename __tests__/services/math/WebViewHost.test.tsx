import Renderer, { act } from 'react-test-renderer';
import { WebView } from 'react-native-webview';
import { createMathBridge } from '@services/math/renderer';
import { MathWebViewHost } from '@services/math/WebViewHost';
let renderer: Renderer.ReactTestRenderer | undefined;
afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = undefined;
  jest.clearAllMocks();
});
it('mounts the offline hidden host and routes its messages and lifecycle errors', async () => {
  const bridge = createMathBridge();
  await act(async () => {
    renderer = Renderer.create(<MathWebViewHost bridge={bridge} />);
  });
  const host = renderer!.root.findByType(WebView);
  expect(host.props.source).toEqual({
    uri: 'file:///android_asset/math/index.html',
  });
  expect(host.props.style).toMatchObject({ width: 0, height: 0 });
  expect(host.props.allowUniversalAccessFromFileURLs).toBe(false);
  expect(
    host.props.onShouldStartLoadWithRequest({ url: 'https://cdn.example.com' }),
  ).toBe(false);
  expect(
    host.props.onShouldStartLoadWithRequest({
      url: 'file:///android_asset/math/index.html',
    }),
  ).toBe(true);
  expect(host.props.onShouldStartLoadWithRequest({ url: 'about:blank' })).toBe(
    true,
  );
  host.props.onMessage({ nativeEvent: { data: '{"type":"ready"}' } });
  const pending = bridge.render('x', false);
  const post = jest.requireMock('react-native-webview')
    .__postMessage as jest.Mock;
  const id = JSON.parse(post.mock.calls[0][0]).id;
  host.props.onMessage({
    nativeEvent: {
      data: JSON.stringify({ id, svg: '<svg/>', w: 4, h: 2, baseline: 1 }),
    },
  });
  expect(await pending).toMatchObject({ width: 4, height: 2 });
  for (const name of [
    'onError',
    'onHttpError',
    'onContentProcessDidTerminate',
    'onRenderProcessGone',
  ]) {
    host.props[name]();
    await expect(bridge.render('x', false)).rejects.toMatchObject({
      reason: 'unavailable',
    });
    host.props.onMessage({ nativeEvent: { data: '{"type":"ready"}' } });
  }
  bridge.close();
});
it('fails an in-flight request promptly when the host unmounts', async () => {
  const bridge = createMathBridge();
  await act(async () => {
    renderer = Renderer.create(<MathWebViewHost bridge={bridge} />);
  });
  const request = bridge.render('x', false);
  const rejected = request.catch(error => error);
  await act(async () => renderer!.unmount());
  renderer = undefined;
  expect(await rejected).toMatchObject({ reason: 'unavailable' });
  bridge.close();
});
