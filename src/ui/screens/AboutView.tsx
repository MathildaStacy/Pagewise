import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Icon, makeStyles, useTokens, usePresentation } from '@ui/kit';
import type { AboutState, AboutIntents } from '@features/settings/types';
import {
  SettingsFrame,
  SettingsGroup,
  SettingsRow,
  SettingsAction,
  SettingsNote,
} from './MeView';
const privacy =
  '本地优先，没有后端：书和学习记录只存在手机上。书只在两种情况下离开手机：上传给 MinerU 解析（你确认后），以及当前讲解需要的小节原文发给你配置的 AI 服务。';
export function AboutView({
  state,
  intents,
}: {
  state: AboutState;
  intents: AboutIntents;
}) {
  const t = useTokens(),
    { groupedLists } = usePresentation(),
    s = useStyles(groupedLists),
    [tools, setTools] = useState(false);
  return (
    <SettingsFrame title="关于" state={state} back={intents.back}>
      <View style={s.hero}>
        {groupedLists ? (
          <View style={s.logo}>
            <Icon name="logo" size={44} color={t.color.continueInk} />
          </View>
        ) : null}
        <Text style={s.brand}>Pagewise</Text>
        <Pressable
          accessibilityRole={state.development ? 'button' : undefined}
          accessibilityLabel={
            state.development ? '版本号，长按打开开发工具' : undefined
          }
          onLongPress={
            state.development ? () => setTools(value => !value) : undefined
          }
          hitSlop={8}
        >
          <Text style={s.tagline}>带着整本书的 AI 伴读 · {state.version}</Text>
        </Pressable>
        {!groupedLists ? <SettingsNote>{privacy}</SettingsNote> : null}
      </View>
      {groupedLists ? (
        <>
          <SettingsGroup>
            <View style={s.privacyBox}>
              <Text style={s.privacy}>{privacy}</Text>
            </View>
          </SettingsGroup>
          <SettingsGroup>
            <SettingsRow
              title="版本"
              right={<Text style={s.value}>{state.version}</Text>}
            />
            <SettingsRow
              title="开源协议"
              right={<Text style={s.value}>GPL-3.0</Text>}
            />
          </SettingsGroup>
        </>
      ) : null}
      {state.demo ? (
        <SettingsGroup>
          <SettingsAction label="退出演示" onPress={intents.demo} />
        </SettingsGroup>
      ) : null}
      {tools && state.development ? (
        <SettingsGroup title="开发与体验">
          {!state.demo ? (
            <SettingsAction label="体验演示书库" onPress={intents.demo} />
          ) : null}
          <SettingsAction label="组件与页面对照" onPress={intents.gallery} />
          <SettingsAction label="导出日志" onPress={intents.exportLogs} />
        </SettingsGroup>
      ) : null}
    </SettingsFrame>
  );
}
const useStyles = (g: boolean) =>
  makeStyles(t => ({
    hero: {
      alignItems: 'center',
      paddingHorizontal: g ? 24 : 16,
      paddingTop: g ? 10 : 24,
      paddingBottom: 24,
      backgroundColor: g ? undefined : t.color.surface,
    },
    logo: {
      backgroundImage: `linear-gradient(140deg, ${t.color.brandStart}, ${t.color.brandEnd})`,
      width: 84,
      height: 84,
      borderRadius: t.shape.md,
      marginBottom: 12,
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: `0 10px 26px ${t.settingsIcons.appearance}4D`,
    },
    brand: {
      ...t.type.largeTitle,
      fontSize: g
        ? t.type.continueTitle.fontSize
        : t.type.largeTitle.fontSize + 2,
      lineHeight: g ? 34.8 : 33,
      fontWeight: '700',
      color: g ? t.color.ink : t.color.accent,
    },
    tagline: {
      ...t.type.caption,
      color: t.color.ink2,
      marginTop: g ? 2 : 4,
      marginBottom: g ? 0 : 14,
    },
    privacyBox: { padding: 16 },
    privacy: {
      ...t.type.body,
      fontSize: t.type.caption.fontSize + 1,
      lineHeight: 24.5,
      color: t.color.ink,
    },
    value: { ...t.type.label, color: t.color.ink2, fontWeight: '400' },
  }))();
