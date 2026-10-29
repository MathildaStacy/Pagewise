import { View } from 'react-native';
import { Row, Switch, Segmented, Field, ListSection, useTokens } from '@ui/kit';
import type {
  PrefsState,
  PrefsIntents,
  TeachPrefs,
} from '@features/settings/types';
import { SettingsFrame } from './MeView';
const switches: {
  key: Exclude<keyof TeachPrefs, 'length' | 'extra'>;
  title: string;
  subtitle: string;
}[] = [
  {
    key: 'intuitionFirst',
    title: '先讲直觉，再讲公式',
    subtitle: '关掉后先给定义和公式',
  },
  {
    key: 'askEachStep',
    title: '每段结尾提一个问题',
    subtitle: '确认你懂了再往下讲',
  },
  {
    key: 'quizAtEnd',
    title: '一节讲完做小测',
    subtitle: '答错会换个角度再讲一次',
  },
  {
    key: 'bilingual',
    title: '术语中英对照',
    subtitle: '例如：可容许的（admissible）',
  },
  {
    key: 'recap',
    title: '续学回顾',
    subtitle: '隔天打开时先回顾上次进度和卡点',
  },
];
export function MePrefsView({
  state,
  intents,
}: {
  state: PrefsState;
  intents: PrefsIntents;
}) {
  const t = useTokens();
  return (
    <SettingsFrame title="讲解偏好" state={state} back={intents.back}>
      <ListSection>
        {switches.map(row => (
          <Row
            key={row.key}
            title={row.title}
            subtitle={row.subtitle}
            right={
              <Switch
                accessibilityLabel={row.title}
                value={state.prefs[row.key]}
                disabled={state.loading}
                onChange={value => intents.set(row.key, value)}
              />
            }
          />
        ))}
      </ListSection>
      <ListSection
        title="每段讲解长度"
        note="短：半屏 · 中：一屏半以内 · 长：完整展开"
      >
        <View style={{ padding: t.space.pageX }}>
          <Segmented
            accessibilityLabel="每段讲解长度"
            options={['短', '中', '长'].map(key => ({ key, label: key }))}
            value={state.prefs.length}
            onChange={value => {
              if (value === '短' || value === '中' || value === '长')
                intents.set('length', value);
            }}
          />
        </View>
      </ListSection>
      <ListSection>
        <Field
          label="补充要求（会写进讲解规则）"
          multiline
          value={state.prefs.extra}
          placeholder="例如：多用编程里的类比；伪代码用 Python"
          onChange={value => intents.set('extra', value)}
        />
      </ListSection>
    </SettingsFrame>
  );
}
