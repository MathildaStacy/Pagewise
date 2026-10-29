import { Text, View } from 'react-native';
import {
  AppBar,
  BoxChart,
  Button,
  Empty,
  ListSection,
  Note,
  Screen,
  Tag,
  makeStyles,
  useTokens,
} from '@ui/kit';
import type { ReviewIntents, ReviewState } from '@features/review/types';

export function ReviewView({
  state,
  intents,
}: {
  state: ReviewState;
  intents: ReviewIntents;
}) {
  const t = useTokens();
  const styles = useStyles();
  return (
    <Screen scroll edges={['top', 'left', 'right']}>
      <AppBar variant="root" title="复习" />
      {state.error ? (
        <View style={styles.s0}>
          <Note tone="bad">{state.error}</Note>
          <Button onPress={intents.retry} variant="text">
            重试
          </Button>
        </View>
      ) : null}
      <View style={styles.s1}>
        <View style={styles.s2}>
          {[
            [state.hero.due, '今日待复习'],
            [state.hero.stuck, '卡点'],
            [state.hero.total, '闪卡总数'],
          ].map(([value, label]) => (
            <View key={label} style={styles.s3}>
              <Text style={styles.s4}>{value}</Text>
              <Text style={styles.s5}>{label}</Text>
            </View>
          ))}
        </View>
        <BoxChart boxes={state.boxes.map(b => b.count)} />
        <View style={styles.s6}>
          {state.boxes.map(box => (
            <Text key={box.label} style={styles.s7}>
              {box.label}
            </Text>
          ))}
        </View>
        <Button
          size="block"
          disabled={!state.start.enabled}
          onPress={intents.start}
        >
          {state.start.label}
        </Button>
      </View>
      <ListSection title="卡点清单" note="没完全掌握的地方">
        {state.loading ? (
          <Empty body="正在读取复习卡片…" />
        ) : !state.stuckList.length ? (
          <Empty body="暂时没有卡点。学习时不懂的地方可以记在这里。" />
        ) : (
          state.stuckList.map(item => (
            <View key={item.id} style={styles.s8}>
              <View style={styles.s9}>
                <Tag
                  tone={item.resolved ? 'ok' : 'stuck'}
                  label={item.resolved ? '✓' : '!'}
                />
                <View style={styles.s10}>
                  <Text
                    style={{
                      ...t.type.body,
                      color: item.resolved ? t.color.ink3 : t.color.ink,
                      ...(item.resolved
                        ? decoration.resolved
                        : decoration.plain),
                    }}
                  >
                    {item.text}
                  </Text>
                  <Text style={styles.s11}>{item.where}</Text>
                </View>
              </View>
              {!item.resolved ? (
                <View style={styles.s12}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={() => intents.reteach(item.id)}
                  >
                    让 AI 重讲
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={() => intents.markResolved(item.id)}
                  >
                    已掌握
                  </Button>
                </View>
              ) : null}
            </View>
          ))
        )}
      </ListSection>
    </Screen>
  );
}

const useStyles = makeStyles(t => ({
  s0: { padding: t.space.pageX },
  s1: {
    padding: t.space.pageX,
    gap: t.space.sectionGap,
    backgroundColor: t.color.surface,
  },
  s2: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: t.space.gap,
  },
  s3: { flex: 1, alignItems: 'center', gap: t.space.gap },
  s4: {
    ...t.type.largeTitle,
    ...t.type.num,
    color: t.color.accentInk,
  },
  s5: { ...t.type.caption, color: t.color.ink2 },
  s6: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.gap },
  s7: { ...t.type.micro, color: t.color.ink2 },
  s8: {
    padding: t.space.pageX,
    gap: t.space.gap,
    borderBottomWidth: 1,
    borderBottomColor: t.color.line,
  },
  s9: {
    flexDirection: 'row',
    gap: t.space.gap,
    alignItems: 'flex-start',
  },
  s10: { flex: 1, gap: t.space.gap },
  s11: { ...t.type.caption, color: t.color.ink2 },
  s12: {
    flexDirection: 'row',
    gap: t.space.gap,
    flexWrap: 'wrap',
  },
}));

const decoration = {
  resolved: { textDecorationLine: 'line-through' as const },
  plain: { textDecorationLine: 'none' as const },
};
