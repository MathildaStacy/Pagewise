import { Pressable, Text, View } from 'react-native';
import {
  AppBar,
  Button,
  CheckRow,
  Empty,
  Field,
  IconButton,
  ListSection,
  Note,
  Row,
  Screen,
  Sheet,
  ToastHost,
  makeStyles,
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
  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']}>
      <AppBar variant="push" title="本节小结" onBack={intents.back} />
      <View style={s.hero}>
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
          <ListSection title="摘要" note={state.summary.hint}>
            <View style={s.panel}>
              <Field
                label="本节摘要"
                value={state.summary.value}
                onChange={intents.setSummary}
                multiline
                placeholder="用自己的话总结这一节"
              />
            </View>
          </ListSection>
          <ListSection title="卡点" note="没完全掌握的地方">
            {state.stuck.length ? (
              state.stuck.map(item => (
                <CheckRow
                  key={item.id}
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
          <ListSection title="闪卡" note="勾选的会加入复习，长按可以修改">
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
                    <IconButton
                      icon="note"
                      label="编辑闪卡"
                      onPress={() => intents.openEditCard(card.id)}
                    />
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
            <View style={s.panel}>
              <Button
                size="block"
                onPress={intents.save}
                disabled={state.saving}
              >
                {state.saving ? '正在保存…' : state.next.label}
              </Button>
              <Text style={s.hint}>{state.next.hint}</Text>
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
    padding: t.space.pageX,
    gap: t.space.gap,
    backgroundColor: t.color.ok,
  },
  kicker: { ...t.type.caption, color: t.color.onAccent },
  title: { ...t.type.title, color: t.color.onAccent },
  stats: { ...t.type.caption, color: t.color.onAccent, opacity: 0.85 },
  panel: { padding: t.space.pageX, gap: t.space.gap },
  hint: { ...t.type.caption, color: t.color.ink2 },
  grow: { flex: 1 },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: t.space.gap,
  },
}));
