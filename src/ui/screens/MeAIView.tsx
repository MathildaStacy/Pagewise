import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  ListSection,
  Row,
  Note,
  Empty,
  CheckRow,
  Sheet,
  Icon,
  makeStyles,
} from '@ui/kit';
import type { AIState, AIIntents } from '@features/settings/types';
import { SettingsFrame } from './MeView';

/** The prototype's select field, with a native sheet for its options. */
export function SettingsSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: { key: string; label: string }[];
  onChange(value: string): void;
  disabled?: boolean;
}) {
  const s = useStyles();
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.key === value);
  return (
    <View style={s.field}>
      <Text style={s.caption}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label + '，' + (selected?.label ?? '尚未选择')}
        accessibilityState={{
          disabled: disabled || !options.length,
          expanded: open,
        }}
        disabled={disabled || !options.length}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [s.select, pressed && s.pressed]}
      >
        <Text style={[s.selectText, !selected && s.caption]}>
          {selected?.label ?? '先添加服务并填写模型名'}
        </Text>
        <Icon name="arrowDown" size={16} />
      </Pressable>
      <Sheet visible={open} title={label} onClose={() => setOpen(false)}>
        {options.map(option => (
          <CheckRow
            key={option.key}
            title={option.label}
            checked={value === option.key}
            onToggle={() => {
              onChange(option.key);
              setOpen(false);
            }}
          />
        ))}
      </Sheet>
    </View>
  );
}

export function MeAIView({
  state,
  intents,
}: {
  state: AIState;
  intents: AIIntents;
}) {
  const s = useStyles();
  return (
    <SettingsFrame title="AI 服务" state={state} back={intents.back}>
      {state.demo ? (
        <View style={s.demo}>
          <Note tone="neutral">
            Demo 演示 · AI 使用脚本模式，用量为演示数据
          </Note>
        </View>
      ) : null}
      <ListSection title="服务" note="Key 保存在 Android Keystore">
        {state.providers.length ? (
          state.providers.map(p => (
            <Row
              key={p.id}
              title={p.name}
              subtitle={p.meta}
              chevron
              onPress={() => intents.edit(p.id)}
            />
          ))
        ) : (
          <Empty body="还没有配置 AI 服务" />
        )}
        <Row title="＋ 添加服务" tone="accent" onPress={intents.add} />
      </ListSection>
      <ListSection title="模型分配">
        {(['teach', 'tidy'] as const).map(purpose => (
          <SettingsSelect
            key={purpose}
            label={
              purpose === 'teach'
                ? '讲解模型（伴读、岔路、解释）'
                : '整理模型（摘要、闪卡草稿、续学回顾、翻译）'
            }
            options={state.options}
            value={state[purpose]}
            onChange={key => intents.assign(purpose, key)}
            disabled={state.loading || state.saving}
          />
        ))}
        <View style={s.note}>
          <Note tone="neutral">
            讲解用强一点的模型，整理用便宜的模型。讲解规则和书的地图走 prompt
            caching。
          </Note>
        </View>
      </ListSection>
      <ListSection title="用量" note="本机统计">
        <View style={s.usage}>
          {state.usage.map((u, i) => (
            <View key={i} style={s.usageRow}>
              <Text style={s.usageTitle}>{u.title}</Text>
              <Text style={s.usageValue}>{u.detail}</Text>
            </View>
          ))}
          <View style={s.totalRow}>
            <Text style={s.caption}>本月合计</Text>
            <Text style={s.total}>{state.month.replace(/^本月合计 /, '')}</Text>
          </View>
        </View>
      </ListSection>
    </SettingsFrame>
  );
}

const useStyles = makeStyles(t => ({
  field: { paddingHorizontal: t.space.pageX, paddingVertical: 10, gap: 4 },
  caption: { ...t.type.caption, color: t.color.ink2 },
  select: {
    minHeight: 48,
    padding: 10,
    borderWidth: 1,
    borderColor: t.color.line,
    borderRadius: t.shape.sm,
    backgroundColor: t.color.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pressed: { backgroundColor: t.color.pressed },
  selectText: { ...t.type.body, color: t.color.ink, flex: 1 },
  demo: { paddingHorizontal: t.space.pageX, paddingBottom: 8 },
  note: { paddingHorizontal: t.space.pageX, paddingTop: 8, paddingBottom: 12 },
  usage: { paddingHorizontal: t.space.pageX, paddingVertical: 12, gap: 10 },
  usageRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  usageTitle: { ...t.type.caption, color: t.color.ink2, flex: 1 },
  usageValue: {
    ...t.type.caption,
    ...t.type.num,
    color: t.color.ink,
    flex: 1,
    textAlign: 'right',
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  total: { ...t.type.caption, ...t.type.num, color: t.color.ink },
}));
