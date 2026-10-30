import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import {
  AppBar,
  Gradient,
  Screen,
  Segmented,
  Note,
  Icon,
  Switch,
  useTokens,
  usePresentation,
  makeStyles,
  type Tone,
  type IconName,
  type Tokens,
} from '@ui/kit';
import type {
  MeState,
  MeIntents,
  SettingStatus,
} from '@features/settings/types';

/** Settings-only geometry follows prototype .sec/.grp; presentation comes from kit. */
export function SettingsGroup({
  title,
  note,
  children,
  icons = false,
}: {
  title?: string;
  note?: string;
  children: ReactNode;
  icons?: boolean;
}) {
  const s = useSettingsStyles(),
    { groupedLists } = usePresentation();
  const flatten = (nodes: ReactNode): ReactNode[] =>
    Children.toArray(nodes).flatMap(child =>
      isValidElement<{ children: ReactNode }>(child) && child.type === Fragment
        ? flatten(child.props.children)
        : [child],
    );
  const rows = flatten(children);
  return (
    <View style={s.group} accessibilityLabel={title ?? '设置分组'}>
      {title ? (
        <View style={s.groupHeading}>
          <Text accessibilityRole="header" style={s.groupTitle}>
            {title}
          </Text>
          {!groupedLists && note ? (
            <Text style={s.groupMeta}>{note}</Text>
          ) : null}
        </View>
      ) : null}
      <View style={s.groupBody}>
        {rows.map((child, i) => (
          <View key={i}>
            {i ? (
              <View
                style={[s.separator, icons && groupedLists && s.iconSeparator]}
              />
            ) : null}
            {child}
          </View>
        ))}
      </View>
      {groupedLists && note ? <Text style={s.groupFoot}>{note}</Text> : null}
    </View>
  );
}
export function SettingsRow({
  title,
  subtitle,
  right,
  onPress,
  chevron,
  tone,
  bold,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?(): void;
  chevron?: boolean;
  tone?: Tone;
  bold?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  const s = useSettingsStyles(),
    t = useTokens(),
    { groupedLists } = usePresentation();
  const color =
    tone === 'bad'
      ? t.color.bad
      : tone === 'stuck' || tone === 'warn'
      ? groupedLists
        ? t.color.stuckInk
        : t.color.stuck
      : tone === 'accent'
      ? t.color.accent
      : undefined;
  const body = (
    <>
      {icon}
      <View style={s.grow}>
        <Text
          style={[
            s.rowTitle,
            bold && s.rowBold,
            tone === 'accent' && { color },
          ]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[
              s.rowSubtitle,
              color && tone !== 'accent' ? { color } : undefined,
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
        {children}
      </View>
      {right}
      {chevron && t.brand?.kind !== 'google' ? (
        groupedLists ? (
          <Icon name="chev" size={15} color={t.color.ink3} />
        ) : (
          <Text style={s.paperChevron}>›</Text>
        )
      ) : null}
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle].filter(Boolean).join('，')}
      accessibilityState={{ disabled: false }}
      onPress={onPress}
      style={({ pressed }) => [s.row, pressed && s.pressed]}
    >
      {body}
    </Pressable>
  ) : (
    <View style={s.row}>{body}</View>
  );
}
export function SettingsAction({
  label,
  onPress,
  disabled,
  danger,
  icon,
}: {
  label: string;
  onPress(): void;
  disabled?: boolean;
  danger?: boolean;
  icon?: boolean;
}) {
  const s = useSettingsStyles(),
    t = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.row,
        s.actionRow,
        pressed && s.pressed,
        disabled && s.disabled,
      ]}
    >
      {icon ? <Icon name="add" size={22} color={t.color.accent} /> : null}
      <Text style={[s.actionText, danger && { color: t.color.bad }]}>
        {label}
      </Text>
    </Pressable>
  );
}
export function SettingsButton({
  label,
  onPress,
  disabled,
  variant = 'primary',
  small,
  block,
}: {
  label: string;
  onPress(): void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'danger' | 'secondary';
  small?: boolean;
  block?: boolean;
}) {
  const s = useSettingsStyles(),
    { groupedLists, reduceMotion } = usePresentation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={small ? 9 : 4}
      style={({ pressed }) => [
        s.button,
        small && s.smallButton,
        block && s.block,
        variant === 'primary'
          ? s.primary
          : variant === 'ghost'
          ? s.ghost
          : s.secondary,
        pressed && groupedLists && !reduceMotion && s.buttonPressed,
        disabled && s.disabled,
      ]}
    >
      <Text
        style={[
          s.buttonLabel,
          small && s.smallButtonLabel,
          variant === 'primary'
            ? s.onPrimary
            : variant === 'danger'
            ? s.dangerText
            : variant === 'ghost'
            ? s.ghostText
            : s.secondaryText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function SettingsField({
  label,
  value,
  onChange,
  placeholder,
  error,
  secure,
  multiline,
  keyboardType,
  disabled,
}: {
  label?: string;
  value: string;
  onChange?(value: string): void;
  placeholder?: string;
  error?: string;
  secure?: boolean;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  disabled?: boolean;
}) {
  const s = useSettingsStyles(),
    t = useTokens();
  return (
    <View style={s.field}>
      {label ? <Text style={s.fieldLabel}>{label}</Text> : null}
      <TextInput
        accessibilityLabel={label ?? placeholder ?? '补充要求'}
        value={value}
        onChangeText={onChange}
        editable={!disabled && !!onChange}
        secureTextEntry={secure}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={placeholder}
        placeholderTextColor={t.color.ink3}
        style={[
          s.fieldInput,
          multiline && s.multiline,
          disabled && s.disabledText,
          error && { borderColor: t.color.bad },
        ]}
      />
      {error ? (
        <Text accessibilityRole="alert" style={s.errorText}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
export function SettingsSegmented({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: { key: string; label: string }[];
  onChange(value: string): void;
  label: string;
}) {
  const s = useSettingsStyles(),
    { groupedLists } = usePresentation();
  if (groupedLists) {
    return (
      <Segmented
        value={value}
        options={options}
        onChange={onChange}
        accessibilityLabel={label}
      />
    );
  }
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={s.segmented}
    >
      {options.map(o => (
        <Pressable
          key={o.key}
          accessibilityRole="tab"
          accessibilityLabel={o.label}
          accessibilityState={{ selected: value === o.key }}
          hitSlop={{ top: 8, bottom: 8 }}
          onPress={() => onChange(o.key)}
          style={[s.segment, value === o.key && s.segmentOn]}
        >
          <Text style={[s.segmentLabel, value === o.key && s.segmentLabelOn]}>
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function SettingsSwitch({
  value,
  onChange,
  label,
  disabled,
}: {
  value: boolean;
  onChange(value: boolean): void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Switch
      accessibilityLabel={label}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
export function SettingsNote({ children }: { children: ReactNode }) {
  const s = useSettingsStyles();
  return (
    <View style={s.note}>
      <Text style={s.noteText}>{children}</Text>
    </View>
  );
}
export function SettingsFeedback({ state }: { state: SettingStatus }) {
  const s = useSettingsStyles();
  return state.error || state.notice ? (
    <View style={s.feedback}>
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
  right,
  backLabel = '我的',
}: {
  title: string;
  state: SettingStatus;
  back(): void;
  children: ReactNode;
  right?: ReactNode;
  backLabel?: string;
}) {
  return (
    <Screen scroll>
      <AppBar
        title={title}
        variant="push"
        backLabel={backLabel}
        onBack={back}
        right={right}
      />
      <SettingsFeedback state={state} />
      {children}
    </Screen>
  );
}
const icons: Record<
  string,
  { name: IconName; token: keyof Tokens['settingsIcons'] }
> = {
  MeMineru: { name: 'settingsDoc', token: 'parser' },
  MeAI: { name: 'cpu', token: 'ai' },
  MePrefs: { name: 'sliders', token: 'preferences' },
  MeAppearance: { name: 'appearance', token: 'appearance' },
  MeStorage: { name: 'drive', token: 'storage' },
  About: { name: 'info', token: 'about' },
  LearningStats: { name: 'chart', token: 'ai' },
  Welcome: { name: 'rocket', token: 'appearance' },
};
export function MeView({
  state,
  intents,
}: {
  state: MeState;
  intents: MeIntents;
}) {
  const s = useSettingsStyles(),
    t = useTokens(),
    { groupedLists } = usePresentation();
  return (
    <Screen scroll edges={['top', 'left', 'right']}>
      <AppBar
        title="我的"
        subtitle={t.brand?.kind === 'win11' ? 'Pagewise · 本地优先' : undefined}
        variant="root"
      />
      <SettingsFeedback state={state} />
      {t.brand?.kind === 'win11' && state.overview ? (
        <View style={s.winHero}>
          <View style={s.winHeroTop}>
            <Icon name="book" variant="color" size={40} />
            <View style={s.grow}>
              <Text style={s.winHeroTitle}>书和学习记录只存在这台手机上</Text>
              <Text style={s.rowSubtitle}>
                没有账号、没有后端。上传给 MinerU 和发给 AI 的内容，都在「AI
                看到的内容」里看得到。
              </Text>
            </View>
          </View>
          <View style={s.winStorage}>
            <Text style={s.rowSubtitle}>本机存储</Text>
            <Text style={s.rowSubtitle}>{state.overview.storage}</Text>
          </View>
          <Gradient colors={t.brand.ai} style={s.winStorageBar} />
          <View style={s.winQuick}>
            {[
              {
                key: 'dark' as const,
                label: '深色',
                icon: 'moon' as const,
                on: t.scheme === 'dark',
              },
              {
                key: 'intuition' as const,
                label: '先讲直觉',
                icon: 'teach' as const,
                on: state.overview.intuition,
              },
              {
                key: 'quiz' as const,
                label: '一节一测',
                icon: 'help' as const,
                on: state.overview.quiz,
              },
            ].map(item => (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityState={{ selected: item.on }}
                onPress={() => intents.quick?.(item.key)}
                style={[s.winQuickButton, item.on && s.winQuickOn]}
              >
                <Icon
                  name={item.icon}
                  size={16}
                  color={item.on ? t.color.accentInk : t.color.ink2}
                />
                <Text style={s.winQuickLabel}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      {state.groups.map((group, index) => (
        <SettingsGroup
          key={index}
          icons
          title={
            t.brand?.kind === 'win11'
              ? index === 0
                ? '学习'
                : '应用'
              : undefined
          }
        >
          {group.map(row => {
            const glyph = icons[row.key];
            return (
              <SettingsRow
                key={row.key}
                title={row.title}
                subtitle={row.subtitle}
                tone={row.tone}
                bold={!groupedLists}
                chevron
                onPress={() => intents.open(row.key)}
                icon={
                  groupedLists && glyph ? (
                    t.brand?.kind === 'win11' ? (
                      <Icon
                        name={row.key === 'MeMineru' ? 'key' : glyph.name}
                        variant="color"
                        size={40}
                      />
                    ) : (
                      <View
                        style={[
                          s.settingsIcon,
                          !t.brand && {
                            backgroundColor: t.settingsIcons[glyph.token],
                          },
                        ]}
                      >
                        <Icon
                          name={glyph.name}
                          size={
                            t.brand?.kind === 'google'
                              ? 24
                              : t.brand?.kind === 'meta'
                              ? 20
                              : 18
                          }
                          color={
                            t.brand
                              ? t.settingsIcons[glyph.token]
                              : t.color.continueInk
                          }
                        />
                      </View>
                    )
                  ) : undefined
                }
              />
            );
          })}
        </SettingsGroup>
      ))}
      {state.error ? (
        <SettingsButton
          variant="ghost"
          onPress={intents.refresh}
          label="重新加载"
        />
      ) : null}
    </Screen>
  );
}
export const useSettingsStyles = () => {
  const { groupedLists } = usePresentation();
  return useStyles(groupedLists);
};
const useStyles = (g: boolean) =>
  makeStyles(t => ({
    grow: { flex: 1, minWidth: 0 },
    winHero: {
      marginHorizontal: 16,
      marginBottom: 20,
      padding: 16,
      borderRadius: t.shape.lg,
      backgroundColor: t.brand?.card ?? t.color.glass,
    },
    winHeroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    winHeroTitle: { ...t.type.label, color: t.color.ink },
    winStorage: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 16,
      marginBottom: 8,
    },
    winStorageBar: { height: 6, borderRadius: t.shape.pill, marginBottom: 16 },
    winQuick: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    winQuickButton: {
      minHeight: 32,
      flexDirection: 'row',
      gap: 5,
      paddingHorizontal: 10,
      alignItems: 'center',
      borderRadius: t.shape.pill,
      backgroundColor: t.color.surfaceAlt,
    },
    winQuickOn: { backgroundColor: t.color.accentBg },
    winQuickLabel: { ...t.type.caption, color: t.color.ink2 },
    group: {
      marginHorizontal: g ? 16 : 0,
      marginBottom: g ? 24 : 8,
      ...(t.brand
        ? {
            marginHorizontal: t.brand.kind === 'google' ? 0 : t.space.pageX,
            marginBottom: t.space.sectionGap,
          }
        : {}),
    },
    groupHeading: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 8,
      paddingHorizontal: g ? 16 : 14,
      paddingTop: g ? 0 : 12,
      paddingBottom: g ? 7 : 6,
      backgroundColor: g ? undefined : t.color.surface,
      ...(t.brand
        ? { paddingHorizontal: t.brand.kind === 'google' ? 24 : 4 }
        : {}),
    },
    groupTitle: {
      ...t.type.caption,
      fontSize: g ? t.type.caption.fontSize : t.type.headline.fontSize,
      lineHeight: g ? 18.85 : 22.5,
      fontWeight: g ? '400' : '600',
      color: g ? t.color.ink2 : t.color.ink,
      ...(t.brand
        ? {
            fontSize:
              t.brand.kind === 'meta'
                ? t.type.body.fontSize
                : t.type.label.fontSize,
            fontWeight: t.brand.kind === 'meta' ? '700' : '500',
            color: t.brand.kind === 'google' ? t.color.accent : t.color.ink,
          }
        : {}),
    },
    groupMeta: { ...t.type.caption, color: t.color.ink3, fontWeight: '400' },
    groupBody: {
      backgroundColor: t.color.surface,
      borderRadius: g ? t.shape.md : undefined,
      overflow: 'hidden',
      ...(t.brand
        ? {
            backgroundColor:
              t.brand.kind === 'google'
                ? 'transparent'
                : t.brand.kind === 'win11'
                ? t.brand.card ?? t.color.glass
                : t.color.surface,
            borderRadius:
              t.brand.kind === 'google' ? t.shape.xs * 0 : t.shape.md,
            borderWidth: t.brand.kind === 'win11' ? 1 : 0,
            borderColor: t.brand.stroke ?? t.color.glassLine,
            ...(t.brand.kind === 'win11' ? t.elevation.card : {}),
          }
        : {}),
    },
    groupFoot: {
      ...t.type.caption,
      fontSize: g ? t.type.caption.fontSize : t.type.label.fontSize,
      lineHeight: 18.85,
      color: t.color.ink2,
      paddingHorizontal: 16,
      paddingTop: 7,
    },
    separator: {
      position: g ? 'absolute' : undefined,
      top: g ? 0 : undefined,
      right: g ? 0 : undefined,
      left: g ? 16 : undefined,
      height: g ? 0.5 : 1,
      backgroundColor: t.color.line,
      zIndex: 1,
      ...(t.brand
        ? {
            height: t.brand.kind === 'google' ? 0 : 1,
            left: t.brand.kind === 'meta' ? 16 : 0,
            right: 16,
          }
        : {}),
    },
    iconSeparator: { left: 58, ...(t.brand ? { left: 64 } : {}) },
    row: {
      minHeight: g ? 50 : 45,
      flexDirection: 'row',
      alignItems: 'center',
      gap: g ? 12 : 10,
      paddingHorizontal: g ? 16 : 14,
      paddingVertical: g ? 11 : 12,
      backgroundColor: t.color.surface,
      ...(t.brand
        ? {
            minHeight: t.brand.kind === 'google' ? 56 : 52,
            paddingHorizontal: t.brand.kind === 'google' ? 24 : 16,
            backgroundColor: undefined,
          }
        : {}),
    },
    rowTitle: {
      ...t.type.body,
      lineHeight: g ? 22.1 : 21,
      fontWeight: '400',
      color: t.color.ink,
      ...(t.brand
        ? {
            fontSize: t.type.bookTitle.fontSize,
            fontWeight: t.brand.kind === 'meta' ? '600' : '400',
          }
        : {}),
    },
    rowBold: { fontWeight: '500' },
    rowSubtitle: {
      ...t.type.caption,
      lineHeight: g ? 18.2 : 18,
      color: g ? t.color.ink2 : t.color.ink3,
      marginTop: g ? 2 : 0,
    },
    rowValue: {
      ...t.type.label,
      ...t.type.num,
      color: t.color.ink2,
      fontWeight: '400',
    },
    quotaValue: {
      ...t.type.body,
      ...t.type.num,
      fontSize: g ? t.type.label.fontSize : t.type.body.fontSize,
      color: t.color.ink2,
    },
    usageText: {
      ...t.type.label,
      ...t.type.num,
      color: t.color.ink,
      fontWeight: '400',
    },
    noteInset: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 12 },
    usageBody: {
      paddingHorizontal: 14,
      paddingTop: 4,
      paddingBottom: 12,
      gap: 6,
    },
    usageRow: { flexDirection: 'row', gap: 12 },
    buttonPair: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      flexDirection: 'row',
      gap: 8,
    },
    fill: { flex: 1 },
    picker: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pickerBelow: { marginTop: 4 },
    modelWidth: { width: 150 },
    lengthWidth: { width: g ? 120 : 130 },
    quotaBar: { marginTop: g ? 8 : 6 },
    overlayActions: { padding: t.space.pageX, gap: 8 },
    navSave: { ...t.type.body, color: t.color.accent, fontWeight: '600' },
    pressed: { backgroundColor: t.color.pressed },
    paperChevron: {
      ...t.type.largeTitle,
      color: t.color.ink3,
      lineHeight: 20,
      marginLeft: 4,
      fontWeight: '400',
    },
    actionRow: { justifyContent: 'flex-start' },
    actionText: { ...t.type.body, color: t.color.accent },
    button: {
      minHeight: g ? 50 : 42,
      paddingHorizontal: g ? 22 : 16,
      borderRadius: t.shape.pill,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'flex-start',
      ...(t.brand
        ? {
            borderRadius: t.brand.kind === 'meta' ? t.shape.sm : t.shape.pill,
            minHeight: 44,
          }
        : {}),
    },
    smallButton: {
      minHeight: g ? 34 : 30,
      paddingHorizontal: g ? 14 : 12,
      borderRadius: t.shape.pill,
      ...(t.brand
        ? { borderRadius: t.brand.kind === 'meta' ? t.shape.sm : t.shape.pill }
        : {}),
    },
    buttonLabel: { ...t.type.body, fontWeight: g ? '600' : '500' },
    smallButtonLabel: {
      ...t.type.label,
      fontWeight: g ? '600' : '500',
    },
    primary: {
      backgroundColor: t.color.accent,
      ...(t.brand ? { backgroundColor: t.brand.accentFill } : {}),
    },
    secondary: { backgroundColor: t.color.surfaceAlt },
    ghost: {
      backgroundColor: g ? t.color.surfaceAlt : t.color.surface,
      borderWidth: g ? 0 : 1,
      borderColor: t.color.line,
    },
    onPrimary: {
      color: t.color.onAccent,
      ...(t.brand ? { color: t.color.onAccent } : {}),
    },
    ghostText: { color: g ? t.color.accent : t.color.ink },
    secondaryText: {
      color: g ? t.color.accent : t.color.ink,
      ...(t.brand ? { color: t.color.ink } : {}),
    },
    dangerText: { color: t.color.bad },
    buttonPressed: { transform: [{ scale: 0.97 }] },
    disabled: { opacity: g ? 0.4 : 0.45 },
    block: { alignSelf: 'stretch' },
    field: {
      paddingHorizontal: g ? 16 : 14,
      paddingTop: 10,
      paddingBottom: g ? 11 : 10,
      backgroundColor: t.color.surface,
      ...(t.brand
        ? {
            backgroundColor: undefined,
            paddingHorizontal: t.brand.kind === 'google' ? 24 : 16,
          }
        : {}),
    },
    fieldLabel: {
      ...t.type.caption,
      lineHeight: g ? 18.85 : 18,
      color: g ? t.color.ink2 : t.color.ink3,
      marginBottom: g ? 3 : 4,
    },
    fieldInput: {
      ...t.type.body,
      color: t.color.ink,
      paddingHorizontal: g ? 0 : 10,
      paddingVertical: g ? 0 : 8,
      borderWidth: g ? 0 : 1,
      borderColor: t.color.fieldBorder,
      borderRadius: g ? undefined : t.shape.sm,
      minHeight: g ? 25 : 39,
      textAlignVertical: 'top',
      ...(t.brand
        ? {
            paddingHorizontal: 10,
            paddingVertical: 8,
            minHeight: 44,
            borderWidth: 1,
            borderColor: t.color.fieldBorder,
            borderRadius: t.shape.sm,
            backgroundColor: t.color.surfaceFill,
          }
        : {}),
    },
    multiline: { minHeight: g ? 84 : 90, lineHeight: g ? 25.5 : 22.4 },
    disabledText: { color: t.color.ink3 },
    errorText: { ...t.type.caption, color: t.color.bad, marginTop: 4 },
    segmented: {
      flexDirection: 'row',
      padding: 2,
      gap: g ? 0 : 2,
      backgroundColor: t.color.surfaceAlt,
      borderRadius: g ? t.shape.lg - 8 : t.shape.sm,
    },
    segment: {
      flex: 1,
      minHeight: g ? 28 : 30,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: g ? t.shape.sm + 4 : t.shape.sm - 2,
    },
    segmentOn: {
      backgroundColor: t.color.thumb,
      ...t.elevation.segment,
    },
    segmentLabel: {
      ...t.type.label,
      fontSize: g ? t.type.caption.fontSize : t.type.label.fontSize,
      lineHeight: 19.5,
      color: t.color.ink2,
    },
    segmentLabelOn: { color: t.color.ink, fontWeight: '600' },
    note: {
      backgroundColor: t.color.surfaceFill,
      borderRadius: g ? t.shape.sm + 4 : t.shape.sm,
      paddingHorizontal: g ? 14 : 10,
      paddingVertical: g ? 10 : 8,
    },
    noteText: {
      ...t.type.caption,
      lineHeight: g ? 20.15 : 19.2,
      color: t.color.ink2,
    },
    feedback: { paddingHorizontal: t.space.pageX, paddingVertical: 10 },
    settingsIcon: {
      width: 30,
      height: 30,
      borderRadius: g ? t.shape.sm - 2 : t.shape.sm,
      alignItems: 'center',
      justifyContent: 'center',
      ...(t.brand
        ? {
            width:
              t.brand.kind === 'google'
                ? 24
                : t.brand.kind === 'meta'
                ? 36
                : 40,
            height:
              t.brand.kind === 'google'
                ? 24
                : t.brand.kind === 'meta'
                ? 36
                : 40,
            borderRadius: t.brand.kind === 'meta' ? t.shape.pill : t.shape.sm,
            backgroundColor:
              t.brand.kind === 'meta'
                ? t.color.surfaceAlt
                : t.brand.kind === 'google'
                ? 'transparent'
                : t.color.accentBg,
          }
        : {}),
    },
  }))();
