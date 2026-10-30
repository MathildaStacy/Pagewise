import { Pressable, ScrollView, Text, View } from 'react-native';
import { ConversationList } from './ConversationList';
import {
  AppBar,
  Button,
  Cover,
  Empty,
  Gradient,
  Icon,
  Note,
  Screen,
  ToastHost,
  makeStyles,
  useTokens,
} from '@ui/kit';
import type { HomeState, HomeIntents } from '@features/home/types';
import type { ShelfState, ShelfIntents } from '@features/library/types';
import { ShelfOverlays } from './ShelfView';
import { SettingsGroup, SettingsRow } from './MeView';

export function TodayView({
  state,
  intents,
  library,
}: {
  state: HomeState;
  intents: HomeIntents;
  library: { state: ShelfState; intents: ShelfIntents };
}) {
  const s = useStyles(),
    t = useTokens();
  const date = new Date(state.date + 'T12:00:00'),
    weekdays = '日一二三四五六';
  const card = state.shelf.continueCard;
  const current = state.books.find(b => b.id === card?.bookId);
  const todayIndex = (date.getDay() + 6) % 7;
  return (
    <View style={s.root}>
      <Screen scroll edges={['top', 'left', 'right']}>
        <AppBar
          title={state.greeting}
          subtitle={`周${weekdays[date.getDay()]} · ${
            date.getMonth() + 1
          } 月 ${date.getDate()} 日`}
          variant="root"
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="我的"
              onPress={intents.me}
            >
              <Gradient
                colors={t.brand?.ai ?? [t.color.accent, t.color.detour]}
                style={s.avatar}
              >
                <Icon name="person" color={t.color.onAccent} />
              </Gradient>
            </Pressable>
          }
        />
        <Pressable
          accessibilityRole="button"
          onPress={intents.ask}
          accessibilityLabel="问问你书架上的书"
          style={s.askMargin}
        >
          <Gradient
            colors={t.brand?.ai ?? [t.color.accent, t.color.detour]}
            style={s.askBorder}
          >
            <View style={s.ask}>
              <Icon name="spark" variant="color" size={22} />
              <Text style={s.placeholder}>问问你书架上的书…</Text>
              <Icon name="mic" color={t.color.ink2} />
            </View>
          </Gradient>
        </Pressable>
        {state.error ? (
          <View style={s.pad}>
            <Note tone="bad">{state.error}</Note>
            <Button onPress={intents.refresh}>重新加载</Button>
          </View>
        ) : null}
        {state.loading ? <Empty body="正在读取书架…" /> : null}
        {!state.loading && !state.books.length ? (
          <>
            <View style={s.empty}>
              <Empty
                title="书架还是空的"
                body="导入一本 PDF 或 EPUB，Pagewise 会先建好「书的地图」，再一节一节讲给你听。"
                action={
                  <Button icon="add" onPress={library.intents.openImport}>
                    导入第一本书
                  </Button>
                }
              />
            </View>
            <SettingsGroup title="还没开始">
              <SettingsRow
                title="配置 AI 服务"
                subtitle="讲解需要一个 AI 服务（Claude、OpenAI 兼容…）"
                icon={<Icon name="cpu" variant="color" size={40} />}
                chevron
                onPress={() => intents.setup('MeAI')}
              />
              <SettingsRow
                title="配置 MinerU Token"
                subtitle="PDF 要先交给 MinerU 解析；EPUB 不需要"
                icon={<Icon name="key" variant="color" size={40} />}
                chevron
                onPress={() => intents.setup('MeMineru')}
              />
              <SettingsRow
                title="看看新手引导"
                subtitle="三步配置好就能开始"
                icon={<Icon name="rocket" variant="color" size={40} />}
                chevron
                onPress={() => intents.setup('Welcome')}
              />
            </SettingsGroup>
          </>
        ) : null}
        {card ? (
          <Gradient
            colors={[t.color.bg, t.color.bg]}
            spots={t.brand?.heroSpots}
            style={s.hero}
          >
            <View style={s.heroInner}>
              <View style={s.row}>
                <Cover
                  {...(current?.cover ?? {
                    title: card.title,
                    color: t.color.accent,
                  })}
                  size="md"
                />
                <View style={s.grow}>
                  <Text style={s.eyebrow}>继续听讲</Text>
                  <Text style={s.heroTitle}>{card.title}</Text>
                  <Text style={s.small}>{card.meta.split(' · p.')[0]}</Text>
                  <View style={s.segments}>
                    {card.steps.map((step, i) => (
                      <View
                        key={i}
                        style={[s.segment, step.done && s.segmentDone]}
                      />
                    ))}
                  </View>
                  <View style={s.stepMeta}>
                    <Text style={s.stepText}>
                      <Text style={s.stepLabel}>{card.stepLabel}</Text>
                      {card.stepTitle ? ` · ${card.stepTitle}` : ''}
                    </Text>
                    <Text style={s.small}>
                      {card.meta.split(' · ').slice(-1)[0]}
                    </Text>
                  </View>
                </View>
              </View>
              {card.recap ? (
                <Gradient
                  colors={
                    t.brand?.aiSoft ?? [t.color.accentBg, t.color.detourBg]
                  }
                  style={s.recap}
                >
                  <Icon name="spark" variant="color" size={16} />
                  <Text style={s.recapText}>{card.recap}</Text>
                </Gradient>
              ) : (
                <View style={s.spacer} />
              )}
              <View style={s.actions}>
                <View style={s.grow}>
                  <Button
                    size="block"
                    icon="play"
                    onPress={() => intents.openContinue('listen')}
                  >
                    继续听讲
                  </Button>
                </View>
                <Button
                  variant="secondary"
                  icon="book"
                  onPress={() => intents.openContinue('read')}
                >
                  读原文
                </Button>
              </View>
            </View>
          </Gradient>
        ) : null}
        {state.books.length ? (
          <>
            <View style={s.widgets}>
              <Pressable
                accessibilityRole="button"
                onPress={intents.review}
                style={s.widget}
              >
                <Icon name="cards" variant="color" size={40} />
                <Text style={s.number}>
                  {state.due}
                  <Text style={s.unit}> 张</Text>
                </Text>
                <Text style={s.small}>今天要复习的闪卡</Text>
                <Text style={s.link}>
                  {state.due ? '开始复习' : '去复习页'} ›
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={intents.stats}
                style={s.widget}
              >
                <Icon name="fire" variant="color" size={40} />
                <Text style={s.number}>
                  {state.stats.streak}
                  <Text style={s.unit}> 天</Text>
                </Text>
                <Text style={s.small}>连续学习</Text>
                <View style={s.days}>
                  {'一二三四五'.split('').map((day, i) => (
                    <Gradient
                      key={day}
                      colors={
                        state.stats.week[i] > 0 && i !== todayIndex
                          ? t.brand?.days ?? [t.color.stuck, t.color.stuck]
                          : [t.color.line, t.color.line]
                      }
                      vertical
                      style={[s.day, i === todayIndex && s.dayToday]}
                    >
                      <Text
                        style={[
                          s.dayText,
                          state.stats.week[i] > 0 &&
                            i !== todayIndex &&
                            s.dayTextOn,
                          i === todayIndex && s.dayTextToday,
                        ]}
                      >
                        {day}
                      </Text>
                    </Gradient>
                  ))}
                </View>
              </Pressable>
            </View>
            <View style={s.heading}>
              <Text style={s.title}>书架</Text>
              <Pressable accessibilityRole="button" onPress={intents.shelf}>
                <Text style={s.link}>全部 {state.books.length} 本</Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.books}
            >
              {state.books.map(book => (
                <Pressable
                  key={book.id}
                  style={s.book}
                  accessibilityRole="button"
                  accessibilityLabel={`打开 ${book.title}`}
                  onPress={() => intents.openBook(book.id)}
                >
                  <Cover {...book.cover} size="lg" />
                  <Text numberOfLines={2} style={s.bookStatus}>
                    {book.status}
                  </Text>
                  <View style={s.progress}>
                    <View
                      style={[
                        s.progressFill,
                        { width: `${book.progress * 100}%` },
                      ]}
                    />
                  </View>
                </Pressable>
              ))}
              <Pressable
                style={s.book}
                accessibilityRole="button"
                onPress={library.intents.openImport}
              >
                <View style={s.addCover}>
                  <Icon name="add" size={28} color={t.color.ink3} />
                </View>
                <Text style={s.bookStatus}>导入 PDF / EPUB</Text>
              </Pressable>
            </ScrollView>
            <View style={s.heading}>
              <Text style={s.title}>最近的卡点</Text>
              <Pressable accessibilityRole="button" onPress={intents.review}>
                <Text style={s.link}>全部</Text>
              </Pressable>
            </View>
            <SettingsGroup>
              {state.stuck.length ? (
                state.stuck.map(item => (
                  <SettingsRow
                    key={item.id}
                    title={item.title}
                    subtitle={item.subtitle}
                    icon={
                      <Icon
                        name={item.solved ? 'bulb' : 'pin'}
                        variant="color"
                        size={40}
                      />
                    }
                    chevron
                    onPress={() => intents.openStuck(item.id)}
                  />
                ))
              ) : (
                <SettingsRow
                  title="还没有卡点"
                  subtitle="听讲时记下的问题会出现在这里"
                />
              )}
            </SettingsGroup>
          </>
        ) : null}
        <ConversationList
          items={state.conversations}
          onOpen={intents.openConversation}
        />
      </Screen>
      <ShelfOverlays {...library} />
      <ToastHost
        toast={library.state.toast ? { message: library.state.toast } : null}
      />
    </View>
  );
}

