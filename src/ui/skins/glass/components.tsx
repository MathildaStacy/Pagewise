import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch as NativeSwitch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  AppBarProps,
  ButtonProps,
  ComponentMap,
  ComposerProps,
  DialogProps,
  GlassProps,
  ListSectionProps,
  ModeSwitchProps,
  QuickActionsProps,
  RowProps,
  SegmentedProps,
  SelectionMenuProps,
  StepProgressProps,
  SwitchProps,
  TabBarProps,
  ToastProps,
} from '../../kit/contracts';
import { useSkin, useTokens } from '../../kit/context';
import { Icon } from '../../kit/Icon';
import { Glass, IconButton, Segmented } from '../../kit/proxy';
import {
  GlassSurface,
  SelectionMenuSurface,
  Sheet,
} from '../../kit/base/overlays';

function AppBar({
  title,
  subtitle,
  variant,
  onBack,
  backLabel = '返回',
  right,
  scrollY = 0,
}: AppBarProps) {
  const tokens = useTokens();
  const { fontScale } = useWindowDimensions();
  const collapse =
    variant === 'root' ? Math.min(1, Math.max(0, scrollY / 56)) : 1;
  const titleType =
    variant === 'root'
      ? {
          ...tokens.type.largeTitle,
          fontSize:
            tokens.type.largeTitle.fontSize +
            (tokens.type.title.fontSize - tokens.type.largeTitle.fontSize) *
              collapse,
          lineHeight:
            tokens.type.largeTitle.lineHeight +
            (tokens.type.title.lineHeight - tokens.type.largeTitle.lineHeight) *
              collapse,
        }
      : tokens.type.title;
  const appBarStyle = StyleSheet.create({
    root: {
      minHeight: variant === 'root' ? 88 - collapse * 32 : 56,
      paddingHorizontal: tokens.space.gap,
      justifyContent: 'center',
    },
  }).root;
  const appBarContentStyle = StyleSheet.create({
    root: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: tokens.space.gap,
      paddingVertical: tokens.space.gap,
    },
  }).root;
  const backLabelStyle = StyleSheet.create({
    root: { color: tokens.color.accent, flexShrink: 1 },
  }).root;
  const titleContainerStyle = StyleSheet.create({
    root: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: tokens.type.title.fontSize * fontScale * 4,
      paddingLeft: variant === 'root' ? tokens.space.gap : 0,
    },
  }).root;
  const titleTextStyle = StyleSheet.create({
    root: {
      color: tokens.color.ink,
      textAlign: variant === 'push' ? 'center' : 'left',
    },
  }).root;
  const subtitleTextStyle = StyleSheet.create({
    root: {
      color: tokens.color.ink2,
      textAlign: variant === 'push' ? 'center' : 'left',
    },
  }).root;
  const appBarRightStyle = StyleSheet.create({
    root: { maxWidth: '100%', flexShrink: 0, marginLeft: 'auto' },
  }).root;
  const appBarBalanceStyle = StyleSheet.create({
    root: { minWidth: onBack ? 48 : 0 },
  }).root;
  return (
    <View
      accessibilityRole="header"
      accessibilityLabel={title}
      accessibilityState={{}}
      style={appBarStyle}
    >
      {scrollY > 0 ? (
        <Glass strength="regular" style={StyleSheet.absoluteFill} />
      ) : null}
      <View testID="glass-appbar-content" style={appBarContentStyle}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={backLabel}
            accessibilityState={{ disabled: false }}
            onPress={onBack}
            style={({ pressed }) => ({
              minHeight: 48,
              minWidth: 48,
              maxWidth: '35%',
              flexDirection: 'row',
              alignItems: 'center',
              paddingRight: tokens.space.gap,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Icon name="back" color={tokens.color.accent} size={24} />
            <Text style={[tokens.type.body, backLabelStyle]}>{backLabel}</Text>
          </Pressable>
        ) : null}
        <View style={titleContainerStyle}>
          <Text style={[titleType, titleTextStyle]}>{title}</Text>
          {subtitle ? (
            <Text style={[tokens.type.micro, subtitleTextStyle]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ? (
          <View testID="glass-appbar-actions" style={appBarRightStyle}>
            {right}
          </View>
        ) : variant === 'push' ? (
          <View style={appBarBalanceStyle} />
        ) : null}
      </View>
    </View>
  );
}

function TabBar({ items, active, onSelect }: TabBarProps) {
  const tokens = useTokens();
  const safe = useSafeAreaInsets();
  const tabBarItemsStyle = StyleSheet.create({
    root: { flexDirection: 'row', padding: 5 },
  }).root;
  return (
    <View
      style={{
        paddingHorizontal: tokens.space.pageX,
        paddingTop: tokens.space.gap,
        paddingBottom: Math.max(safe.bottom, tokens.space.gap),
      }}
    >
      <Glass
        strength="regular"
        style={{ borderRadius: tokens.shape.pill, ...tokens.elevation.pop }}
      >
        <View
          accessibilityRole="tablist"
          accessibilityLabel="主要页面"
          accessibilityState={{}}
          style={tabBarItemsStyle}
        >
          {items.map(item => {
            const selected = item.key === active;
            const color = selected ? tokens.color.accent : tokens.color.ink2;
            const tabIconRowStyle = StyleSheet.create({
              root: { flexDirection: 'row', alignItems: 'center', gap: 3 },
            }).root;
            const tabBadgeStyle = StyleSheet.create({
              root: {
                color: tokens.color.onAccent,
                backgroundColor: tokens.color.bad,
                minWidth: 18,
                textAlign: 'center',
                borderRadius: tokens.shape.pill,
                paddingHorizontal: 4,
              },
            }).root;
            const tabLabelStyle = StyleSheet.create({
              root: { color, textAlign: 'center' },
            }).root;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="tab"
                accessibilityLabel={
                  item.badge === undefined
                    ? item.label
                    : `${item.label}，${item.badge}`
                }
                accessibilityState={{ selected }}
                onPress={() => onSelect(item.key)}
                style={({ pressed }) => ({
                  flex: 1,
                  minWidth: 48,
                  minHeight: 56,
                  paddingVertical: tokens.space.gap,
                  paddingHorizontal: 4,
                  borderRadius: tokens.shape.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  backgroundColor: selected ? tokens.color.accentBg : undefined,
                  opacity: pressed ? 0.65 : 1,
                })}
              >
                <View style={tabIconRowStyle}>
                  <Icon name={item.icon} color={color} size={22} />
                  {item.badge !== undefined ? (
                    <Text style={[tokens.type.micro, tabBadgeStyle]}>
                      {item.badge}
                    </Text>
                  ) : null}
                </View>
                <Text style={[tokens.type.micro, tabLabelStyle]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Glass>
    </View>
  );
}

function GlassSegmented({
  options,
  value,
  onChange,
  accessibilityLabel = '选项',
}: SegmentedProps) {
  const tokens = useTokens();
  const thumbColor =
    tokens.scheme === 'dark' ? tokens.color.glassStrong : tokens.color.surface;
  const { reduceMotion } = useSkin();
  const [width, setWidth] = useState(0);
  const position = useRef(new Animated.Value(0)).current;
  const index = Math.max(
    0,
    options.findIndex(option => option.key === value),
  );
  const optionWidth = Math.max(0, width - 6) / Math.max(1, options.length);
  useEffect(() => {
    const target = index * optionWidth;
    if (reduceMotion || width === 0) {
      position.setValue(target);
      return;
    }
    const animation = Animated.timing(position, {
      toValue: target,
      duration: tokens.motion.normal,
      easing: Easing.bezier(...tokens.motion.easing),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [
    index,
    optionWidth,
    position,
    reduceMotion,
    tokens.motion.normal,
    tokens.motion.easing,
    width,
  ]);
  const segmentedStyle = StyleSheet.create({
    root: {
      flexDirection: 'row',
      padding: 3,
      backgroundColor: tokens.color.surfaceAlt,
      borderRadius: tokens.shape.pill,
    },
  }).root;
  const segmentThumbStyle = StyleSheet.create({
    root: {
      position: 'absolute',
      top: 3,
      bottom: 3,
      left: 3,
      width: optionWidth,
      borderRadius: tokens.shape.pill,
      backgroundColor: thumbColor,
      ...tokens.elevation.card,
      transform: [{ translateX: position }],
    },
  }).root;
  return (
    <View
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{}}
      style={segmentedStyle}
    >
      {width > 0 ? (
        <Animated.View pointerEvents="none" style={segmentThumbStyle} />
      ) : null}
      {options.map(option => {
        const selected = option.key === value;
        const segmentOptionStyle = StyleSheet.create({
          root: {
            flex: 1,
            minWidth: 48,
            minHeight: 48,
            paddingHorizontal: tokens.space.gap,
            paddingVertical: tokens.space.gap,
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: tokens.shape.pill,
            backgroundColor: width === 0 && selected ? thumbColor : undefined,
          },
        }).root;
        const segmentLabelStyle = StyleSheet.create({
          root: {
            color: tokens.color.ink,
            textAlign: 'center',
            fontWeight: selected ? '600' : '400',
          },
        }).root;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option.key)}
            style={segmentOptionStyle}
          >
            <Text style={[tokens.type.label, segmentLabelStyle]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ModeSwitch({ value, onChange }: ModeSwitchProps) {
  const tokens = useTokens();
  const { fontScale } = useWindowDimensions();
  // 两个汉字需要完整字宽，不能只保留48dp触控宽度后再扣掉左右内边距。
  const optionWidth = Math.max(
    48,
    tokens.type.label.fontSize * fontScale * 2 + tokens.space.gap * 2 + 2,
  );
  const modeSwitchStyle = StyleSheet.create({
    root: { minWidth: optionWidth * 2 + 6, maxWidth: '100%' },
  }).root;
  return (
    <View testID="glass-mode-switch" style={modeSwitchStyle}>
      <Segmented
        accessibilityLabel="学习方式"
        options={[
          { key: 'read', label: '读书' },
          { key: 'listen', label: '听讲' },
        ]}
        value={value}
        onChange={next => onChange(next as 'read' | 'listen')}
      />
    </View>
  );
}

function Switch({
  value,
  onChange,
  accessibilityLabel,
  disabled,
}: SwitchProps) {
  const tokens = useTokens();
  const switchStyle = StyleSheet.create({
    root: { minWidth: 52, minHeight: 48 },
  }).root;
  return (
    <NativeSwitch
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      value={value}
      disabled={disabled}
      onValueChange={onChange}
      trackColor={{ false: tokens.color.surfaceAlt, true: tokens.color.ok }}
      thumbColor={tokens.color.onAccent}
      ios_backgroundColor={tokens.color.surfaceAlt}
      style={switchStyle}
    />
  );
}

function Button({
  variant = 'primary',
  size = 'md',
  icon,
  disabled,
  onPress,
  children,
  label,
  accessibilityLabel,
}: ButtonProps) {
  const tokens = useTokens();
  const solid = variant === 'primary' || variant === 'detour';
  const backgroundColor =
    variant === 'primary'
      ? tokens.color.accent
      : variant === 'detour'
      ? tokens.color.detour
      : variant === 'danger'
      ? tokens.color.badBg
      : variant === 'text'
      ? undefined
      : variant === 'secondary'
      ? tokens.color.surfaceAlt
      : tokens.color.surface;
  const foreground = solid
    ? tokens.color.onAccent
    : variant === 'danger'
    ? tokens.color.badInk
    : variant === 'text'
    ? tokens.color.accent
    : tokens.color.ink;
  const name =
    accessibilityLabel ??
    label ??
    (typeof children === 'string' ? children : '按钮');
  const buttonLabelStyle = StyleSheet.create({
    root: { color: foreground, textAlign: 'center', flexShrink: 1 },
  }).root;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        minWidth: 48,
        alignSelf: size === 'block' ? 'stretch' : undefined,
        paddingVertical: tokens.space.gap,
        paddingHorizontal:
          size === 'sm' ? tokens.space.gap : tokens.space.pageX,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: tokens.space.gap,
        borderRadius: tokens.shape.pill,
        backgroundColor,
        opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        transform: [
          { scale: pressed && !disabled ? tokens.motion.pressScale : 1 },
        ],
      })}
    >
      {icon ? <Icon name={icon} color={foreground} size={20} /> : null}
      <Text style={[tokens.type.label, buttonLabelStyle]}>
        {label ?? children}
      </Text>
    </Pressable>
  );
}

function ListSection({ title, note, children }: ListSectionProps) {
  const tokens = useTokens();
  const listCardStyle = StyleSheet.create({
    root: {
      borderRadius: tokens.shape.lg,
      backgroundColor: tokens.color.surface,
      overflow: 'hidden',
    },
  }).root;
  return (
    <View
      accessibilityRole="none"
      accessibilityLabel={title ?? '分组'}
      accessibilityState={{}}
      style={{
        marginHorizontal: tokens.space.pageX,
        marginBottom: tokens.space.sectionGap,
      }}
    >
      {title ? (
        <Text
          accessibilityRole="header"
          style={[
            tokens.type.caption,
            {
              color: tokens.color.ink2,
              paddingHorizontal: tokens.space.pageX,
              paddingBottom: tokens.space.gap,
            },
          ]}
        >
          {title}
        </Text>
      ) : null}
      <View style={listCardStyle}>{children}</View>
      {note ? (
        <Text
          style={[
            tokens.type.caption,
            {
              color: tokens.color.ink2,
              paddingHorizontal: tokens.space.pageX,
              paddingTop: tokens.space.gap,
            },
          ]}
        >
          {note}
        </Text>
      ) : null}
    </View>
  );
}

function Row({ title, subtitle, right, chevron, onPress, tone }: RowProps) {
  const tokens = useTokens();
  const foreground = {
    neutral: tokens.color.ink,
    accent: tokens.color.accentInk,
    main: tokens.color.accentInk,
    detour: tokens.color.detour,
    stuck: tokens.color.stuckInk,
    warn: tokens.color.stuckInk,
    ok: tokens.color.ink,
    bad: tokens.color.badInk,
    muted: tokens.color.ink2,
    derive: tokens.color.derive,
    example: tokens.color.example,
    pin: tokens.color.pin,
  }[tone ?? 'neutral'];
  const rowTextStyle = StyleSheet.create({
    root: { flex: 1, minWidth: 0 },
  }).root;
  const rowRightStyle = StyleSheet.create({
    root: { maxWidth: '55%', flexShrink: 1 },
  }).root;
  const rowSeparatorStyle = StyleSheet.create({
    root: {
      position: 'absolute',
      left: tokens.space.pageX,
      right: 0,
      bottom: 0,
      height: StyleSheet.hairlineWidth,
      backgroundColor: tokens.color.line,
    },
  }).root;
  const body = (
    <>
      <View style={rowTextStyle}>
        <Text style={[tokens.type.body, { color: foreground }]}>{title}</Text>
        {subtitle ? (
          <Text style={[tokens.type.caption, { color: tokens.color.ink2 }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={rowRightStyle}>{right}</View> : null}
      {chevron ? (
        <Icon name="chev" color={tokens.color.ink3} size={18} />
      ) : null}
      <View pointerEvents="none" style={rowSeparatorStyle} />
    </>
  );
  const style = {
    minHeight: 56,
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    alignItems: 'center' as const,
    gap: tokens.space.gap,
    paddingHorizontal: tokens.space.pageX,
    paddingVertical: tokens.space.rowY,
  };
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}，${subtitle}` : title}
      accessibilityState={{ disabled: false }}
      onPress={onPress}
      style={({ pressed }) => [
        style,
        {
          backgroundColor: pressed
            ? tokens.color.pressed
            : tokens.color.surface,
        },
      ]}
    >
      {body}
    </Pressable>
  ) : (
    <View
      accessibilityRole="none"
      accessibilityLabel={title}
      accessibilityState={{}}
      style={style}
    >
      {body}
    </View>
  );
}

function StepProgress({
  steps,
  label,
  onPressStep,
  onPressBar,
  right,
}: StepProgressProps) {
  const tokens = useTokens();
  const states = {
    done: '已讲',
    current: '当前',
    skipped: '已跳过',
    todo: '未讲',
  };
  const stepCaptionRowStyle = StyleSheet.create({
    root: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: tokens.space.pageX,
    },
  }).root;
  const stepCaptionStyle = StyleSheet.create({
    root: { minHeight: 48, minWidth: 48, justifyContent: 'center' },
  }).root;
  return (
    <View
      accessibilityRole="none"
      accessibilityLabel={label}
      accessibilityState={{}}
    >
      <View style={stepCaptionRowStyle}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}，查看路线图`}
          accessibilityState={{ disabled: false }}
          onPress={onPressBar}
          style={stepCaptionStyle}
        >
          <Text style={[tokens.type.caption, { color: tokens.color.ink2 }]}>
            {label}
          </Text>
        </Pressable>
        {right}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: tokens.space.gap,
          paddingHorizontal: tokens.space.pageX,
          paddingBottom: tokens.space.gap,
        }}
      >
        {steps.map((step, index) => {
          const current = step.state === 'current';
          const done = step.state === 'done';
          const foreground = current
            ? tokens.color.onAccent
            : step.state === 'skipped'
            ? tokens.color.ink2
            : tokens.color.ink;
          const stepNumberStyle = StyleSheet.create({
            root: {
              minWidth: 30,
              minHeight: 30,
              borderRadius: tokens.shape.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: current
                ? tokens.color.accentBg
                : done
                ? tokens.color.accent
                : tokens.color.surfaceAlt,
            },
          }).root;
          const stepTitleStyle = StyleSheet.create({
            root: {
              color: foreground,
              textDecorationLine:
                step.state === 'skipped' ? 'line-through' : 'none',
            },
          }).root;
          return (
            <Pressable
              key={`${step.title}-${index}`}
              accessibilityRole="button"
              accessibilityLabel={`第 ${index + 1} 步，${step.title}，${
                states[step.state]
              }`}
              accessibilityState={{ selected: current }}
              onPress={() => onPressStep(index)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: tokens.space.gap,
                paddingVertical: 5,
                paddingLeft: 5,
                paddingRight: tokens.space.pageX,
                minHeight: 48,
                minWidth: 48,
                borderRadius: tokens.shape.pill,
                backgroundColor: current
                  ? tokens.color.accent
                  : tokens.color.surface,
                transform: [{ scale: pressed ? tokens.motion.pressScale : 1 }],
              })}
            >
              <View style={stepNumberStyle}>
                {done || step.state === 'skipped' ? (
                  <Icon
                    name={done ? 'check' : 'skip'}
                    color={
                      done || current
                        ? tokens.color.onAccent
                        : tokens.color.ink2
                    }
                    size={16}
                  />
                ) : (
                  <Text style={[tokens.type.micro, { color: foreground }]}>
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text style={[tokens.type.label, stepTitleStyle]}>
                {step.title}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function QuickActions({ items, onPress }: QuickActionsProps) {
  const tokens = useTokens();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        gap: tokens.space.gap,
        paddingHorizontal: tokens.space.pageX,
        paddingVertical: tokens.space.gap,
      }}
    >
      {items.map(item => {
        const solid = item.kind === 'primary' || item.kind === 'detour';
        const foreground = solid ? tokens.color.onAccent : tokens.color.ink;
        return (
          <Glass
            key={item.key}
            strength="regular"
            blurEnabled={!solid}
            style={{
              borderRadius: tokens.shape.pill,
              backgroundColor:
                item.kind === 'primary'
                  ? tokens.color.accent
                  : item.kind === 'detour'
                  ? tokens.color.detour
                  : tokens.color.glass,
              ...tokens.elevation.pop,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ disabled: false }}
              onPress={() => onPress(item.key)}
              style={({ pressed }) => ({
                minWidth: 48,
                minHeight: 48,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: tokens.space.gap,
                paddingHorizontal: tokens.space.pageX,
                paddingVertical: tokens.space.gap,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              {item.icon ? (
                <Icon name={item.icon} color={foreground} size={18} />
              ) : null}
              <Text style={[tokens.type.label, { color: foreground }]}>
                {item.label}
              </Text>
            </Pressable>
          </Glass>
        );
      })}
    </ScrollView>
  );
}

function Composer({
  value,
  onChange,
  placeholder,
  onSend,
  sendDisabled,
  quote,
  micAvailable,
  onMic,
  busy,
  onStop,
}: ComposerProps) {
  const tokens = useTokens();
  const safe = useSafeAreaInsets();
  const composerQuoteStyle = StyleSheet.create({
    root: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: tokens.space.pageX,
    },
  }).root;
  const composerQuoteTextStyle = StyleSheet.create({
    root: { flex: 1, color: tokens.color.accent },
  }).root;
  const composerInputRowStyle = StyleSheet.create({
    root: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingLeft: tokens.space.pageX,
      paddingRight: 4,
      paddingVertical: 4,
      gap: 4,
    },
  }).root;
  const composerInputStyle = StyleSheet.create({
    root: {
      color: tokens.color.ink,
      flex: 1,
      minHeight: 48,
      maxHeight: tokens.type.body.lineHeight * 5 + 16,
      paddingVertical: tokens.space.rowY,
    },
  }).root;
  return (
    <View
      accessibilityRole="none"
      accessibilityLabel="提问输入区"
      accessibilityState={{ busy: !!busy }}
      style={{
        paddingHorizontal: tokens.space.pageX,
        paddingTop: tokens.space.gap,
        paddingBottom: Math.max(tokens.space.gap, safe.bottom),
      }}
    >
      {quote ? (
        <Glass
          strength="strong"
          style={{
            borderRadius: tokens.shape.md,
            marginBottom: tokens.space.gap,
          }}
        >
          <View style={composerQuoteStyle}>
            <Text style={[tokens.type.caption, composerQuoteTextStyle]}>
              {quote.label}
            </Text>
            <IconButton icon="close" label="取消引用" onPress={quote.onClear} />
          </View>
        </Glass>
      ) : null}
      <Glass
        strength="regular"
        style={{ borderRadius: tokens.shape.pill, ...tokens.elevation.pop }}
      >
        <View style={composerInputRowStyle}>
          <TextInput
            accessibilityLabel={placeholder}
            accessibilityState={{ disabled: false }}
            value={value}
            onChangeText={onChange}
            placeholder={placeholder}
            placeholderTextColor={tokens.color.ink2}
            multiline
            style={[tokens.type.body, composerInputStyle]}
          />
          {micAvailable && onMic ? (
            <IconButton icon="mic" label="语音输入" onPress={onMic} />
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={busy ? '停止' : '发送'}
            accessibilityState={{ disabled: busy ? !onStop : sendDisabled }}
            disabled={busy ? !onStop : sendDisabled}
            onPress={busy ? onStop : onSend}
            style={({ pressed }) => ({
              minWidth: 48,
              minHeight: 48,
              borderRadius: tokens.shape.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: tokens.color.accent,
              opacity: !busy && sendDisabled ? 0.4 : pressed ? 0.75 : 1,
            })}
          >
            <Icon
              name={busy ? 'stop' : 'send'}
              color={tokens.color.onAccent}
              size={21}
            />
          </Pressable>
        </View>
      </Glass>
    </View>
  );
}

function Dialog({
  visible,
  title,
  body,
  confirm,
  cancel,
  onConfirm,
  onCancel,
}: DialogProps) {
  const tokens = useTokens();
  const { reduceMotion } = useSkin();
  const dialogMaskStyle = StyleSheet.create({
    root: {
      flex: 1,
      paddingHorizontal: tokens.space.pageX * 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
  }).root;
  const dialogScrollStyle = StyleSheet.create({
    root: {
      maxHeight: '90%',
      width: '100%',
      maxWidth: 360,
      flexGrow: 0,
    },
  }).root;
  const dialogTitleStyle = StyleSheet.create({
    root: { color: tokens.color.ink, textAlign: 'center' },
  }).root;
  const dialogBodyStyle = StyleSheet.create({
    root: { color: tokens.color.ink, textAlign: 'center' },
  }).root;
  const dialogActionsStyle = StyleSheet.create({
    root: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: tokens.color.line,
    },
  }).root;
  const dialogCancelStyle = StyleSheet.create({
    root: { color: tokens.color.accent, textAlign: 'center' },
  }).root;
  const dialogConfirmStyle = StyleSheet.create({
    root: {
      color: tokens.color.accent,
      fontWeight: '600',
      textAlign: 'center',
    },
  }).root;
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onCancel}
    >
      <View style={dialogMaskStyle}>
        <Pressable
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: tokens.color.scrim },
          ]}
          accessibilityRole="button"
          accessibilityLabel={cancel ?? '关闭对话框'}
          accessibilityState={{ disabled: false }}
          onPress={onCancel}
        />
        <ScrollView
          style={dialogScrollStyle}
          keyboardShouldPersistTaps="handled"
        >
          <Glass
            strength="strong"
            style={{ borderRadius: tokens.shape.lg, ...tokens.elevation.pop }}
          >
            <View
              accessibilityRole="alert"
              accessibilityLabel={title}
              accessibilityState={{ expanded: visible }}
              accessibilityViewIsModal
              onAccessibilityEscape={onCancel}
            >
              <View
                style={{ padding: tokens.space.pageX, gap: tokens.space.gap }}
              >
                <Text
                  accessibilityRole="header"
                  style={[tokens.type.title, dialogTitleStyle]}
                >
                  {title}
                </Text>
                <Text style={[tokens.type.caption, dialogBodyStyle]}>
                  {body}
                </Text>
              </View>
              <View style={dialogActionsStyle}>
                {cancel ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={cancel}
                    accessibilityState={{ disabled: false }}
                    onPress={onCancel}
                    style={({ pressed }) => ({
                      flexGrow: 1,
                      flexBasis: 100,
                      minHeight: 48,
                      padding: tokens.space.gap,
                      borderRightWidth: StyleSheet.hairlineWidth,
                      borderColor: tokens.color.line,
                      justifyContent: 'center',
                      backgroundColor: pressed
                        ? tokens.color.pressed
                        : undefined,
                    })}
                  >
                    <Text style={[tokens.type.body, dialogCancelStyle]}>
                      {cancel}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={confirm}
                  accessibilityState={{ disabled: false }}
                  onPress={onConfirm}
                  style={({ pressed }) => ({
                    flexGrow: 1,
                    flexBasis: 100,
                    minHeight: 48,
                    padding: tokens.space.gap,
                    justifyContent: 'center',
                    backgroundColor: pressed ? tokens.color.pressed : undefined,
                  })}
                >
                  <Text style={[tokens.type.body, dialogConfirmStyle]}>
                    {confirm}
                  </Text>
                </Pressable>
              </View>
            </View>
          </Glass>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Toast({ message, tone = 'default' }: ToastProps) {
  const tokens = useTokens();
  const color =
    tone === 'ok'
      ? tokens.color.ok
      : tone === 'detour'
      ? tokens.color.detour
      : tone === 'bad'
      ? tokens.color.bad
      : tokens.color.ink;
  const toastSurfaceStyle = StyleSheet.create({
    root: {
      alignSelf: 'center',
      maxWidth: '92%',
      borderRadius: tokens.shape.pill,
      ...tokens.elevation.pop,
    },
  }).root;
  const toastBodyStyle = StyleSheet.create({
    root: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 48,
      paddingHorizontal: tokens.space.pageX,
      paddingVertical: tokens.space.gap,
      gap: tokens.space.gap,
    },
  }).root;
  const toastLabelStyle = StyleSheet.create({
    root: { color: tokens.color.ink, flexShrink: 1, textAlign: 'center' },
  }).root;
  return (
    <Glass strength="strong" style={toastSurfaceStyle}>
      <View
        pointerEvents="none"
        accessibilityRole="alert"
        accessibilityLabel={message}
        accessibilityLiveRegion="polite"
        accessibilityState={{}}
        style={toastBodyStyle}
      >
        {tone !== 'default' ? (
          <Icon
            name={
              tone === 'ok' ? 'check' : tone === 'bad' ? 'warning' : 'branch'
            }
            color={color}
            size={18}
          />
        ) : null}
        <Text style={[tokens.type.caption, toastLabelStyle]}>{message}</Text>
      </View>
    </Glass>
  );
}

function SelectionMenu(props: SelectionMenuProps) {
  return <SelectionMenuSurface {...props} material />;
}

function GlassMaterial(props: GlassProps) {
  return <GlassSurface {...props} material />;
}

export const glassComponents: Partial<ComponentMap> = {
  AppBar,
  TabBar,
  ModeSwitch,
  Segmented: GlassSegmented,
  Switch,
  Button,
  ListSection,
  Row,
  StepProgress,
  QuickActions,
  Composer,
  Sheet,
  Dialog,
  Toast,
  SelectionMenu,
  Glass: GlassMaterial,
};
