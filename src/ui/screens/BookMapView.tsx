import { Pressable, Text, TextInput, View } from 'react-native';
import {
  AppBar,
  Button,
  Dialog,
  Empty,
  Icon,
  IconButton,
  Note,
  Screen,
  SectionStatusIcon,
  Sheet,
  Tag,
  ToastHost,
  useTokens,
  usePresentation,
  makeStyles,
} from '@ui/kit';
import type {
  BookMapIntents,
  BookMapState,
  MapNode,
} from '@features/library/types';
function MapRows({
  nodes,
  intents,
}: {
  nodes: MapNode[];
  intents: BookMapIntents;
}) {
  const t = useTokens();
  const { groupedLists } = usePresentation();
  const s = useStyles();
  return (
    <>
      {nodes.map(node => (
        <View key={node.id}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${node.label}${
              node.expandable ? (node.expanded ? '，收起' : '，展开') : ''
            }`}
            accessibilityState={
              node.expandable
                ? {
                    expanded: node.expanded,
                  }
                : undefined
            }
            onPress={() =>
              node.expandable
                ? intents.toggle(node.id)
                : intents.openSection(node.id)
            }
            style={({ pressed }) => [
              s.nodeRow,
              node.level === 3 && s.nodeLevel3,
              node.current && s.nodeCurrent,
              node.flagged && s.nodeFlagged,
              pressed && s.rowPressed,
            ]}
          >
            <SectionStatusIcon status={node.status} />
            <View style={s.nodeContent}>
              <Text
                style={[
                  s.nodeLabel,
                  node.level === 3 ? s.nodeSubLabel : undefined,
                  node.current && s.nodeCurrentLabel,
                ]}
              >
                {node.label}
              </Text>
              {node.tags.length ? (
                <View style={s.tagRow}>
                  {node.tags.map(tag => (
                    <Tag key={tag.label} {...tag} />
                  ))}
                </View>
              ) : null}
            </View>
            <View style={s.nodeTrailing}>
              <Text style={s.nodePage}>{node.pageLabel}</Text>
              {node.expandable && !groupedLists ? (
                <Text style={s.nodePage}>{node.expanded ? '▾' : '▸'}</Text>
              ) : null}
              {node.expandable && groupedLists ? (
                <View style={node.expanded ? s.expandedArrow : undefined}>
                  <Icon name="chev" size={13} color={t.color.ink2} />
                </View>
              ) : null}
            </View>
          </Pressable>
          {node.expanded ? (
            <MapRows nodes={node.children} intents={intents} />
          ) : null}
        </View>
      ))}
    </>
  );
}
export function BookMapView({
  state,
  intents,
}: {
  state: BookMapState;
  intents: BookMapIntents;
}) {
  const t = useTokens();
  const { groupedLists } = usePresentation();
  const s = useStyles();
  const section = state.overlay?.kind === 'section' ? state.overlay : null;
  const search = state.overlay?.kind === 'search' ? state.overlay : null;
  const dialog =
    state.overlay?.kind === 'flag' || state.overlay?.kind === 'changeMain'
      ? state.overlay
      : null;
  return (
    <View style={s.root}>
      <Screen scroll>
        <AppBar
          title={state.title}
          subtitle="书的地图"
          variant="push"
          backLabel="书架"
          onBack={intents.back}
          right={
            <IconButton
              icon="search"
              label="全书搜索"
              onPress={intents.openSearch}
            />
          }
        />
        {state.error ? (
          <View style={s.errorPanel}>
            <Note tone="bad">{state.error}</Note>
            <Button variant="secondary" onPress={intents.refresh}>
              重新加载
            </Button>
          </View>
        ) : null}
        {state.loading ? (
          <Empty body="正在读取地图…" />
        ) : (
          <View style={s.checkNote}>
            <SectionStatusIcon status={state.check.ok ? 'done' : 'learning'} />
            <View style={s.checkContent}>
              <Text style={s.checkTitle}>{state.check.text}</Text>
              {state.check.sub ? (
                <Text
                  style={[
                    s.checkSub,
                    state.check.tone === 'stuck' ? s.stuckText : undefined,
                  ]}
                >
                  {state.check.sub}
                </Text>
              ) : null}
            </View>
          </View>
        )}
        {!state.loading && !state.chapters.length ? (
          <Empty
            title="地图还未就绪"
            body="解析完成的章节会出现在这里，可以先回书架查看进度。"
          />
        ) : null}
        {state.chapters.map(chapter => (
          <View key={chapter.id} style={s.chapter}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${chapter.no} ${chapter.title}`}
              accessibilityState={
                chapter.leaf
                  ? undefined
                  : {
                      expanded: chapter.expanded,
                    }
              }
              onPress={() =>
                chapter.leaf
                  ? intents.openSection(chapter.id)
                  : intents.toggle(chapter.id)
              }
              style={({ pressed }) => [
                s.chapterHeader,
                pressed && s.rowPressed,
              ]}
            >
              <View
                style={[
                  s.chapterBadge,
                  chapter.current
                    ? s.chapterBadgeCurrent
                    : chapter.status === 'done'
                    ? s.chapterBadgeDone
                    : undefined,
                ]}
              >
                <Text
                  style={[
                    s.chapterNo,
                    chapter.current
                      ? s.chapterNoCurrent
                      : chapter.status === 'done'
                      ? s.chapterNoDone
                      : undefined,
                  ]}
                >
                  {chapter.no}
                </Text>
              </View>
              <View style={s.chapterContent}>
                <Text style={s.chapterTitle}>{chapter.title}</Text>
                <Text style={s.chapterMeta}>{chapter.meta}</Text>
              </View>
              <View style={chapter.expanded ? s.expandedArrow : undefined}>
                <Icon
                  name="chev"
                  color={t.color.ink3}
                  size={groupedLists ? 16 : 18}
                />
              </View>
            </Pressable>
            {chapter.expanded ? (
              <View style={s.children}>
                <MapRows nodes={chapter.children} intents={intents} />
              </View>
            ) : null}
          </View>
        ))}
        <Sheet
          visible={Boolean(section)}
          title={section?.title ?? ''}
          subtitle={section?.subtitle}
          onClose={intents.closeOverlay}
          actions={section?.actions.map(action => ({
            label: action.label,
            kind: action.primary ? 'primary' : 'ghost',
            onPress: () => intents.sectionAction(action.key),
          }))}
        >
          {section ? (
            <>
              <View style={s.sectionFacts}>
                {section.facts.map((fact, index) => (
                  <View
                    key={fact.k}
                    style={[s.factRow, index > 0 && s.factDivider]}
                  >
                    <Text style={s.factKey}>{fact.k}</Text>
                    <Text style={s.sectionFact}>
                      {groupedLists ? fact.v : fact.v.replace(/步/gu, '段')}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={s.sectionNotes}>
                {section.summary ? (
                  <Note tone="accent">摘要　{section.summary}</Note>
                ) : null}
                {section.stuck.map((text, i) => (
                  <Note key={i} tone="warn">
                    卡点：{text}
                  </Note>
                ))}
              </View>
            </>
          ) : null}
        </Sheet>
        <Sheet
          visible={Boolean(search)}
          title="全书搜索"
          subtitle={groupedLists ? search?.hint : undefined}
          onClose={intents.closeOverlay}
        >
          {search ? (
            <View style={s.searchBody}>
              <View style={s.searchField}>
                <View style={s.searchBox}>
                  {groupedLists ? (
                    <Icon name="search" size={18} color={t.color.ink2} />
                  ) : null}
                  <TextInput
                    style={s.searchInput}
                    value={search.query}
                    onChangeText={intents.setQuery}
                    placeholder={
                      groupedLists
                        ? '一致代价、可容许、三角不等式'
                        : '例如：一致代价、可容许、三角不等式'
                    }
                    placeholderTextColor={t.color.ink3}
                    accessibilityLabel="搜索书中的内容"
                  />
                </View>
              </View>
              {!groupedLists && !search.query.trim() ? (
                <Text style={s.searchHint}>{search.hint}</Text>
              ) : null}
              {search.busy ? (
                <Empty body="正在搜索…" />
              ) : (
                <View style={s.results}>
                  {search.results.map((result, index) => (
                    <Pressable
                      key={result.ref}
                      accessibilityRole="button"
                      accessibilityLabel={`打开 ${result.title} ${result.page}`}
                      onPress={() => intents.openResult(result.ref)}
                      style={({ pressed }) => [
                        s.resultRow,
                        pressed && s.rowPressed,
                      ]}
                    >
                      {groupedLists && index > 0 ? (
                        <View style={s.resultDivider} />
                      ) : null}
                      <View style={s.resultContent}>
                        <View style={s.resultHeader}>
                          <Text style={s.resultTitle}>{result.title}</Text>
                        </View>
                        <Text style={s.resultSnippet}>
                          {result.snippet.map((chunk, i) => (
                            <Text
                              key={i}
                              style={
                                chunk.hit
                                  ? {
                                      backgroundColor: t.color.highlight,
                                      color: t.color.ink,
                                    }
                                  : undefined
                              }
                            >
                              {chunk.text}
                            </Text>
                          ))}
                        </Text>
                      </View>
                      <Text style={s.resultPage}>{result.page}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {search.empty ? <Empty body={search.empty} /> : null}
            </View>
          ) : null}
        </Sheet>
        <Dialog
          visible={Boolean(dialog)}
          title={dialog?.title ?? ''}
          body={dialog?.body ?? ''}
          confirm={dialog?.confirm ?? ''}
          cancel={dialog?.cancel}
          onConfirm={
            dialog?.kind === 'changeMain'
              ? intents.confirmStart
              : intents.confirmFlag
          }
          onCancel={
            dialog?.kind === 'flag' ? intents.rejectFlag : intents.closeOverlay
          }
        />
      </Screen>
      <ToastHost
        toast={
          state.toast
            ? {
                message: state.toast,
              }
            : null
        }
      />
    </View>
  );
}
const useStyles = makeStyles(t => ({
  nodeRow: {
    minHeight: t.layout.groupedLists ? 44 : 0,
    paddingVertical: t.layout.groupedLists ? 8 : 9,
    paddingLeft: t.layout.groupedLists ? 18 : 22,
    paddingRight: 14,
    flexDirection: 'row',
    gap: t.layout.groupedLists ? 11 : 10,
    alignItems: 'center',
    backgroundColor: t.color.surface,
  },
  nodeLevel3: { paddingLeft: t.layout.groupedLists ? 50 : 52 },
  nodeCurrent: { backgroundColor: t.color.accentBg },
  nodeFlagged: { backgroundColor: t.color.mapFlagBg },
  rowPressed: { backgroundColor: t.color.pressed },
  nodeTrailing: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  expandedArrow: { transform: [{ rotate: '90deg' }] },
  nodeContent: {
    flex: 1,
    gap: 4,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  tagRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  nodePage: {
    ...t.type.caption,
    ...t.type.num,
    color: t.layout.groupedLists ? t.color.ink2 : t.color.ink3,
  },
  root: {
    flex: 1,
  },
  errorPanel: {
    padding: t.space.pageX,
    gap: t.space.gap,
  },
  checkNote: {
    marginHorizontal: t.layout.groupedLists ? 16 : 12,
    marginTop: t.layout.groupedLists ? 0 : 10,
    marginBottom: t.layout.groupedLists ? 16 : 10,
    paddingVertical: t.layout.groupedLists ? 12 : 10,
    paddingHorizontal: t.layout.groupedLists ? 16 : 12,
    borderRadius: t.layout.groupedLists ? t.shape.md : t.shape.sm + 2,
    backgroundColor: t.color.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.layout.groupedLists ? 12 : 10,
  },
  checkContent: { flex: 1 },
  checkTitle: {
    ...t.type.label,
    fontWeight: t.type.body.fontWeight,
    color: t.color.ink,
  },
  checkSub: {
    ...t.type.caption,
    color: t.layout.groupedLists ? t.color.ink2 : t.color.ink3,
  },
  stuckText: {
    color: t.layout.groupedLists ? t.color.stuckInk : t.color.stuck,
  },
  chapterHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.gap,
    backgroundColor: t.color.surface,
  },
  children: {
    borderTopWidth: t.layout.groupedLists ? 0.5 : 0,
    borderTopColor: t.color.line,
    paddingVertical: t.layout.groupedLists ? 4 : 0,
  },
  chapterContent: {
    flex: 1,
    gap: 0,
  },
  chapterTitle: {
    ...t.type.mapTitle,
    color: t.color.ink,
  },
  chapterMeta: {
    ...t.type.caption,
    color: t.layout.groupedLists ? t.color.ink2 : t.color.ink3,
  },
  sectionFact: {
    ...t.type.label,
    fontWeight: '400',
    color: t.layout.groupedLists ? t.color.ink2 : t.color.ink,
    flex: 1,
    textAlign: 'right',
  },
  sectionNotes: {
    marginHorizontal: t.layout.groupedLists ? 0 : -t.space.pageX,
    paddingHorizontal: t.layout.groupedLists ? 0 : t.space.pageX,
    paddingVertical: t.layout.groupedLists ? 0 : 10,
    gap: t.layout.groupedLists ? 8 : 6,
  },
  sectionFacts: {
    paddingHorizontal: t.layout.groupedLists ? 0 : t.space.pageX,
    paddingTop: t.layout.groupedLists ? 0 : 4,
    paddingBottom: t.layout.groupedLists ? 0 : 12,
    gap: t.layout.groupedLists ? 0 : 6,
    marginHorizontal: t.layout.groupedLists ? 0 : -t.space.pageX,
    marginBottom: t.layout.groupedLists ? 10 : 0,
    backgroundColor: t.layout.groupedLists ? t.color.surface : undefined,
    borderRadius: t.layout.groupedLists ? t.shape.md - 2 : 0,
    overflow: 'hidden',
  },
  factRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: t.layout.groupedLists ? 16 : 0,
    paddingVertical: t.layout.groupedLists ? 11 : 0,
  },
  factDivider: {
    borderTopWidth: t.layout.groupedLists ? 0.5 : 0,
    borderTopColor: t.color.line,
  },
  factKey: {
    ...t.type.label,
    fontWeight: '400',
    color: t.layout.groupedLists ? t.color.ink : t.color.ink3,
  },
  searchInput: {
    ...t.type.body,
    color: t.color.ink,
    flex: 1,
    height: '100%',
    paddingVertical: 0,
  },
  searchBody: { marginHorizontal: t.layout.groupedLists ? 0 : -t.space.pageX },
  searchBox: {
    height: 40,
    borderWidth: t.layout.groupedLists ? 0 : 1,
    borderColor: t.layout.groupedLists ? t.color.line : t.color.fieldBorder,
    borderRadius: t.layout.groupedLists ? t.shape.sm + 2 : t.shape.pill,
    backgroundColor: t.layout.groupedLists
      ? t.color.surfaceAlt
      : t.color.surface,
    paddingHorizontal: t.layout.groupedLists ? 10 : 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  searchField: {
    paddingHorizontal: t.layout.groupedLists ? 2 : 16,
    paddingTop: t.layout.groupedLists ? 0 : 4,
    paddingBottom: t.layout.groupedLists ? 10 : 8,
  },
  searchHint: {
    ...t.type.label,
    fontWeight: '400',
    color: t.color.ink3,
    padding: 20,
    textAlign: 'center',
  },
  results: {
    borderRadius: t.layout.groupedLists ? t.shape.md : 0,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: t.space.pageX,
    paddingVertical: t.layout.groupedLists ? 11 : 12,
    gap: t.space.gap,
    borderBottomWidth: t.layout.groupedLists ? 0 : 1,
    borderBottomColor: t.color.line,
    backgroundColor: t.color.surface,
  },
  resultDivider: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 0,
    height: 0.5,
    backgroundColor: t.color.line,
  },
  resultContent: { flex: 1 },
  resultHeader: {
    flexDirection: 'row',
    gap: t.space.gap,
  },
  resultTitle: {
    ...t.type.label,
    fontWeight: t.layout.groupedLists ? '600' : '500',
    color: t.color.ink,
    flex: 1,
  },
  resultPage: {
    ...t.type.caption,
    color: t.layout.groupedLists ? t.color.ink2 : t.color.ink3,
    ...t.type.num,
  },
  resultSnippet: {
    ...(t.layout.groupedLists ? t.type.caption : t.type.label),
    fontFamily: t.type.serifFamily,
    fontWeight: '400',
    color: t.color.ink2,
  },
  nodeLabel: {
    ...(t.layout.groupedLists ? t.type.label : t.type.body),
    color: t.color.ink,
    fontWeight: t.type.body.fontWeight,
    lineHeight:
      (t.layout.groupedLists ? t.type.label : t.type.body).fontSize *
      (t.layout.groupedLists ? 1.35 : 1.5),
    flexShrink: 1,
  },
  nodeCurrentLabel: { color: t.color.accentInk, fontWeight: '600' },
  nodeSubLabel: {
    ...t.type.label,
    lineHeight: t.type.label.fontSize * (t.layout.groupedLists ? 1.35 : 1.5),
    fontWeight: t.type.body.fontWeight,
  },
  chapter: {
    backgroundColor: t.color.surface,
    marginHorizontal: t.layout.groupedLists ? 16 : 0,
    marginBottom: t.layout.groupedLists ? 10 : 0,
    borderRadius: t.layout.groupedLists ? t.shape.md : 0,
    overflow: 'hidden',
    borderBottomWidth: t.layout.groupedLists ? 0 : 1,
    borderBottomColor: t.color.line,
  },
  chapterBadge: {
    width: t.layout.groupedLists ? 34 : 30,
    height: t.layout.groupedLists ? 34 : 30,
    borderRadius: t.layout.groupedLists ? t.shape.sm + 1 : t.shape.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.layout.groupedLists ? t.color.surfaceFill : t.color.bg,
  },
  chapterBadgeCurrent: { backgroundColor: t.color.accent },
  chapterBadgeDone: { backgroundColor: t.color.okBg },
  chapterNo: {
    ...t.type.label,
    ...t.type.num,
    fontWeight: '700',
    color: t.color.ink2,
  },
  chapterNoCurrent: { color: t.color.onAccent },
  chapterNoDone: { color: t.color.okInk },
}));
