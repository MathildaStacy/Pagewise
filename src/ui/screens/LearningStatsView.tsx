import { Text, View } from 'react-native';
import {
  AppBar,
  Cover,
  Gradient,
  Icon,
  Note,
  ProgressRing,
  Screen,
  Segmented,
  Switch,
  makeStyles,
  useTokens,
} from '@ui/kit';
import type { HomeState, HomeIntents } from '@features/home/types';
import { SettingsGroup, SettingsRow } from './MeView';

export function LearningStatsView({
  state,
  intents,
  back,
}: {
  state: HomeState;
  intents: HomeIntents;
  back(): void;
}) {
  const s = useStyles(),
    t = useTokens(),
    stats = state.stats;
  const date = new Date(state.date + 'T12:00:00');
  const offset =
    (new Date(date.getFullYear(), date.getMonth(), 1).getDay() + 6) % 7;
  const maximum = Math.max(...stats.week, 1);
  return (
    <Screen scroll>
      <AppBar
        title="学习记录"
        subtitle="最近 30 天"
        variant="push"
        onBack={back}
      />
      {state.error ? (
        <View style={s.pad}>
          <Note tone="bad">{state.error}</Note>
        </View>
      ) : null}
      <View style={s.streak}>
        <Icon name="fire" variant="color" size={64} />
        <View style={s.grow}>
          <Text style={s.big}>
            {stats.streak}
            <Text style={s.small}> 天</Text>
          </Text>
          <Text style={s.small}>连续学习 · 最长 {stats.best} 天</Text>
        </View>
        <ProgressRing
          value={stats.today / state.goal}
          color={t.color.stuck}
          colors={t.brand?.fire}
          track={t.color.line}
        >
          <Text style={s.ringNumber}>{stats.today}</Text>
          <Text style={s.ringLabel}>/{state.goal} 分</Text>
        </ProgressRing>
      </View>
      <SettingsGroup
        title={`本周 · ${stats.week.reduce((n, m) => n + m, 0)} 分钟`}
      >
        <View style={s.week}>
          {stats.week.map((minutes, i) => (
            <View
              key={i}
              accessibilityLabel={`周${'一二三四五六日'[i]} ${minutes} 分钟`}
              style={s.weekDay}
            >
              <Text style={s.minute}>{minutes || ''}</Text>
              <Gradient
                colors={
                  minutes
                    ? t.brand?.ai ?? [t.color.accent, t.color.detour]
                    : [t.color.line, t.color.line]
                }
                style={[
                  s.weekBar,
                  { height: Math.max(4, (minutes / maximum) * 96) },
                ]}
              />
              <Text style={s.small}>{'一二三四五六日'[i]}</Text>
            </View>
          ))}
        </View>
      </SettingsGroup>
      <SettingsGroup title={`${date.getMonth() + 1} 月`}>
        <View style={s.heat}>
          <View style={s.calendar}>
            {'一二三四五六日'.split('').map(day => (
              <View key={day} style={s.cellSlot}>
                <Text style={s.weekday}>{day}</Text>
              </View>
            ))}
          </View>
          <View style={s.calendar}>
            {Array.from({ length: offset }, (_, i) => (
              <View key={`pad${i}`} style={s.cellSlot} />
            ))}
            {stats.month.map((minutes, i) => (
              <View
                key={i}
                accessibilityLabel={`${date.getMonth() + 1} 月 ${
                  i + 1
                } 日 · ${minutes} 分钟`}
                style={s.cellSlot}
              >
                <Gradient
                  colors={
                    t.brand?.heat
                      ? t.brand.heat[
                          minutes >= 30
                            ? 3
                            : minutes >= 18
                            ? 2
                            : minutes > 0
                            ? 1
                            : 0
                        ]
                      : minutes >= 30
                      ? [t.color.brandEnd, t.brand?.ai[2] ?? t.color.detour]
                      : [
                          minutes >= 18
                            ? t.color.detour
                            : minutes > 0
                            ? t.color.accentBg
                            : t.color.line,
                          minutes >= 18
                            ? t.color.detour
                            : minutes > 0
                            ? t.color.accentBg
                            : t.color.line,
                        ]
                  }
                  style={[s.cell, i + 1 === date.getDate() && s.today]}
                >
                  <Text style={[s.cellText, minutes >= 18 && s.cellTextOn]}>
                    {i + 1}
                  </Text>
                </Gradient>
              </View>
            ))}
          </View>
          <View style={s.legend}>
            <Text style={s.legendText}>少</Text>
            {(
              t.brand?.heat ?? [
                [t.color.line, t.color.line],
                [t.color.accentBg, t.color.accentBg],
                [t.color.detour, t.color.detour],
                [t.color.brandEnd, t.color.detour],
              ]
            ).map((colors, i) => (
              <Gradient key={i} colors={colors} style={s.legendCell} />
            ))}
            <Text style={s.legendText}>多</Text>
          </View>
        </View>
      </SettingsGroup>
      <View style={s.tiles}>
        {[
          {
            icon: 'check' as const,
            n: stats.totals.sections,
            label: '学完的小节',
          },
          { icon: 'cards' as const, n: stats.totals.cards, label: '闪卡' },
          { icon: 'help' as const, n: stats.totals.asks, label: '次提问' },
          { icon: 'branch' as const, n: stats.totals.detours, label: '次岔路' },
        ].map(item => (
          <View key={item.label} style={s.tile}>
            <Icon name={item.icon} variant="color" size={32} />
            <Text style={s.tileNumber}>{item.n}</Text>
            <Text style={s.small}>{item.label}</Text>
          </View>
        ))}
      </View>
      <SettingsGroup title="每本书">
        {state.books.map(book => (
          <SettingsRow
            key={book.id}
            title={book.title}
            icon={<Cover {...book.cover} size="sm" />}
            right={<Text style={s.small}>{book.progressLabel}</Text>}
          >
            <View style={s.progress}>
              <View
                style={[s.progressFill, { width: `${book.progress * 100}%` }]}
              />
            </View>
          </SettingsRow>
        ))}
      </SettingsGroup>
      <SettingsGroup
        title="每日目标"
        note="时长只统计听讲和读书页在前台的时间。"
      >
        <SettingsRow
          title="每天学习"
          subtitle="达成后「连续学习」加一天"
          right={
            <View style={s.segment}>
              <Segmented
                options={['10', '20', '30'].map(key => ({ key, label: key }))}
                value={String(state.goal)}
                onChange={intents.goal}
              />
            </View>
          }
        />
        <SettingsRow
          title="每天提醒"
          subtitle={
            state.demo
              ? '21:00 · 本机通知，不联网'
              : '本机通知尚未接入，可在演示书库预览'
          }
          right={
            <Switch
              value={state.reminder}
              disabled={!state.demo}
              onChange={intents.reminder}
              accessibilityLabel="每天提醒"
            />
          }
        />
      </SettingsGroup>
    </Screen>
  );
}
const useStyles = makeStyles(t => ({
  pad: { padding: 16 },
  grow: { flex: 1, minWidth: 0 },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 16,
    borderRadius: t.shape.lg,
    backgroundColor: t.brand?.card ?? t.color.glass,
    borderWidth: 1,
    borderColor: t.brand?.stroke ?? t.color.line,
    ...t.elevation.card,
  },
  big: {
    ...t.type.largeTitle,
    fontSize: t.type.largeTitle.fontSize + 10,
    lineHeight: 44,
    color: t.color.ink,
  },
  small: { ...t.type.caption, color: t.color.ink2 },
  ringNumber: { ...t.type.title, color: t.color.ink },
  ringLabel: {
    ...t.type.caption,
    fontSize: t.type.caption.fontSize - 2,
    color: t.color.ink2,
  },
  week: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 160,
    gap: 8,
    padding: 14,
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  weekBar: {
    width: '100%',
    maxWidth: 28,
    borderTopLeftRadius: t.shape.md,
    borderTopRightRadius: t.shape.md,
    borderBottomLeftRadius: t.shape.sm,
    borderBottomRightRadius: t.shape.sm,
  },
  minute: { ...t.type.caption, color: t.color.ink2 },
  heat: { padding: 12 },
  calendar: { flexDirection: 'row', flexWrap: 'wrap' },
  cellSlot: { width: '14.2857%', padding: 2.5, alignItems: 'center' },
  weekday: { ...t.type.caption, color: t.color.ink3, paddingBottom: 4 },
  cell: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: t.shape.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  today: { borderWidth: 2, borderColor: t.color.accent },
  cellText: { ...t.type.caption, color: t.color.ink2 },
  cellTextOn: { color: t.color.onAccent },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 10,
  },
  legendText: {
    ...t.type.caption,
    fontSize: t.type.caption.fontSize - 1.5,
    color: t.color.ink3,
  },
  legendCell: { width: 12, height: 12, borderRadius: t.shape.xs - 1 },
  tiles: {
    marginHorizontal: 16,
    marginBottom: 20,
    gap: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tile: {
    flexGrow: 1,
    flexBasis: '21%',
    minWidth: 70,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    borderRadius: t.shape.lg,
    backgroundColor: t.color.glass,
  },
  tileNumber: {
    ...t.type.largeTitle,
    fontSize: t.type.largeTitle.fontSize - 6,
    lineHeight: 30,
    color: t.color.ink,
  },
  progress: {
    height: 4,
    borderRadius: t.shape.pill,
    backgroundColor: t.color.line,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: t.color.accent },
  segment: { width: 132 },
}));
