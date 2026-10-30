import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  Button,
  Icon,
  Note,
  RevealContext,
  RevealSkip,
  RichView,
  Typing,
  docLength,
  makeStyles,
  revealDoc,
  useReveal,
  useTokens,
  type RichDoc,
} from '@ui/kit';
import type { StudyIntents, StudyOverlay } from '@features/study/types';
import type { AiOptionsState } from '@features/settings/types';
import { AiOptionsControl } from './AiOptionsControl';

const empty: RichDoc = [];
type Translation = Extract<
  StudyOverlay,
  { kind: 'translate' | 'explain' | 'sectionTranslation' }
>;

/** The source stays above the translation; only the newly arriving text animates. */
export function TranslationView({
  overlay,
  intents,
  aiOptions,
}: {
  overlay: Translation;
  intents: StudyIntents;
  aiOptions?: AiOptionsState;
}) {
  const s = useStyles(),
    t = useTokens();
  const [expanded, setExpanded] = useState(false);
  const quote = overlay.quote ?? empty;
  const canExpand = docLength(quote) > 180;
  const source = expanded || !canExpand ? quote : revealDoc(quote, 180);
  const reveal = useReveal(overlay.answer ?? empty, overlay.streaming);
  const busy = overlay.streaming || reveal.revealing;
  const status = overlay.error
    ? '翻译中断'
    : overlay.stopped
    ? '已停止'
    : busy
    ? '正在翻译'
    : '翻译完成';
  return (
    <View style={s.root}>
      <View style={s.options}>
        <Text style={s.language}>双语对照</Text>
        <View style={s.model}>
          <AiOptionsControl
            state={aiOptions}
            onChange={intents.setAiOptions}
            disabled={overlay.streaming}
            compact
          />
        </View>
      </View>
      {quote.length ? (
        <View style={s.source} testID="translation-source">
          <View style={s.heading}>
            <Text accessibilityRole="header" style={s.sourceLabel}>
              原文
            </Text>
            {canExpand ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={expanded ? '收起原文' : '展开全部原文'}
                accessibilityState={{ expanded }}
                onPress={() => setExpanded(value => !value)}
                style={({ pressed }) => [s.toggle, pressed && s.pressed]}
              >
                <Text style={s.toggleLabel}>
                  {expanded ? '收起' : '展开全文'}
                </Text>
                <Icon
                  name={expanded ? 'updown' : 'arrowDown'}
                  size={14}
                  color={t.color.ink2}
                />
              </Pressable>
            ) : null}
          </View>
          <RichView doc={source} typography="sheetQuote" />
          {canExpand && !expanded ? <Text style={s.ellipsis}>…</Text> : null}
        </View>
      ) : null}
      <View
        testID="translation-answer"
        style={s.translation}
        accessibilityState={{ busy }}
      >
        <View style={s.heading}>
          <View style={s.titleGroup}>
            <Icon name="spark" size={18} color={t.color.accentInk} />
            <Text accessibilityRole="header" style={s.title}>
              中文译文
            </Text>
          </View>
          <Text accessibilityLiveRegion="polite" style={s.status}>
            {status}
          </Text>
        </View>
        <RevealContext.Provider value={busy}>
          <RichView
            doc={reveal.doc}
            onCite={intents.pressCite}
            onFigure={intents.pressFigure}
          />
        </RevealContext.Provider>
        {overlay.streaming ? (
          <Typing
            label={overlay.answer?.length ? '正在翻译…' : '正在准备译文…'}
          />
        ) : null}
        {reveal.canSkip ? <RevealSkip onPress={reveal.skip} /> : null}
        {overlay.error ? <Note tone="bad">{overlay.error}</Note> : null}
        {overlay.stopped ? (
          <Text style={s.status}>已保留当前译文，可重新翻译。</Text>
        ) : null}
      </View>
      <View style={s.footer}>
        {overlay.streaming ? (
          <Button
            variant="text"
            icon="stop"
            label="停止翻译"
            onPress={() => intents.overlayAction('stop')}
          />
        ) : (
          <Button
            variant="text"
            icon="sync"
            label={overlay.error ? '重试翻译' : '重新翻译'}
            onPress={() => intents.overlayAction('regenerate')}
          />
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles(t => ({
  root: { gap: 16, paddingVertical: 8 },
  options: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  model: { flexShrink: 1, minWidth: 0 },
  language: { ...t.type.caption, color: t.color.ink2 },
  source: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: t.color.surfaceAlt,
    borderRadius: t.shape.md,
  },
  heading: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sourceLabel: { ...t.type.label, color: t.color.ink2 },
  toggle: {
    minHeight: 48,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: t.shape.sm,
  },
  toggleLabel: { ...t.type.caption, color: t.color.ink2 },
  pressed: { backgroundColor: t.color.pressed },
  ellipsis: { ...t.type.body, color: t.color.ink3 },
  translation: { gap: 8 },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  title: { ...t.type.headline, color: t.color.ink },
  status: { ...t.type.caption, color: t.color.ink2, flexShrink: 1 },
  footer: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: t.color.line,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
}));
