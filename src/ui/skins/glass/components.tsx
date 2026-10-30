import { useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from '@react-native-community/blur';
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
import { Glass, Segmented } from '../../kit/proxy';
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
  part = 'all',
}: AppBarProps) {
  const t = useTokens();
  const root = variant === 'root';
  const { reduceMotion, blurEnabled } = useSkin();
  const compactVisible = !root || scrollY > 36;
  const opacity = useRef(new Animated.Value(compactVisible ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(compactVisible ? 1 : 0);
      return;
    }
    const animation = Animated.timing(opacity, {
      toValue: compactVisible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [compactVisible, opacity, reduceMotion]);
  const largeTitle = root ? (
    <Text
      testID="glass-appbar-large-title"
      accessibilityRole="header"
      style={[
        t.type.largeTitle,
        StyleSheet.create({
          title: {
            color: t.color.ink,
            paddingHorizontal: 20,
            paddingBottom: 12,
            letterSpacing: 0.34,
          },
        }).title,
      ]}
    >
      {title}
    </Text>
  ) : null;
  if (part === 'largeTitle') return largeTitle;
  return (
    <View accessibilityRole="header" accessibilityLabel={title}>
      <View
        testID="glass-appbar-content"
        style={
          StyleSheet.create({
            root: {
              minHeight: 44,
              paddingHorizontal: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 2,
            },
          }).root
        }
      >
        {scrollY > 2 ? (
          <View
            testID="glass-appbar-material"
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              StyleSheet.create({
                material: {
                  overflow: 'hidden',
                  borderBottomWidth: 0.5,
                  borderBottomColor: t.color.line,
                },
              }).material,
            ]}
          >
            {blurEnabled &&
            (Platform.OS === 'android' || Platform.OS === 'ios') ? (
              <BlurView
                testID="glass-appbar-blur"
                style={StyleSheet.absoluteFill}
                blurType={t.scheme === 'dark' ? 'dark' : 'light'}
                blurAmount={20}
                reducedTransparencyFallbackColor={t.color.surface}
              />
            ) : null}
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: blurEnabled
                    ? t.color.header
                    : t.color.surface,
                },
              ]}
            />
          </View>
        ) : null}
        <View
          style={
            StyleSheet.create({
              root: { minWidth: 88, flexShrink: 0 },
            }).root
          }
        >
          {onBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={backLabel}
              hitSlop={2}
              onPress={onBack}
              style={({ pressed }) => ({
                minHeight: 44,
                maxWidth: 120,
                paddingRight: 4,
                flexDirection: 'row',
                alignItems: 'center',
                opacity: pressed ? 0.5 : 1,
              })}
            >
              <Icon name="back" size={27} color={t.color.accent} />
              <Text
                numberOfLines={1}
                style={
                  StyleSheet.create({
                    root: {
                      fontSize: 17,
                      color: t.color.accent,
                      flexShrink: 1,
                    },
                  }).root
                }
              >
                {backLabel}
              </Text>
            </Pressable>
          ) : null}
        </View>
        <Animated.View
          testID="glass-appbar-compact-title"
          accessibilityElementsHidden={!compactVisible}
          importantForAccessibility={
            compactVisible ? 'auto' : 'no-hide-descendants'
          }
          style={[
            StyleSheet.create({
              title: { flex: 1, minWidth: 0, alignItems: 'center' },
            }).title,
            { opacity },
          ]}
        >
          <Text
            numberOfLines={1}
            style={[
              t.type.title,
              StyleSheet.create({ root: { color: t.color.ink } }).root,
            ]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              numberOfLines={1}
              style={
                StyleSheet.create({
                  root: { fontSize: 11, lineHeight: 13.2, color: t.color.ink2 },
                }).root
              }
            >
              {subtitle}
            </Text>
          ) : null}
        </Animated.View>
        <View
          style={
            StyleSheet.create({
              root: {
                minWidth: 88,
                alignItems: 'flex-end',
                justifyContent: 'center',
              },
            }).root
          }
        >
          {right}
        </View>
      </View>
      {part === 'all' ? largeTitle : null}
    </View>
  );
}

