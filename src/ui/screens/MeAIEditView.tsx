import { useState } from 'react';
import { View } from 'react-native';
import {
  Field,
  ListSection,
  CheckRow,
  Button,
  Dialog,
  Sheet,
  Note,
  Row,
  makeStyles,
} from '@ui/kit';
import type { AIEditState, AIEditIntents } from '@features/settings/types';
import { SettingsFrame } from './MeView';
import { SettingsSelect } from './MeAIView';
export function MeAIEditView({
  state,
  intents,
}: {
  state: AIEditState;
  intents: AIEditIntents;
}) {
  const s = useStyles();
  const [modelsOpen, setModelsOpen] = useState(false);
  const busy = state.loading || state.saving || Boolean(state.busy);
  return (
    <SettingsFrame title={state.title} state={state} back={intents.back}>
      {state.demo ? (
        <View style={s.demo}>
          <Note tone="neutral">
            Demo 演示 · 使用脚本模式，填写的服务不会用于演示讲解
          </Note>
        </View>
      ) : null}
      <ListSection>
        <Field
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
        <Field
          label="Base URL"
          value={state.form.baseUrl}
          onChange={value => intents.field('baseUrl', value)}
          keyboardType="url"
          error={state.errors.baseUrl}
          placeholder="https://api.anthropic.com"
        />
        <Field
          label="API Key"
          secure
          value={state.form.key}
          onChange={value => intents.field('key', value)}
          error={state.errors.key}
          placeholder={state.keyLabel}
        />
        <Field
          label="模型（逗号分隔）"
          value={state.form.model}
          onChange={value => intents.field('model', value)}
          error={state.errors.model}
          placeholder="例如 claude-sonnet-5-5"
        />
        <Row
          title={state.busy === 'models' ? '正在读取模型…' : '读取模型列表'}
          tone="accent"
          onPress={busy ? undefined : intents.readModels}
        />
        {state.models?.length ? (
          <Row
            title={'选择模型（' + state.models.length + ' 个可用）'}
            chevron
            onPress={() => setModelsOpen(true)}
          />
        ) : null}
        {state.form.protocol === 'anthropic' ? (
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
        ) : null}
      </ListSection>
      <View style={s.actions}>
        <View style={s.cell}>
          <Button
            variant="ghost"
            label={state.busy === 'test' ? '正在测试…' : '测试连接'}
            onPress={intents.testConnection}
            disabled={busy}
            size="block"
          />
        </View>
        <View style={s.cell}>
          <Button
            label={state.saving ? '正在保存…' : '保存'}
            onPress={intents.save}
            disabled={busy}
            size="block"
          />
        </View>
      </View>
      {state.canDelete ? (
        <View style={s.delete}>
          <Button
            variant="danger"
            label="删除服务"
            onPress={intents.remove}
            disabled={busy}
          />
        </View>
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

const useStyles = makeStyles(t => ({
  demo: { paddingHorizontal: t.space.pageX, paddingBottom: 8 },
  actions: {
    paddingHorizontal: t.space.pageX,
    paddingVertical: 6,
    flexDirection: 'row',
    gap: 8,
  },
  cell: { flex: 1 },
  delete: { padding: t.space.pageX },
}));
