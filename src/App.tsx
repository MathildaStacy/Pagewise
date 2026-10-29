import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  View,
  DevSettings,
} from 'react-native';
import { useStore } from 'zustand';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { createDeviceContainer, type Container } from '@app/container';
import { createDemoContainer } from '@app/demo';
import { getMathRuntime } from '@app/math';
import { MathWebViewHost } from '@services/math/WebViewHost';
import { ContainerProvider } from '@app/ContainerProvider';
import { toAppError, type AppError } from '@app/errors';
import { createLogger } from '@app/log';
import { useUiEnvironment } from '@app/useUiEnvironment';
import { SkinProvider, useSkin, Button, MathProvider } from '@ui/kit';
import { RootNavigator } from '@ui/navigation/RootNavigator';

function Content({
  container,
  demoBootstrap,
}: {
  container: Container;
  demoBootstrap(): Promise<Container>;
}) {
  const [demo, setDemo] = useState<Container | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);
  const switching = useRef(false);
  const mounted = useRef(true);
  const active = demo ?? container;
  const enterDemo = useCallback(() => {
    if (switching.current || demo) return;
    switching.current = true;
    demoBootstrap()
      .then(value => {
        if (mounted.current) {
          setDemo(value);
          setDemoError(null);
        } else
          value.close().catch(() => container.log.warn('关闭演示书库失败'));
      })
      .catch(() => setDemoError('演示书库暂时无法打开，请重试'))
      .finally(() => {
        switching.current = false;
      });
  }, [demo, demoBootstrap, container]);
  const exitDemo = useCallback(() => setDemo(null), []);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  useEffect(
    () => () => {
      if (demo)
        demo.close().catch(() => container.log.warn('关闭演示书库失败'));
    },
    [demo, container],
  );
  useEffect(() => {
    if (__DEV__) {
      DevSettings.addMenuItem('体验演示书库', enterDemo);
      DevSettings.addMenuItem('返回我的书库', exitDemo);
    }
  }, [enterDemo, exitDemo]);
  const [fontScale, setFontScale] = useState(1);
  const appearance = useStore(active.appearance.store);
  const environment = useUiEnvironment();
  const math = useMemo(() => getMathRuntime(active), [active]);
  useEffect(() => () => math.close(), [math]);
  return (
    <ContainerProvider value={active}>
      <SkinProvider
        skinId={appearance.skin}
        scheme={appearance.scheme}
        readingSize={appearance.readingSize}
        fontScale={fontScale}
        blurEnabled={environment.blurAllowed}
      >
        <MathProvider renderer={math.renderer}>
          <MathWebViewHost bridge={math.bridge} />
          <ThemedStatusBar />
          {demo ? <DemoBanner exit={exitDemo} /> : null}
          {demoError ? (
            <Text accessibilityRole="alert">{demoError}</Text>
          ) : null}
          <SafeAreaProvider key={demo ? 'demo' : 'device'} style={styles.root}>
            <RootNavigator
              key={demo ? 'demo' : 'device'}
              enterDemo={enterDemo}
              exitDemo={exitDemo}
              fontScale={fontScale}
              onScale={setFontScale}
            />
          </SafeAreaProvider>
        </MathProvider>
      </SkinProvider>
    </ContainerProvider>
  );
}
function DemoBanner({ exit }: { exit(): void }) {
  const { tokens: t } = useSkin();
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: t.color.accentBg }}>
      <View
        style={[
          styles.demoBanner,
          {
            backgroundColor: t.color.accentBg,
            paddingHorizontal: t.space.pageX,
          },
        ]}
      >
        <Text style={{ ...t.type.caption, color: t.color.accentInk }}>
          演示书库 · 内容均为示意
        </Text>
        <Button size="sm" variant="text" label="退出演示" onPress={exit} />
      </View>
    </SafeAreaView>
  );
}
function ThemedStatusBar() {
  const { skin, tokens } = useSkin();
  const status = skin.statusBar(tokens);
  return <StatusBar barStyle={status.style} />;
}

async function shareStartupLogs() {
  const { createDeviceLogFileStore } = await import('@platform/logFiles');
  const message = await createLogger({
    files: createDeviceLogFileStore(),
  }).export();
  await Share.share({ message: message || '暂无日志' });
}

export default function App({
  bootstrap = createDeviceContainer,
  demoBootstrap = createDemoContainer,
}: {
  bootstrap?: () => Promise<Container>;
  demoBootstrap?: () => Promise<Container>;
}) {
  const [container, setContainer] = useState<Container | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let mounted = true;
    let owned: Container | undefined;
    bootstrap()
      .then(value => {
        owned = value;
        if (mounted) setContainer(value);
        else value.close().catch(() => value.log.warn('关闭基础服务失败'));
      })
      .catch(cause => {
        if (mounted) setError(toAppError(cause));
      });
    return () => {
      mounted = false;
      if (owned) owned.close().catch(() => owned?.log.warn('关闭基础服务失败'));
    };
  }, [bootstrap, attempt]);
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <View style={styles.root} accessibilityLabel="Pagewise">
          {container ? (
            <Content container={container} demoBootstrap={demoBootstrap} />
          ) : error ? (
            <View style={styles.startup}>
              <Text accessibilityRole="alert">启动失败：{error.message}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="重试启动"
                onPress={() => {
                  setError(null);
                  setAttempt(value => value + 1);
                }}
                style={styles.action}
              >
                <Text>重试</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="导出日志"
                style={styles.action}
                onPress={() => {
                  shareStartupLogs().catch(() =>
                    setError({
                      code: 'unknown',
                      message: '日志暂时无法导出，请重试',
                    }),
                  );
                }}
              >
                <Text>导出日志</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
const styles = StyleSheet.create({
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  root: { flex: 1 },
  startup: { padding: 24, gap: 16 },
  action: { minHeight: 48, justifyContent: 'center' },
});
