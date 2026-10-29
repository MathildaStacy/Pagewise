import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  AppBar,
  Button,
  CheckRow,
  Empty,
  Field,
  Icon,
  ListSection,
  Note,
  Row,
  Screen,
  Sheet,
  ToastHost,
  makeStyles,
  usePresentation,
  useTokens,
} from '@ui/kit';
import type {
  SectionDoneIntents,
  SectionDoneState,
} from '@features/study/types';
export function SectionDoneView({
  state,
  intents,
}: {
  state: SectionDoneState;
  intents: SectionDoneIntents;
}) {
  const s = useStyles();
  const t = useTokens();
  const { groupedLists, reduceMotion } = usePresentation();
  const pop = useRef(
    new Animated.Value(groupedLists && !reduceMotion ? 0 : 1),
  ).current;
  useEffect(() => {
    if (!groupedLists || reduceMotion) {
      pop.setValue(1);
      return;
    }
    pop.setValue(0);
    const animation = Animated.timing(pop, {
      toValue: 1,
      duration: 500,
      easing: Easing.bezier(...t.motion.easing),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [groupedLists, reduceMotion, pop, t.motion.easing]);
  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']}>
      <AppBar variant="push" title="本节小结" onBack={intents.back} />
      <View style={s.hero}>
        {groupedLists ? (
          <Animated.View
            testID="section-done-complete"
            style={[
              s.complete,
              {
                opacity: pop,
                transform: [
                  {
                    scale: pop.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.9, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Icon name="check" size={32} color={s.complete.color} />
          </Animated.View>
        ) : null}
        <Text style={s.kicker}>{state.hero.kicker}</Text>
        <Text style={s.title}>{state.hero.title}</Text>
        <Text style={s.stats}>{state.hero.stats}</Text>
      </View>
      {state.loading ? (
        <Empty body="正在整理摘要和闪卡…" />
      ) : (
        <>
          {state.error ? (
            <View style={s.panel}>
              <Note tone="bad">
                {state.error}。可以重试，也可以手写后保存。
              </Note>
              <Button variant="secondary" onPress={intents.retry}>
                重新整理
              </Button>
            </View>
          ) : null}
          <ListSection
            plain={groupedLists}
            title="摘要"
            subtitle="AI 起草，可以改"
          >
            <View style={s.summaryPanel}>
              <TextInput
                accessibilityLabel="本节摘要"
                value={state.summary.value}
                onChangeText={intents.setSummary}
                multiline
                style={s.editor}
              />
            </View>
          </ListSection>
          <ListSection
            plain={groupedLists}
            title="卡点"
            subtitle="没完全掌握的地方"
          >
            {state.stuck.length ? (
              state.stuck.map(item => (
                <CheckRow
                  key={item.id}
                  tone="stuck"
                  checked={item.checked}
                  title={item.text}
                  onToggle={() => intents.toggleStuck(item.id)}
                />
              ))
            ) : (
              <View style={s.panel}>
                <Text style={s.hint}>这节没有待记的卡点</Text>
              </View>
            )}
          </ListSection>
          <ListSection
            plain={groupedLists}
            title={groupedLists ? '闪卡草稿' : '闪卡'}
            subtitle={
              groupedLists ? '勾选的会加入复习 · 默认全选' : '勾选的会加入复习'
            }
          >
            {state.cards.length ? (
              state.cards.map(card => (
                <Pressable
                  key={card.id}
                  accessibilityLabel={`编辑闪卡：${card.front}`}
                  onLongPress={() => intents.openEditCard(card.id)}
                >
                  <View style={s.cardRow}>
                    <View style={s.grow}>
                      <CheckRow
                        checked={card.checked}
                        title={card.front}
                        subtitle={card.back}
                        tag={card.fromDetour ? '来自岔路' : undefined}
                        onToggle={() => intents.toggleCard(card.id)}
                      />
                    </View>
                  </View>
                </Pressable>
              ))
            ) : (
              <View style={s.panel}>
                <Text style={s.hint}>没有生成闪卡，可重新整理后选择</Text>
              </View>
            )}
          </ListSection>
          {state.detours.length ? (
            <ListSection title="岔路记录">
              {state.detours.map((d, i) => (
                <Row key={i} title={d.q} subtitle={d.where} />
              ))}
            </ListSection>
          ) : null}
          {state.next ? (
            <View style={s.savePanel}>
              <Button
                size="block"
                variant="primary"
                onPress={intents.save}
                disabled={state.saving}
              >
                {state.saving ? '正在保存…' : state.next.label}
              </Button>
              <Text style={s.saveHint}>{state.next.hint}</Text>
            </View>
          ) : null}
        </>
      )}
      <Sheet
        visible={state.editing !== null}
        title="编辑闪卡"
        onClose={intents.closeEditCard}
      >
        {state.editing ? (
          <View style={s.panel}>
            <Field
              label="正面"
              value={state.editing.front}
              onChange={intents.setEditFront}
              multiline
            />
            <Field
              label="背面"
              value={state.editing.back}
              onChange={intents.setEditBack}
              multiline
            />
            <Button
              disabled={
                !state.editing.front.trim() || !state.editing.back.trim()
              }
              onPress={intents.saveEditCard}
            >
              保存修改
            </Button>
          </View>
        ) : null}
      </Sheet>
      <ToastHost toast={state.toast ? { message: state.toast } : null} />
    </Screen>
  );
}
const useStyles = makeStyles(t => ({
  hero: {
    paddingTop: t.layout.groupedLists ? 6 : 16,
    paddingHorizontal: t.layout.groupedLists ? 24 : 16,
    paddingBottom: t.layout.groupedLists ? 22 : 18,
    backgroundColor: t.layout.groupedLists ? t.color.bg : t.color.ok,
    alignItems: t.layout.groupedLists ? 'center' : 'stretch',
  },
  complete: {
    width: 64,
    height: 64,
    borderRadius: t.shape.pill,
    backgroundColor: t.color.ok,
    color: t.color.continueInk,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    boxShadow: `0 10px 24px ${t.color.ok}66`,
  },
  kicker: {
    ...t.type.caption,
    color: t.layout.groupedLists ? t.color.ink2 : t.color.continueInk,
    opacity: t.layout.groupedLists ? 1 : 0.85,
  },
  title: {
    ...t.type.continueTitle,
    color: t.layout.groupedLists ? t.color.ink : t.color.continueInk,
    marginTop: 2,
    marginBottom: t.layout.groupedLists ? 4 : 0,
    letterSpacing: t.layout.groupedLists
      ? -t.type.continueTitle.fontSize * 0.01
      : 0,
  },
  stats: {
    ...t.type.caption,
    color: t.layout.groupedLists ? t.color.ink2 : t.color.continueInk,
    opacity: t.layout.groupedLists ? 1 : 0.85,
    marginTop: t.layout.groupedLists ? 0 : 4,
  },
  editor: {
    ...t.type.body,
    fontSize: t.layout.groupedLists
      ? (t.type.body.fontSize * 16) / 17
      : t.type.body.fontSize,
    lineHeight: t.layout.groupedLists ? 25.6 : 23.8,
    color: t.color.ink,
    backgroundColor: t.color.editor,
    borderWidth: t.layout.groupedLists ? 0 : 1,
    borderColor: t.color.line,
    borderRadius: t.layout.groupedLists ? t.shape.lg - 8 : t.shape.sm,
    minHeight: 120,
    paddingVertical: t.layout.groupedLists ? 13 : 9,
    paddingHorizontal: t.layout.groupedLists ? 16 : 10,
    textAlignVertical: 'top',
  },
  summaryPanel: {
    paddingHorizontal: t.layout.groupedLists ? 0 : 14,
    paddingTop: 0,
    paddingBottom: t.layout.groupedLists ? 0 : 12,
  },
  panel: { padding: t.space.pageX, gap: t.space.gap },
  hint: { ...t.type.caption, color: t.color.ink2 },
  savePanel: {
    paddingTop: t.layout.groupedLists ? 0 : 6,
    paddingHorizontal: t.layout.groupedLists ? 16 : 14,
    paddingBottom: t.layout.groupedLists ? 0 : 22,
  },
  saveHint: {
    ...t.type.caption,
    color: t.color.ink2,
    textAlign: 'center',
    marginTop: t.layout.groupedLists ? 10 : 8,
  },
  grow: { flex: 1 },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 0,
  },
}));
