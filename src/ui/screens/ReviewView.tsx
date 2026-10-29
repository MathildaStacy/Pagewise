import { Text, View } from 'react-native';
import {
  AppBar,
  Button,
  Empty,
  Icon,
  ListSection,
  Note,
  Screen,
  makeStyles,
  usePresentation,
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
  const s = useStyles(),
    t = useTokens();
  const { groupedLists } = usePresentation();
  return (
    <Screen scroll edges={['top', 'left', 'right']}>
      <AppBar variant="root" title="复习" />
      {state.error ? (
        <View style={s.message}>
          <Note tone="bad">{state.error}</Note>
          <Button onPress={intents.retry} variant="text">
            重试
          </Button>
        </View>
      ) : null}
      <View style={s.hero}>
        {[
          [state.hero.due, '今日待复习'],
          [state.hero.stuck, '卡点'],
          [state.hero.total, '闪卡总数'],
        ].map(([value, label], index) => (
          <View key={label} style={s.stat}>
            <Text
              style={[
                s.number,
                groupedLists && index === 0
                  ? s.dueNumber
                  : groupedLists && index === 1
                  ? s.stuckNumber
                  : undefined,
              ]}
            >
              {value}
            </Text>
            <Text style={s.statCaption}>{label}</Text>
          </View>
        ))}
      </View>
      <View style={s.boxes}>
        {state.boxes.map(box => (
          <View key={box.label} style={s.box}>
            <View style={s.boxBar}>
              <View
                style={[
                  s.boxFill,
                  { height: `${Math.max(0, Math.min(1, box.ratio)) * 100}%` },
                ]}
              />
              <Text style={s.boxNumber}>{box.count}</Text>
            </View>
            <Text style={s.boxLabel} numberOfLines={1}>
              {box.label}
            </Text>
          </View>
        ))}
      </View>
      <View style={s.start}>
        <Button
          size="block"
          variant="primary"
          disabled={!state.start.enabled}
          onPress={intents.start}
        >
          {state.start.label}
        </Button>
      </View>
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>卡点清单</Text>
        <Text style={s.caption}>没完全掌握的地方</Text>
      </View>
      <ListSection>
        {state.loading ? (
          <Empty body="正在读取复习卡片…" />
        ) : !state.stuckList.length ? (
          <Empty body="暂时没有卡点。学习时不懂的地方可以记在这里。" />
        ) : (
          state.stuckList.map((item, index) => (
            <View key={item.id} style={s.stuck}>
              {groupedLists && index > 0 ? <View style={s.separator} /> : null}
              <View
                style={[s.badge, item.resolved ? s.badgeResolved : undefined]}
              >
                {groupedLists && item.resolved ? (
                  <Icon name="check" size={14} color={t.color.onAccent} />
                ) : (
                  <Text
                    style={[s.badgeText, item.resolved ? s.good : undefined]}
                  >
                    {item.resolved ? '✓' : '!'}
                  </Text>
                )}
              </View>
              <View style={s.stuckContent}>
                <Text
                  style={[s.stuckTitle, item.resolved ? s.resolved : undefined]}
                >
                  {item.text}
                </Text>
                <Text style={s.caption}>{item.where}</Text>
                {!item.resolved ? (
                  <View style={s.actions}>
                    <Button
                      variant={groupedLists ? 'secondary' : 'ghost'}
                      size="sm"
                      onPress={() => intents.reteach(item.id)}
                    >
                      让 AI 重讲
                    </Button>
                    <Button
                      variant={groupedLists ? 'secondary' : 'ghost'}
                      size="sm"
                      onPress={() => intents.markResolved(item.id)}
                    >
                      已掌握
                    </Button>
                  </View>
                ) : null}
              </View>
            </View>
          ))
        )}
      </ListSection>
    </Screen>
  );
}
const useStyles = makeStyles(t => {
  const grouped = t.layout.groupedLists,
    scale = t.type.body.fontSize / (grouped ? 17 : 14);
  return {
    message: { padding: t.space.pageX },
    hero: {
      flexDirection: 'row',
      paddingVertical: grouped ? 0 : 16,
      paddingHorizontal: grouped ? 0 : 8,
      marginHorizontal: grouped ? 16 : 0,
      marginBottom: grouped ? 10 : 0,
      gap: grouped ? 8 : 0,
      backgroundColor: grouped ? t.color.bg : t.color.surface,
    },
    stat: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: t.color.surface,
      borderRadius: grouped ? t.shape.md : 0 * t.shape.md,
      paddingHorizontal: grouped ? 8 : 0,
      paddingTop: grouped ? 14 : 0,
      paddingBottom: grouped ? 12 : 0,
    },
    number: {
      ...t.type.num,
      fontSize: (grouped ? 30 : 26) * scale,
      lineHeight: (grouped ? 33 : 31.2) * scale,
      fontWeight: grouped ? '700' : '600',
      color: t.color.ink,
    },
    dueNumber: { color: t.color.accent },
    stuckNumber: { color: t.color.stuck },
    caption: {
      ...t.type.caption,
      lineHeight: (grouped ? 18.85 : 18) * scale,
      color: grouped ? t.color.ink2 : t.color.ink3,
    },
    statCaption: {
      ...t.type.caption,
      fontSize: 12 * scale,
      lineHeight: (grouped ? 17.4 : 18) * scale,
      color: grouped ? t.color.ink2 : t.color.ink3,
    },
    boxes: {
      flexDirection: 'row',
      gap: grouped ? 8 : 6,
      paddingHorizontal: 14,
      paddingTop: grouped ? 14 : 4,
      paddingBottom: grouped ? 12 : 14,
      marginHorizontal: grouped ? 16 : 0,
      marginBottom: grouped ? 12 : 0,
      borderRadius: grouped ? t.shape.md : 0 * t.shape.md,
      backgroundColor: t.color.surface,
    },
    box: { flex: 1 },
    boxBar: {
      height: grouped ? 56 : 44,
      borderRadius: grouped ? t.shape.sm : t.shape.md / 2,
      backgroundColor: grouped ? t.color.surfaceFill : t.color.bg,
      marginBottom: grouped ? 5 : 4,
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
    },
    boxFill: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: grouped ? t.color.accent : t.color.stepCur,
      opacity: grouped ? 0.85 : 1,
      borderTopLeftRadius: grouped ? t.shape.sm : 0 * t.shape.sm,
      borderTopRightRadius: grouped ? t.shape.sm : 0 * t.shape.sm,
    },
    boxNumber: {
      ...t.type.num,
      fontSize: (grouped ? 15 : 13) * scale,
      lineHeight: (grouped ? 21.75 : 19.5) * scale,
      fontWeight: '600',
      color: t.color.ink,
    },
    boxLabel: {
      ...t.type.micro,
      fontSize: 11 * scale,
      lineHeight: (grouped ? 15.95 : 16.5) * scale,
      fontWeight: '400',
      color: grouped ? t.color.ink2 : t.color.ink3,
      textAlign: 'center',
    },
    start: {
      paddingHorizontal: t.space.pageX,
      paddingBottom: grouped ? 0 : 14,
      marginBottom: grouped ? 26 : 8,
      backgroundColor: grouped ? t.color.bg : t.color.surface,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: grouped ? 'baseline' : 'center',
      paddingHorizontal: grouped ? 20 : 14,
      paddingTop: grouped ? 0 : 12,
      paddingBottom: grouped ? 8 : 6,
      backgroundColor: grouped ? t.color.bg : t.color.surface,
    },
    sectionTitle: {
      ...t.type.body,
      fontSize: (grouped ? 20 : 15) * scale,
      lineHeight: (grouped ? 29 : 22.5) * scale,
      fontWeight: grouped ? '700' : '600',
      color: t.color.ink,
    },
    stuck: {
      flexDirection: 'row',
      gap: grouped ? 12 : 10,
      paddingVertical: grouped ? 13 : 12,
      paddingHorizontal: t.space.pageX,
      borderBottomWidth: grouped ? 0 : 1,
      borderBottomColor: t.color.line,
      backgroundColor: t.color.surface,
    },
    separator: {
      position: 'absolute',
      top: 0,
      right: 0,
      left: 52,
      height: 0.5,
      backgroundColor: t.color.line,
    },
    badge: {
      width: grouped ? 24 : 22,
      height: grouped ? 24 : 22,
      marginTop: grouped ? 0 : 1,
      borderRadius: t.shape.pill,
      backgroundColor: grouped ? t.color.stuck : t.color.stuckBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeResolved: { backgroundColor: grouped ? t.color.ok : t.color.okBg },
    badgeText: {
      ...t.type.caption,
      fontSize: (grouped ? 14 : 12) * scale,
      fontWeight: '700',
      color: grouped ? t.color.onAccent : t.color.stuck,
    },
    good: { color: grouped ? t.color.onAccent : t.color.ok },
    stuckContent: { flex: 1 },
    stuckTitle: {
      ...t.type.body,
      fontSize: (grouped ? 16 : 14) * scale,
      lineHeight: (grouped ? 23.2 : 21) * scale,
      fontWeight: grouped ? '400' : '500',
      color: t.color.ink,
    },
    resolved: {
      textDecorationLine: 'line-through',
      color: grouped ? t.color.ink2 : t.color.ink3,
    },
    actions: {
      flexDirection: 'row',
      gap: grouped ? 8 : 6,
      marginTop: grouped ? 9 : 8,
      flexWrap: 'wrap',
    },
  };
});
