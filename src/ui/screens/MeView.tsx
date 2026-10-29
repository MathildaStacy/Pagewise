import type { ReactNode } from 'react';
import { View } from 'react-native';
import {
  AppBar,
  Screen,
  ListSection,
  Row,
  Note,
  Button,
  useTokens,
} from '@ui/kit';
import type {
  MeState,
  MeIntents,
  SettingStatus,
} from '@features/settings/types';

export function SettingsFeedback({ state }: { state: SettingStatus }) {
  const t = useTokens();
  return state.error || state.notice ? (
    <View
      style={{ paddingHorizontal: t.space.pageX, paddingVertical: t.space.gap }}
    >
      <Note tone={state.error ? 'bad' : 'accent'}>
        {state.error ?? state.notice}
      </Note>
    </View>
  ) : null;
}
export function SettingsFrame({
  title,
  state,
  back,
  children,
}: {
  title: string;
  state: SettingStatus;
  back(): void;
  children: ReactNode;
}) {
  return (
    <Screen scroll>
      <AppBar title={title} variant="push" backLabel="我的" onBack={back} />
      <SettingsFeedback state={state} />
      {children}
    </Screen>
  );
}
export function MeView({
  state,
  intents,
}: {
  state: MeState;
  intents: MeIntents;
}) {
  return (
    <Screen scroll>
      <AppBar title="我的" variant="root" />
      <SettingsFeedback state={state} />
      {state.groups.map((group, index) => (
        <ListSection key={index}>
          {group.map(row => (
            <Row
              key={row.key}
              title={row.title}
              subtitle={row.subtitle}
              tone={row.tone}
              chevron
              onPress={() => intents.open(row.key)}
            />
          ))}
        </ListSection>
      ))}
      {state.error ? (
        <Button variant="ghost" onPress={intents.refresh} label="重新加载" />
      ) : null}
    </Screen>
  );
}
