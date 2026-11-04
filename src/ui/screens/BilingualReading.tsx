import { useLayoutEffect, useRef, useState } from 'react';
import { FlatList, Text, View, useWindowDimensions } from 'react-native';
import {
  Button,
  Note,
  RevealContext,
  RichView,
  Segmented,
  TableView,
  makeStyles,
  useReveal,
  type RichDoc,
} from '@ui/kit';
import type {
  ReadingAppearance,
  StudyIntents,
  StudyOverlay,
  TranslationReadingMode,
} from '@features/study/types';
import type { AiOptionsState } from '@features/settings/types';
import { AiOptionsControl } from './AiOptionsControl';
import { ReadingSettings } from './ReadingTools';

type Translation = Extract<StudyOverlay, { kind: 'sectionTranslation' }>;
type Passage = NonNullable<Translation['passages']>[number];
type ReadingMode = TranslationReadingMode;
const empty: RichDoc = [];
const noPassages: Passage[] = [];

/** A book's source blocks own the layout and alignment, including while translation streams. */
export function BilingualReading({
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
  const s = useStyles();
  const language = overlay.target === 'en' ? '英文' : '中文';
  const parts = overlay.passages ?? noPassages;
  const initial = parts.find(part => part.ref === overlay.initialRef);
  const [mode, setMode] = useState<ReadingMode>(
    overlay.initialMode ?? 'parallel',
  );
  const list = useRef<FlatList<Passage>>(null);
  const anchor = useRef<string | null>(initial?.id ?? null);
  const pending = useRef<string | null>(initial?.id ?? null);
  const restoring = useRef(false);
  const frame = useRef<number | null>(null);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { width, fontScale } = useWindowDimensions();
  const columns = width >= 720 && fontScale <= 1.3;
  const [visibleId, setVisibleId] = useState(initial?.id ?? parts[0]?.id);
  const actions = useRef(intents);
  actions.current = intents;
  const translated = parts.filter(part => !part.preserved);
  const finished = translated.filter(part => part.complete).length;
  const firstPending = parts.findIndex(
    part => !part.preserved && !part.complete,
  );
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: { item: Passage }[] }) => {
      if (pending.current) {
        if (
          !restoring.current ||
          !viewableItems.some(item => item.item.id === pending.current)
        )
          return;
      }
      anchor.current =
        pending.current ?? viewableItems[0]?.item.id ?? anchor.current;
      const visible = viewableItems.find(
        item => item.item.id === anchor.current,
      );
      if (visible) {
        setVisibleId(visible.item.id);
        actions.current.reportAnchor?.(`b${visible.item.ref}`);
      }
      pending.current = null;
    },
  ).current;
  const restoreAnchor = () => {
    if (!pending.current) return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    // Cell heights change between reading modes. Wait for native layout before
    // asking FlatList to locate the passage with its newly measured offsets.
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const index = parts.findIndex(part => part.id === pending.current);
      if (index >= 0) {
        restoring.current = true;
        list.current?.scrollToIndex({
          index,
          animated: false,
          viewPosition: 0,
        });
      }
    });
  };
  useLayoutEffect(
    () => () => {
      if (retry.current) clearTimeout(retry.current);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );
  const status = overlay.error
    ? '翻译中断'
    : overlay.stopped
    ? '已停止'
    : overlay.streaming
    ? translated.length
      ? `正在翻译 · ${finished} / ${translated.length}`
      : '正在准备译文…'
    : translated.length
    ? `${
        finished === translated.length ? '翻译完成' : '部分已翻译'
      } · ${finished} / ${translated.length}`
    : '原文内容无需翻译';
  const visibleIndex = Math.max(
    0,
    parts.findIndex(part => part.id === visibleId),
  );
  return (
    <View style={s.root} testID="bilingual-reading">
      <View style={s.controls}>
        <View style={s.tools}>
          <View style={s.progress}>
            <Text style={s.status} accessibilityLiveRegion="polite">
              {status}
            </Text>
            {parts.length ? (
              <Text style={s.status}>
                {parts[visibleIndex].page} · 本节 {visibleIndex + 1} /{' '}
                {parts.length}
              </Text>
            ) : null}
          </View>
          <ReadingSettings reading={reading} intents={intents} />
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
        <Segmented
          accessibilityLabel="双语阅读方式"
          options={[
            { key: 'parallel', label: '中英对照' },
            { key: 'chinese', label: language },
            { key: 'source', label: '原文' },
          ]}
          value={mode}
          onChange={value => {
            pending.current = anchor.current;
            restoring.current = false;
            setMode(value as ReadingMode);
            intents.setTranslationMode?.(value as ReadingMode);
          }}
        />
        {firstPending >= 0 ? (
          <Button
            variant="text"
            label="到未译段落"
            icon="arrowDown"
            onPress={() => {
              pending.current = parts[firstPending].id;
              restoring.current = false;
              restoreAnchor();
            }}
          />
        ) : null}
      </View>
      <FlatList
        ref={list}
        testID="bilingual-passages"
        style={s.scroll}
        contentContainerStyle={s.book}
        data={parts}
        keyExtractor={part => part.id}
        extraData={[mode, columns, overlay.streaming, overlay.fromCache]}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 5 }}
        onContentSizeChange={restoreAnchor}
        onScrollBeginDrag={() => {
          pending.current = null;
        }}
        onScrollToIndexFailed={info => {
          list.current?.scrollToOffset({
            offset: info.averageItemLength * info.index,
            animated: false,
          });
          if (retry.current) clearTimeout(retry.current);
          retry.current = setTimeout(() => {
            if (pending.current)
              list.current?.scrollToIndex({
                index: info.index,
                animated: false,
                viewPosition: 0,
              });
          }, 150);
        }}
        renderItem={({ item: part, index }) => (
          <View
            onLayout={restoreAnchor}
            style={[
              s.page,
              (mode !== 'parallel' || !columns) && s.singleColumn,
            ]}
          >
            <PassageView
              part={part}
              language={language}
              mode={mode}
              columns={columns}
              streaming={overlay.streaming}
              fromCache={overlay.fromCache}
              intents={intents}
              showPage={parts[index + 1]?.page !== part.page}
              pendingLabel={
                overlay.streaming && index === firstPending
                  ? '正在翻译…'
                  : '尚未翻译'
              }
            />
          </View>
        )}
        ListFooterComponent={
          <View style={[s.page, s.singleColumn]}>
            {overlay.error ? <Note tone="bad">{overlay.error}</Note> : null}
            {overlay.stopped ? (
              <Text style={s.status}>已保留当前译文，继续时会接着翻译。</Text>
            ) : null}
            <View style={s.footer}>
              <Text style={s.status}>
                {mode === 'parallel'
                  ? columns
                    ? `原文在左，${language}在右`
                    : `原文在前，${language}紧随其后`
                  : mode === 'chinese'
                  ? '未译段落保留原文'
                  : '原文保持书籍顺序'}
              </Text>
              {!overlay.streaming && !overlay.error && !overlay.stopped ? (
                <Button
                  variant="text"
                  icon="sync"
                  label={firstPending >= 0 ? '继续翻译' : '重新翻译'}
                  onPress={() => intents.overlayAction('regenerate')}
                />
              ) : null}
              {overlay.error ? (
                <Button
                  variant="text"
                  label="AI 服务设置"
                  onPress={() => intents.openAiSettings?.()}
                />
              ) : null}
            </View>
          </View>
        }
      />
    </View>
  );
}

