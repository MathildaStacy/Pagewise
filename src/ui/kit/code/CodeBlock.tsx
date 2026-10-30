import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import { useSkin, useTokens } from '../context';
import { makeStyles } from '../makeStyles';
import { codeColors, codeLanguage, highlightCode } from './syntax';

export const codeFontFamily = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

/** Shared by source blocks, explanations, translations and streamed AI messages. */
export const CodeBlock = memo(function CodeBlockView({
  text,
  language,
}: {
  text: string;
  language?: string;
}) {
  const t = useTokens();
  const s = useStyles();
  const { reduceMotion } = useSkin();
  const colors = codeColors[t.scheme];
  const [full, setFull] = useState(false);
  const [copyState, setCopyState] = useState<'ready' | 'copied' | 'failed'>(
    'ready',
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const spans = useMemo(() => highlightCode(text, language), [text, language]);
  const lines = text.split('\n').length;
  const numbers = useMemo(
    () => Array.from({ length: lines }, (_, i) => i + 1).join('\n'),
    [lines],
  );
  const label = codeLanguage(language).label;
  const copy = () => {
    try {
      Clipboard.setString(text);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopyState('ready'), 2000);
  };
  const toolbar = (expanded: boolean) => (
    <View style={s.toolbar}>
      <Text
        style={s.label}
        numberOfLines={1}
        accessibilityLabel={`${label}，${lines} 行代码`}
      >
        {label} · {lines} 行
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="复制代码"
        onPress={copy}
        style={({ pressed }) => [s.action, pressed && s.pressed]}
      >
        <Text style={s.actionText} accessibilityLiveRegion="polite">
          {copyState === 'copied'
            ? '已复制'
            : copyState === 'failed'
            ? '重试复制'
            : '复制'}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={expanded ? '关闭代码全屏' : '全屏阅读代码'}
        onPress={() => setFull(!expanded)}
        style={({ pressed }) => [s.action, pressed && s.pressed]}
      >
        <Text style={s.actionText}>{expanded ? '关闭' : '全屏'}</Text>
      </Pressable>
    </View>
  );
  const body = () => (
    <View style={[s.viewport, { backgroundColor: colors.bg }]}>
      <Text
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={[s.codeText, s.gutter, { color: colors.comment }]}
      >
        {numbers}
      </Text>
      <ScrollView
        horizontal
        nestedScrollEnabled
        style={s.horizontal}
        contentContainerStyle={s.codePadding}
        showsHorizontalScrollIndicator
        accessibilityLabel="代码，左右滑动查看长行"
      >
        <Text
          selectable
          style={[s.codeText, { color: colors.text }]}
          textBreakStrategy="simple"
        >
          {spans.map((span, i) => (
            <Text
              key={i}
              style={span.kind ? { color: colors[span.kind] } : undefined}
            >
              {span.text}
            </Text>
          ))}
        </Text>
      </ScrollView>
    </View>
  );
  return (
    <View style={s.block}>
      {toolbar(false)}
      {body()}
      {full ? (
        <Modal
          visible
          animationType={reduceMotion ? 'none' : 'fade'}
          onRequestClose={() => setFull(false)}
        >
          <SafeAreaView
            style={[s.full, { backgroundColor: colors.bg }]}
            accessibilityViewIsModal
          >
            {toolbar(true)}
            <ScrollView
              style={s.vertical}
              contentContainerStyle={s.fullContent}
              nestedScrollEnabled
            >
              {body()}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      ) : null}
    </View>
  );
});

const useStyles = makeStyles(t => ({
  block: { borderRadius: t.shape.sm, overflow: 'hidden', maxWidth: '100%' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    backgroundColor: t.color.surfaceAlt,
    borderBottomWidth: 0.5,
    borderColor: t.color.line,
  },
  label: { ...t.type.caption, color: t.color.ink2, flex: 1 },
  action: {
    minWidth: 48,
    minHeight: 48,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { ...t.type.caption, color: t.color.ink, fontWeight: '500' },
  pressed: { backgroundColor: t.color.pressed },
  viewport: { flexDirection: 'row', paddingVertical: 12 },
  horizontal: { flex: 1 },
  codePadding: { paddingRight: 16 },
  codeText: {
    ...t.type.body,
    fontFamily: codeFontFamily,
    fontWeight: '400',
    includeFontPadding: false,
    letterSpacing: 0,
  },
  gutter: { paddingHorizontal: 12, textAlign: 'right' },
  full: { flex: 1 },
  vertical: { flex: 1 },
  fullContent: { paddingBottom: 24 },
}));
