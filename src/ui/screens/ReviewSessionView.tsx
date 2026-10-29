import { Text, View } from 'react-native';
import {
  AppBar,
  Button,
  Empty,
  FlashCard,
  Note,
  Screen,
  makeStyles,
} from '@ui/kit';
import type {
  ReviewSessionIntents,
  ReviewSessionState,
} from '@features/review/types';

export function ReviewSessionView({
  state,
  intents,
}: {
  state: ReviewSessionState;
  intents: ReviewSessionIntents;
}) {
  const styles = useStyles();
  return (
    <Screen scroll>
      <AppBar
        title={state.title}
        variant="push"
        backLabel="复习"
        onBack={intents.back}
      />
      <View style={styles.s0}>
        {state.error ? (
          <>
            <Note tone="bad">{state.error}</Note>
            <Button variant="text" onPress={intents.retry}>
              重试
            </Button>
          </>
        ) : null}
        {state.loading ? <Empty body="正在读取卡片…" /> : null}
        {state.card ? (
          <>
            <View style={styles.s1}>
              <Text style={styles.s2}>{state.card.source}</Text>
              <Text style={styles.s3}>{state.card.box}</Text>
            </View>
            <FlashCard
              front={state.card.front}
              back={state.card.back ?? ''}
              flipped={state.card.flipped}
              onFlip={intents.flip}
            />
            {!state.card.flipped ? (
              <Text style={styles.s4}>{state.card.tip}</Text>
            ) : (
              <View style={styles.s5}>
                {state.card.canOpenSource ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={intents.openSource}
                  >
                    回到原文
                  </Button>
                ) : null}
                <Button variant="ghost" size="sm" onPress={intents.askAi}>
                  问 AI
                </Button>
              </View>
            )}
            {state.rate ? (
              <View style={styles.s6}>
                {state.rate.map(rate => (
                  <View key={rate.key} style={styles.s7}>
                    <Button
                      variant={rate.key === 'good' ? 'primary' : 'secondary'}
                      disabled={state.busy}
                      onPress={() => intents.rate(rate.key)}
                    >
                      {rate.label}
                    </Button>
                    <Text style={styles.s8}>{rate.sub}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : null}
        {state.finished ? (
          <>
            <Empty title={state.finished.title} body={state.finished.text} />
            <Button size="block" onPress={intents.done}>
              完成
            </Button>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles(t => ({
  s0: { padding: t.space.pageX, gap: t.space.sectionGap },
  s1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: t.space.gap,
  },
  s2: { ...t.type.caption, color: t.color.ink2, flex: 1 },
  s3: { ...t.type.caption, color: t.color.ink2 },
  s4: {
    ...t.type.caption,
    color: t.color.ink3,
    textAlign: 'center',
  },
  s5: {
    flexDirection: 'row',
    gap: t.space.gap,
    flexWrap: 'wrap',
  },
  s6: { flexDirection: 'row', gap: t.space.gap },
  s7: { flex: 1, gap: t.space.gap },
  s8: {
    ...t.type.caption,
    color: t.color.ink2,
    textAlign: 'center',
  },
}));