function TabBar({ items, active, onSelect }: TabBarProps) {
  const t = useTokens();
  return (
    <Glass
      strength="regular"
      style={
        StyleSheet.create({
          root: {
            borderRadius: 31,
            marginHorizontal: 22,
            marginBottom: 24,
            minHeight: 62,
            padding: 4,
            ...t.elevation.pop,
          },
        }).root
      }
    >
      <View
        style={
          StyleSheet.create({ root: { flexDirection: 'row', minHeight: 54 } })
            .root
        }
        accessibilityRole="tablist"
        accessibilityLabel="主导航"
      >
        {items.map(item => (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active === item.key }}
            onPress={() => onSelect(item.key)}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              borderRadius: 27,
              backgroundColor:
                active === item.key ? t.color.surfaceFill : undefined,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            })}
          >
            <Icon
              name={item.icon}
              size={24}
              color={active === item.key ? t.color.accent : t.color.ink}
            />
            <Text
              style={
                StyleSheet.create({
                  root: {
                    fontSize: 10,
                    lineHeight: 14.5,
                    fontWeight: '600',
                    color: active === item.key ? t.color.accent : t.color.ink,
                  },
                }).root
              }
            >
              {item.label}
            </Text>
            {item.badge != null ? (
              <Text
                style={
                  StyleSheet.create({
                    root: {
                      position: 'absolute',
                      top: 5,
                      left: '58%',
                      minWidth: 17,
                      paddingHorizontal: 5,
                      borderRadius: 9,
                      fontSize: 11,
                      lineHeight: 17,
                      fontWeight: '600',
                      textAlign: 'center',
                      backgroundColor: t.color.bad,
                      color: t.color.onAccent,
                    },
                  }).root
                }
              >
                {item.badge}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </View>
    </Glass>
  );
}

function GlassSegmented({
  options,
  value,
  onChange,
  accessibilityLabel = '选项',
}: SegmentedProps) {
  const tokens = useTokens();
  const thumbColor = tokens.color.thumb;
  const { reduceMotion } = useSkin();
  const [width, setWidth] = useState(0);
  const position = useRef(new Animated.Value(0)).current;
  const index = Math.max(
    0,
    options.findIndex(option => option.key === value),
  );
  const optionWidth = Math.max(0, width - 4) / Math.max(1, options.length);
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
      padding: 2,
      backgroundColor: tokens.color.surfaceAlt,
      borderRadius: tokens.shape.pill,
    },
  }).root;
  const segmentThumbStyle = StyleSheet.create({
    root: {
      position: 'absolute',
      top: 2,
      bottom: 2,
      left: 2,
      width: optionWidth,
      borderRadius: tokens.shape.pill,
      backgroundColor: thumbColor,
      boxShadow: '0 3px 8px rgba(0,0,0,.12),0 0 0 .5px rgba(0,0,0,.04)',
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
            minWidth: 0,
            minHeight: 28,
            paddingHorizontal: 0,
            paddingVertical: 0,
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: tokens.shape.pill,
            backgroundColor: width === 0 && selected ? thumbColor : undefined,
          },
        }).root;
        const segmentLabelStyle = StyleSheet.create({
          root: {
            color: tokens.color.ink,
            fontSize: tokens.type.caption.fontSize,
            lineHeight: tokens.type.caption.lineHeight,
            textAlign: 'center',
            fontWeight: selected ? '600' : '500',
          },
        }).root;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected }}
            hitSlop={8}
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
  const t = useTokens();
  return (
    <View
      testID="glass-mode-switch"
      style={
        StyleSheet.create({
          root: {
            width: 4 + 2 * Math.max(46, t.type.caption.fontSize * 2 + 12),
          },
        }).root
      }
    >
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
  const t = useTokens();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      hitSlop={9}
      style={
        StyleSheet.create({
          root: {
            width: 51,
            height: 31,
            borderRadius: 16,
            backgroundColor: value ? t.color.ok : t.color.switchOff,
            opacity: disabled ? 0.4 : 1,
          },
        }).root
      }
    >
      <View
        style={
          StyleSheet.create({
            root: {
              position: 'absolute',
              left: value ? 22 : 2,
              top: 2,
              width: 27,
              height: 27,
              borderRadius: 14,
              backgroundColor: '#FFFFFF',
              boxShadow: '0 3px 8px rgba(0,0,0,.15),0 1px 1px rgba(0,0,0,.16)',
            },
          }).root
        }
      />
    </Pressable>
  );
}

