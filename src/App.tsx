import { useEffect, useState } from 'react';
import {
  Pressable,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useStore } from 'zustand';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { appearanceStore } from '@app/appearance';
import { createDeviceContainer, type Container } from '@app/container';
import { ContainerProvider } from '@app/ContainerProvider';
import { toAppError, type AppError } from '@app/errors';
import { createLogger } from '@app/log';
import { useUiEnvironment } from '@app/useUiEnvironment';
import { AppearanceScreen } from '@features/appearance/AppearanceScreen';
import { GalleryScreen } from '@features/gallery/GalleryScreen';
import { SkinProvider, useSkin } from '@ui/kit';

function Content() {
  const [page, setPage] = useState<'gallery' | 'appearance'>(
    __DEV__ ? 'gallery' : 'appearance',
  );
  const [fontScale, setFontScale] = useState(1);
  const appearance = useStore(appearanceStore);
  const environment = useUiEnvironment();
  return (
    <SkinProvider
      skinId={appearance.skin}
      scheme={appearance.scheme}
      readingSize={appearance.readingSize}
      fontScale={fontScale}
      blurEnabled={environment.blurAllowed}
    >
      <ThemedStatusBar />
      {page === 'gallery' ? (
        <GalleryScreen
          appearance={() => setPage('appearance')}
          fontScale={fontScale}
          onScale={setFontScale}
        />
      ) : (
        <AppearanceScreen back={() => setPage('gallery')} />
      )}
    </SkinProvider>
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
}: {
  bootstrap?: () => Promise<Container>;
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
            <ContainerProvider value={container}>
              <Content />
            </ContainerProvider>
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
  root: { flex: 1 },
  startup: { padding: 24, gap: 16 },
  action: { minHeight: 48, justifyContent: 'center' },
});
