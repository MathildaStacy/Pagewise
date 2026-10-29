import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CheckRow, Dialog, Sheet, usePresentation } from '@ui/kit';
import type { AIEditState, AIEditIntents } from '@features/settings/types';
import {
  SettingsFrame,
  SettingsGroup,
  SettingsField,
  SettingsAction,
  SettingsButton,
  useSettingsStyles,
} from './MeView';
import { SettingsSelect } from './MeAIView';
export function MeAIEditView({
  state,
  intents,
}: {
  state: AIEditState;
  intents: AIEditIntents;
}) {
  const [modelsOpen, setModelsOpen] = useState(false);
  const { groupedLists } = usePresentation(),
    s = useSettingsStyles();
  const busy = state.loading || state.saving || Boolean(state.busy);
  const save = state.saving ? '正在保存…' : '保存';
  return (
    <SettingsFrame
      title={state.title}
      backLabel="AI 服务"
      state={state}
      back={intents.back}
      right={
        groupedLists ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={save}
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            hitSlop={10}
            onPress={intents.save}
          >
            <Text style={s.navSave}>{save}</Text>
          </Pressable>
        ) : undefined
      }
    >
      <SettingsGroup>
        <SettingsField
          label="名称"
          value={state.form.name}
          onChange={value => intents.field('name', value)}
          error={state.errors.name}
          placeholder="例如：Claude 官方"
        />
        <SettingsSelect
          label="协议"
          value={state.form.protocol}
          options={[
            { key: 'anthropic', label: 'Anthropic Messages' },
            { key: 'openai', label: 'OpenAI Responses' },
            { key: 'chat', label: 'OpenAI Chat Completions' },
          ]}
          onChange={value => {
            if (value === 'anthropic' || value === 'openai' || value === 'chat')
              intents.field('protocol', value);
          }}
          disabled={state.loading || state.saving}
        />
        <SettingsField
          label="Base URL"
          value={state.form.baseUrl}
          onChange={value => intents.field('baseUrl', value)}
          keyboardType="url"
          error={state.errors.baseUrl}
          placeholder="https://api.anthropic.com"
        />
        <SettingsField
          label="API Key"
          secure
          value={state.form.key}
          onChange={value => intents.field('key', value)}
          error={state.errors.key}
          placeholder={state.keyLabel}
        />
        <SettingsField
          label="模型（逗号分隔）"
          value={state.form.model}
          onChange={value => intents.field('model', value)}
          error={state.errors.model}
          placeholder="claude-sonnet-5-5"
        />
      </SettingsGroup>
      <SettingsGroup>
        <SettingsAction
          label={state.busy === 'models' ? '正在读取模型…' : '读取模型列表'}
          disabled={busy}
          onPress={intents.readModels}
        />
        {state.models?.length ? (
          <SettingsAction
            label={'选择模型（' + state.models.length + ' 个可用）'}
            onPress={() => setModelsOpen(true)}
          />
        ) : null}
        {groupedLists ? (
          <SettingsAction
            label={state.busy === 'test' ? '正在测试…' : '测试连接'}
            onPress={intents.testConnection}
            disabled={busy}
          />
        ) : null}
      </SettingsGroup>
      {state.form.protocol === 'anthropic' ? (
        <SettingsGroup>
          <SettingsSelect
            label="鉴权方式"
            value={state.form.auth}
            options={[
              { key: 'x-api-key', label: 'x-api-key' },
              { key: 'bearer', label: 'Bearer Token' },
            ]}
            onChange={value => {
              if (value === 'x-api-key' || value === 'bearer')
                intents.field('auth', value);
            }}
            disabled={state.loading || state.saving}
          />
        </SettingsGroup>
      ) : null}
      {!groupedLists ? (
        <View style={s.buttonPair}>
          <View style={s.fill}>
            <SettingsButton
              variant="ghost"
              label={state.busy === 'test' ? '正在测试…' : '测试连接'}
              onPress={intents.testConnection}
              disabled={busy}
              block
            />
          </View>
          <View style={s.fill}>
            <SettingsButton
              label={save}
              onPress={intents.save}
              disabled={busy}
              block
            />
          </View>
        </View>
      ) : null}
      {state.canDelete ? (
        <SettingsGroup>
          <SettingsAction
            danger
            label="删除服务"
            onPress={intents.remove}
            disabled={busy}
          />
        </SettingsGroup>
      ) : null}
      <Sheet
        visible={modelsOpen}
        title="选择模型"
        subtitle="勾选的模型保存后可用于讲解或整理，也可以直接填写模型名。"
        onClose={() => setModelsOpen(false)}
      >
        {state.models?.map(model => (
          <CheckRow
            key={model.id}
            title={model.label}
            checked={model.selected}
            onToggle={() => intents.toggleModel(model.id)}
          />
        ))}
      </Sheet>
      <Dialog
        danger
        visible={state.confirmDelete}
        title="删除这个服务？"
        body="保存的 API Key 和模型分配也会移除，需要重新添加后才能使用。"
        confirm="删除服务"
        cancel="取消"
        onConfirm={intents.confirmRemove}
        onCancel={intents.closeOverlay}
      />
    </SettingsFrame>
  );
}
