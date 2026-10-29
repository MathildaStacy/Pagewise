import { useState } from 'react';
import { Text, View } from 'react-native';
import { Sheet, ProgressBar, usePresentation } from '@ui/kit';
import type { MineruState, MineruIntents } from '@features/settings/types';
import {
  SettingsFrame,
  SettingsGroup,
  SettingsRow,
  SettingsField,
  SettingsSegmented,
  SettingsSwitch,
  SettingsButton,
  SettingsAction,
  SettingsNote,
  useSettingsStyles,
} from './MeView';
export function MeMineruView({
  state,
  intents,
}: {
  state: MineruState;
  intents: MineruIntents;
}) {
  const [editing, setEditing] = useState(false);
  const { groupedLists } = usePresentation(),
    s = useSettingsStyles();
  return (
    <SettingsFrame title="解析服务" state={state} back={intents.back}>
      <SettingsGroup title="MinerU 官方精准解析 API">
        <SettingsField
          label={
            groupedLists
              ? 'Token（保存在 Android Keystore，只显示末 4 位）'
              : 'Token（保存在 Android Keystore）'
          }
          value={state.tokenLabel}
        />
        <SettingsRow
          title="有效期"
          subtitle={state.expiresHint}
          tone={state.expired ? 'bad' : undefined}
          right={
            <SettingsButton
              small
              label="更新 Token"
              onPress={() => setEditing(true)}
              disabled={state.loading}
            />
          }
        />
        <SettingsRow
          title="今日额度"
          subtitle="每天 1000 页最高优先级，超出后排队变慢，不会被拦截"
          right={
            <Text style={s.quotaValue}>
              {state.quotaLabel.replace(/ 页$/, '')}
            </Text>
          }
        >
          <View style={s.quotaBar}>
            <ProgressBar value={state.quotaRatio} />
          </View>
        </SettingsRow>
        <SettingsRow
          title="默认解析模型"
          subtitle={state.model === 'vlm' ? '公式和复杂排版更好' : '速度更快'}
          right={
            <View style={s.modelWidth}>
              <SettingsSegmented
                label="默认解析模型"
                options={[
                  { key: 'vlm', label: 'vlm' },
                  { key: 'pipeline', label: 'pipeline' },
                ]}
                value={state.model}
                onChange={intents.setModel}
              />
            </View>
          }
        />
        <SettingsRow
          title="上传前确认"
          subtitle="每次上传书之前弹窗确认"
          right={
            <SettingsSwitch
              label="上传前确认"
              value={state.confirmUpload}
              onChange={intents.setConfirmUpload}
              disabled={state.loading}
            />
          }
        />
        <SettingsAction
          label="测试连接"
          onPress={intents.testConnection}
          disabled={state.loading || state.saving}
        />
      </SettingsGroup>
      <SettingsGroup
        title={groupedLists ? '自建 MinerU 服务 · V1.1' : '自建 MinerU 服务'}
        note={
          groupedLists
            ? '用自建服务时，书不离开你的网络，也不占官方额度。'
            : 'V1.1'
        }
      >
        <SettingsField
          label="服务地址（例如局域网里 Mac 上的 mineru-api）"
          value=""
          placeholder="http://192.168.1.20:8000"
          disabled
        />
        {!groupedLists ? (
          <View style={s.noteInset}>
            <SettingsNote>
              用自建服务时，书不离开你的网络，也不占官方额度。
            </SettingsNote>
          </View>
        ) : null}
      </SettingsGroup>
      <Sheet
        visible={editing}
        title="更新 Token"
        onClose={() => setEditing(false)}
      >
        <SettingsField
          label="Token"
          secure
          value={state.token}
          onChange={intents.setToken}
          placeholder="留空保留已保存的 Token"
        />
        <SettingsField
          label="有效期（可选，YYYY-MM-DD）"
          value={state.expiresOn}
          onChange={intents.setExpiresOn}
          placeholder="例如 2027-01-26"
        />
        <View style={s.overlayActions}>
          <SettingsButton
            block
            label={state.saving ? '正在保存…' : '保存 Token 与有效期'}
            disabled={state.loading || state.saving}
            onPress={intents.saveToken}
          />
          <SettingsButton
            block
            variant="ghost"
            label="完成"
            onPress={() => setEditing(false)}
          />
        </View>
      </Sheet>
    </SettingsFrame>
  );
}
