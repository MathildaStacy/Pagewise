import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  View,
  DevSettings,
  Alert,
} from 'react-native';
import { useStore } from 'zustand';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { createDeviceContainer, type Container } from '@app/container';
import { createDemoContainer } from '@app/demo';
import { runNativePdfSmoke, runNativeReaderSmoke } from '@app/dev/nativeSmoke';
import { loadAcceptanceCredentials } from '@app/dev/acceptanceSetup';
import { runRealStudySmoke } from '@app/dev/realStudySmoke';
import {
  runStorageEpubSmoke,
  runRestoreBackupSmoke,
} from '@app/dev/storageEpubSmoke';
import { rebuildLocalPdfMap } from '@app/usecases/importResults';
import { runEpubReparseSmoke } from '@app/dev/reparseSmoke';
import { useImportLifecycle } from '@app/useImportLifecycle';
import type { ImportSelection } from '@app/usecases/importBooks';
import { getMathRuntime } from '@app/math';
import { MathWebViewHost } from '@services/math/WebViewHost';
import { ContainerProvider } from '@app/ContainerProvider';
import { toAppError, type AppError } from '@app/errors';
import { createLogger } from '@app/log';
import { useUiEnvironment } from '@app/useUiEnvironment';
import { SkinProvider, useSkin, MathProvider } from '@ui/kit';
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
  const [incomingImport, setIncomingImport] = useState<{
    token: number;
    selection: ImportSelection;
  } | null>(null);
  const receiveImport = useCallback((selection: ImportSelection) => {
    setDemo(null);
    setIncomingImport({ token: Date.now(), selection });
  }, []);
  useImportLifecycle(container, !demo, receiveImport);
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
      DevSettings.addMenuItem('加载本机验收凭据', () => {
        loadAcceptanceCredentials(container)
          .then(() => Alert.alert('验收服务已配置'))
          .catch(() => Alert.alert('验收服务配置失败，请检查本机凭据文件'));
      });
      DevSettings.addMenuItem('验证 PDF 文件接口', () => {
        runNativePdfSmoke()
          .then(report =>
            Alert.alert(
              'PDF 接口验证通过',
              `${report.pages} 页 · ${report.outline} 条书签 · 分片 ${report.samplePages} 页 · 渲染缓存命中`,
            ),
          )
          .catch(error => Alert.alert('PDF 接口验证失败', String(error)));
      });
      DevSettings.addMenuItem('验证连续 50 页渲染', () => {
        runNativeReaderSmoke()
          .then(report =>
            Alert.alert(
              '连续渲染通过',
              `50 页 · 中位 ${report.medianMs}ms · p95 ${report.p95Ms}ms`,
            ),
          )
          .catch(() => Alert.alert('连续渲染失败，请检查本机验收文件'));
      });
      DevSettings.addMenuItem('验证真实书籍三节学习', () => {
        runRealStudySmoke(container).then(report =>
          Alert.alert(
            report.status === 'passed'
              ? '真实学习验证通过'
              : '真实学习验证未通过',
            `${report.completedSections}/3 节 · ${
              report.errorCode ?? report.stage
            }`,
          ),
        );
      });
      DevSettings.addMenuItem('验证 EPUB 导出与备份', () => {
        runStorageEpubSmoke(container).then(report =>
          Alert.alert(
            report.status === 'passed'
              ? 'EPUB 与存储验证通过'
              : 'EPUB 与存储验证未通过',
            report.errors
              .map(error => `${error.stage}: ${error.code}`)
              .join('\n') || report.stage,
          ),
        );
      });
      DevSettings.addMenuItem('从本机验收备份恢复', () => {
        runRestoreBackupSmoke(container).then(report => {
          if (report.status === 'failed')
            Alert.alert(
              '验收备份恢复失败',
              report.errors.map(error => error.code).join('\n'),
            );
        });
      });
      DevSettings.addMenuItem('仅重建本机 PDF 地图', () => {
        (async () => {
          try {
            const book = (await container.repos.books.list()).find(
              value => value.format === 'pdf' && value.ready_to_page > 0,
            );
            if (!book) throw new Error('请先导入验收 PDF');
            await rebuildLocalPdfMap(container, book.id);
            Alert.alert('本机地图重建完成', '重新打开书的地图即可查看');
          } catch {
            Alert.alert(
              '本机地图重建未完成',
              '请检查学习记录保护检查和本机日志',
            );
          }
        })();
      });
      DevSettings.addMenuItem('验证 EPUB 清缓存与重新解析', () => {
        runEpubReparseSmoke(container).then(report =>
          Alert.alert(
            report.status === 'passed'
              ? '清缓存与重新解析通过'
              : '清缓存与重新解析未通过',
            report.errors.map(error => error.code).join('\n') || report.stage,
          ),
        );
      });
      DevSettings.addMenuItem('体验演示书库', enterDemo);
      DevSettings.addMenuItem('返回我的书库', exitDemo);
    }
  }, [enterDemo, exitDemo, container]);
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
          {demoError ? (
            <Text accessibilityRole="alert">{demoError}</Text>
          ) : null}
          <SafeAreaProvider key={demo ? 'demo' : 'device'} style={styles.root}>
            <RootNavigator
              incomingImport={incomingImport}
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
  root: { flex: 1 },
  startup: { padding: 24, gap: 16 },
  action: { minHeight: 48, justifyContent: 'center' },
});
