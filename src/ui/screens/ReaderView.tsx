import { useEffect, useRef, type ComponentRef } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {
  AppBar,
  BlockView,
  Button,
  Dialog,
  Empty,
  Field,
  GuideBar,
  LayerRow,
  ListSection,
  ModeSwitch,
  Note,
  PinChip,
  ReadEnd,
  RichView,
  Row,
  Screen,
  Segmented,
  SelectionMenu,
  Sheet,
  StackBar,
  ToastHost,
  Typing,
  makeStyles,
} from '@ui/kit';
import type {
  ReaderItem,
  ReaderScreenState,
  ReaderState,
  StudyIntents,
  StudyOverlay,
} from '@features/study/types';

export function ReaderView({
  state,
  intents,
}: {
  state: ReaderScreenState;
  intents: StudyIntents;
}) {
  const s = useStyles();
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <AppBar
        variant="push"
        title={state.header.title}
        subtitle={state.header.subtitle}
        onBack={intents.back}
        backLabel="返回"
        right={<ModeSwitch value="read" onChange={intents.setMode} />}
      />
      <View style={s.grow}>
        <ReaderContent state={state.read} intents={intents} />
      </View>
      <StudyOverlays overlay={state.overlay} intents={intents} />
      <ToastHost toast={state.toast ? { message: state.toast } : null} />
    </Screen>
  );
}
export function ReaderContent({
  state,
  intents,
}: {
  state: ReaderState;
  intents: StudyIntents;
}) {
  const s = useStyles(),
    list = useRef<FlatList<ReaderItem>>(null),
    visible = useRef(intents.reportAnchor);
  visible.current = intents.reportAnchor;
  const viewable = useRef(
    ({ viewableItems }: { viewableItems: { item: ReaderItem }[] }) => {
      const blocks = viewableItems.filter(v => v.item.kind === 'block');
      const middle = blocks[Math.floor(blocks.length / 2)];
      if (middle?.item.kind === 'block') visible.current(middle.item.ref);
    },
  ).current;
  const target = state.scrollTo?.ref;
  const index = target
    ? state.items.findIndex(
        item => item.kind === 'block' && item.ref === target,
      )
    : -1;
  useEffect(() => {
    if (index < 0 || state.view !== 'flow') return;
    const timer = setTimeout(
      () =>
        list.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.3,
        }),
      100,
    );
    return () => clearTimeout(timer);
  }, [index, state.scrollTo?.token, state.view]);
  const renderItem = ({ item }: { item: ReaderItem }) =>
    item.kind === 'pageBreak' ? (
      <Text style={s.pageBreak}>{item.page}</Text>
    ) : (
      <ReaderBlockRow item={item} intents={intents} />
    );
  return (
    <View style={s.grow}>
      <View style={s.toolbar}>
        <Segmented
          options={[
            { key: 'orig', label: '原版' },
            { key: 'flow', label: '重排' },
          ]}
          value={state.view}
          onChange={value =>
            intents.setView(value === 'orig' ? 'orig' : 'flow')
          }
          accessibilityLabel="原文排版"
        />
        <Text style={s.hint}>{state.hint}</Text>
      </View>
      {state.view === 'orig' ? (
        <View style={s.empty}>
          <Empty
            title="原版 PDF 阅读"
            body="原版页面阅读尚未接入，先用重排模式读原文。"
            action={
              <Button
                variant="secondary"
                onPress={() => intents.setView('flow')}
              >
                切换到重排
              </Button>
            }
          />
        </View>
      ) : (
        <FlatList
          ref={list}
          data={state.items}
          renderItem={renderItem}
          keyExtractor={item => (item.kind === 'block' ? item.ref : item.id)}
          contentContainerStyle={s.readerBody}
          onViewableItemsChanged={viewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 40 }}
          onScrollToIndexFailed={info => {
            list.current?.scrollToOffset({
              offset: Math.max(0, info.averageItemLength * info.index),
              animated: false,
            });
            setTimeout(
              () =>
                list.current?.scrollToIndex({
                  index: info.index,
                  animated: true,
                  viewPosition: 0.3,
                }),
              150,
            );
          }}
          ListHeaderComponent={
            <>
              {state.guide ? (
                <GuideBar
                  title={state.guide.oneLine}
                  body={
                    state.guide.loading ? '正在生成导读…' : state.guide.full
                  }
                  expanded={state.guide.expanded}
                  onToggle={intents.toggleGuide}
                />
              ) : null}
              {state.loading ? <Empty body="正在读取原文…" /> : null}
              {state.error ? (
                <View style={s.panel}>
                  <Note tone="bad">{state.error}</Note>
                  <Button variant="secondary" onPress={() => intents.retry()}>
                    重新加载
                  </Button>
                </View>
              ) : null}
            </>
          }
          ListEmptyComponent={
            !state.loading && !state.error ? (
              <Empty body="这节还没有可读的正文" />
            ) : undefined
          }
          ListFooterComponent={
            state.readEnd.visible ? (
              <View style={s.end}>
                <ReadEnd
                  label={state.readEnd.label}
                  onPress={intents.finishReading}
                />
                <Text style={s.hint}>{state.readEnd.hint}</Text>
              </View>
            ) : (
              <View style={s.footerSpace} />
            )
          }
        />
      )}
      {state.selection ? (
        <SelectionMenu
          anchor={state.selection.anchor}
          items={state.selection.items}
          onSelect={intents.menuAction}
          onDismiss={intents.closeOverlay}
        />
      ) : null}
    </View>
  );
}
function ReaderBlockRow({
  item,
  intents,
}: {
  item: Extract<ReaderItem, { kind: 'block' }>;
  intents: StudyIntents;
}) {
  const s = useStyles(),
    view = useRef<ComponentRef<typeof View>>(null);
  const select = () => {
    if (item.type === 'title') return;
    view.current?.measureInWindow((x, y, w, h) =>
      intents.pressBlock(item.ref, { x, y, w, h }),
    );
  };
  return (
    <View
      ref={view}
      collapsable={false}
      style={[
        s.block,
        item.marks.includes('selected') ? s.selected : undefined,
        item.marks.includes('flash') ? s.flash : undefined,
      ]}
    >
      {item.type === 'title' ? (
        <View style={s.readerTitle}>
          <RichView doc={item.doc} />
        </View>
      ) : item.type === 'table' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="查看表格"
          onPress={select}
        >
          <View style={s.tablePreview}>
            {item.table?.slice(0, 3).map((row, i) => (
              <Text key={i} style={s.tableText} numberOfLines={1}>
                {row.join('    ·    ')}
              </Text>
            ))}
            <Button
              variant="text"
              size="sm"
              onPress={() => intents.pressTable(item.ref)}
            >
              展开表格
            </Button>
          </View>
        </Pressable>
      ) : (
        <BlockView
          doc={item.doc}
          current={item.marks.includes('now')}
          done={item.marks.includes('heard')}
          highlighted={item.marks.includes('highlight')}
          onPress={item.type === 'title' ? undefined : select}
        />
      )}
      {item.pin ? (
        <View style={s.pin}>
          <PinChip
            label={item.pin.label}
            onPress={() => intents.pressPin(item.pin!.id)}
          />
        </View>
      ) : null}
    </View>
  );
}
export function StudyOverlays({
  overlay,
  intents,
}: {
  overlay: StudyOverlay | null;
  intents: StudyIntents;
}) {
  const s = useStyles();
  if (!overlay) return null;
  if (overlay.kind === 'jumpStep' || overlay.kind === 'switchMain')
    return (
      <Dialog
        visible
        title={
          overlay.kind === 'jumpStep'
            ? overlay.title
            : overlay.rebase === false
            ? '回到主线？'
            : '切换主线？'
        }
        body={overlay.body}
        confirm={
          overlay.kind === 'switchMain' && overlay.rebase === false
            ? '回到主线'
            : '从这里开始讲'
        }
        onConfirm={() => intents.overlayAction('confirm')}
        onCancel={intents.closeOverlay}
      />
    );
  const title =
    overlay.kind === 'menu'
      ? '伴读'
      : overlay.kind === 'roadmap'
      ? '本节路线图'
      : overlay.kind === 'context'
      ? 'AI 看到的内容'
      : overlay.kind === 'peek'
      ? overlay.title
      : overlay.kind === 'figure'
      ? '查看图片'
      : overlay.kind === 'explain'
      ? '解释'
      : overlay.kind === 'translate'
      ? '翻译'
      : overlay.kind === 'pin'
      ? '问答便签'
      : overlay.kind === 'note'
      ? '记笔记'
      : '查看表格';
  const subtitle =
    'subtitle' in overlay
      ? overlay.subtitle
      : overlay.kind === 'context'
      ? '本轮请求 · 预计输入 token'
      : overlay.kind === 'figure'
      ? overlay.page
      : undefined;
  return (
    <Sheet
      visible
      title={title}
      subtitle={subtitle}
      onClose={intents.closeOverlay}
      detent={
        overlay.kind === 'figure' || overlay.kind === 'table' ? 'full' : 'auto'
      }
    >
      {overlay.kind === 'menu'
        ? overlay.rows.map(row => (
            <Row
              key={row.key}
              title={row.title}
              subtitle={row.sub}
              chevron
              onPress={() => intents.menuSelect(row.key)}
            />
          ))
        : null}
      {overlay.kind === 'roadmap' ? (
        <ListSection title={overlay.title}>
          {overlay.steps.map((step, i) => (
            <Row
              key={i}
              title={`${i + 1}. ${step.title}`}
              subtitle={`${step.kindLabel} · ${step.pages}`}
              right={
                <Text style={s.hint}>
                  {
                    {
                      done: '已讲',
                      current: '正在讲',
                      skipped: '已跳过',
                      todo: '未讲',
                    }[step.state]
                  }
                </Text>
              }
              chevron
              onPress={() => intents.pressStep(i)}
            />
          ))}
        </ListSection>
      ) : null}
      {overlay.kind === 'context' ? (
        <View style={s.panel}>
          <StackBar layers={overlay.layers.map(l => ({ value: l.value }))} />
          {overlay.layers.map((l, i) => (
            <LayerRow
              key={i}
              name={l.name}
              detail={l.detail}
              tokens={l.tokens}
              cached={l.cached}
            />
          ))}
          <Row
            title="合计"
            subtitle={overlay.lastActual}
            right={<Text style={s.body}>{overlay.total}</Text>}
          />
          <Note tone="neutral">{overlay.note}</Note>
        </View>
      ) : null}
      {overlay.kind === 'peek' ? (
        <View style={s.panel}>
          {overlay.blocks.map(block => (
            <View key={block.ref} style={block.target ? s.target : s.quote}>
              <RichView
                doc={block.doc}
                onCite={intents.pressCite}
                onFigure={intents.pressFigure}
              />
            </View>
          ))}
          <View style={s.actions}>
            {!overlay.detour ? (
              <Button onPress={() => intents.overlayAction('openInReader')}>
                在读书模式打开
              </Button>
            ) : null}
            <Button variant="secondary" onPress={intents.closeOverlay}>
              {overlay.detour ? '好的' : '关闭'}
            </Button>
          </View>
        </View>
      ) : null}
      {overlay.kind === 'figure' ? (
        <ScrollView contentContainerStyle={s.panel}>
          <Image
            source={{ uri: overlay.uri }}
            style={s.figure}
            resizeMode="contain"
            accessibilityLabel={overlay.caption}
          />
          <Text style={s.body}>{overlay.caption}</Text>
        </ScrollView>
      ) : null}
      {overlay.kind === 'explain' || overlay.kind === 'translate' ? (
        <View style={s.panel}>
          <View style={s.quote}>
            <RichView doc={overlay.quote} />
          </View>
          {overlay.streaming ? <Typing label="正在整理…" /> : null}
          {overlay.answer ? (
            <RichView
              doc={overlay.answer}
              onCite={intents.pressCite}
              onFigure={intents.pressFigure}
            />
          ) : null}
          {overlay.error ? <Note tone="bad">{overlay.error}</Note> : null}
          <View style={s.actions}>
            <Button
              variant="secondary"
              onPress={() => intents.overlayAction('stuck')}
            >
              记为卡点
            </Button>
            <Button
              variant="secondary"
              onPress={() => intents.overlayAction('ask')}
            >
              带到听讲里继续问
            </Button>
            <Button
              disabled={!overlay.answer || overlay.streaming}
              onPress={() => intents.overlayAction('ok')}
            >
              好的，贴成便签
            </Button>
          </View>
        </View>
      ) : null}
      {overlay.kind === 'pin' ? (
        <View style={s.panel}>
          <Text style={s.headline}>{overlay.title}</Text>
          <RichView doc={overlay.answer} />
          <View style={s.actions}>
            <Button onPress={() => intents.overlayAction('ask')}>
              在听讲里继续问
            </Button>
            <Button variant="secondary" onPress={intents.closeOverlay}>
              好的
            </Button>
          </View>
        </View>
      ) : null}
      {overlay.kind === 'note' ? (
        <View style={s.panel}>
          <View style={s.quote}>
            <RichView doc={overlay.quote} />
          </View>
          <Field
            label="我的理解"
            value={overlay.value}
            onChange={intents.setNoteText}
            placeholder="写下你的理解"
            multiline
          />
          <Button onPress={() => intents.overlayAction('save')}>保存</Button>
        </View>
      ) : null}
      {overlay.kind === 'table' ? (
        <ScrollView horizontal>
          <View style={s.panel}>
            {overlay.rows.map((row, i) => (
              <View key={i} style={s.tableRow}>
                {row.map((cell, j) => (
                  <Text
                    key={j}
                    style={[s.tableCell, i === 0 ? s.tableHead : undefined]}
                  >
                    {cell}
                  </Text>
                ))}
              </View>
            ))}
            <Text style={s.hint}>{overlay.caption}</Text>
          </View>
        </ScrollView>
      ) : null}
    </Sheet>
  );
}
const useStyles = makeStyles(t => ({
  grow: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: t.space.pageX,
    paddingVertical: t.space.gap,
    gap: t.space.gap,
    borderBottomWidth: 1,
    borderBottomColor: t.color.line,
  },
  hint: { ...t.type.caption, color: t.color.ink3, flexShrink: 1 },
  empty: { flex: 1, justifyContent: 'center', padding: t.space.pageX },
  readerBody: { paddingVertical: t.space.gap },
  pageBreak: {
    ...t.type.caption,
    color: t.color.ink3,
    textAlign: 'center',
    paddingTop: t.space.pageX,
    paddingBottom: t.space.gap,
  },
  block: { marginHorizontal: t.space.pageX, marginVertical: 4 },
  selected: { backgroundColor: t.color.pressed, borderRadius: t.shape.md },
  flash: { backgroundColor: t.color.accentBg, borderRadius: t.shape.md },
  pin: { paddingLeft: t.space.pageX, paddingBottom: t.space.gap },
  end: { padding: t.space.pageX, gap: t.space.gap },
  footerSpace: { height: 50 },
  panel: { padding: t.space.pageX, gap: t.space.gap },
  body: { ...t.type.body, color: t.color.ink },
  headline: { ...t.type.headline, color: t.color.ink },
  readerTitle: {
    paddingHorizontal: t.space.pageX,
    paddingVertical: t.space.gap,
  },
  quote: {
    padding: t.space.gap,
    borderLeftWidth: 2,
    borderLeftColor: t.color.line,
  },
  target: {
    padding: t.space.gap,
    borderLeftWidth: 3,
    borderLeftColor: t.color.accent,
    backgroundColor: t.color.accentBg,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.space.gap,
    paddingTop: t.space.gap,
  },
  figure: { width: '100%', height: 350 },
  tablePreview: {
    padding: t.space.pageX,
    gap: t.space.gap,
    borderWidth: 1,
    borderColor: t.color.line,
    borderRadius: t.shape.md,
  },
  tableText: { ...t.type.bookBody, color: t.color.ink },
  tableRow: { flexDirection: 'row' },
  tableCell: {
    ...t.type.body,
    color: t.color.ink,
    width: 170,
    padding: t.space.gap,
    borderWidth: 1,
    borderColor: t.color.line,
  },
  tableHead: { backgroundColor: t.color.surfaceAlt },
}));
