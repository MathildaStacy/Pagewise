import { Pressable, Text, View } from 'react-native';
import {
  AppBar,
  Button,
  Cover,
  Empty,
  Fab,
  Field,
  IconButton,
  ListSection,
  Note,
  Row,
  Screen,
  Sheet,
  StatusDot,
  ToastHost,
  useTokens,
  makeStyles,
} from '@ui/kit';
import type { ShelfIntents, ShelfState } from '@features/library/types';
export function ShelfView({
  state,
  intents,
}: {
  state: ShelfState;
  intents: ShelfIntents;
}) {
  const t = useTokens();
  const s = useStyles();
  return (
    <View style={s.root}>
      <Screen scroll edges={['top', 'left', 'right']}>
        <AppBar
          title="Pagewise"
          variant="root"
          right={
            <IconButton
              icon="search"
              label="搜索书架"
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
        {state.loading ? <Empty body="正在读取书架…" /> : null}
        {state.continueCard ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`继续学习 ${state.continueCard.title}`}
            onPress={intents.openContinue}
            style={({ pressed }) => ({
              margin: 12,
              padding: 16,
              gap: 4,
              borderRadius: t.shape.lg,
              backgroundColor: t.color.accent,
              opacity: pressed ? 0.88 : 1,
              borderWidth: 1,
              borderColor: t.color.accent,
            })}
          >
            <Text style={s.continueKicker}>{state.continueCard.kicker}</Text>
            <Text style={s.continueTitle}>{state.continueCard.title}</Text>
            <Text style={s.continueMeta}>{state.continueCard.meta}</Text>
            {state.continueCard.recap ? (
              <Text style={s.continueRecap}>{state.continueCard.recap}</Text>
            ) : null}
            <View style={s.continueFooter}>
              <View style={s.stepDots}>
                {state.continueCard.steps.map((step, i) => (
                  <View
                    key={i}
                    style={[
                      s.stepDot,
                      {
                        opacity: step.done ? s.done.opacity : s.todo.opacity,
                        backgroundColor: step.done
                          ? t.color.onAccent
                          : t.color.onAccent,
                      },
                    ]}
                  />
                ))}
                <Text style={s.stepLabel}>{state.continueCard.stepLabel}</Text>
              </View>
              <View style={s.continueButton}>
                <Text style={s.continueAction}>继续 ›</Text>
              </View>
            </View>
          </Pressable>
        ) : null}
        {!state.loading && state.empty ? (
          <Empty
            title="导入第一本书"
            body="带着整本书，一节一节读懂。支持 PDF 和 EPUB。"
            action={
              <Button icon="add" onPress={intents.openImport}>
                导入一本书
              </Button>
            }
          />
        ) : null}
        {state.books.length ? (
          <ListSection title="我的书" subtitle={`${state.books.length} 本`}>
            {state.books.map(book => (
              <Pressable
                key={book.id}
                accessibilityRole="button"
                accessibilityLabel={`打开 ${book.title}`}
                onPress={() => intents.openBook(book.id)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  gap: t.space.gap,
                  padding: t.space.pageX,
                  borderBottomWidth: 1,
                  borderBottomColor: t.color.line,
                  backgroundColor: pressed ? t.color.pressed : t.color.surface,
                })}
              >
                <Cover {...book.cover} size="md" />
                <View style={s.bookContent}>
                  <Text style={s.bookTitle}>{book.title}</Text>
                  <Text style={s.bookMeta}>{book.meta}</Text>
                  <View style={s.bookStatus}>
                    <StatusDot tone={book.status.tone} />
                    <Text
                      style={[
                        s.statusLabel,
                        {
                          color:
                            book.status.tone === 'bad'
                              ? t.color.badInk
                              : book.status.tone === 'stuck'
                              ? t.color.stuckInk
                              : t.color.ink2,
                        },
                      ]}
                    >
                      {book.status.text}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </ListSection>
        ) : null}
        <View style={s.fabSpace} />
        <Sheet
          visible={state.overlay?.kind === 'import'}
          title="导入一本书"
          onClose={intents.closeOverlay}
        >
          {state.overlay?.kind === 'import' ? (
            <>
              <ListSection title={state.demo ? '演示文件' : '最近 · 下载'}>
                {state.overlay.recent.map(file => (
                  <Row
                    key={file.key}
                    title={file.name}
                    subtitle={file.meta}
                    right={<Text style={s.formatLabel}>{file.format}</Text>}
                    chevron
                    onPress={() => intents.pickRecent(file.key)}
                  />
                ))}
              </ListSection>
              <Row
                title="从其他位置选择…"
                onPress={intents.pickOther}
                chevron
              />
              <View style={s.importNote}>
                <Note tone="neutral">{state.overlay.note}</Note>
              </View>
            </>
          ) : null}
        </Sheet>
        <Sheet
          visible={state.overlay?.kind === 'search'}
          title="搜索书架"
          onClose={intents.closeOverlay}
        >
          {state.overlay?.kind === 'search' ? (
            <>
              <View style={s.searchField}>
                <Field
                  label="书名或作者"
                  value={state.overlay.query}
                  onChange={intents.setSearch}
                  placeholder="搜索书架"
                />
              </View>
              {state.overlay.results.map(book => (
                <Row
                  key={book.id}
                  title={book.title}
                  subtitle={book.meta}
                  chevron
                  onPress={() => {
                    intents.closeOverlay();
                    intents.openBook(book.id);
                  }}
                />
              ))}
              {state.overlay.results.length === 0 ? (
                <Empty body="没有找到，试试其他书名或作者" />
              ) : null}
            </>
          ) : null}
        </Sheet>
      </Screen>
      <View style={s.fab}>
        <Fab icon="add" label="导入" onPress={intents.openImport} />
      </View>
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
  root: {
    flex: 1,
  },
  demoNote: {
    paddingHorizontal: t.space.pageX,
    paddingBottom: t.space.gap,
  },
  errorPanel: {
    padding: t.space.pageX,
    gap: t.space.gap,
  },
  continueKicker: {
    ...t.type.caption,
    color: t.color.onAccent,
    opacity: 0.8,
  },
  continueTitle: {
    ...t.type.title,
    color: t.color.onAccent,
  },
  continueMeta: {
    ...t.type.caption,
    color: t.color.onAccent,
    opacity: 0.85,
  },
  continueRecap: {
    ...t.type.caption,
    color: t.color.onAccent,
    backgroundColor: t.color.accentInk,
    paddingVertical: 7,
    paddingHorizontal: 9,
    marginTop: 6,
    borderRadius: t.shape.sm,
  },
  continueFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.gap,
    paddingTop: t.space.gap,
  },
  stepDots: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  stepLabel: {
    ...t.type.caption,
    color: t.color.onAccent,
    opacity: 0.85,
  },
  continueButton: {
    backgroundColor: t.color.onAccent,
    borderRadius: t.shape.pill,
    paddingHorizontal: 16,
    height: 34,
    justifyContent: 'center',
  },
  continueAction: {
    ...t.type.label,
    color: t.color.accentInk,
  },
  bookContent: {
    flex: 1,
    gap: 2,
    justifyContent: 'center',
  },
  bookTitle: {
    ...t.type.headline,
    color: t.color.ink,
  },
  bookMeta: {
    ...t.type.caption,
    color: t.color.ink3,
  },
  bookStatus: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    marginTop: 4,
  },
  fabSpace: {
    height: 90,
  },
  formatLabel: {
    ...t.type.caption,
    color: t.color.accentInk,
  },
  importNote: {
    padding: t.space.pageX,
  },
  searchField: {
    padding: t.space.pageX,
  },
  fab: {
    position: 'absolute',
    right: t.space.pageX,
    bottom: t.space.pageX,
  },
  done: { opacity: 1 },
  todo: { opacity: 0.3 },
  stepDot: {
    width: 18,
    height: 4,
    borderRadius: t.shape.pill,
  },
  statusLabel: {
    ...t.type.caption,
    flex: 1,
  },
}));
