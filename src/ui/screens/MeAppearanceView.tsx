import { Pressable, Text, View } from 'react-native';
import {
  Icon,
  SkinProvider,
  makeStyles,
  useTokens,
  usePresentation,
} from '@ui/kit';
import type {
  AppearanceState,
  AppearanceIntents,
} from '@features/appearance/types';
import {
  SettingsFrame,
  SettingsGroup,
  SettingsRow,
  SettingsSegmented,
  useSettingsStyles,
} from './MeView';
function SkinPreview({ glass }: { glass: boolean }) {
  const t = useTokens();
  return (
    <SkinProvider
      skinId={glass ? 'glass' : 'paper'}
      scheme={glass ? t.scheme : 'light'}
      reduceMotion
    >
      <PreviewContent />
    </SkinProvider>
  );
}
function PreviewContent() {
  const { groupedLists } = usePresentation(),
    s = usePreviewStyles(groupedLists);
  return (
    <View style={s.frame}>
      <View style={groupedLists ? s.largeTitle : s.nav} />
      <View style={s.card} />
      {[0, 1, ...(!groupedLists ? [2] : [])].map(i => (
        <View key={i} style={[s.line, !groupedLists && i === 2 && s.short]} />
      ))}
      <View style={s.tabBar} />
    </View>
  );
}
export function MeAppearanceView({
  state,
  intents,
}: {
  state: AppearanceState;
  intents: AppearanceIntents;
}) {
  const t = useTokens(),
    { groupedLists } = usePresentation(),
    s = useStyles(groupedLists),
    common = useSettingsStyles();
  return (
    <SettingsFrame
      title="外观"
      state={{ loading: false, saving: false, error: state.error ?? undefined }}
      back={intents.back}
    >
      <View style={s.skinGroup}>
        <Text style={[common.groupTitle, s.heading]}>皮肤</Text>
        <View style={s.grid}>
          {state.skinOptions.map(option => (
            <Pressable
              key={option.key}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: state.skin === option.key }}
              onPress={() => intents.setSkin(option.key)}
              hitSlop={4}
              style={[
                s.skinCard,
                {
                  borderColor:
                    state.skin === option.key
                      ? t.color.accent
                      : t.color.surface,
                },
              ]}
            >
              <SkinPreview glass={option.key === 'glass'} />
              <Text style={s.skinName}>{option.label}</Text>
              <Text style={s.skinDescription}>
                {option.key === 'glass' ? '毛玻璃 · 圆角' : '默认'}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={[common.groupFoot, s.skinFoot]}>
          换皮肤只改样子，功能、页面和按钮位置都一样。
        </Text>
      </View>
      <SettingsGroup title="深浅色">
        {state.schemeOptions.map(option => (
          <SettingsRow
            key={option.key}
            title={option.label}
            onPress={() => intents.setScheme(option.key)}
            right={
              state.scheme === option.key ? (
                <Icon name="check" color={t.color.accent} size={22} />
              ) : undefined
            }
          />
        ))}
      </SettingsGroup>
      <SettingsGroup
        title="读书正文字号"
        note={groupedLists ? '只影响重排模式和讲解正文。' : undefined}
      >
        <View style={s.fontField}>
          <SettingsSegmented
            label="正文字号"
            options={state.sizeOptions}
            value={state.readingSize}
            onChange={intents.setSize}
          />
          <Text style={s.sample}>
            可容许的启发式函数从不高估到达目标的代价。
          </Text>
        </View>
      </SettingsGroup>
    </SettingsFrame>
  );
}
const usePreviewStyles = (g: boolean) =>
  makeStyles(t => ({
    frame: {
      height: 150,
      borderRadius: g ? t.shape.sm + 4 : t.shape.sm + 6,
      marginBottom: 10,
      overflow: 'hidden',
      backgroundColor: t.color.bg,
      boxShadow: g ? undefined : `inset 0 0 0 1px ${t.color.line}`,
    },
    largeTitle: {
      height: 12,
      width: '50%',
      marginTop: 12,
      marginLeft: 10,
      marginBottom: 6,
      borderRadius: t.shape.xs - 2,
      backgroundColor: t.color.ink,
      opacity: 0.85,
    },
    nav: {
      height: 20,
      backgroundColor: t.color.surface,
      borderBottomWidth: 1,
      borderColor: t.color.line,
    },
    card: {
      marginHorizontal: 8,
      marginTop: g ? 0 : 8,
      height: 42,
      borderRadius: g ? t.shape.sm + 4 : t.shape.sm,
      backgroundImage: `linear-gradient(${g ? 140 : 135}deg, ${
        g ? t.color.brandStart : t.color.accent
      }, ${g ? t.color.brandEnd : t.color.accentEnd})`,
    },
    line: {
      marginTop: g ? 7 : 6,
      marginHorizontal: 8,
      height: g ? 16 : 8,
      borderRadius: g ? t.shape.xs + 1 : t.shape.xs - 1,
      backgroundColor: t.color.surface,
    },
    short: { width: '60%' },
    tabBar: {
      position: 'absolute',
      bottom: g ? 8 : 0,
      left: g ? 12 : 0,
      right: g ? 12 : 0,
      height: 18,
      borderRadius: g ? t.shape.sm - 1 : undefined,
      backgroundColor: g ? t.color.glass : t.color.surface,
      borderTopWidth: g ? 0 : 1,
      borderColor: t.color.line,
      ...(g ? t.elevation.pop : {}),
      boxShadow: g ? `inset 0 0 0 0.5px ${t.color.glassLine}` : undefined,
    },
  }))();
const useStyles = (g: boolean) =>
  makeStyles(t => ({
    skinGroup: { marginHorizontal: g ? 16 : 14, marginBottom: g ? 24 : 8 },
    heading: {
      paddingHorizontal: g ? 16 : 0,
      paddingTop: g ? 0 : 12,
      paddingBottom: g ? 7 : 6,
    },
    grid: { flexDirection: 'row', gap: 12 },
    skinCard: {
      flex: 1,
      backgroundColor: t.color.surface,
      borderRadius: t.shape.md,
      padding: 12,
      borderWidth: 2,
    },
    skinName: {
      ...t.type.label,
      fontSize: g ? t.type.label.fontSize : t.type.headline.fontSize,
      fontWeight: '600',
      color: t.color.ink,
      textAlign: 'center',
    },
    skinDescription: {
      ...t.type.caption,
      fontSize: g ? t.type.micro.fontSize : t.type.caption.fontSize,
      fontWeight: '400',
      color: t.color.ink2,
      textAlign: 'center',
    },
    skinFoot: { paddingHorizontal: g ? 16 : 0, paddingTop: 7, marginTop: 8 },
    fontField: {
      paddingHorizontal: g ? 16 : 14,
      paddingTop: 10,
      paddingBottom: g ? 11 : 10,
    },
    sample: {
      ...t.type.bookBody,
      color: t.color.ink,
      marginTop: 12,
      lineHeight: t.type.bookBody.fontSize * 1.8,
    },
  }))();
