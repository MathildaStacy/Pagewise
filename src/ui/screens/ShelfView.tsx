import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  AppBar,
  Button,
  Cover,
  Empty,
  Fab,
  Gradient,
  GradientText,
  Icon,
  IconButton,
  ListSection,
  Note,
  Screen,
  Sheet,
  StatusDot,
  ToastHost,
  useTokens,
  usePresentation,
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
  const { groupedLists } = usePresentation();
  const s = useStyles();
  const win = t.brand?.kind === 'win11';
  const [filter, setFilter] = useState('all');
  const [grid, setGrid] = useState(false);
  const { width } = useWindowDimensions();
  const gridWidth = (width - 56) / 3;
  const category = (book: ShelfState['books'][number]) =>
    book.category ??
    (book.status.tone === 'accent'
      ? 'learning'
      : book.status.tone === 'stuck' || book.status.tone === 'bad'
      ? 'parsing'
      : 'new');
  const books = win
    ? state.books.filter(book => filter === 'all' || category(book) === filter)
    : state.books;
  return (
    <View style={s.root}>
      <Screen scroll edges={['top', 'left', 'right']}>
        <AppBar
          title={win ? '书架' : 'Pagewise'}
          subtitle={
            win
              ? `${state.books.length} 本书${
                  state.books.some(book => category(book) === 'parsing')
                    ? ' · 有书正在解析'
                    : ''
                }`
              : undefined
          }
          variant="root"
          right={
            <View style={s.headerActions}>
              <IconButton
                icon="search"
                variant="root"
                label="搜索书架"
                onPress={intents.openSearch}
              />
              {win ? (
                <IconButton
                  icon={grid ? 'list' : 'grid'}
                  variant="root"
                  label={grid ? '列表视图' : '网格视图'}
                  onPress={() => setGrid(value => !value)}
                />
              ) : null}
            </View>
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
        {state.continueCard && !win ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`继续学习 ${state.continueCard.title}`}
            onPress={intents.openContinue}
            style={({ pressed }) => [s.continueCard, pressed && s.pressed]}
          >
            {t.brand?.kind === 'meta' ? (
              <>
                <View pointerEvents="none" style={s.continueStripe}>
                  <Gradient colors={t.brand.ai} style={s.fill} />
                </View>
                <GradientText colors={t.brand.ai} style={s.continueKicker}>
                  {state.continueCard.kicker}
                </GradientText>
              </>
            ) : (
              <Text style={s.continueKicker}>{state.continueCard.kicker}</Text>
            )}
            <Text style={s.continueTitle}>{state.continueCard.title}</Text>
            <Text style={s.continueMeta}>{state.continueCard.meta}</Text>
            {state.continueCard.recap ? (
              <Text style={s.continueRecap}>
                {groupedLists
                  ? state.continueCard.recap
                  : state.continueCard.recap.replace(/步/gu, '段')}
              </Text>
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
                      },
                    ]}
                  />
                ))}
                <Text style={s.stepLabel}>
                  {groupedLists
                    ? state.continueCard.stepLabel
                    : state.continueCard.stepLabel.replace(/步/gu, '段')}
                </Text>
              </View>
              <View style={s.continueButton}>
                <Text style={s.continueAction}>
                  {groupedLists ? '继续' : '继续 ›'}
                </Text>
                {groupedLists ? (
                  <Icon
                    name="chev"
                    size={16}
                    color={t.brand ? t.color.onAccent : t.color.accent}
                  />
                ) : null}
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
          <View style={s.shelfSection}>
            {win ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.filters}
              >
                {[
                  ['all', '全部'],
                  ['learning', '在学'],
                  ['parsing', '解析中'],
                  ['new', '未开始'],
                ].map(([key, label]) => (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityLabel={`${label} ${
                      state.books.filter(
                        book => key === 'all' || category(book) === key,
                      ).length
                    }`}
                    accessibilityState={{ selected: filter === key }}
                    hitSlop={6}
                    onPress={() => setFilter(key)}
                    style={({ pressed }) => [
                      s.filter,
                      filter === key && s.filterOn,
                      pressed && s.pressed,
                    ]}
                  >
                    <Text
                      style={[s.filterText, filter === key && s.filterTextOn]}
                    >
                      {label}{' '}
                      <Text style={s.filterCount}>
                        {
                          state.books.filter(
                            book => key === 'all' || category(book) === key,
                          ).length
                        }
                      </Text>
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <View style={s.shelfHeading}>
                <Text style={s.shelfTitle} accessibilityRole="header">
                  我的书
                </Text>
                <Text style={s.shelfCount}>{state.books.length} 本</Text>
              </View>
            )}
            {win && !books.length ? (
              <Empty body="这个分类下没有书" />
            ) : grid && win ? (
              <View style={s.grid}>
                {books.map(book => (
                  <Pressable
                    key={book.id}
                    accessibilityRole="button"
                    accessibilityLabel={`打开 ${book.title}`}
                    onPress={() => intents.openBook(book.id)}
                    style={({ pressed }) => [
                      s.gridBook,
                      { width: gridWidth },
                      pressed && s.pressed,
                    ]}
                  >
                    <Cover
                      {...book.cover}
                      title={book.title}
                      subtitle={book.author}
                      size="lg"
                      width={gridWidth}
                    />
                    <Text numberOfLines={2} style={s.gridTitle}>
                      {book.title}
                    </Text>
                    <View style={s.bookStatus}>
                      <StatusDot tone={book.status.tone} />
                      <Text numberOfLines={2} style={s.gridStatus}>
                        {book.status.text}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : (
              <ListSection>
                {books.map((book, index) => (
                  <Pressable
                    key={book.id}
                    accessibilityRole="button"
                    accessibilityLabel={`打开 ${book.title}`}
                    onPress={() => intents.openBook(book.id)}
                    style={({ pressed }) => [s.book, pressed && s.rowPressed]}
                  >
                    {groupedLists && index > 0 ? (
                      <View style={s.bookDivider} />
                    ) : null}
                    <Cover
                      {...book.cover}
                      title={win ? book.title : book.cover.title}
                      subtitle={book.author}
                      size={win ? 'sm' : 'md'}
                    />
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
                                  ? groupedLists
                                    ? t.color.badInk
                                    : t.color.bad
                                  : groupedLists
                                  ? t.color.ink2
                                  : t.color.ink,
                            },
                          ]}
                        >
                          {book.status.text}
                        </Text>
                      </View>
                      {win &&
                      book.category !== 'new' &&
                      book.progress !== undefined ? (
                        <View style={s.progress}>
                          <View
                            style={[
                              s.progressFill,
                              { width: `${book.progress * 100}%` },
                              book.status.tone === 'bad' && s.progressBad,
                            ]}
                          />
                        </View>
                      ) : null}
                    </View>
                    {groupedLists && t.brand?.kind !== 'google' ? (
                      <Icon name="chev" size={20} color={t.color.ink3} />
                    ) : null}
                  </Pressable>
                ))}
              </ListSection>
            )}
          </View>
        ) : null}
        <View style={s.fabSpace} />
        <ShelfOverlays state={state} intents={intents} />
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
export function ShelfOverlays({
  state,
  intents,
}: {
  state: ShelfState;
  intents: ShelfIntents;
}) {
  const s = useStyles(),
    t = useTokens();
  const { groupedLists } = usePresentation();
  return (
    <>
      <Sheet
        visible={state.overlay?.kind === 'import'}
        title="导入一本书"
        onClose={intents.closeOverlay}
      >
        {state.overlay?.kind === 'import' ? (
          <View style={s.importBody}>
            <Text style={s.importHeading}>
              {state.demo ? '演示文件' : '最近 · 下载'}
            </Text>
            <View style={s.importList}>
              {state.overlay.recent.map((file, index) => (
                <Pressable
                  key={file.key}
                  accessibilityRole="button"
                  accessibilityLabel={`导入 ${file.name}`}
                  style={({ pressed }) => [
                    s.importFile,
                    pressed && s.rowPressed,
                  ]}
                  onPress={() => intents.pickRecent(file.key)}
                >
                  {index > 0 ? <View style={s.importDivider} /> : null}
                  <View
                    style={[s.fileBadge, file.format === 'EPUB' && s.epubBadge]}
                  >
                    <Text style={s.formatLabel}>{file.format}</Text>
                  </View>
                  <View style={s.importFileContent}>
                    <Text style={s.importFileName}>{file.name}</Text>
                    <Text style={s.importFileMeta}>{file.meta}</Text>
                  </View>
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                onPress={intents.pickOther}
                style={({ pressed }) => [
                  s.chooseOther,
                  pressed && s.rowPressed,
                ]}
              >
                <View style={s.importDivider} />
                <Text style={s.chooseOtherLabel}>从其他位置选择…</Text>
              </Pressable>
            </View>
            <View style={s.importNote}>
              <Note tone="neutral">{state.overlay.note}</Note>
            </View>
          </View>
        ) : null}
      </Sheet>
      <Sheet
        visible={state.overlay?.kind === 'search'}
        title="搜索书架"
        onClose={intents.closeOverlay}
      >
        {state.overlay?.kind === 'search' ? (
          <View style={s.importBody}>
            <View style={s.searchField}>
              <View style={s.searchBox}>
                {groupedLists ? (
                  <Icon name="search" size={18} color={t.color.ink2} />
                ) : null}
                <TextInput
                  accessibilityLabel="书名或作者"
                  value={state.overlay.query}
                  onChangeText={intents.setSearch}
                  placeholder="书名、作者"
                  placeholderTextColor={t.color.ink3}
                  style={s.searchInput}
                />
              </View>
            </View>
            <View style={s.searchResults}>
              {state.overlay.results.map((book, index) => (
                <Pressable
                  key={book.id}
                  accessibilityRole="button"
                  accessibilityLabel={`打开 ${book.title}`}
                  style={({ pressed }) => [s.book, pressed && s.rowPressed]}
                  onPress={() => {
                    intents.closeOverlay();
                    intents.openBook(book.id);
                  }}
                >
                  {groupedLists && index > 0 ? (
                    <View style={s.bookDivider} />
                  ) : null}
                  <Cover
                    {...(state.books.find(value => value.id === book.id)
                      ?.cover ?? {
                      title: book.title,
                      color: t.color.accent,
                    })}
                  />
                  <View style={s.bookContent}>
                    <Text style={s.bookTitle}>{book.title}</Text>
                    <Text style={s.bookMeta}>
                      {state.books.find(value => value.id === book.id)
                        ?.author ?? book.meta}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
            {state.overlay.results.length === 0 ? (
              <Empty body={`书架上没有「${state.overlay.query}」`} />
            ) : null}
          </View>
        ) : null}
      </Sheet>
    </>
  );
}
const useStyles = makeStyles(t => ({
  root: {
    flex: 1,
  },
  fill: { flex: 1 },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.brand?.kind === 'win11' ? t.space.gap / 2 : 0,
  },
  continueStripe: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 4,
  },
  filters: { gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  filter: {
    minHeight: 36,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.shape.pill,
    backgroundColor: t.brand?.cardHi,
    borderWidth: 1,
    borderColor: t.color.fieldBorder,
  },
  filterOn: { backgroundColor: t.color.ink, borderColor: t.color.ink },
  filterText: {
    ...t.type.label,
    fontSize: t.type.label.fontSize - 0.5,
    color: t.color.ink,
  },
  filterTextOn: { color: t.color.bg, fontWeight: '600' },
  filterCount: { opacity: 0.7 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    rowGap: 18,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 20,
  },
  gridBook: { gap: 6, alignItems: 'flex-start' },
  gridTitle: {
    ...t.type.caption,
    fontSize: t.type.caption.fontSize + 0.5,
    fontWeight: '600',
    color: t.color.ink,
  },
  gridStatus: {
    ...t.type.caption,
    fontSize: t.type.caption.fontSize - 1,
    color: t.color.ink2,
    flex: 1,
  },
  progress: {
    height: 4,
    maxWidth: 180,
    borderRadius: t.shape.pill,
    backgroundColor: t.color.line,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: t.color.accent },
  progressBad: { backgroundColor: t.color.bad },
  errorPanel: {
    padding: t.space.pageX,
    gap: t.space.gap,
  },
  continueCard: {
    marginHorizontal: t.layout.groupedLists ? 16 : 12,
    marginTop: t.layout.groupedLists ? 0 : 12,
    marginBottom: t.layout.groupedLists ? 26 : 12,
    paddingHorizontal: t.layout.groupedLists ? 18 : 16,
    paddingTop: t.layout.groupedLists ? 18 : 16,
    paddingBottom: 16,
    borderRadius: t.layout.groupedLists ? t.shape.lg + 2 : t.shape.lg,
    backgroundColor: t.color.continueStart,
    backgroundImage: t.layout.groupedLists
      ? `linear-gradient(140deg, ${t.color.continueStart} 0%, ${t.color.continueMid} 45%, ${t.color.continueEnd} 100%)`
      : `linear-gradient(135deg, ${t.color.continueStart}, ${t.color.continueEnd})`,
    boxShadow: t.layout.groupedLists
      ? `0 14px 34px ${
          t.scheme === 'dark'
            ? `${String(t.elevation.pop.shadowColor)}80`
            : `${t.color.continueMid}47`
        }`
      : `0 6px 18px ${t.color.continueStart}40`,
    ...(t.brand
      ? {
          marginHorizontal: t.brand.kind === 'meta' ? 12 : 16,
          marginTop: t.brand.kind === 'meta' ? 12 : 4,
          marginBottom: t.brand.kind === 'google' ? 24 : 20,
          paddingHorizontal: t.brand.kind === 'google' ? 20 : 16,
          paddingTop: t.brand.kind === 'google' ? 20 : 18,
          paddingBottom: t.brand.kind === 'google' ? 16 : 14,
          borderRadius: t.brand.kind === 'google' ? t.shape.xl : t.shape.md,
          overflow: 'hidden',
          backgroundImage:
            t.brand.kind === 'win11'
              ? `linear-gradient(120deg, ${t.brand.aiSoft.join(',')})`
              : undefined,
          boxShadow:
            t.brand.kind === 'google' ? undefined : `0 1px 3px ${t.color.line}`,
          borderWidth: t.brand.kind === 'win11' ? 1 : 0,
          borderColor: t.color.glassLine,
        }
      : {}),
  },
  pressed: { opacity: 0.88 },
  rowPressed: { backgroundColor: t.color.pressed },
  continueKicker: {
    ...t.type.caption,
    color: t.color.continueInk,
    opacity: t.layout.groupedLists ? 0.85 : 0.8,
    fontWeight: t.layout.groupedLists ? '500' : '400',
  },
  continueTitle: {
    ...t.type.continueTitle,
    color: t.color.continueInk,
    marginTop: 4,
    marginBottom: 2,
  },
  continueMeta: {
    ...t.type.caption,
    color: t.color.continueInk,
    opacity: 0.85,
    ...(t.brand ? { color: t.color.ink2, opacity: 1 } : {}),
  },
  continueRecap: {
    ...t.type.caption,
    color: t.color.continueInk,
    backgroundColor: t.color.continueOverlay,
    paddingVertical: t.layout.groupedLists ? 9 : 7,
    paddingHorizontal: t.layout.groupedLists ? 12 : 9,
    marginTop: t.layout.groupedLists ? 12 : 10,
    borderRadius: t.layout.groupedLists ? t.shape.sm + 4 : t.shape.sm,
    lineHeight: t.type.caption.fontSize * (t.layout.groupedLists ? 1.5 : 1.55),
    ...(t.brand
      ? {
          color:
            t.brand.kind === 'google' ? t.color.continueInk : t.color.stuckInk,
          backgroundColor:
            t.brand.kind === 'google'
              ? t.scheme === 'dark'
                ? t.color.continueOverlay
                : t.color.surface
              : t.color.stuckBg,
          borderRadius: t.brand.kind === 'google' ? t.shape.md : t.shape.sm,
          paddingHorizontal: t.brand.kind === 'google' ? 14 : 12,
          paddingVertical: t.brand.kind === 'google' ? 10 : 9,
          marginTop: t.brand.kind === 'google' ? 14 : 12,
        }
      : {}),
  },
  continueFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.gap,
    marginTop: t.layout.groupedLists ? 14 : 12,
  },
  stepDots: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.layout.groupedLists ? 5 : 4,
    flexWrap: 'wrap',
  },
  stepLabel: {
    ...t.type.caption,
    color: t.color.continueInk,
    opacity: t.layout.groupedLists ? 0.9 : 0.85,
    marginLeft: 6,
  },
  continueButton: {
    backgroundColor: t.color.continueInk,
    borderRadius: t.shape.pill,
    paddingHorizontal: 16,
    height: t.layout.groupedLists ? 36 : 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    justifyContent: 'center',
    ...(t.brand
      ? {
          backgroundColor: t.brand.accentFill,
          borderRadius: t.brand.kind === 'meta' ? t.shape.sm : t.shape.pill,
          height: t.brand.kind === 'google' ? 40 : 36,
        }
      : {}),
  },
  continueAction: {
    ...t.type.label,
    color: t.color.accent,
    ...(t.brand ? { color: t.color.onAccent } : {}),
  },
  shelfSection: {
    backgroundColor: t.layout.groupedLists ? undefined : t.color.surface,
  },
  shelfHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: t.layout.groupedLists ? 20 : t.space.pageX,
    paddingTop: t.layout.groupedLists ? 0 : 12,
    paddingBottom: t.layout.groupedLists ? 8 : 6,
  },
  shelfTitle: {
    ...(t.layout.groupedLists ? t.type.fileTitle : t.type.headline),
    color: t.color.ink,
    ...(t.brand
      ? {
          fontSize: t.type.headline.fontSize,
          fontWeight: t.brand.kind === 'meta' ? '700' : '500',
        }
      : {}),
  },
  shelfCount: {
    ...t.type.caption,
    color: t.layout.groupedLists ? t.color.ink2 : t.color.ink3,
  },
  book: {
    flexDirection: 'row',
    gap: t.layout.groupedLists ? 14 : 12,
    paddingHorizontal: t.space.pageX,
    paddingVertical: 12,
    alignItems: t.layout.groupedLists ? 'center' : 'flex-start',
    borderBottomWidth: t.layout.groupedLists ? 0 : 1,
    borderBottomColor: t.color.line,
    backgroundColor: t.color.surface,
    ...(t.brand
      ? {
          backgroundColor: undefined,
          paddingHorizontal:
            t.brand.kind === 'google' ? 24 : t.brand.kind === 'win11' ? 14 : 16,
          paddingVertical: t.brand.kind === 'google' ? 10 : 12,
          gap:
            t.brand.kind === 'google' ? 16 : t.brand.kind === 'win11' ? 14 : 12,
        }
      : {}),
  },
  bookDivider: {
    position: 'absolute',
    left: 84,
    right: 0,
    top: 0,
    height: 0.5,
    backgroundColor: t.color.line,
    ...(t.brand
      ? { height: t.brand.kind === 'google' ? 0 : 1, right: 16 }
      : {}),
  },
  bookContent: {
    flex: 1,
  },
  bookTitle: {
    ...t.type.bookTitle,
    color: t.color.ink,
    ...(t.brand
      ? {
          fontWeight:
            t.brand.kind === 'meta'
              ? '700'
              : t.brand.kind === 'win11'
              ? '600'
              : '400',
          fontSize:
            t.brand.kind === 'win11'
              ? t.type.body.fontSize + 0.5
              : t.type.bookTitle.fontSize,
        }
      : {}),
  },
  bookMeta: {
    ...t.type.caption,
    color: t.layout.groupedLists ? t.color.ink2 : t.color.ink3,
    marginTop: t.layout.groupedLists ? 1 : 2,
  },
  bookStatus: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    marginTop: 6,
  },
  fabSpace: {
    height: t.layout.groupedLists ? 26 : 70,
  },
  importBody: { marginHorizontal: t.layout.groupedLists ? 0 : -t.space.pageX },
  importHeading: {
    ...t.type.caption,
    color: t.layout.groupedLists ? t.color.ink2 : t.color.ink3,
    fontWeight: t.layout.groupedLists ? '600' : '400',
    marginTop: t.layout.groupedLists ? 12 : 0,
    marginHorizontal: t.layout.groupedLists ? 4 : 0,
    marginBottom: t.layout.groupedLists ? 6 : 0,
    paddingTop: t.layout.groupedLists ? 0 : 2,
    paddingHorizontal: t.layout.groupedLists ? 0 : t.space.pageX,
    paddingBottom: t.layout.groupedLists ? 0 : 6,
  },
  importList: {
    borderRadius: t.layout.groupedLists ? t.shape.md : 0,
    overflow: 'hidden',
    backgroundColor: t.color.surface,
  },
  importFile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: t.space.pageX,
    paddingVertical: t.layout.groupedLists ? 11 : 12,
    backgroundColor: t.color.surface,
  },
  importDivider: {
    position: 'absolute',
    left: t.layout.groupedLists ? 68 : 0,
    right: 0,
    top: 0,
    height: t.layout.groupedLists ? 0.5 : 1,
    backgroundColor: t.color.line,
  },
  fileBadge: {
    width: t.layout.groupedLists ? 40 : 42,
    height: t.layout.groupedLists ? 50 : 52,
    borderRadius: t.layout.groupedLists ? t.shape.sm - 1 : t.shape.xs + 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.color.bad,
  },
  epubBadge: { backgroundColor: t.color.ok },
  importFileContent: { flex: 1 },
  importFileName: {
    ...(t.layout.groupedLists ? t.type.label : t.type.body),
    fontWeight: t.layout.groupedLists ? '400' : '500',
    color: t.color.ink,
  },
  importFileMeta: {
    ...t.type.caption,
    color: t.layout.groupedLists ? t.color.ink2 : t.color.ink3,
    marginTop: t.layout.groupedLists ? 2 : 0,
  },
  chooseOther: {
    minHeight: t.layout.groupedLists ? 50 : 45,
    paddingHorizontal: t.space.pageX,
    paddingVertical: t.layout.groupedLists ? 11 : 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.color.surface,
  },
  chooseOtherLabel: { ...t.type.body, color: t.color.accent },
  formatLabel: {
    ...t.type.micro,
    fontSize: t.type.micro.fontSize * (t.layout.groupedLists ? 11 / 12 : 1),
    fontWeight: '700',
    color: t.color.continueInk,
  },
  importNote: {
    paddingHorizontal: t.layout.groupedLists ? 0 : t.space.pageX,
    paddingTop: t.layout.groupedLists ? 12 : 10,
    paddingBottom: t.layout.groupedLists ? 4 : 12,
  },
  searchField: {
    paddingHorizontal: t.layout.groupedLists ? 2 : 16,
    paddingTop: t.layout.groupedLists ? 0 : 4,
    paddingBottom: t.layout.groupedLists ? 10 : 8,
  },
  searchBox: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: t.layout.groupedLists ? t.shape.sm + 2 : t.shape.pill,
    paddingHorizontal: t.layout.groupedLists ? 10 : 14,
    backgroundColor: t.layout.groupedLists
      ? t.color.surfaceAlt
      : t.color.surface,
    borderWidth: t.layout.groupedLists ? 0 : 1,
    borderColor: t.color.line,
  },
  searchInput: {
    ...t.type.body,
    color: t.color.ink,
    flex: 1,
    paddingVertical: 0,
    height: '100%',
  },
  searchResults: {
    borderRadius: t.layout.groupedLists ? t.shape.md : 0,
    overflow: 'hidden',
  },
  fab: {
    position: 'absolute',
    right: t.layout.groupedLists ? 22 : 16,
    bottom: t.layout.groupedLists ? 104 : 16,
    ...(t.brand
      ? { right: 16, bottom: t.brand.kind === 'google' ? 112 : 104 }
      : {}),
  },
  done: { opacity: 1 },
  todo: { opacity: 0.3 },
  stepDot: {
    width: t.layout.groupedLists ? 22 : 18,
    height: t.layout.groupedLists ? 6 : 4,
    borderRadius: t.shape.pill,
    backgroundColor: t.color.continueInk,
    ...(t.brand ? { backgroundColor: t.color.accent } : {}),
  },
  statusLabel: {
    ...t.type.caption,
    flex: 1,
    color: t.layout.groupedLists ? t.color.ink2 : t.color.ink,
  },
}));
