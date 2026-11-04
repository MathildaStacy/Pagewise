import { useLayoutEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  Button,
  CopyTextButton,
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
import type {
  ReadingAppearance,
  StudyIntents,
  StudyOverlay,
} from '@features/study/types';
import type { AiOptionsState } from '@features/settings/types';
import { AiOptionsControl } from './AiOptionsControl';
import { BilingualReading } from './BilingualReading';

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
  reading,
}: {
  overlay: Translation;
  intents: StudyIntents;
  aiOptions?: AiOptionsState;
  reading?: ReadingAppearance;
}) {
  const s = useStyles(),
    t = useTokens();
  const [expanded, setExpanded] = useState(false);
  const [picking, setPicking] = useState(false);
  const quote = overlay.quote ?? empty;
  const canExpand = docLength(quote) > 180;
  const source = expanded || !canExpand ? quote : revealDoc(quote, 180);
  const reveal = useReveal(overlay.answer ?? empty, overlay.streaming);
  const skipReveal = reveal.skip;
  useLayoutEffect(() => {
    if (overlay.fromCache) skipReveal();
  }, [overlay.fromCache, skipReveal]);
  const busy = overlay.streaming || (!overlay.fromCache && reveal.revealing);
  const explain = overlay.kind === 'explain';
  const sentences = overlay.kind === 'explain' ? overlay.sentences ?? [] : [];
  const focus = overlay.kind === 'explain' ? overlay.focus ?? null : null;
  const status = overlay.error
    ? explain
      ? '讲解中断'
      : '翻译中断'
    : overlay.stopped
    ? '已停止'
    : busy
    ? explain
      ? '正在讲解'
      : '正在翻译'
    : explain
    ? '讲解完成'
    : '翻译完成';
  if (overlay.kind === 'sectionTranslation' && overlay.passages)
    return (
      <BilingualReading
        overlay={overlay}
        intents={intents}
        aiOptions={aiOptions}
        reading={reading}
      />
    );
  return (
    <View style={s.root}>
      <View style={s.options}>
        <Text style={s.language}>{explain ? '本段讲解' : '双语对照'}</Text>
        <View style={s.model}>
          <AiOptionsControl
            state={aiOptions}
            onChange={intents.setAiOptions}
            disabled={overlay.streaming}
            compact
            labelOnly
          />
        </View>
      </View>
      {quote.length ? (
        <View style={s.source} testID="translation-source">
          <View style={s.heading}>
            <Text accessibilityRole="header" style={s.sourceLabel}>
              原文
            </Text>
            <View style={s.tools}>
              {sentences.length > 1 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={picking ? '收起逐句' : '选一句只讲这一句'}
                  accessibilityState={{ expanded: picking }}
                  onPress={() => setPicking(value => !value)}
                  style={({ pressed }) => [s.toggle, pressed && s.pressed]}
                >
                  <Text style={s.toggleLabel}>
                    {picking ? '收起逐句' : '只讲一句'}
                  </Text>
                </Pressable>
              ) : null}
              {canExpand && !picking ? (
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
          </View>
          {picking ? (
            <View style={s.sentences}>
              <Text style={s.hint}>点一句，只讲这一句；整段仍作为上下文</Text>
              {sentences.map((sentence, index) => (
                <Pressable
                  key={`${index}:${sentence.slice(0, 12)}`}
                  accessibilityRole="button"
                  accessibilityLabel={`只讲第 ${index + 1} 句`}
                  accessibilityState={{ selected: focus === index }}
                  onPress={() => {
                    setPicking(false);
                    intents.overlayAction(`focus:${index}`);
                  }}
                  style={({ pressed }) => [
                    s.sentence,
                    focus === index && s.sentenceOn,
                    pressed && s.pressed,
                  ]}
                >
                  <Text style={s.sentenceText}>{sentence}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <>
              <RichView doc={source} typography="book" selectable />
              {canExpand && !expanded ? (
                <Text style={s.ellipsis}>…</Text>
              ) : null}
            </>
          )}
        </View>
      ) : null}
      {focus !== null && sentences[focus] ? (
        <View style={s.focus} testID="explain-focus">
          <Text style={s.focusText} numberOfLines={3}>
            只讲这一句：{sentences[focus]}
          </Text>
          <Button
            variant="text"
            label="讲整段"
            onPress={() => intents.overlayAction('focus:none')}
          />
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
              {explain ? 'AI 讲解' : '中文译文'}
            </Text>
          </View>
          <Text accessibilityLiveRegion="polite" style={s.status}>
            {status}
          </Text>
        </View>
        <RevealContext.Provider value={busy}>
          <RichView
            typography={explain ? undefined : 'book'}
            selectable={!busy}
            doc={overlay.fromCache ? overlay.answer ?? empty : reveal.doc}
            onCite={intents.pressCite}
            onFigure={intents.pressFigure}
          />
        </RevealContext.Provider>
        {overlay.streaming ? (
          <Typing
            label={
              explain
                ? '正在生成讲解…'
                : overlay.answer?.length
                ? '正在翻译…'
                : '正在准备译文…'
            }
          />
        ) : null}
        {!overlay.fromCache && reveal.canSkip ? (
          <RevealSkip onPress={reveal.skip} />
        ) : null}
        {overlay.error ? (
          <>
            <Note tone="bad">{overlay.error}</Note>
            <Button
              variant="secondary"
              onPress={() => intents.openAiSettings?.()}
            >
              AI 服务设置
            </Button>
          </>
        ) : null}
        {overlay.stopped ? (
          <Text style={s.status}>
            {explain
              ? '讲解已停止，可重新生成。'
              : '已保留当前译文，可继续翻译。'}
          </Text>
        ) : null}
      </View>
      {!overlay.streaming && !overlay.error && !overlay.stopped ? (
        <View style={s.footer}>
          {!busy && overlay.answer?.length ? (
            <CopyTextButton
              doc={overlay.answer}
              label={explain ? '复制讲解' : '复制译文'}
            />
          ) : null}
          <Button
            variant="text"
            icon="sync"
            label={explain ? '重新讲解' : '重新翻译'}
            onPress={() => intents.overlayAction('regenerate')}
          />
        </View>
      ) : null}
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
  tools: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  sentences: { gap: 4 },
  hint: { ...t.type.caption, color: t.color.ink2, paddingBottom: 4 },
  sentence: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: t.shape.sm,
    borderLeftWidth: 3,
    borderLeftColor: t.color.surfaceAlt,
  },
  sentenceOn: {
    backgroundColor: t.color.accentBg,
    borderLeftColor: t.color.accent,
  },
  sentenceText: { ...t.type.body, color: t.color.ink },
  focus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
    borderRadius: t.shape.md,
    backgroundColor: t.color.accentBg,
  },
  focusText: { ...t.type.caption, color: t.color.accentInk, flex: 1 },
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
