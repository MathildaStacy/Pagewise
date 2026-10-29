import { View, Text } from 'react-native';
import {
  ListSection,
  Row,
  Field,
  Segmented,
  Switch,
  ProgressBar,
  Button,
  Note,
  useTokens,
} from '@ui/kit';
import type { MineruState, MineruIntents } from '@features/settings/types';
import { SettingsFrame } from './MeView';
export function MeMineruView({
  state,
  intents,
}: {
  state: MineruState;
  intents: MineruIntents;
}) {
  const t = useTokens();
  return (
    <SettingsFrame title="解析服务" state={state} back={intents.back}>
      <ListSection
        title="MinerU 官方精准解析 API"
        note="Token 保存在 Android Keystore"
      >
        <Row title="Token" subtitle={state.tokenLabel} />
        <Field
          label="更新 Token"
          secure
          value={state.token}
          onChange={intents.setToken}
          placeholder="留空保留已保存的 Token"
        />
        <Field
          label="有效期（可选，YYYY-MM-DD）"
          value={state.expiresOn}
          onChange={intents.setExpiresOn}
          placeholder="例如 2027-01-26"
        />
        <Row
          title="有效期"
          subtitle={state.expiresHint}
          tone={state.expired ? 'bad' : 'neutral'}
        />
        <View style={{ padding: t.space.pageX }}>
          <Button
            onPress={intents.saveToken}
            disabled={state.loading || state.saving}
            label={state.saving ? '正在保存…' : '保存 Token 与有效期'}
          />
        </View>
      </ListSection>
      <ListSection title="解析设置">
        <Row
          title="今日额度"
          subtitle="每天 1000 页高优先级，超出后排队变慢"
          right={
            <Text style={{ ...t.type.caption, color: t.color.ink2 }}>
              {state.quotaLabel}
            </Text>
          }
        />
        <View style={{ paddingHorizontal: t.space.pageX }}>
          <ProgressBar value={state.quotaRatio} />
        </View>
        <Row
          title="默认解析模型"
          subtitle={state.model === 'vlm' ? '公式和复杂排版更好' : '速度更快'}
        />
        <View
          style={{
            paddingHorizontal: t.space.pageX,
            paddingBottom: t.space.gap,
          }}
        >
          <Segmented
            accessibilityLabel="默认解析模型"
            options={[
              { key: 'vlm', label: 'vlm' },
              { key: 'pipeline', label: 'pipeline' },
            ]}
            value={state.model}
            onChange={intents.setModel}
          />
        </View>
        <Row
          title="上传前确认"
          subtitle="每次上传书之前弹窗确认"
          right={
            <Switch
              accessibilityLabel="上传前确认"
              value={state.confirmUpload}
              onChange={intents.setConfirmUpload}
              disabled={state.loading}
            />
          }
        />
        <Row title="测试连接" tone="accent" onPress={intents.testConnection} />
      </ListSection>
      <ListSection title="自建 MinerU 服务" note="后续版本支持">
        <View style={{ padding: t.space.pageX }}>
          <Note tone="neutral">自建服务地址将在后续版本开放。</Note>
        </View>
      </ListSection>
    </SettingsFrame>
  );
}