function PassageView({
  part,
  language,
  mode,
  columns,
  streaming,
  fromCache,
  intents,
  showPage,
  pendingLabel,
}: {
  part: Passage;
  language: string;
  mode: ReadingMode;
  columns: boolean;
  streaming: boolean;
  fromCache?: boolean;
  intents: StudyIntents;
  showPage: boolean;
  pendingLabel: string;
}) {
  const s = useStyles();
  const reveal = useReveal(part.answer ?? empty, streaming && !part.complete);
  const skip = reveal.skip;
  useLayoutEffect(() => {
    if (fromCache || part.complete) skip();
  }, [fromCache, part.complete, skip]);
  const caption = part.type === 'caption' || part.type === 'footnote';
  const typography = caption ? 'bookCaption' : 'book';
  const original = part.sourceTable ? (
    <TableView rows={part.sourceTable} grid={part.sourceGrid} selectable />
  ) : (
    <RichView
      doc={part.source}
      typography={typography}
      selectable
      onFigure={intents.pressFigure}
    />
  );
  const translated = part.answerTable ? (
    <TableView rows={part.answerTable} grid={part.answerGrid} selectable />
  ) : (
    <RevealContext.Provider value={streaming && !part.complete}>
      <RichView
        doc={fromCache || part.complete ? part.answer ?? empty : reveal.doc}
        typography={part.type === 'image' ? 'bookCaption' : typography}
        selectable
      />
    </RevealContext.Provider>
  );
  const sideBySide = columns && mode === 'parallel' && !part.preserved;
  return (
    <View
      style={[
        s.passage,
        mode === 'parallel' && s.parallelPassage,
        caption && s.captionPassage,
      ]}
      testID={`translation-passage-${part.id}`}
    >
      <View style={sideBySide ? s.columns : undefined}>
        {mode !== 'chinese' ||
        part.preserved ||
        !part.answer ||
        part.type === 'image' ? (
          <View
            style={sideBySide ? s.column : undefined}
            testID={`translation-original-${part.id}`}
          >
            {!part.preserved && (mode === 'parallel' || !part.answer) ? (
              <Text style={s.language}>
                {mode === 'chinese' ? '原文 · 尚未翻译' : '原文'}
              </Text>
            ) : null}
            {original}
          </View>
        ) : null}
        {!part.preserved && mode !== 'source' ? (
          <View
            style={[
              s.translation,
              mode === 'parallel' && s.paired,
              sideBySide && s.column,
              sideBySide && s.aligned,
            ]}
            testID={`translation-chinese-${part.id}`}
          >
            {mode === 'parallel' ? (
              <Text style={s.language}>{language}译文</Text>
            ) : null}
            {part.answer ? (
              translated
            ) : (
              <Text style={s.pending}>{pendingLabel}</Text>
            )}
          </View>
        ) : null}
      </View>
      {showPage ? (
        <Button
          variant="text"
          size="sm"
          label={`查看原文 · ${part.page}`}
          onPress={() => intents.pressCite(part.ref)}
        />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(t => ({
  singleColumn: { maxWidth: 760 },
  root: {
    flex: 1,
    width: '100%',
  },
  scroll: { flex: 1 },
  controls: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: t.color.line,
    backgroundColor: t.color.paper,
  },
  page: { width: '100%', maxWidth: 1040, alignSelf: 'center' },
  tools: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  model: { flexShrink: 1, minWidth: 0 },
  progress: { flex: 1, minWidth: 100, gap: 4 },
  status: { ...t.type.caption, color: t.color.ink2 },
  book: { paddingTop: 20, paddingHorizontal: 24, paddingBottom: 24 },
  language: { ...t.type.caption, color: t.color.ink2, marginBottom: 8 },
  passage: { marginBottom: 18 },
  parallelPassage: {
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: t.color.line,
  },
  captionPassage: { paddingHorizontal: 8 },
  translation: { paddingTop: 8 },
  paired: {
    marginTop: 12,
    paddingTop: 0,
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: t.color.line,
  },
  columns: { flexDirection: 'row', gap: 32, alignItems: 'flex-start' },
  column: { flex: 1, minWidth: 0 },
  aligned: { marginTop: 0, paddingTop: 0 },
  pending: { ...t.type.caption, color: t.color.ink2 },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingBottom: 16,
  },
}));