const useStyles = makeStyles(t => ({
  root: { flex: 1 },
  grow: { flex: 1, minWidth: 0 },
  pad: { padding: 16, gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: t.shape.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  askMargin: { marginHorizontal: 16, marginBottom: 16 },
  askBorder: {
    borderRadius: t.shape.pill,
    padding: 1.5,
    ...t.elevation.card,
  },
  ask: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: t.shape.pill,
    backgroundColor: t.brand?.cardSolid ?? t.color.surface,
  },
  placeholder: { ...t.type.body, color: t.color.ink3, flex: 1 },
  empty: {
    marginHorizontal: 16,
    marginBottom: 22,
    borderRadius: t.shape.lg - 5,
    backgroundColor: t.color.glass,
  },
  hero: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: t.shape.xl,
    padding: 6,
    borderWidth: 1,
    borderColor: t.brand?.stroke ?? t.color.line,
    ...t.elevation.pop,
  },
  heroInner: {
    borderRadius: t.shape.lg - 5,
    padding: 16,
    backgroundColor: t.color.glass,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  eyebrow: { ...t.type.caption, fontWeight: '600', color: t.color.accent },
  heroTitle: {
    ...t.type.title,
    fontSize: t.type.title.fontSize + 4,
    lineHeight: 25,
    color: t.color.ink,
    marginTop: 4,
    marginBottom: 2,
  },
  small: { ...t.type.caption, color: t.color.ink2 },
  stepMeta: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  stepText: { ...t.type.caption, color: t.color.ink2, flex: 1 },
  stepLabel: { fontWeight: '600', color: t.color.ink },
  segments: { flexDirection: 'row', gap: 4, marginTop: 12, marginBottom: 6 },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: t.shape.pill,
    backgroundColor: t.color.line,
  },
  segmentDone: { backgroundColor: t.color.accent },
  recap: {
    padding: 10,
    marginVertical: 14,
    borderRadius: t.shape.md,
    flexDirection: 'row',
    gap: 8,
  },
  recapText: { ...t.type.caption, color: t.color.ink2, flex: 1 },
  spacer: { height: 14 },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  widgets: {
    marginHorizontal: 16,
    marginBottom: 22,
    flexDirection: 'row',
    gap: 12,
  },
  widget: {
    flex: 1,
    minHeight: 136,
    padding: 14,
    gap: 10,
    borderRadius: t.shape.lg,
    backgroundColor: t.brand?.card ?? t.color.glass,
    borderWidth: 1,
    borderColor: t.brand?.stroke ?? t.color.line,
    ...t.elevation.card,
  },
  number: {
    ...t.type.largeTitle,
    fontSize: t.type.largeTitle.fontSize - 2,
    color: t.color.ink,
  },
  unit: { ...t.type.caption, color: t.color.ink2 },
  link: { ...t.type.caption, fontWeight: '600', color: t.color.accentInk },
  days: { flexDirection: 'row', gap: 5, marginTop: 'auto' },
  day: {
    flex: 1,
    height: 22,
    borderRadius: t.shape.sm - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayToday: { borderWidth: 1.5, borderColor: t.color.stuck },
  dayText: {
    ...t.type.caption,
    fontSize: t.type.caption.fontSize - 2,
    color: t.color.ink3,
  },
  dayTextOn: { color: t.color.thumb, fontWeight: '600' },
  dayTextToday: { color: t.color.stuckInk, fontWeight: '600' },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 10,
  },
  title: {
    ...t.type.headline,
    fontSize: t.type.headline.fontSize - 1,
    color: t.color.ink,
  },
  books: { gap: 14, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 22 },
  book: { width: 84, alignItems: 'flex-start', gap: 6 },
  bookStatus: { ...t.type.caption, color: t.color.ink2 },
  addCover: {
    width: 84,
    height: 116,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.shape.md,
    borderWidth: 1,
    borderColor: t.color.fieldBorder,
    backgroundColor: t.color.surfaceAlt,
  },
  progress: {
    height: 3,
    width: '100%',
    borderRadius: t.shape.pill,
    backgroundColor: t.color.line,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: t.color.accent },
}));
