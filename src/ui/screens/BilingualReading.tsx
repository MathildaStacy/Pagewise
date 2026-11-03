import { useLayoutEffect, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
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
import type { StudyIntents, StudyOverlay } from '@features/study/types';
import type { AiOptionsState } from '@features/settings/types';
import { AiOptionsControl } from './AiOptionsControl';

type Translation = Extract<StudyOverlay, { kind: 'sectionTranslation' }>;
type Passage = NonNullable<Translation['passages']>[number];
type ReadingMode = 'parallel' | 'chinese' | 'source';
const empty: RichDoc = [];

/** A book's source blocks own the layout and alignment, including while translation streams. */
export function BilingualReading({
  overlay,
  intents,
  aiOptions,
}: {
  overlay: Translation;
  intents: StudyIntents;
  aiOptions?: AiOptionsState;
}) {
  const s = useStyles();
  const [mode, setMode] = useState<ReadingMode>('parallel');
  const { width, fontScale } = useWindowDimensions();
  const columns = width >= 720 && fontScale <= 1.3;
  const parts = overlay.passages ?? [];
  const translated = parts.filter(part => !part.preserved);
  const finished = translated.filter(part => part.complete).length;
  const status = overlay.error
    ? '翻译中断'
    : overlay.stopped
    ? '已停止'
    : overlay.streaming
    ? translated.length
      ? `正在翻译 · ${finished} / ${translated.length}`
      : '正在准备译文…'
    : '翻译完成';
  return (
    <View
      style={[s.root, (mode !== 'parallel' || !columns) && s.singleColumn]}
      testID="bilingual-reading"
    >
      <View style={s.tools}>
        <Text style={s.status} accessibilityLiveRegion="polite">
          {status}
        </Text>
        <View style={s.model}>
          <AiOptionsControl
            state={aiOptions}
            onChange={intents.setAiOptions}
            disabled={overlay.streaming}
            compact
          />
        </View>
      </View>
      <Segmented
        accessibilityLabel="双语阅读方式"
        options={[
          { key: 'parallel', label: '中英对照' },
          { key: 'chinese', label: '中文' },
          { key: 'source', label: '原文' },
        ]}
        value={mode}
        onChange={value => setMode(value as ReadingMode)}
      />
      <View style={s.book}>
        {parts.map((part, index) => (
          <PassageView
            key={part.id}
            part={part}
            mode={mode}
            columns={columns}
            streaming={overlay.streaming}
            fromCache={overlay.fromCache}
            intents={intents}
            showPage={parts[index + 1]?.page !== part.page}
          />
        ))}
      </View>
      {overlay.error ? <Note tone="bad">{overlay.error}</Note> : null}
      {overlay.stopped ? (
        <Text style={s.status}>已保留当前译文，继续时会接着翻译。</Text>
      ) : null}
      <View style={s.footer}>
        <Text style={s.status}>
          {mode === 'parallel'
            ? columns
              ? '原文在左，中文在右'
              : '原文在前，中文紧随其后'
            : mode === 'chinese'
            ? '未译段落保留原文'
            : '原文保持书籍顺序'}
        </Text>
        {!overlay.streaming && !overlay.error && !overlay.stopped ? (
          <Button
            variant="text"
            icon="sync"
            label="重新翻译"
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
  );
}

function PassageView({
  part,
  mode,
  columns,
  streaming,
  fromCache,
  intents,
  showPage,
}: {
  part: Passage;
  mode: ReadingMode;
  columns: boolean;
  streaming: boolean;
  fromCache?: boolean;
  intents: StudyIntents;
  showPage: boolean;
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
            {part.answer ? translated : <Text style={s.pending}>待译</Text>}
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
    width: '100%',
    maxWidth: 1040,
    alignSelf: 'center',
    gap: 16,
    paddingTop: 4,
  },
  tools: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  model: { flexShrink: 1, minWidth: 0 },
  status: { ...t.type.caption, color: t.color.ink2 },
  book: { paddingTop: 8 },
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
