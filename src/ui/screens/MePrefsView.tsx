import { View } from 'react-native';
import { usePresentation } from '@ui/kit';
import type {
  PrefsState,
  PrefsIntents,
  TeachPrefs,
} from '@features/settings/types';
import {
  SettingsFrame,
  SettingsGroup,
  SettingsRow,
  SettingsSwitch,
  SettingsSegmented,
  SettingsField,
  useSettingsStyles,
} from './MeView';
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
    subtitle: '隔天打开时先用三句话回顾上次的进度和卡点',
  },
];
export function MePrefsView({
  state,
  intents,
}: {
  state: PrefsState;
  intents: PrefsIntents;
}) {
  const { groupedLists } = usePresentation(),
    s = useSettingsStyles();
  const toggle = (row: (typeof switches)[number]) => (
    <SettingsRow
      key={row.key}
      title={row.title}
      subtitle={row.subtitle}
      right={
        <SettingsSwitch
          label={row.title}
          value={state.prefs[row.key]}
          disabled={state.loading}
          onChange={value => intents.set(row.key, value)}
        />
      }
    />
  );
  return (
    <SettingsFrame title="讲解偏好" state={state} back={intents.back}>
      <SettingsGroup>
        {toggle(switches[0])}
        <SettingsRow
          title="每段讲解长度"
          subtitle="短：半屏 · 中：一屏半以内 · 长：完整展开"
          right={
            <View style={s.lengthWidth}>
              <SettingsSegmented
                label="每段讲解长度"
                options={['短', '中', '长'].map(key => ({ key, label: key }))}
                value={state.prefs.length}
                onChange={value => {
                  if (value === '短' || value === '中' || value === '长')
                    intents.set('length', value);
                }}
              />
            </View>
          }
        />
        {switches.slice(1).map(toggle)}
      </SettingsGroup>
      <SettingsGroup
        title={groupedLists ? '补充要求' : undefined}
        note={groupedLists ? '会写进讲解规则。' : undefined}
      >
        <SettingsField
          label={groupedLists ? undefined : '补充要求（会写进讲解规则）'}
          multiline
          value={state.prefs.extra}
          placeholder="例如：多用编程里的类比；伪代码用 Python"
          onChange={value => intents.set('extra', value)}
        />
      </SettingsGroup>
    </SettingsFrame>
  );
}
