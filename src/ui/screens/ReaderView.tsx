import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from 'react';
import {
  FlatList,
  Image,
  PixelRatio,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import {
  AppBar,
  BlockView,
  Button,
  Dialog,
  Empty,
  GuideBar,
  Icon,
  LayerRow,
  ListSection,
  ModeSwitch,
  Note,
  PinChip,
  PageOrig,
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
  useTokens,
  type RichInline,
  type SheetProps,
} from '@ui/kit';
import type {
  ReaderItem,
  ReaderOriginalPage,
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
  const s = useStyles(),
    t = useTokens();
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <AppBar
        variant="push"
        title={
          t.layout.groupedLists
            ? state.header.title
            : `原文 · ${state.header.title}`
        }
        subtitle={state.header.subtitle}
        onBack={intents.back}
        backLabel="返回"
        right={
          <View style={s.headerActions}>
            <ModeSwitch value="read" onChange={intents.setMode} />
            <View testID="reader-header-spacer" style={s.headerSpacer} />
          </View>
        }
      />
      <View style={s.grow}>
        <ReaderContent state={state.read} intents={intents} />
      </View>
      <StudyOverlays overlay={state.overlay} intents={intents} />
      <ToastHost toast={state.toast ? { message: state.toast } : null} />
    </Screen>
  );
}
type FlowRow = {
  id: string;
  block?: Extract<ReaderItem, { kind: 'block' }>;
  label?: string;
  start: boolean;
  end: boolean;
};
type FlowCellProps = {
  children: ReactNode;
  item: FlowRow;
  onLayout?: (event: LayoutChangeEvent) => void;
  onFocusCapture?: ViewProps['onFocusCapture'];
  style?: StyleProp<ViewStyle>;
};
const FlowCellLayout = createContext<
  ((id: string, layout: { y: number; height: number }) => void) | null
