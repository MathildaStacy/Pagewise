import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Sheet, CheckRow, Icon, usePresentation, useTokens } from '@ui/kit';
import type { AIState, AIIntents } from '@features/settings/types';
import {
  SettingsFrame,
  SettingsGroup,
  SettingsRow,
  SettingsAction,
  SettingsNote,
  useSettingsStyles,
} from './MeView';
export function SettingsSelect({
  label,
  value,
  options,
  onChange,
  disabled,
  title,
  subtitle,
}: {
  label: string;
  value: string;
  options: { key: string; label: string }[];
  onChange(value: string): void;
  disabled?: boolean;
  title?: string;
  subtitle?: string;
}) {
  const s = useSettingsStyles(),
    t = useTokens(),
    { groupedLists } = usePresentation();
  const [open, setOpen] = useState(false),
    selected = options.find(o => o.key === value);
  const unavailable = disabled || !options.length;
  const picker = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label + '，' + (selected?.label ?? '尚未选择')}
      accessibilityState={{ disabled: unavailable, expanded: open }}
      disabled={unavailable}
      onPress={() => setOpen(true)}
      hitSlop={6}
      style={[title && groupedLists ? undefined : s.fieldInput, s.picker]}
    >
      <Text
        style={[
          s.grow,
          title && groupedLists
            ? { ...t.type.label, color: t.color.accent }
            : {
                ...t.type.body,
                color: groupedLists ? t.color.accent : t.color.ink,
              },
        ]}
      >
        {selected?.label ?? '先添加服务并填写模型名'}
      </Text>
      {!(title && groupedLists) ? <Icon name="arrowDown" size={16} /> : null}
    </Pressable>
  );
  return (
    <>
      {title && groupedLists ? (
        <SettingsRow
          title={title}
          subtitle={subtitle}
          right={<Icon name="updown" size={15} color={t.color.ink3} />}
        >
          <View style={s.pickerBelow}>{picker}</View>
        </SettingsRow>
      ) : (
        <View style={s.field}>
          <Text style={s.fieldLabel}>{label}</Text>
          {picker}
        </View>
      )}
      <Sheet
        visible={open}
        title={title ?? label}
        onClose={() => setOpen(false)}
      >
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
    </>
  );
}
export function MeAIView({
  state,
  intents,
}: {
  state: AIState;
  intents: AIIntents;
}) {
  const { groupedLists } = usePresentation(),
    s = useSettingsStyles();
  return (
    <SettingsFrame title="AI 服务" state={state} back={intents.back}>
      <SettingsGroup
        title={groupedLists ? '服务 · Key 保存在 Android Keystore' : '服务'}
        note={groupedLists ? undefined : 'Key 保存在 Android Keystore'}
      >
        {state.providers.map(p => (
          <SettingsRow
            key={p.id}
            title={p.name}
            subtitle={p.meta}
            bold={!groupedLists}
            chevron
            onPress={() => intents.edit(p.id)}
          />
        ))}
        <SettingsAction
          label={groupedLists ? '添加服务' : '＋ 添加服务'}
          icon={groupedLists}
          onPress={intents.add}
        />
      </SettingsGroup>
      <SettingsGroup
        title="模型分配"
        note={
          groupedLists
            ? '讲解用强一点的模型，整理用便宜的模型。讲解规则和书的地图走 prompt caching。'
            : undefined
        }
      >
        {(['teach', 'tidy'] as const).map(purpose => (
          <SettingsSelect
            key={purpose}
            label={
              purpose === 'teach'
                ? '讲解模型（伴读、岔路、解释）'
                : '整理模型（摘要、闪卡草稿、续学回顾、翻译）'
            }
            title={purpose === 'teach' ? '讲解模型' : '整理模型'}
            subtitle={
              purpose === 'teach'
                ? '听讲、岔路、解释'
                : '路线图、摘要、闪卡草稿、续学回顾、翻译'
            }
            options={state.options}
            value={state[purpose]}
            onChange={key => intents.assign(purpose, key)}
            disabled={state.loading || state.saving}
          />
        ))}
        {!groupedLists ? (
          <View style={s.noteInset}>
            <SettingsNote>
              讲解用强一点的模型，整理用便宜的模型。讲解规则和书的地图走 prompt
              caching。
            </SettingsNote>
          </View>
        ) : null}
      </SettingsGroup>
      <SettingsGroup
        title={groupedLists ? '用量 · 本机统计' : '用量'}
        note={groupedLists ? undefined : '本机统计'}
      >
        {groupedLists ? (
          <>
            {state.usage.map((u, i) => (
              <SettingsRow
                key={i}
                title={u.title}
                right={
                  <Text style={s.rowValue}>
                    {u.detail
                      .replace(' tokens', '')
                      .replace('缓存命中', '缓存')}
                  </Text>
                }
              />
            ))}
            <SettingsRow
              title="本月合计"
              right={
                <Text style={s.rowValue}>
                  {state.month.replace(/^本月合计 /, '')}
                </Text>
              }
            />
          </>
        ) : (
          <View style={s.usageBody}>
            {[
              ...state.usage,
              {
                title: '本月合计',
                detail: state.month.replace(/^本月合计 /, ''),
              },
            ].map((u, i) => (
              <View key={i} style={s.usageRow}>
                <Text style={[s.usageText, s.grow]}>{u.title}</Text>
                <Text style={s.usageText}>{u.detail}</Text>
              </View>
            ))}
          </View>
        )}
      </SettingsGroup>
    </SettingsFrame>
  );
}
