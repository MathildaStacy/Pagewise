import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Sheet, Row, makeStyles } from '@ui/kit';
import type {
  AiOptionsState,
  ConversationConfig,
} from '@features/settings/types';
import { SettingsSelect } from './MeAIView';
import { SettingsGroup, SettingsRow } from './MeView';
import { Switch } from '@ui/kit';

/** 同一控制器可内联放在解释弹层，也可收起在聊天输入框旁。 */
export function AiOptionsControl({
  state,
  onChange,
  disabled,
  inline = false,
}: {
  state?: AiOptionsState;
  onChange?(patch: Partial<ConversationConfig>): void;
  disabled?: boolean;
  inline?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const s = useStyles();
  if (!state || !onChange) return null;
  const selected = state.models.find(m => m.key === state.selected);
  const effort = state.efforts.find(e => e.key === state.config?.effort)?.label;
  const body = (
    <View>
      <SettingsSelect
        label="模型"
        value={state.selected}
        options={state.models}
        disabled={disabled}
        onChange={key => {
          const model = state.models.find(m => m.key === key);
          if (model)
            onChange({ providerId: model.providerId, model: model.model });
        }}
      />
      {state.efforts.length ? (
        <SettingsSelect
          label="推理强度"
          value={state.config?.effort ?? ''}
          options={state.efforts}
          disabled={disabled}
          onChange={key => {
            const effortOption = state.efforts.find(e => e.key === key);
            if (effortOption) onChange({ effort: effortOption.key });
          }}
        />
      ) : (
        <Row title="推理强度" subtitle="此模型没有可选的推理档位" />
      )}
      <SettingsRow
        title="模型内置搜索"
        subtitle={
          state.search.ok
            ? '由模型搜索互联网，补充原书之外的信息'
            : state.search.reason
        }
        right={
          <Switch
            accessibilityLabel="模型内置搜索"
            value={state.config?.search ?? false}
            disabled={disabled || !state.search.ok}
            onChange={search => onChange({ search })}
          />
        }
      />
    </View>
  );
  if (inline) return <SettingsGroup>{body}</SettingsGroup>;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="模型与推理设置"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={s.control}
      >
        <Text numberOfLines={2} style={s.label}>
          {selected?.label ?? '选择 AI 模型'}
          {effort ? ' · 推理' + effort : ''} · 搜索
          {state.config?.search ? '开' : '关'} ▾
        </Text>
      </Pressable>
      <Sheet
        visible={open}
        title="模型与推理设置"
        onClose={() => setOpen(false)}
      >
        {body}
      </Sheet>
    </>
  );
}
const useStyles = makeStyles(t => ({
  control: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: t.space.pageX,
  },
  label: { ...t.type.caption, color: t.color.ink2 },
}));