>(null);
function ReaderCell({
  children,
  item,
  onLayout,
  onFocusCapture,
  style,
}: FlowCellProps) {
  const record = useContext(FlowCellLayout);
  return (
    <View
      testID={`reader-cell-${item.id}`}
      style={style}
      onFocusCapture={onFocusCapture}
      onLayout={event => {
        onLayout?.(event);
        record?.(item.id, event.nativeEvent.layout);
      }}
    >
      {children}
    </View>
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
    t = useTokens(),
    list = useRef<FlatList<FlowRow>>(null),
    geometry = useRef(new Map<string, { y: number; height: number }>()),
    viewport = useRef(0),
    pending = useRef<string | null>(null),
    retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rows = useMemo(() => {
    const pages: {
      id: string;
      label: string;
      blocks: Extract<ReaderItem, { kind: 'block' }>[];
    }[] = [];
    for (const item of state.items) {
      if (item.kind === 'pageBreak')
        pages.push({ id: item.id, label: item.page, blocks: [] });
      else {
        if (!pages.length)
          pages.push({ id: 'first', label: item.page, blocks: [] });
        pages[pages.length - 1].blocks.push(item);
      }
    }
    return pages.flatMap((page, pageIndex): FlowRow[] => [
      ...page.blocks.map((block, blockIndex) => ({
        id: block.ref,
        block,
        start: blockIndex === 0 && (!t.layout.groupedLists || pageIndex === 0),
        end: false,
      })),
      {
        id: `number-${page.id}`,
        label: page.label,
        start:
          !page.blocks.length && (!t.layout.groupedLists || pageIndex === 0),
        end: !t.layout.groupedLists || pageIndex === pages.length - 1,
      },
    ]);
  }, [state.items, t.layout.groupedLists]);
  const latest = useRef({ rows, reportAnchor: intents.reportAnchor });
  latest.current = { rows, reportAnchor: intents.reportAnchor };
  const settleTarget = useRef(() => {});
  settleTarget.current = () => {
    const rect = pending.current && geometry.current.get(pending.current);
    if (!rect || !viewport.current) return;
    list.current?.scrollToOffset({
      offset: Math.max(0, rect.y - viewport.current * 0.3),
      animated: false,
    });
    pending.current = null;
  };
  // Cell coordinates include the list header; row-local onLayout.y is 0.
  const recordLayout = useCallback(
    (id: string, rect: { y: number; height: number }) => {
      geometry.current.set(id, rect);
      if (pending.current === id) settleTarget.current();
    },
    [],
  );
  const target = state.scrollTo?.ref;
  const index = target ? rows.findIndex(row => row.block?.ref === target) : -1;
  useEffect(() => {
    if (index < 0 || state.view !== 'flow') return;
    pending.current = target ?? null;
    settleTarget.current();
    if (pending.current)
      list.current?.scrollToIndex({
        index,
        animated: false,
        viewPosition: 0.3,
      });
    return () => {
      pending.current = null;
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [index, target, state.scrollTo?.token, state.view]);
  useEffect(() => {
    geometry.current.clear();
  }, [t.type.bookBody.fontSize, t.layout.groupedLists]);
  const guide = state.guide ? (
    <ReaderGuide guide={state.guide} onToggle={intents.toggleGuide} />
  ) : null;
  const renderItem = ({ item }: { item: FlowRow }) => (
    <View style={[s.flowRow, item.start && s.flowStart, item.end && s.flowEnd]}>
      {item.block ? (
        <ReaderBlockRow item={item.block} intents={intents} />
      ) : (
        <Text style={s.pageBreak}>
          {t.layout.groupedLists
            ? `— ${item.label?.replace(/^p\./, '')} —`
            : item.label?.replace(/^p\./, '')}
        </Text>
      )}
    </View>
  );
  return (
    <View style={s.grow}>
      <View style={s.toolbar}>
        <View style={s.segmentWidth}>
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
        </View>
        <Text style={s.hint}>{state.hint}</Text>
      </View>
      {state.view === 'orig' ? (
        state.original?.available ? (
          <OriginalReaderPages state={state} intents={intents} header={guide} />
        ) : (
          <View style={s.empty}>
            <Empty
              title="原版 PDF 阅读"
              body={
                state.original?.reason ?? '请先导入 PDF，再用原版模式读原文。'
              }
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
        )
      ) : (
        <FlowCellLayout.Provider value={recordLayout}>
          <FlatList
            ref={list}
            data={rows}
            renderItem={renderItem}
            CellRendererComponent={ReaderCell}
            keyExtractor={item => item.id}
            contentContainerStyle={s.readerBody}
            onLayout={event => {
              viewport.current = event.nativeEvent.layout.height;
              settleTarget.current();
            }}
            onScroll={event => {
              if (pending.current) return;
              const top = event.nativeEvent.contentOffset.y;
              const height = event.nativeEvent.layoutMeasurement.height;
              const middle = top + height / 2;
              let nearest: { ref: string; distance: number } | undefined;
              for (const row of latest.current.rows) {
                const rect = row.block && geometry.current.get(row.id);
                if (
                  !rect ||
                  rect.y + rect.height < top ||
                  rect.y > top + height
                )
                  continue;
                const distance =
                  middle < rect.y
                    ? rect.y - middle
                    : middle > rect.y + rect.height
                    ? middle - rect.y - rect.height
                    : 0;
                if (!nearest || distance < nearest.distance)
                  nearest = { ref: row.id, distance };
              }
              if (nearest) latest.current.reportAnchor(nearest.ref);
            }}
            onScrollBeginDrag={() => {
              pending.current = null;
            }}
            scrollEventThrottle={100}
            onScrollToIndexFailed={info => {
              if (!pending.current) return;
              list.current?.scrollToOffset({
                offset: Math.max(0, info.averageItemLength * info.index),
                animated: false,
              });
              if (retryTimer.current) clearTimeout(retryTimer.current);
              retryTimer.current = setTimeout(() => {
                if (pending.current)
                  list.current?.scrollToIndex({
                    index: info.index,
                    animated: false,
                    viewPosition: 0.3,
                  });
              }, 150);
            }}
            ListHeaderComponent={
              <View style={s.readerHeader}>
                {guide}
                {state.loading ? <Empty body="正在读取原文…" /> : null}
                {state.error ? (
                  <View style={s.panel}>
                    <Note tone="bad">{state.error}</Note>
                    <Button variant="secondary" onPress={() => intents.retry()}>
                      重新加载
                    </Button>
                  </View>
                ) : null}
              </View>
            }
            ListEmptyComponent={
              !state.loading && !state.error ? (
                <Empty body="这节还没有可读的正文" />
              ) : undefined
            }
            ListFooterComponent={
              state.readEnd.visible ? (
                <ReadEnd
                  label={state.readEnd.label}
                  hint={state.readEnd.hint}
                  onPress={intents.finishReading}
                />
              ) : (
                <View style={s.footerSpace} />
              )
            }
          />
        </FlowCellLayout.Provider>
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

function ReaderGuide({
  guide,
  onToggle,
}: {
  guide: NonNullable<ReaderState['guide']>;
  onToggle(): void;
}) {
  const s = useStyles(),
    t = useTokens();
  if (!t.layout.groupedLists)
    return (
      <GuideBar
        title={guide.oneLine}
        body={guide.loading ? '正在生成导读…' : guide.full}
        expanded={guide.expanded}
        onToggle={onToggle}
      />
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="本节导读"
      accessibilityState={{ expanded: guide.expanded }}
      onPress={onToggle}
      style={s.guide}
    >
      <View style={s.guideLabel}>
        <Icon name="spark" size={14} color={t.color.accent} />
        <Text style={s.guideTitle}>本节导读</Text>
      </View>
      {!guide.expanded ? (
        <Text numberOfLines={1} style={s.guideOne}>
          {guide.oneLine}
        </Text>
      ) : null}
      <View style={guide.expanded ? s.guideUp : s.guideDown}>
        <Icon name="chev" size={16} color={t.color.ink3} />
      </View>
      {guide.expanded ? (
        <Text style={s.guideBody}>
          {guide.loading ? '正在生成导读…' : guide.full ?? guide.oneLine}
        </Text>
      ) : null}
    </Pressable>
  );
}
function titleText(nodes: RichInline[]): string {
  return nodes
    .map(node =>
      node.t === 'text'
        ? node.v
        : node.t === 'b'
        ? titleText(node.c)
        : node.t === 'math'
        ? node.tex
        : node.t === 'cite'
        ? node.label ?? `b${node.ref}`
        : '（未核实）',
    )
    .join('');
}

function OriginalReaderPages({
  state,
  intents,
  header,
}: {
  state: ReaderState;
  intents: StudyIntents;
  header?: ReactNode;
}) {
  const s = useStyles(),
    t = useTokens();
  const window = useWindowDimensions();
  const [width, setWidth] = useState(window.width - t.space.pageX * 2);
  const [viewport, setViewport] = useState(window.height / 2);
  const [headerHeight, setHeaderHeight] = useState(0);
  const pages = state.original?.pages ?? [];
  const target = state.scrollTo?.ref;
  const targetIndex = target
    ? pages.findIndex(p => p.blocks.some(b => `b${b.ref}` === target))
    : -1;
  const [center, setCenter] = useState(
    () => pages[Math.max(0, targetIndex)]?.page ?? 1,
  );
  const list = useRef<FlatList<ReaderOriginalPage>>(null);
  const actions = useRef(intents);
  actions.current = intents;
  const heights = pages.map(p => (width * p.size.h) / p.size.w + 42);
  const offsets: number[] = [];
  heights.reduce(
    (offset, height, i) => {
      offsets[i] = offset;
      return offset + height;
    },
    header ? headerHeight : 0,
  );
  const destination = pages[targetIndex];
  const destinationBlock = destination?.blocks.find(
    b => `b${b.ref}` === target,
  );
  const destinationPage = destination?.page;
  const destinationOffset = destination
    ? Math.max(
        0,
        offsets[targetIndex] +
          (destinationBlock?.y0 ?? 0) * (heights[targetIndex] - 42) -
          viewport * 0.3,
      )
    : undefined;
  useEffect(() => {
    actions.current.requestPage?.(center, width * PixelRatio.get());
  }, [center, width]);
  useEffect(() => {
    if (destinationPage === undefined || destinationOffset === undefined)
      return;
    setCenter(destinationPage);
    const timer = setTimeout(
      () =>
        list.current?.scrollToOffset({
          offset: destinationOffset,
          animated: false,
        }),
      60,
    );
    return () => clearTimeout(timer);
    // Page geometry changes when native metadata becomes available.
  }, [destinationPage, destinationOffset, state.scrollTo?.token]);
  return (
    <View
      style={s.grow}
      onLayout={event => {
        setWidth(
          Math.max(1, event.nativeEvent.layout.width - t.space.pageX * 2),
        );
        setViewport(event.nativeEvent.layout.height);
      }}
    >
      {state.original?.error ? (
        <View style={s.panel}>
          <Note tone="bad">{state.original.error}</Note>
          <Button
            variant="secondary"
            onPress={() =>
              intents.requestPage?.(center, width * PixelRatio.get())
            }
          >
            重新加载页面
          </Button>
        </View>
      ) : null}
      <FlatList
        ref={list}
        data={pages}
        ListHeaderComponent={
          header ? (
            <View
              onLayout={event =>
                setHeaderHeight(event.nativeEvent.layout.height)
              }
            >
              {header}
            </View>
          ) : undefined
        }
        keyExtractor={page => String(page.page)}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
        removeClippedSubviews
        extraData={state.original?.pages}
        getItemLayout={(_data, index) => ({
          index,
          length: heights[index],
          offset: offsets[index],
        })}
        onScroll={event => {
          const middle =
            event.nativeEvent.contentOffset.y +
            event.nativeEvent.layoutMeasurement.height / 2;
          const index = Math.max(
            0,
            offsets.findIndex(
              (offset, i) => middle >= offset && middle < offset + heights[i],
            ),
          );
          const page = pages[index];
          if (!page) return;
          setCenter(page.page);
          const y =
            (middle - offsets[index] - 20) / Math.max(1, heights[index] - 42);
          const block = [...page.blocks].sort(
            (a, b) =>
              Math.abs((a.y0 + a.y1) / 2 - y) - Math.abs((b.y0 + b.y1) / 2 - y),
          )[0];
          if (block) intents.reportAnchor(`b${block.ref}`);
        }}
        scrollEventThrottle={100}
        renderItem={({ item }) => (
          <View
            style={[
              s.originalPage,
              { height: (width * item.size.h) / item.size.w + 42 },
            ]}
          >
            <Text style={s.originalLabel}>{item.label}</Text>
            {item.image ? (
              <PageOrig
                uri={item.image.uri}
                width={item.image.w}
                height={item.image.h}
                blocks={item.blocks}
                onBlock={(ref, rect) =>
                  intents.pressBlock(
                    `b${ref}`,
                    rect ?? { x: 0, y: 0, w: width, h: 48 },
                  )
                }
                onPin={ref => {
                  const pin = item.blocks.find(b => b.ref === ref)?.pinId;
                  if (pin) intents.pressPin(pin);
                }}
              />
            ) : (
              <View
                style={[
                  s.originalPlaceholder,
                  { height: (width * item.size.h) / item.size.w },
                ]}
              >
                <Text style={s.hint}>正在读取 {item.label}…</Text>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          !state.loading ? (
            <Empty body="这节还没有可显示的 PDF 页" />
          ) : (
            <Empty body="正在读取原文…" />
          )
        }
        ListFooterComponent={
          state.readEnd.visible ? (
            <ReadEnd
              label={state.readEnd.label}
              hint={state.readEnd.hint}
              onPress={intents.finishReading}
            />
          ) : undefined
        }
      />
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
        item.type === 'title' ? s.titleBlock : undefined,
        item.marks.includes('selected') ? s.selected : undefined,
        item.marks.includes('flash') ? s.flash : undefined,
      ]}
    >
      {item.type === 'title' ? (
        <View style={s.readerTitle}>
          <Text accessibilityRole="header" style={s.readerTitleText}>
            {item.doc
              .map(part => (part.t === 'p' ? titleText(part.c) : ''))
              .join('\n')}
          </Text>
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
  const s = useStyles(),
    t = useTokens();
  const apple = t.layout.groupedLists;
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
  if (overlay.kind === 'note')
    return (
      <Dialog
        visible
        title={`记笔记 · ${overlay.subtitle}`}
        body={
          <View>
            <View style={s.noteQuote}>
              <RichView doc={overlay.quote} typography="dialogQuote" />
            </View>
            <TextInput
              accessibilityLabel="我的理解"
              placeholder="写下你的理解"
              placeholderTextColor={t.color.ink3}
              value={overlay.value}
              onChangeText={intents.setNoteText}
              multiline
              autoFocus
              style={s.noteEditor}
            />
          </View>
        }
        confirm="保存"
        cancel="取消"
        onConfirm={() => {
          if (overlay.value.trim()) intents.overlayAction('save');
        }}
        onCancel={intents.closeOverlay}
      />
    );
  const actions: NonNullable<SheetProps['actions']> = [];
  if (overlay.kind === 'peek') {
    if (!overlay.detour)
      actions.push({
        label: apple ? '在读书模式打开' : '在原文模式打开',
        kind: 'primary',
        onPress: () => intents.overlayAction('openInReader'),
      });
    actions.push({
      label: overlay.detour ? '好的' : '关闭',
      kind: overlay.detour ? 'primary' : 'ghost',
      onPress: intents.closeOverlay,
    });
  } else if (overlay.kind === 'explain') {
    const ask = {
      label: apple ? '带到听讲里继续问' : '带到伴读里继续问',
      kind: 'primary' as const,
      onPress: () => intents.overlayAction('ask'),
    };
    const stuck = {
      label: '记为卡点',
      kind: 'ghost' as const,
      onPress: () => intents.overlayAction('stuck'),
    };
    if (apple)
      actions.push(
        ask,
        {
          label: '好的',
          kind: 'ghost',
          disabled: !overlay.answer || overlay.streaming,
          onPress: () => {
            if (overlay.answer && !overlay.streaming)
              intents.overlayAction('ok');
          },
        },
        stuck,
      );
    else actions.push(stuck, ask);
  } else if (overlay.kind === 'translate') {
    if (apple)
      actions.push({
        label: '好的',
        kind: 'primary',
        onPress: intents.closeOverlay,
      });
  } else if (overlay.kind === 'pin') {
    actions.push(
      {
        label: apple ? '在听讲里继续问' : '在伴读里继续问',
        kind: 'primary',
        onPress: () => intents.overlayAction('ask'),
      },
      { label: '好的', kind: 'ghost', onPress: intents.closeOverlay },
    );
  }
  const title =
    overlay.kind === 'menu'
      ? overlay.title ?? '伴读'
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
      ? overlay.title
      : '查看表格';
  const subtitle =
    'subtitle' in overlay
      ? overlay.kind === 'pin' && apple
        ? `问答便签 · ${overlay.subtitle}`
        : overlay.subtitle
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
      actions={actions}
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
        <View style={s.overlayBody}>
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
        <View style={s.overlayBody}>
          {overlay.blocks.map(block => (
            <View key={block.ref} style={block.target ? s.target : s.quote}>
              <RichView
                doc={block.doc}
                onCite={intents.pressCite}
                onFigure={intents.pressFigure}
              />
            </View>
          ))}
        </View>
      ) : null}
      {overlay.kind === 'figure' ? (
        <ScrollView contentContainerStyle={s.overlayBody}>
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
        <View style={s.overlayBody}>
          <View style={s.sheetQuote}>
            <RichView doc={overlay.quote} typography="sheetQuote" />
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
        </View>
      ) : null}
      {overlay.kind === 'pin' ? (
        <View style={s.overlayBody}>
          <RichView doc={overlay.answer} />
        </View>
      ) : null}
      {overlay.kind === 'table' ? (
        <ScrollView horizontal>
          <View style={s.overlayBody}>
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
    paddingHorizontal: t.layout.groupedLists ? 16 : 12,
    paddingTop: t.layout.groupedLists ? 0 : 8,
    paddingBottom: t.layout.groupedLists ? 10 : 8,
    backgroundColor: t.layout.groupedLists ? t.color.bg : t.color.surface,
    gap: t.layout.groupedLists ? 12 : 10,
    borderBottomWidth: t.layout.groupedLists ? 0 : 1,
    borderBottomColor: t.color.line,
    ...(t.brand ? { backgroundColor: undefined } : {}),
  },
  segmentWidth: { width: t.layout.groupedLists ? 140 : 150 },
  hint: {
    ...t.type.caption,
    color: t.layout.groupedLists ? t.color.ink2 : t.color.ink3,
    flex: 1,
    textAlign: 'right',
  },
  empty: { flex: 1, justifyContent: 'center', padding: t.space.pageX },
  readerBody: { paddingBottom: 0 },
  readerHeader: { paddingBottom: t.layout.groupedLists ? 12 : 14 },
  flowRow: {
    marginHorizontal: t.layout.groupedLists ? 16 : 12,
    paddingHorizontal: t.layout.groupedLists ? 20 : 16,
    backgroundColor: t.layout.groupedLists ? t.color.paper : undefined,
    ...(t.brand ? { marginHorizontal: t.brand.kind === 'meta' ? 0 : 16 } : {}),
  },
  flowStart: {
    paddingTop: t.layout.groupedLists ? 22 : 18,
    borderTopLeftRadius: t.layout.groupedLists ? t.shape.lg : 0,
    borderTopRightRadius: t.layout.groupedLists ? t.shape.lg : 0,
    ...(t.brand
      ? {
          borderTopLeftRadius:
            t.brand.kind === 'meta' ? t.shape.xs * 0 : t.shape.lg,
          borderTopRightRadius:
            t.brand.kind === 'meta' ? t.shape.xs * 0 : t.shape.lg,
        }
      : {}),
  },
  flowEnd: {
    paddingBottom: t.layout.groupedLists ? 10 : 14,
    marginBottom: t.layout.groupedLists ? 0 : 14,
    borderBottomLeftRadius: t.layout.groupedLists ? t.shape.lg : 0,
    borderBottomRightRadius: t.layout.groupedLists ? t.shape.lg : 0,
    ...(t.brand
      ? {
          borderBottomLeftRadius:
            t.brand.kind === 'meta' ? t.shape.xs * 0 : t.shape.lg,
          borderBottomRightRadius:
            t.brand.kind === 'meta' ? t.shape.xs * 0 : t.shape.lg,
        }
      : {}),
  },
  guide: {
    marginHorizontal: 16,
    marginTop: 2,
    paddingVertical: 11,
    paddingHorizontal: 14,
    backgroundColor: t.color.surface,
    borderRadius: t.shape.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    rowGap: 4,
    columnGap: 6,
    ...(t.brand
      ? {
          marginHorizontal: t.brand.kind === 'meta' ? 0 : 16,
          backgroundColor:
            t.brand.kind === 'google'
              ? t.brand.secondaryContainer
              : t.color.surface,
          backgroundImage:
            t.brand.kind === 'win11'
              ? `linear-gradient(120deg, ${t.brand.aiSoft.join(',')})`
              : undefined,
          borderRadius: t.brand.kind === 'meta' ? t.shape.xs * 0 : t.shape.lg,
        }
      : {}),
  },
  guideLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  guideTitle: {
    ...t.type.caption,
    fontSize: t.type.caption.fontSize - 1,
    lineHeight: (t.type.caption.fontSize - 1) * 1.45,
    color: t.color.accent,
    fontWeight: '600',
  },
  guideOne: {
    ...t.type.body,
    fontSize: t.type.caption.fontSize + 1,
    lineHeight: (t.type.caption.fontSize + 1) * 1.45,
    color: t.color.ink2,
    flex: 1,
  },
  guideBody: {
    ...t.type.body,
    fontSize: t.type.caption.fontSize + 2,
    lineHeight: (t.type.caption.fontSize + 2) * 1.6,
    color: t.color.ink,
    flexBasis: '100%',
    marginTop: 2,
  },
  guideDown: { marginLeft: 'auto', transform: [{ rotate: '90deg' }] },
  guideUp: { marginLeft: 'auto', transform: [{ rotate: '-90deg' }] },
  originalPage: { marginHorizontal: t.space.pageX },
  originalLabel: {
    ...t.type.caption,
    color: t.color.ink3,
    textAlign: 'center',
    height: 20,
  },
  originalPlaceholder: {
    backgroundColor: t.color.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBreak: {
    ...t.type.micro,
    fontWeight: '400',
    fontSize: t.layout.groupedLists
      ? t.type.caption.fontSize - 1
      : t.type.micro.fontSize,
    fontFamily: t.layout.groupedLists
      ? t.type.num.fontFamily
      : t.type.sansFamily,
    color: t.color.readerPageLabel,
    textAlign: t.layout.groupedLists ? 'center' : 'left',
    borderTopWidth: t.layout.groupedLists ? 0 : 1,
    borderTopColor: t.color.readerPageRule,
    borderStyle: 'dashed',
    paddingTop: t.layout.groupedLists ? 0 : 4,
    marginTop: t.layout.groupedLists ? 4 : 6,
    marginBottom: t.layout.groupedLists ? 14 : 0,
  },
  block: {
    marginHorizontal: t.layout.groupedLists ? -10 : -4,
    marginBottom: t.layout.groupedLists ? 8 : 6,
  },
  selected: { backgroundColor: t.color.pressed, borderRadius: t.shape.md },
  flash: { backgroundColor: t.color.accentBg, borderRadius: t.shape.md },
  pin: { paddingLeft: t.space.pageX, paddingBottom: t.space.gap },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerSpacer: { width: t.layout.groupedLists ? 44 : 40, flexShrink: 0 },
  footerSpace: { height: 50 },
  panel: { padding: t.space.pageX, gap: t.space.gap },
  body: { ...t.type.body, color: t.color.ink },
  headline: { ...t.type.headline, color: t.color.ink },
  readerTitle: {
    paddingHorizontal: t.layout.groupedLists ? 10 : 4,
    paddingVertical: t.layout.groupedLists ? 3 : 2,
  },
  titleBlock: { marginBottom: t.layout.groupedLists ? 12 : 8 },
  readerTitleText: {
    ...t.type.bookBody,
    fontFamily: t.type.sansFamily,
    fontSize: t.type.bookBody.fontSize * (t.layout.groupedLists ? 1.3 : 1.25),
    lineHeight:
      t.type.bookBody.fontSize *
      (t.layout.groupedLists ? 1.3 * 1.4 : 1.25 * 1.9),
    fontWeight: '700',
    color: t.color.paperInk,
    letterSpacing: t.layout.groupedLists
      ? -t.type.bookBody.fontSize * 1.3 * 0.01
      : 0,
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
  overlayBody: { gap: 10 },
  noteQuote: {
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: t.color.highlight,
    paddingLeft: t.layout.groupedLists ? 12 : 10,
    paddingVertical: t.layout.groupedLists ? 0 : 2,
  },
  sheetQuote: {
    borderLeftWidth: 3,
    borderLeftColor: t.color.highlight,
    paddingLeft: t.layout.groupedLists ? 12 : 10,
    paddingVertical: t.layout.groupedLists ? 0 : 2,
    marginTop: t.layout.groupedLists ? 4 : 0,
    marginRight: t.layout.groupedLists ? 2 : 0,
  },
  noteEditor: {
    ...t.type.body,
    fontSize: t.layout.groupedLists
      ? t.type.label.fontSize
      : t.type.body.fontSize,
    lineHeight: t.layout.groupedLists ? 24 : 23.8,
    color: t.color.ink,
    backgroundColor: t.layout.groupedLists
      ? t.color.surfaceFill
      : t.color.editor,
    borderWidth: t.layout.groupedLists ? 0 : 1,
    borderColor: t.color.line,
    borderRadius: t.layout.groupedLists ? t.shape.lg - 8 : t.shape.sm,
    paddingVertical: t.layout.groupedLists ? 13 : 9,
    paddingHorizontal: t.layout.groupedLists ? 16 : 10,
    minHeight: t.layout.groupedLists ? 96 : 120,
    marginTop: t.layout.groupedLists ? 10 : 0,
    textAlignVertical: 'top',
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
