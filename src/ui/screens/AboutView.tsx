import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ListSection, Row, Note, Button, Icon, useTokens } from '@ui/kit';
import type { AboutState, AboutIntents } from '@features/settings/types';
import { SettingsFrame } from './MeView';
export function AboutView({
  state,
  intents,
}: {
  state: AboutState;
  intents: AboutIntents;
}) {
  const t = useTokens();
  return (
    <SettingsFrame title="关于 Pagewise" state={state} back={intents.back}>
      <View
        style={[
          styles.hero,
          {
            padding: t.space.pageX,
            paddingVertical: t.space.sectionGap,
            gap: t.space.gap,
          },
        ]}
      >
        <Icon name="bookOpen" size={40} color={t.color.accent} />
        <Text style={{ ...t.type.largeTitle, color: t.color.ink }}>
          Pagewise
        </Text>
        <Text style={{ ...t.type.body, color: t.color.ink2 }}>
          带着整本书的 AI 伴读
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="版本号，长按打开组件对照"
          onLongPress={state.development ? intents.gallery : undefined}
        >
          <Text style={{ ...t.type.caption, color: t.color.ink3 }}>
            版本 {state.version}
          </Text>
        </Pressable>
      </View>
      <View style={{ padding: t.space.pageX }}>
        <Note tone="neutral">
          本地优先，没有后端：书和学习记录只存在手机上。你确认后，PDF 会上传给
          MinerU 解析；讲解时，当前小节原文会发给你配置的 AI 服务。
        </Note>
      </View>
      <ListSection>
        <Row title="开源协议" subtitle="GPL-3.0-only" />
      </ListSection>
      {state.development ? (
        <ListSection title="开发与体验">
          <View style={{ padding: t.space.pageX, gap: t.space.gap }}>
            <Button
              variant="secondary"
              label={state.demo ? '退出演示，返回我的书库' : '体验演示书库'}
              onPress={intents.demo}
            />
            <Button
              variant="ghost"
              label="组件与页面对照"
              onPress={intents.gallery}
            />
            <Button
              variant="ghost"
              label="导出日志"
              onPress={intents.exportLogs}
            />
          </View>
        </ListSection>
      ) : null}
    </SettingsFrame>
  );
}

const styles = StyleSheet.create({ hero: { alignItems: 'center' } });
