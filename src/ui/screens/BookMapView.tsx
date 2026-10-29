import { Pressable, Text, View } from 'react-native';
import {
  AppBar,
  Button,
  Dialog,
  Empty,
  Field,
  Icon,
  IconButton,
  ListSection,
  Note,
  Row,
  Screen,
  SectionStatusIcon,
  Sheet,
  Tag,
  ToastHost,
  useTokens,
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
            style={({ pressed }) => ({
              paddingVertical: t.space.rowY,
              paddingLeft: node.level === 3 ? t.space.pageX * 2 : t.space.pageX,
              paddingRight: t.space.pageX,
              flexDirection: 'row',
              gap: t.space.gap,
              alignItems: 'flex-start',
              borderBottomWidth: 1,
              borderBottomColor: t.color.line,
              backgroundColor: pressed
                ? t.color.pressed
                : node.current
                ? t.color.accentBg
                : node.flagged
                ? t.color.stuckBg
                : t.color.surface,
            })}
          >
            <SectionStatusIcon status={node.status} />
            <View style={s.nodeContent}>
              <Text
                style={[
                  s.nodeLabel,
                  {
                    color: node.current ? t.color.accentInk : t.color.ink,
                    fontWeight: node.current
                      ? t.type.headline.fontWeight
                      : t.type.body.fontWeight,
                  },
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
            <Text style={s.nodePage}>{node.pageLabel}</Text>
            {node.expandable ? (
              <Icon
                name={node.expanded ? 'arrowDown' : 'chev'}
                size={16}
                color={t.color.ink2}
              />
            ) : null}
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
            <Note tone={state.check.tone === 'stuck' ? 'warn' : 'neutral'}>
              {state.check.text}
              {state.check.sub ? `\n${state.check.sub}` : ''}
              {state.demo ? '\n演示内容，仅用于体验学习流程。' : ''}
            </Note>
          </View>
        )}
        {!state.loading && !state.chapters.length ? (
          <Empty
            title="地图还未就绪"
            body="解析完成的章节会出现在这里，可以先回书架查看进度。"
          />
        ) : null}
        {state.chapters.map(chapter => (
          <View
            key={chapter.id}
            style={[
              s.chapter,
              {
                borderColor: chapter.current ? t.color.accent : t.color.line,
              },
            ]}
          >
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
              style={({ pressed }) => ({
                padding: t.space.pageX,
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.space.gap,
                backgroundColor: pressed
                  ? t.color.pressed
                  : chapter.current
                  ? t.color.accentBg
                  : t.color.surface,
              })}
            >
              <Text
                style={[
                  s.chapterNo,
                  {
                    color: chapter.current ? t.color.accentInk : t.color.ink2,
                  },
                ]}
              >
                {chapter.no}
              </Text>
              <View style={s.chapterContent}>
                <Text style={s.chapterTitle}>{chapter.title}</Text>
                <Text style={s.chapterMeta}>{chapter.meta}</Text>
              </View>
              <Icon
                name={chapter.expanded ? 'arrowDown' : 'chev'}
                color={t.color.ink2}
                size={18}
              />
            </Pressable>
            {chapter.expanded ? (
              <MapRows nodes={chapter.children} intents={intents} />
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
              <ListSection>
                {section.facts.map(fact => (
                  <Row
                    key={fact.k}
                    title={fact.k}
                    right={<Text style={s.sectionFact}>{fact.v}</Text>}
                  />
                ))}
              </ListSection>
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
          onClose={intents.closeOverlay}
          detent="full"
        >
          {search ? (
            <>
              <View style={s.searchField}>
                <Field
                  label="搜索书中的内容"
                  value={search.query}
                  onChange={intents.setQuery}
                  placeholder="例如：一致代价、启发"
                />
                <Text style={s.searchHint}>{search.hint}</Text>
              </View>
              {search.busy ? (
                <Empty body="正在搜索…" />
              ) : (
                search.results.map(result => (
                  <Pressable
                    key={result.ref}
                    accessibilityRole="button"
                    accessibilityLabel={`打开 ${result.title} ${result.page}`}
                    onPress={() => intents.openResult(result.ref)}
                    style={({ pressed }) => ({
                      padding: t.space.pageX,
                      gap: 6,
                      borderBottomWidth: 1,
                      borderBottomColor: t.color.line,
                      backgroundColor: pressed
                        ? t.color.pressed
                        : t.color.surface,
                    })}
                  >
                    <View style={s.resultHeader}>
                      <Text style={s.resultTitle}>{result.title}</Text>
                      <Text style={s.resultPage}>{result.page}</Text>
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
                  </Pressable>
                ))
              )}
              {search.empty ? <Empty body={search.empty} /> : null}
            </>
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
  nodeContent: {
    flex: 1,
    gap: 5,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  nodePage: {
    ...t.type.caption,
    color: t.color.ink2,
  },
  root: {
    flex: 1,
  },
  errorPanel: {
    padding: t.space.pageX,
    gap: t.space.gap,
  },
  checkNote: {
    margin: t.space.pageX,
  },
  chapterContent: {
    flex: 1,
    gap: 5,
  },
  chapterTitle: {
    ...t.type.headline,
    color: t.color.ink,
  },
  chapterMeta: {
    ...t.type.caption,
    color: t.color.ink2,
  },
  sectionFact: {
    ...t.type.body,
    color: t.color.ink2,
  },
  sectionNotes: {
    padding: t.space.pageX,
    gap: t.space.gap,
  },
  searchField: {
    padding: t.space.pageX,
    gap: t.space.gap,
  },
  searchHint: {
    ...t.type.caption,
    color: t.color.ink2,
  },
  resultHeader: {
    flexDirection: 'row',
    gap: t.space.gap,
  },
  resultTitle: {
    ...t.type.label,
    color: t.color.ink,
    flex: 1,
  },
  resultPage: {
    ...t.type.caption,
    color: t.color.accentInk,
  },
  resultSnippet: {
    ...t.type.body,
    color: t.color.ink2,
  },
  nodeLabel: {
    ...t.type.body,
  },
  chapter: {
    marginHorizontal: t.space.pageX,
    marginBottom: t.space.gap,
    borderRadius: t.shape.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  chapterNo: {
    ...t.type.title,
    minWidth: 26,
  },
}));