function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  disabled,
  onPress,
  children,
  label,
  accessibilityLabel,
}: ButtonProps) {
  const t = useTokens(),
    solid = variant === 'primary' || variant === 'detour';
  const bg =
    variant === 'primary'
      ? t.color.accent
      : variant === 'detour'
      ? t.color.detour
      : variant === 'text'
      ? undefined
      : t.color.surfaceAlt;
  const fg = solid
    ? t.color.onAccent
    : variant === 'danger'
    ? t.color.bad
    : t.color.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ??
        label ??
        (typeof children === 'string' ? children : '按钮')
      }
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={size === 'sm' ? 7 : 0}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: size === 'sm' ? 34 : 50,
        paddingHorizontal: variant === 'text' ? 8 : size === 'sm' ? 14 : 22,
        alignSelf: size === 'block' ? 'stretch' : undefined,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: size === 'sm' ? 17 : 25,
        backgroundColor: bg,
        opacity: disabled ? 0.4 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      {icon ? <Icon name={icon} size={18} color={fg} /> : null}
      {children &&
      typeof children !== 'string' &&
      typeof children !== 'number' ? (
        children
      ) : (
        <Text
          style={
            StyleSheet.create({
              root: {
                fontSize:
                  size === 'sm' ? t.type.label.fontSize : t.type.body.fontSize,
                lineHeight: size === 'sm' ? 21.75 : 24.65,
                fontWeight: '600',
                color: fg,
                textAlign: 'center',
              },
            }).root
          }
        >
          {label ?? children}
        </Text>
      )}
    </Pressable>
  );
}

