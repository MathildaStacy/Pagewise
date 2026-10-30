import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import {
  AiMessage,
  AppBar,
  Button,
  Cover,
  Gradient,
  Icon,
  Note,
  Screen,
  ToastHost,
  ToolSteps,
  UserBubble,
  makeStyles,
  useTokens,
} from '@ui/kit';
import type { AskState, AskIntents } from '@features/home/types';
import { SettingsGroup, SettingsRow } from './MeView';

const suggestions = [
  { q: 'A* 和 Dijkstra 是什么关系？', icon: 'branch' as const },
  { q: '我在哪些地方卡住过？', icon: 'pin' as const },
  { q: '把第 3 章学过的内容串一下', icon: 'shelf' as const },
  { q: '可容许和一致性有什么区别？', icon: 'help' as const },
];
export function AskShelfView({
  state,
  intents,
}: {
  state: AskState;
  intents: AskIntents;
}) {
  const s = useStyles(),
    t = useTokens();
  const [scrollY, setScrollY] = useState(0);
  const books = state.hits.filter(
    (hit, i) => state.hits.findIndex(h => h.bookId === hit.bookId) === i,
  );
  return (
    <View style={s.root}>
      <Screen edges={['top', 'left', 'right', 'bottom']}>
        <AppBar
          title="问书架"
          subtitle="在你所有书的原文里找答案"
          variant="push"
          onBack={intents.back}
          scrollY={scrollY}
        />
        <Gradient
          colors={t.brand?.ai ?? [t.color.accent, t.color.detour]}
          style={s.askBorder}
        >
          <View style={s.ask}>
            <Icon name="spark" variant="color" size={22} />
            <TextInput
              accessibilityLabel="问书架"
              placeholder="比如：A* 和 Dijkstra 是什么关系？"
              placeholderTextColor={t.color.ink3}
              value={state.query}
              onChangeText={intents.query}
              onSubmitEditing={() => intents.ask()}
              editable={!state.busy}
              style={s.input}
              returnKeyType="send"
            />
            <Gradient
              colors={t.brand?.ai ?? [t.color.accent, t.color.detour]}
              style={[
                s.send,
                !state.busy && !state.query.trim() && s.sendDisabled,
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={state.busy ? '停止' : '提问'}
                accessibilityState={{
                  disabled: !state.busy && !state.query.trim(),
                }}
                onPress={state.busy ? intents.stop : () => intents.ask()}
                disabled={!state.busy && !state.query.trim()}
                hitSlop={4}
                style={s.sendButton}
              >
                <Icon
                  name={state.busy ? 'stop' : 'send'}
                  size={22}
                  color={t.color.thumb}
                />
              </Pressable>
            </Gradient>
          </View>
        </Gradient>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={s.scopeFrame}
          contentContainerStyle={s.scopes}
        >
          {[
            { id: 'all', title: `全部 ${state.books.length} 本` },
            ...state.books,
          ].map(book => (
            <Pressable
              key={book.id}
              accessibilityRole="button"
              accessibilityState={{
                selected: state.scope === book.id,
                disabled: state.busy,
              }}
              disabled={state.busy}
              hitSlop={6}
              onPress={() => intents.scope(book.id)}
              style={[s.chip, state.scope === book.id && s.chipSelected]}
            >
              <Text
                style={[
                  s.chipText,
                  state.scope === book.id && s.chipTextSelected,
                ]}
              >
                {book.title.replace(/[（(].*$/u, '')}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView
          testID="ask-answer"
          style={s.answer}
          contentContainerStyle={s.answerContent}
          keyboardShouldPersistTaps="handled"
          onScroll={event => setScrollY(event.nativeEvent.contentOffset.y)}
          scrollEventThrottle={16}
        >
          {state.error ? (
            <View style={s.pad}>
              <Note tone="bad">{state.error}</Note>
              <Button onPress={() => intents.ask(state.asked)}>重试</Button>
            </View>
          ) : null}
          {!state.asked ? (
            <>
              <SettingsGroup title="试试这样问">
                {suggestions.map(item => (
                  <SettingsRow
                    key={item.q}
                    title={item.q}
                    icon={<Icon name={item.icon} variant="color" size={40} />}
                    chevron
                    onPress={() => intents.ask(item.q)}
                  />
                ))}
              </SettingsGroup>
              {state.recent.length || state.demo ? (
                <SettingsGroup title="最近问过">
                  {(state.recent.length
                    ? state.recent
                    : ['贪心搜索为什么不是最优的？']
                  ).map(q => (
                    <SettingsRow
                      key={q}
                      title={q}
                      subtitle={
                        state.demo
                          ? '10 月 26 日 · 人工智能：现代方法'
                          : undefined
                      }
                      icon={<Icon name="clock" size={22} />}
                      chevron
                      onPress={() => intents.ask(q)}
                    />
                  ))}
                </SettingsGroup>
              ) : null}
              <View style={s.pad}>
                <Note tone="neutral" variant="ai" icon="info">
                  跨书问答只读你书架上已解析的内容，回答里每个说法都带书名和页码。解析中的书只搜已就绪的部分。
                </Note>
              </View>
            </>
          ) : (
            <View style={s.thread}>
              <UserBubble text={state.asked} />
              <ToolSteps
                lines={state.tools.map((text, i) => ({
                  text,
                  running: state.busy && i === state.tools.length - 1,
                }))}
              />
              {state.answer ? (
                <>
                  <View style={s.who}>
                    <Icon name="spark" variant="color" size={28} />
                    <Text style={s.whoText}>Pagewise · 跨书回答</Text>
                  </View>
                  <AiMessage
                    doc={state.doc}
                    streaming={state.busy}
                    onCite={ref => intents.openHit(ref - 1)}
                  />
                </>
              ) : state.busy ? (
                <Text accessibilityLiveRegion="polite" style={s.small}>
                  正在读取相关原文…
                </Text>
              ) : null}
              {state.done && state.hits.length ? (
                <>
                  <Text style={s.sectionTitle}>
                    原文命中 · {state.hits.length} 处
                  </Text>
                  {books.map(book => (
                    <View key={book.bookId} style={s.hitGroup}>
                      <View style={s.bookHeader}>
                        <Cover {...book.cover} size="sm" />
                        <Text style={s.bookTitle}>{book.bookTitle}</Text>
                        <Text style={s.small}>
                          {
                            state.hits.filter(h => h.bookId === book.bookId)
                              .length
                          }
                        </Text>
                      </View>
                      {state.hits.map((hit, i) =>
                        hit.bookId === book.bookId ? (
                          <Pressable
                            key={hit.ref}
                            accessibilityRole="button"
                            onPress={() => intents.openHit(i)}
                            style={s.hit}
                          >
                            <View style={s.grow}>
                              <Text style={s.hitTitle}>{hit.section}</Text>
                              <Text numberOfLines={2} style={s.excerpt}>
                                {hit.text}
                              </Text>
                            </View>
                            <Text style={s.small}>{hit.page}</Text>
                          </Pressable>
                        ) : null,
                      )}
                    </View>
                  ))}
                  <View style={s.actions}>
                    <Button icon="listen" onPress={intents.continue}>
                      带到听讲里继续问
                    </Button>
                    <Button
                      icon="note"
                      variant="secondary"
                      onPress={intents.save}
                    >
                      存到笔记
                    </Button>
                  </View>
                </>
              ) : null}
            </View>
          )}
        </ScrollView>
      </Screen>
      <ToastHost toast={state.toast ? { message: state.toast } : null} />
    </View>
  );
}
const useStyles = makeStyles(t => ({
  root: { flex: 1 },
  answer: { flex: 1 },
  answerContent: { flexGrow: 1 },
  grow: { flex: 1, minWidth: 0 },
  pad: { padding: 16, gap: 12 },
  askBorder: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 1.5,
    borderRadius: t.shape.pill,
    ...t.brand?.aiGlow,
  },
  ask: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingLeft: 10,
    paddingRight: 6,
    gap: 4,
    borderRadius: t.shape.pill,
    backgroundColor: t.brand?.cardSolid ?? t.color.surface,
  },
  input: {
    flex: 1,
    minWidth: 0,
    ...t.type.body,
    color: t.color.ink,
    paddingHorizontal: 4,
    paddingVertical: 12,
  },
  scopeFrame: { flexGrow: 0, flexShrink: 0 },
  scopes: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
    alignItems: 'center',
    gap: 6,
  },
  chip: {
    borderRadius: t.shape.pill,
    borderWidth: 1,
    borderColor: t.color.fieldBorder,
    backgroundColor: t.color.glass,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipSelected: {
    backgroundColor: t.color.ink,
    borderColor: t.color.ink,
  },
  chipText: { ...t.type.caption, color: t.color.ink2 },
  chipTextSelected: { color: t.color.bg },
  send: { borderRadius: t.shape.pill },
  sendButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.45 },
  thread: { paddingHorizontal: 16, paddingBottom: 24, gap: 14 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  whoText: { ...t.type.caption, color: t.color.ink2 },
  small: { ...t.type.caption, color: t.color.ink2 },
  sectionTitle: { ...t.type.label, color: t.color.ink, marginTop: 12 },
  hitGroup: {
    borderRadius: t.shape.lg,
    backgroundColor: t.color.glass,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: t.color.line,
  },
  bookHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  bookTitle: { flex: 1, ...t.type.label, color: t.color.ink },
  hit: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
    borderTopWidth: 1,
    borderColor: t.color.line,
  },
  hitTitle: { ...t.type.body, color: t.color.ink, fontWeight: '600' },
  excerpt: {
    ...t.type.caption,
    fontFamily: t.type.serifFamily,
    color: t.color.ink2,
    marginTop: 4,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
}));
