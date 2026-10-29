import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { MathBridge } from './types';
const source = { uri: 'file:///android_asset/math/index.html' };
const origins = ['file://*'];
/** One instance remains mounted at the app root, independent of screens and skin changes. */
export function MathWebViewHost({ bridge }: { bridge: MathBridge }) {
  const webview = useRef<WebView<object>>(null);
  useEffect(
    () =>
      bridge.attach(payload => {
        if (!webview.current) throw new Error('Math WebView unavailable');
        webview.current.postMessage(payload);
      }),
    [bridge],
  );
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={styles.hidden}
    >
      <WebView<object>
        ref={webview}
        source={source}
        style={styles.hidden}
        javaScriptEnabled
        allowFileAccess
        allowUniversalAccessFromFileURLs={false}
        domStorageEnabled={false}
        originWhitelist={origins}
        mixedContentMode="never"
        scrollEnabled={false}
        onMessage={event => bridge.receive(event.nativeEvent.data)}
        onError={() => bridge.fail()}
        onHttpError={() => bridge.fail()}
        onContentProcessDidTerminate={() => bridge.fail()}
        onRenderProcessGone={() => bridge.fail()}
        onShouldStartLoadWithRequest={request =>
          request.url === 'about:blank' ||
          request.url.startsWith('file:///android_asset/math/')
        }
      />
    </View>
  );
}
const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 0, height: 0, opacity: 0 },
});