function ListSection({
  title,
  subtitle,
  note,
  children,
  plain,
}: ListSectionProps) {
  const t = useTokens();
  return (
    <View
      accessibilityRole="none"
      accessibilityState={{}}
      accessibilityLabel={title ?? '分组'}
      style={
        StyleSheet.create({ root: { marginHorizontal: 16, marginBottom: 24 } })
          .root
      }
    >
      {title ? (
        <View
          style={
            StyleSheet.create({
              root: {
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                paddingHorizontal: 16,
                paddingBottom: 7,
              },
            }).root
          }
        >
          <Text
            accessibilityRole="header"
            style={[
              t.type.caption,
              StyleSheet.create({ root: { color: t.color.ink2 } }).root,
            ]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[
                t.type.caption,
                StyleSheet.create({ root: { color: t.color.ink2 } }).root,
              ]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View
        style={
          StyleSheet.create({
            root: {
              borderRadius: 20,
              backgroundColor: plain ? undefined : t.color.surface,
              overflow: 'hidden',
            },
          }).root
        }
      >
        {children}
      </View>
      {note ? (
        <Text
          style={[
            t.type.caption,
            StyleSheet.create({
              root: {
                color: t.color.ink2,
                paddingTop: 7,
                paddingHorizontal: 16,
              },
            }).root,
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
      height: 0.5,
      backgroundColor: tokens.color.line,
    },
  }).root;
  const body = (
    <>
      <View style={rowTextStyle}>
        <Text
          style={[
            tokens.type.body,
            StyleSheet.create({ root: { color: foreground, lineHeight: 22.1 } })
              .root,
          ]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[
              tokens.type.caption,
              StyleSheet.create({
                root: {
                  color: tokens.color.ink2,
                  lineHeight: 18.2,
                  marginTop: 2,
                },
              }).root,
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={rowRightStyle}>{right}</View> : null}
      {chevron ? (
        <Icon name="chev" color={tokens.color.ink3} size={15} />
      ) : null}
      <View pointerEvents="none" style={rowSeparatorStyle} />
    </>
  );
  const style = {
    minHeight: 50,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: tokens.space.gap,
    paddingHorizontal: tokens.space.pageX,
    paddingVertical: 11,
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
  const t = useTokens();
  return (
    <View accessibilityLabel={label}>
      <View
        style={
          StyleSheet.create({
            root: {
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: 24,
              paddingHorizontal: 20,
              paddingBottom: 6,
            },
          }).root
        }
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}，查看路线图`}
          onPress={onPressBar}
          hitSlop={12}
        >
          <Text
            style={
              StyleSheet.create({
                root: { fontSize: 13, lineHeight: 18, color: t.color.ink2 },
              }).root
            }
          >
            {label.replace('段', '步')}
          </Text>
        </Pressable>
        {right}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={StyleSheet.create({ root: { flexGrow: 0 } }).root}
        contentContainerStyle={
          StyleSheet.create({
            root: {
              gap: 8,
              paddingHorizontal: 16,
              paddingBottom: 10,
            },
          }).root
        }
      >
        {steps.map((step, i) => {
          const now = step.state === 'current',
            done = step.state === 'done';
          const fg = now
            ? t.color.onAccent
            : step.state === 'skipped'
            ? t.color.ink2
            : t.color.ink;
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`第 ${i + 1} 步 ${step.title}`}
              accessibilityState={{ selected: now }}
              hitSlop={{ top: 5, bottom: 5, left: 0, right: 0 }}
              onPress={() => onPressStep(i)}
              style={({ pressed }) => ({
                minHeight: 38,
                paddingLeft: 5,
                paddingRight: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 7,
                borderRadius: 19,
                backgroundColor: now ? t.color.accent : t.color.surface,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View
                style={
                  StyleSheet.create({
                    root: {
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: now
                        ? 'rgba(255,255,255,.24)'
                        : done
                        ? t.color.accent
                        : t.color.surfaceAlt,
                    },
                  }).root
                }
              >
                {done || step.state === 'skipped' ? (
                  <Icon
                    name={done ? 'check' : 'skip'}
                    size={15}
                    color={done ? t.color.onAccent : fg}
                  />
                ) : (
                  <Text
                    style={
                      StyleSheet.create({
                        root: { fontSize: 14, fontWeight: '600', color: fg },
                      }).root
                    }
                  >
                    {i + 1}
                  </Text>
                )}
              </View>
              <Text
                style={
                  StyleSheet.create({
                    root: {
                      fontSize: 14,
                      fontWeight: now ? '600' : '400',
                      lineHeight: 20.3,
                      color: fg,
                      textDecorationLine:
                        step.state === 'skipped' ? 'line-through' : 'none',
                    },
                  }).root
                }
              >
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
  const t = useTokens();
  return (
    <ScrollView
      horizontal
      style={StyleSheet.create({ root: { flexGrow: 0, flexShrink: 0 } }).root}
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={
        StyleSheet.create({
          root: {
            gap: 8,
            paddingHorizontal: 16,
            paddingBottom: 10,
          },
        }).root
      }
    >
      {items.map(item => {
        const solid = item.kind === 'primary' || item.kind === 'detour',
          fg = solid ? t.color.onAccent : t.color.ink;
        return (
          <Glass
            key={item.key}
            strength="regular"
            blurEnabled={!solid}
            style={
              StyleSheet.create({
                root: {
                  borderRadius: 20,
                  backgroundColor:
                    item.kind === 'primary'
                      ? t.color.accent
                      : item.kind === 'detour'
                      ? t.color.detour
                      : t.color.glass,
                  ...t.elevation.pop,
                },
              }).root
            }
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.label}
              onPress={() => onPress(item.key)}
              hitSlop={4}
              style={({ pressed }) => ({
                minHeight: 40,
                paddingHorizontal: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              {item.icon ? (
                <Icon name={item.icon} color={fg} size={17} />
              ) : null}
              <Text
                style={
                  StyleSheet.create({
                    root: {
                      fontSize: 15,
                      lineHeight: 21.75,
                      fontWeight: solid ? '600' : '500',
                      color: fg,
                    },
                  }).root
                }
              >
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
  focusRequest,
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
  const t = useTokens();
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  useEffect(() => {
    if (focusRequest) inputRef.current?.focus();
  }, [focusRequest]);
  return (
    <View
      accessibilityLabel="提问输入区"
      accessibilityState={{ busy: !!busy }}
      style={
        StyleSheet.create({
          root: { paddingHorizontal: 16, paddingBottom: 30 },
        }).root
      }
    >
      {quote ? (
        <Glass
          strength="regular"
          style={
            StyleSheet.create({ root: { borderRadius: 19, marginBottom: 8 } })
              .root
          }
        >
          <View
            style={
              StyleSheet.create({
                root: {
                  minHeight: 38,
                  paddingVertical: 4,
                  paddingLeft: 14,
                  paddingRight: 4,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                },
              }).root
            }
          >
            {quote.page && quote.excerpt !== undefined ? (
              <>
                <Text
                  style={
                    StyleSheet.create({
                      root: {
                        fontSize: t.type.caption.fontSize,
                        color: t.color.accent,
                        fontWeight: '600',
                        flexShrink: 0,
                      },
                    }).root
                  }
                >
                  引用 {quote.page}
                </Text>
                <Text
                  numberOfLines={1}
                  style={
                    StyleSheet.create({
                      root: {
                        flex: 1,
                        minWidth: 0,
                        fontSize: t.type.caption.fontSize,
                        fontFamily: t.type.serifFamily,
                        color: t.color.ink2,
                      },
                    }).root
                  }
                >
                  {quote.excerpt}
                </Text>
              </>
            ) : (
              <Text
                numberOfLines={1}
                style={
                  StyleSheet.create({
                    root: {
                      flex: 1,
                      fontSize: t.type.caption.fontSize,
                      color: t.color.ink2,
                    },
                  }).root
                }
              >
                {quote.label}
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="取消引用"
              hitSlop={9}
              onPress={quote.onClear}
              style={
                StyleSheet.create({
                  root: {
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: t.color.surfaceAlt,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                }).root
              }
            >
              <Icon name="close" size={13} color={t.color.ink2} />
            </Pressable>
          </View>
        </Glass>
      ) : null}
      <Glass
        strength="regular"
        style={
          StyleSheet.create({ root: { borderRadius: 26, ...t.elevation.pop } })
            .root
        }
      >
        <View
          style={
            StyleSheet.create({
              root: {
                minHeight: 52,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingLeft: 18,
                paddingRight: 6,
              },
            }).root
          }
        >
          <TextInput
            ref={inputRef}
            accessibilityLabel={placeholder}
            value={value}
            onChangeText={onChange}
            placeholder={placeholder}
            placeholderTextColor={t.color.ink2}
            style={
              StyleSheet.create({
                root: {
                  flex: 1,
                  minWidth: 0,
                  fontSize: 17,
                  color: t.color.ink,
                  padding: 0,
                },
              }).root
            }
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="语音提问"
            accessibilityState={{ disabled: !micAvailable }}
            onPress={onMic}
            disabled={!micAvailable}
            hitSlop={4}
            style={
              StyleSheet.create({
                root: {
                  width: 40,
                  height: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
              }).root
            }
          >
            <Icon name="mic" size={20} color={t.color.ink2} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={busy ? '停止' : '发送'}
            accessibilityState={{ disabled: busy ? !onStop : sendDisabled }}
            disabled={busy ? !onStop : sendDisabled}
            onPress={busy ? onStop : onSend}
            hitSlop={4}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: t.color.accent,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Icon
              name={busy ? 'stop' : 'send'}
              color={t.color.onAccent}
              size={busy ? 14 : 20}
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
  danger = false,
  onConfirm,
  onCancel,
}: DialogProps) {
  const tokens = useTokens();
  const { reduceMotion } = useSkin();
  const [presented, setPresented] = useState(visible);
  const wasVisible = useRef(visible);
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const scale = useRef(new Animated.Value(reduceMotion ? 1 : 1.12)).current;
  const scrim = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    const previous = wasVisible.current;
    wasVisible.current = visible;
    if (visible) setPresented(true);
    if (reduceMotion || (!visible && !previous)) {
      opacity.setValue(visible ? 1 : 0);
      scale.setValue(visible ? 1 : 1.12);
      scrim.setValue(visible ? 1 : 0);
      if (!visible) setPresented(false);
      return;
    }
    if (visible && !previous) {
      opacity.setValue(0);
      scale.setValue(1.12);
      scrim.setValue(0);
    }
    const easing = Easing.bezier(...tokens.motion.easing);
    const transition = Animated.parallel([
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: 200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: visible ? 1 : 1.12,
        duration: 320,
        easing,
        useNativeDriver: true,
      }),
      Animated.timing(scrim, {
        toValue: visible ? 1 : 0,
        duration: 300,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]);
    transition.start(({ finished }) => {
      if (finished && !visible) setPresented(false);
    });
    return () => transition.stop();
  }, [visible, reduceMotion, opacity, scale, scrim, tokens.motion.easing]);
  const s = StyleSheet.create({
    mask: {
      flex: 1,
      paddingHorizontal: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrim: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: tokens.color.scrim,
    },
    scrimTarget: { flex: 1 },
    card: {
      width: '100%',
      maxWidth: 300,
      maxHeight: '90%',
      borderRadius: 28,
      boxShadow: '0 20px 60px rgba(0,0,0,.25)',
    },
    scroll: { flexGrow: 0, borderRadius: 28, overflow: 'hidden' },
    surface: {
      borderRadius: 28,
      borderWidth: 0,
      boxShadow: `inset 0 0 0 .5px ${tokens.color.glassLine}`,
    },
    title: {
      ...tokens.type.body,
      fontWeight: '600',
      lineHeight: tokens.type.body.fontSize * 1.3,
      color: tokens.color.ink,
      textAlign: 'center',
      paddingTop: 20,
      paddingHorizontal: 18,
      paddingBottom: 2,
    },
    body: {
      ...tokens.type.caption,
      lineHeight: tokens.type.caption.fontSize * 1.55,
      color: tokens.color.ink,
      textAlign: 'center',
      paddingTop: 6,
      paddingHorizontal: 18,
      paddingBottom: 18,
    },
    bodySlot: { paddingTop: 6, paddingHorizontal: 18, paddingBottom: 18 },
    actions: {
      flexDirection: 'row',
      borderTopWidth: 0.5,
      borderColor: tokens.color.line,
    },
    action: {
      flex: 1,
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
    },
    divider: { borderLeftWidth: 0.5, borderColor: tokens.color.line },
    pressed: { backgroundColor: tokens.color.pressed },
    actionText: {
      ...tokens.type.body,
      lineHeight: tokens.type.body.fontSize * 1.45,
      color: tokens.color.accent,
      textAlign: 'center',
      fontWeight: '400',
    },
    confirmText: {
      color: danger ? tokens.color.bad : tokens.color.accent,
      fontWeight: '600',
    },
  });
  return (
    <Modal
      visible={presented}
      transparent
      animationType="none"
      onRequestClose={onCancel}
    >
      <View style={s.mask} pointerEvents={visible ? 'auto' : 'none'}>
        <Animated.View style={[s.scrim, { opacity: scrim }]}>
          <Pressable
            style={s.scrimTarget}
            accessibilityRole="button"
            accessibilityLabel="关闭对话框"
            accessibilityState={{ disabled: false }}
            onPress={onCancel}
          />
        </Animated.View>
        <Animated.View
          testID="glass-dialog-card"
          style={[s.card, { opacity, transform: [{ scale }] }]}
        >
          <ScrollView
            style={s.scroll}
            keyboardShouldPersistTaps="handled"
            bounces={false}
            automaticallyAdjustKeyboardInsets
            keyboardDismissMode="interactive"
          >
            <Glass strength="strong" style={s.surface}>
              <View
                accessibilityRole="alert"
                accessibilityLabel={title}
                accessibilityState={{ expanded: visible }}
                accessibilityViewIsModal
                onAccessibilityEscape={onCancel}
              >
                <Text accessibilityRole="header" style={s.title}>
                  {title}
                </Text>
                {typeof body === 'string' ? (
                  <Text style={s.body}>{body}</Text>
                ) : (
                  <View testID="dialog-body-slot" style={s.bodySlot}>
                    {body}
                  </View>
                )}
                <View testID="glass-dialog-actions" style={s.actions}>
                  {cancel ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={cancel}
                      accessibilityState={{ disabled: false }}
                      hitSlop={1}
                      onPress={onCancel}
                      style={({ pressed }) => [s.action, pressed && s.pressed]}
                    >
                      <Text style={s.actionText}>{cancel}</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={confirm}
                    accessibilityState={{ disabled: false }}
                    hitSlop={1}
                    onPress={onConfirm}
                    style={({ pressed }) => [
                      s.action,
                      cancel && s.divider,
                      pressed && s.pressed,
                    ]}
                  >
                    <Text style={[s.actionText, s.confirmText]}>{confirm}</Text>
                  </Pressable>
                </View>
              </View>
            </Glass>
          </ScrollView>
        </Animated.View>
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
