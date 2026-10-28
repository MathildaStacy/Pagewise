import { Text, View } from 'react-native';
import {
  AppBar,
  ListSection,
  Row,
  Screen,
  Segmented,
  Note,
  useTokens,
} from '@ui/kit';
import type {
  AppearanceState,
  AppearanceIntents,
} from '@features/appearance/types';

export function MeAppearanceView({
  state,
  intents,
}: {
  state: AppearanceState;
  intents: AppearanceIntents;
}) {
  const t = useTokens();
  return (
    <Screen scroll>
      <AppBar
        title="外观"
        variant="push"
        onBack={intents.back}
        backLabel="组件对照"
      />
      <ListSection title="皮肤" note="切换即时生效，学习位置保持不变">
        <Row title="界面风格" subtitle="纸感 · 温暖克制 / 苹果风 · 通透轻盈" />
        <View style={{ padding: t.space.pageX }}>
          <Segmented
            accessibilityLabel="皮肤"
            options={state.skinOptions}
            value={state.skin}
            onChange={intents.setSkin}
          />
        </View>
      </ListSection>
      <ListSection title="深浅色">
        <View style={{ padding: t.space.pageX }}>
          <Segmented
            accessibilityLabel="深浅色"
            options={state.schemeOptions}
            value={state.scheme}
            onChange={intents.setScheme}
          />
        </View>
      </ListSection>
      <ListSection title="读书正文字号" note="只影响重排原文和 AI 讲解正文">
        <View style={{ padding: t.space.pageX, gap: t.space.gap }}>
          <Segmented
            accessibilityLabel="正文字号"
            options={state.sizeOptions}
            value={state.readingSize}
            onChange={intents.setSize}
          />
          <Text
            style={{
              ...t.type.bookBody,
              color: t.color.paperInk,
              backgroundColor: t.color.paper,
              padding: t.space.pageX,
              borderRadius: t.shape.md,
            }}
          >
            读书，一步一步弄懂。原书用衬线字体，讲解用清晰的界面字体。
          </Text>
          <Text style={{ ...t.type.aiBody, color: t.color.ink }}>
            先讲直觉，再讲公式，举例、提问。
          </Text>
        </View>
      </ListSection>
      <View style={{ padding: t.space.pageX }}>
        <Note tone="neutral">所有按钮和文字跟随系统字号。</Note>
      </View>
    </Screen>
  );
}
