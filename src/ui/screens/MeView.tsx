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
      {chevron ? (
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
      <AppBar title="我的" variant="root" />
      <SettingsFeedback state={state} />
      {state.groups.map((group, index) => (
        <SettingsGroup key={index} icons>
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
                    <View
                      style={[
                        s.settingsIcon,
                        { backgroundColor: t.settingsIcons[glyph.token] },
                      ]}
                    >
                      <Icon
                        name={glyph.name}
                        size={18}
                        color={t.color.continueInk}
                      />
                    </View>
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
    group: { marginHorizontal: g ? 16 : 0, marginBottom: g ? 24 : 8 },
    groupHeading: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 8,
      paddingHorizontal: g ? 16 : 14,
      paddingTop: g ? 0 : 12,
      paddingBottom: g ? 7 : 6,
      backgroundColor: g ? undefined : t.color.surface,
    },
    groupTitle: {
      ...t.type.caption,
      fontSize: g ? t.type.caption.fontSize : t.type.headline.fontSize,
      lineHeight: g ? 18.85 : 22.5,
      fontWeight: g ? '400' : '600',
      color: g ? t.color.ink2 : t.color.ink,
    },
    groupMeta: { ...t.type.caption, color: t.color.ink3, fontWeight: '400' },
    groupBody: {
      backgroundColor: t.color.surface,
      borderRadius: g ? t.shape.md : undefined,
      overflow: 'hidden',
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
    },
    iconSeparator: { left: 58 },
    row: {
      minHeight: g ? 50 : 45,
      flexDirection: 'row',
      alignItems: 'center',
      gap: g ? 12 : 10,
      paddingHorizontal: g ? 16 : 14,
      paddingVertical: g ? 11 : 12,
      backgroundColor: t.color.surface,
    },
    rowTitle: {
      ...t.type.body,
      lineHeight: g ? 22.1 : 21,
      fontWeight: '400',
      color: t.color.ink,
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
    },
    smallButton: {
      minHeight: g ? 34 : 30,
      paddingHorizontal: g ? 14 : 12,
      borderRadius: t.shape.pill,
    },
    buttonLabel: { ...t.type.body, fontWeight: g ? '600' : '500' },
    smallButtonLabel: {
      ...t.type.label,
      fontWeight: g ? '600' : '500',
    },
    primary: { backgroundColor: t.color.accent },
    secondary: { backgroundColor: t.color.surfaceAlt },
    ghost: {
      backgroundColor: g ? t.color.surfaceAlt : t.color.surface,
      borderWidth: g ? 0 : 1,
      borderColor: t.color.line,
    },
    onPrimary: { color: t.color.onAccent },
    ghostText: { color: g ? t.color.accent : t.color.ink },
    secondaryText: { color: g ? t.color.accent : t.color.ink },
    dangerText: { color: t.color.bad },
    buttonPressed: { transform: [{ scale: 0.97 }] },
    disabled: { opacity: g ? 0.4 : 0.45 },
    block: { alignSelf: 'stretch' },
    field: {
      paddingHorizontal: g ? 16 : 14,
      paddingTop: 10,
      paddingBottom: g ? 11 : 10,
      backgroundColor: t.color.surface,
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
    },
  }))();
