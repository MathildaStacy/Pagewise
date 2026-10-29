import { Text, View } from 'react-native';
import {
  AppBar,
  Button,
  Empty,
  Field,
  ListSection,
  Note,
  Row,
  Screen,
  SourceCard,
  makeStyles,
  useTokens,
} from '@ui/kit';
import type { NoteDetailIntents, NoteDetailState } from '@features/notes/types';

export function NoteDetailView({
  state,
  intents,
}: {
  state: NoteDetailState;
  intents: NoteDetailIntents;
}) {
  const t = useTokens();
  const styles = useStyles();
  return (
    <Screen scroll>
      <AppBar
        title={state.title}
        subtitle={state.subtitle}
        variant="push"
        backLabel="笔记"
        onBack={intents.back}
        right={
          state.canOpenSource ? (
            <Button variant="text" size="sm" onPress={intents.openSource}>
              原文
            </Button>
          ) : undefined
        }
      />
      {state.error ? (
        <View style={styles.s0}>
          <Note tone="bad">{state.error}</Note>
          <Button variant="text" onPress={intents.retry}>
            重试
          </Button>
        </View>
      ) : null}
      {state.loading ? (
        <Empty body="正在读取这节笔记…" />
      ) : (
        <>
          <ListSection title="摘要">
            <View style={styles.s1}>
              <Text
                style={{
                  ...t.type.body,
                  color: state.summary ? t.color.ink : t.color.ink3,
                }}
              >
                {state.summary ?? '学完这一节后生成'}
              </Text>
            </View>
          </ListSection>
          {state.qa.length ? (
            <ListSection title="问答">
              {state.qa.map((qa, index) => (
                <View key={index} style={styles.s2}>
                  <Text style={styles.s3}>{qa.q}</Text>
                  <Text style={styles.s4}>{qa.a}</Text>
                </View>
              ))}
            </ListSection>
          ) : null}
          {state.detourQa.length ? (
            <ListSection title="岔路记录">
              {state.detourQa.map((qa, index) => (
                <View key={index} style={styles.s5}>
                  <Text style={styles.s6}>{qa.from}</Text>
                  <Text style={styles.s7}>{qa.q}</Text>
                  <Text style={styles.s8}>{qa.a}</Text>
                </View>
              ))}
            </ListSection>
          ) : null}
          {state.stuck.length ? (
            <ListSection title="卡点">
              {state.stuck.map((s, index) => (
                <View key={index} style={styles.s9}>
                  <Text
                    style={{
                      ...t.type.body,
                      color: s.resolved ? t.color.ink3 : t.color.stuckInk,
                      ...(s.resolved ? decoration.resolved : decoration.plain),
                    }}
                  >
                    {s.text}
                  </Text>
                </View>
              ))}
            </ListSection>
          ) : null}
          {state.highlights.length ? (
            <ListSection title="高亮">
              {state.highlights.map(h => (
                <View key={h.ref} style={styles.s10}>
                  <SourceCard
                    label={h.page}
                    text={h.text}
                    onPress={() => intents.openHighlight(h.ref)}
                  />
                </View>
              ))}
            </ListSection>
          ) : null}
          {state.pins.length ? (
            <ListSection title="问答便签">
              {state.pins.map(p => (
                <Row
                  key={p.ref}
                  title={p.q}
                  subtitle={p.page}
                  onPress={() => intents.openHighlight(p.ref)}
                  chevron
                />
              ))}
            </ListSection>
          ) : null}
          <ListSection title="我的笔记">
            <View style={styles.s11}>
              <Field
                label="自己的理解"
                value={state.userText}
                onChange={intents.setUserText}
                multiline
                placeholder="写点自己的理解…"
              />
              <Text accessibilityLiveRegion="polite" style={styles.s12}>
                {state.saveStatus}
              </Text>
            </View>
          </ListSection>
        </>
      )}
    </Screen>
  );
}

const useStyles = makeStyles(t => ({
  s0: { padding: t.space.pageX },
  s1: { padding: t.space.pageX },
  s2: {
    padding: t.space.pageX,
    gap: t.space.gap,
    borderBottomWidth: 1,
    borderBottomColor: t.color.line,
  },
  s3: { ...t.type.headline, color: t.color.ink },
  s4: { ...t.type.aiBody, color: t.color.ink2 },
  s5: { padding: t.space.pageX, gap: t.space.gap },
  s6: { ...t.type.caption, color: t.color.detour },
  s7: { ...t.type.headline, color: t.color.ink },
  s8: { ...t.type.aiBody, color: t.color.ink2 },
  s9: { padding: t.space.pageX },
  s10: { padding: t.space.pageX },
  s11: { padding: t.space.pageX, gap: t.space.gap },
  s12: { ...t.type.caption, color: t.color.ink3 },
}));

const decoration = {
  resolved: { textDecorationLine: 'line-through' as const },
  plain: { textDecorationLine: 'none' as const },
};
