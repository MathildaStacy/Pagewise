import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ComponentMap, KitProps } from '../../kit/contracts';
import { useSkin, useTokens } from '../../kit/context';
import { Icon } from '../../kit/Icon';
import { Gradient } from '../../kit/Gradient';
import { GlassSurface } from '../../kit/base/overlays';
import { Note as BaseNote } from '../../kit/base/controls';
import { Cover } from './Cover';

function AppBar({
  title,
  subtitle,
  variant,
  onBack,
  backLabel = '返回',
  right,
  scrollY = 0,
  part = 'all',
}: KitProps['AppBar']) {
  const t = useTokens(),
    kind = t.brand!.kind;
  if (part === 'largeTitle') return null;
  const root = variant === 'root',
    win = kind === 'win11',
    google = kind === 'google';
  return (
    <View
      testID={`${kind}-appbar`}
      accessibilityRole="header"
      accessibilityLabel={title}
      style={
        StyleSheet.create({
          root: {
            minHeight: root && win ? 76 : google ? 64 : win ? 52 : 56,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: root ? (win ? 20 : 16) : google ? 4 : 8,
            paddingVertical: win && root ? 10 : 0,
            backgroundColor: win
              ? scrollY > 2
                ? t.color.glassStrong
                : 'transparent'
              : google && scrollY > 2
              ? t.color.surfaceFill
              : t.color.header,
            borderBottomWidth: scrollY > 2 ? StyleSheet.hairlineWidth : 0,
            borderColor: t.color.line,
          },
        }).root
      }
    >
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          hitSlop={4}
          android_ripple={{ color: t.color.pressed, borderless: true }}
          style={
            StyleSheet.create({
              root: {
                width: 40,
                minHeight: 48,
                alignItems: 'center',
                justifyContent: 'center',
              },
            }).root
          }
        >
          <Icon name="back" size={24} color={t.color.ink} />
        </Pressable>
      ) : null}
      <View
        style={
          StyleSheet.create({
            root: {
              flex: 1,
              minWidth: 0,
              alignItems: win && !root ? 'center' : 'flex-start',
            },
          }).root
        }
      >
        {win && root && subtitle ? (
          <Text
            numberOfLines={1}
            style={[t.type.caption, { color: t.color.ink2 }]}
          >
            {subtitle}
          </Text>
        ) : null}
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={[
            root ? t.type.largeTitle : t.type.title,
            {
              color:
                kind === 'meta' && root && title === 'Pagewise'
                  ? t.color.accent
                  : t.color.ink,
            },
          ]}
        >
          {title}
        </Text>
        {subtitle && !(win && root) ? (
          <Text
            numberOfLines={1}
            style={[t.type.caption, { color: t.color.ink2 }]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View
        style={
          StyleSheet.create({
            root: {
              flexShrink: 0,
              minWidth: win && !root ? 40 : 0,
              alignItems: 'flex-end',
            },
          }).root
        }
      >
        {right}
      </View>
    </View>
  );
}

function IconButton({
  icon,
  variant = 'push',
  label,
  onPress,
  disabled,
  badge,
}: KitProps['IconButton']) {
  const t = useTokens(),
    kind = t.brand!.kind,
    raised = variant === 'root' && kind === 'win11';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      android_ripple={{
        color: t.color.pressed,
        borderless: !raised,
        foreground: raised,
      }}
      style={({ pressed }) =>
        StyleSheet.create({
          root: {
            width: 40,
            height: 40,
            borderRadius: kind === 'win11' ? 12 : 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: pressed
              ? t.color.pressed
              : kind === 'meta'
              ? t.color.surfaceAlt
              : raised
              ? t.brand!.cardHi
              : 'transparent',
            borderWidth: raised ? 1 : 0,
            borderColor: t.brand?.stroke,
            ...(raised ? t.elevation.card : {}),
            opacity: disabled ? 0.4 : 1,
          },
        }).root
      }
    >
      <Icon
        name={icon}
        size={kind === 'google' ? 24 : 21}
        color={t.color.ink}
      />
      {badge != null ? (
        <Text
          style={
            StyleSheet.create({
              root: {
                ...t.type.micro,
                position: 'absolute',
                top: 0,
                right: 0,
                borderRadius: 10,
                backgroundColor: t.color.bad,
                color: t.color.onAccent,
                paddingHorizontal: 4,
              },
            }).root
          }
        >
          {badge}
        </Text>
      ) : null}
    </Pressable>
  );
}

function TabBar({ items, active, onSelect }: KitProps['TabBar']) {
  const t = useTokens(),
    b = t.brand!,
    safe = useSafeAreaInsets(),
    win = b.kind === 'win11',
    google = b.kind === 'google';
  return (
    <GlassSurface
      material={win}
      strength="regular"
      style={
        StyleSheet.create({
          root: {
            marginHorizontal: win ? 16 : 0,
            marginBottom: win ? Math.max(26, safe.bottom + 8) : 0,
            borderRadius: win ? 22 : 0,
            backgroundColor: win
              ? t.color.glass
              : google
              ? t.color.surfaceFill
              : t.color.header,
            borderTopWidth: b.kind === 'meta' ? StyleSheet.hairlineWidth : 0,
            borderTopColor: t.color.line,
            paddingHorizontal: google ? 8 : 4,
            paddingTop: google ? 12 : 0,
            paddingBottom: win ? 0 : Math.max(14, safe.bottom),
            ...(win ? t.elevation.pop : {}),
          },
        }).root
      }
    >
      <View
        accessibilityRole="tablist"
        accessibilityLabel="主导航"
        testID={`${b.kind}-tabbar`}
        style={
          StyleSheet.create({
            root: {
              flexDirection: 'row',
              minHeight: win ? 64 : google ? 56 : 58,
            },
          }).root
        }
      >
        {items.map(item => {
          const selected = item.key === active,
            fg = selected ? t.color.accent : t.color.ink2;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected }}
              onPress={() => onSelect(item.key)}
              android_ripple={{ color: t.color.pressed }}
              style={
                StyleSheet.create({
                  root: {
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    minHeight: 48,
                  },
                }).root
              }
            >
              {b.kind === 'meta' && selected ? (
                <View
                  testID="meta-tab-indicator"
                  style={
                    StyleSheet.create({
                      root: {
                        position: 'absolute',
                        top: 0,
                        width: 44,
                        height: 3,
                        backgroundColor: t.color.accent,
                        borderBottomLeftRadius: 3,
                        borderBottomRightRadius: 3,
                      },
                    }).root
                  }
                />
              ) : null}
              <View
                style={
                  StyleSheet.create({
                    root: {
                      width: google ? 64 : 40,
                      height: 32,
                      borderRadius: 16,
                      overflow: 'hidden',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor:
                        google && selected
                          ? b.secondaryContainer
                          : 'transparent',
                    },
                  }).root
                }
              >
                <Icon
                  name={item.icon}
                  filled={selected}
                  size={b.kind === 'meta' ? 26 : win ? 22 : 24}
                  color={google && selected ? b.onSecondaryContainer : fg}
                />
                {item.badge != null ? (
                  <Text
                    style={
                      StyleSheet.create({
                        root: {
                          position: 'absolute',
                          left: '60%',
                          top: -2,
                          minWidth: 17,
                          paddingHorizontal: 4,
                          borderRadius: 10,
                          backgroundColor: t.color.bad,
                          color:
                            t.scheme === 'dark' && b.kind !== 'meta'
                              ? t.color.badBg
                              : '#FFFFFF',
                          fontSize: 11,
                          lineHeight: 17,
                          fontWeight: '600',
                          textAlign: 'center',
                        },
                      }).root
                    }
                  >
                    {item.badge}
                  </Text>
                ) : null}
              </View>
              <Text
                style={
                  StyleSheet.create({
                    root: {
                      ...t.type.micro,
                      fontSize: google ? 12 : 11,
                      color: google ? t.color.ink : fg,
                      fontWeight: selected ? '600' : '400',
                    },
                  }).root
                }
              >
                {item.label}
              </Text>
              {win && selected ? (
                <View
                  testID="win11-tab-indicator"
                  style={
                    StyleSheet.create({
                      root: {
                        width: 16,
                        height: 3,
                        backgroundColor: t.color.accent,
                        borderRadius: 2,
                        position: 'absolute',
                        bottom: 4,
                      },
                    }).root
                  }
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </GlassSurface>
  );
}

function Segmented({
  options,
  value,
  onChange,
  accessibilityLabel = '选项',
}: KitProps['Segmented']) {
  const t = useTokens(),
    b = t.brand!,
    google = b.kind === 'google',
    win = b.kind === 'win11';
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={
        StyleSheet.create({
          root: {
            flexDirection: 'row',
            gap: google ? 0 : 4,
            borderRadius: google ? 20 : 0,
            borderWidth: google ? 1 : 0,
            borderColor: t.color.fieldBorder,
            overflow: 'hidden',
            flexWrap: win ? 'wrap' : 'nowrap',
          },
        }).root
      }
    >
      {options.map((option, index) => {
        const on = value === option.key;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: on }}
            onPress={() => onChange(option.key)}
            hitSlop={7}
            android_ripple={{ color: t.color.pressed }}
            style={
              StyleSheet.create({
                root: {
                  flex: 1,
                  minWidth: 0,
                  minHeight: win ? 36 : 34,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 3,
                  borderLeftWidth: google && index > 0 ? 1 : 0,
                  borderColor: t.color.fieldBorder,
                  borderRadius: google ? 0 : win ? 10 : 17,
                  backgroundColor: on
                    ? google
                      ? b.secondaryContainer
                      : win
                      ? t.color.surface
                      : t.color.accentBg
                    : win || google
                    ? 'transparent'
                    : t.color.surfaceAlt,
                },
              }).root
            }
          >
            {google && on ? (
              <Icon name="check" size={16} color={b.onSecondaryContainer} />
            ) : null}
            <Text
              numberOfLines={2}
              style={
                StyleSheet.create({
                  root: {
                    ...t.type.label,
                    fontSize: 14,
                    color: on
                      ? google
                        ? b.onSecondaryContainer
                        : win
                        ? t.color.ink
                        : t.color.accentInk
                      : t.color.ink,
                    fontWeight: on ? '600' : '500',
                    textAlign: 'center',
                    flexShrink: 1,
                  },
                }).root
              }
            >
              {option.label}
            </Text>
            {win && on ? (
              <View
                style={
                  StyleSheet.create({
                    root: {
                      position: 'absolute',
                      bottom: 3,
                      width: 14,
                      height: 3,
                      borderRadius: 2,
                      backgroundColor: t.color.accent,
                    },
                  }).root
                }
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
function ModeSwitch({ value, onChange }: KitProps['ModeSwitch']) {
  const t = useTokens(),
    kind = t.brand!.kind;
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="学习方式"
      style={
        StyleSheet.create({
          root: {
            flexDirection: 'row',
            gap: kind === 'google' ? 0 : 4,
            borderWidth: kind === 'google' ? 1 : 0,
            borderColor: t.color.fieldBorder,
            borderRadius: kind === 'google' ? 18 : 0,
            overflow: 'hidden',
            flexShrink: 0,
          },
        }).root
      }
    >
      {(['read', 'listen'] as const).map((key, i) => (
        <Pressable
          key={key}
          accessibilityRole="tab"
          accessibilityLabel={key === 'read' ? '读书' : '听讲'}
          accessibilityState={{ selected: value === key }}
          onPress={() => onChange(key)}
          hitSlop={8}
          style={
            StyleSheet.create({
              root: {
                minWidth: kind === 'win11' ? 78 : 44,
                minHeight: kind === 'win11' ? 36 : 32,
                paddingHorizontal: kind === 'win11' ? 10 : 8,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                borderLeftWidth: kind === 'google' && i > 0 ? 1 : 0,
                borderColor: t.color.fieldBorder,
                borderRadius: kind === 'google' ? 0 : kind === 'meta' ? 18 : 10,
                backgroundColor:
                  value === key
                    ? kind === 'win11'
                      ? t.brand!.cardHi
                      : t.brand!.secondaryContainer
                    : kind === 'meta'
                    ? t.color.surfaceAlt
                    : undefined,
              },
            }).root
          }
        >
          {kind === 'win11' ? (
            <Icon
              name={key === 'read' ? 'book' : 'teach'}
              size={16}
              color={value === key ? t.color.ink : t.color.ink2}
            />
          ) : null}
          <Text
            numberOfLines={1}
            style={
              StyleSheet.create({
                root: {
                  ...t.type.label,
                  fontSize: kind === 'win11' ? 14 : 13,
                  color:
                    value === key && kind === 'meta'
                      ? t.color.accentInk
                      : t.color.ink,
                  fontWeight: value === key ? '600' : '400',
                },
              }).root
            }
          >
            {key === 'read' ? '读书' : '听讲'}
          </Text>
          {kind === 'win11' && value === key ? (
            <View
              style={
                StyleSheet.create({
                  root: {
                    position: 'absolute',
                    bottom: 2,
                    width: 14,
                    height: 3,
                    borderRadius: 2,
                    backgroundColor: t.color.accent,
                  },
                }).root
              }
            />
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}
function Switch({
  value,
  onChange,
  disabled,
  accessibilityLabel,
}: KitProps['Switch']) {
  const t = useTokens(),
    b = t.brand!,
    google = b.kind === 'google',
    win = b.kind === 'win11';
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      hitSlop={win ? 14 : 10}
      style={
        StyleSheet.create({
          root: {
            width: google ? 52 : win ? 40 : 46,
            height: google ? 32 : win ? 20 : 26,
            borderRadius: 20,
            backgroundColor: value ? b.accentFill : t.color.switchOff,
            borderWidth: google && !value ? 2 : win ? 1 : 0,
            borderColor: t.color.ink2,
            opacity: disabled ? 0.4 : 1,
            justifyContent: 'center',
            paddingHorizontal: google ? 4 : 3,
          },
        }).root
      }
    >
      <View
        style={
          StyleSheet.create({
            root: {
              width: google ? (value ? 24 : 16) : win ? 12 : 20,
              height: google ? (value ? 24 : 16) : win ? 12 : 20,
              borderRadius: 12,
              backgroundColor: value
                ? t.color.onAccent
                : google
                ? t.color.ink2
                : t.color.thumb,
              alignSelf: value ? 'flex-end' : 'flex-start',
              alignItems: 'center',
              justifyContent: 'center',
            },
          }).root
        }
      >
        {google && value ? (
          <Icon name="check" size={16} color={b.accentFill} />
        ) : null}
      </View>
    </Pressable>
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
}: KitProps['Button']) {
  const t = useTokens(),
    b = t.brand!,
    { reduceMotion } = useSkin();
  const primary = variant === 'primary',
    detour = variant === 'detour',
    text = variant === 'text',
    google = b.kind === 'google',
    win = b.kind === 'win11';
  const fg = primary
    ? t.color.onAccent
    : detour
    ? b.onDetour
    : variant === 'danger'
    ? t.color.badInk
    : google || text
    ? t.color.accent
    : t.color.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ??
        label ??
        (typeof children === 'string' ? children : undefined)
      }
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={size === 'sm' ? 8 : 4}
      android_ripple={{
        color: primary || detour ? 'rgba(255,255,255,.18)' : t.color.pressed,
      }}
      style={({ pressed }) => ({
        minHeight:
          size === 'sm'
            ? 32
            : size === 'block'
            ? 48
            : b.kind === 'meta'
            ? 44
            : 40,
        paddingHorizontal: size === 'sm' ? 12 : google ? 24 : 18,
        paddingVertical: 8,
        flexDirection: 'row',
        gap: 6,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: size === 'block' ? 'stretch' : 'flex-start',
        borderRadius: b.kind === 'meta' ? 6 : google && pressed ? 12 : 999,
        borderWidth: (google || win) && !primary && !detour && !text ? 1 : 0,
        borderColor: t.color.fieldBorder,
        backgroundColor: primary
          ? b.accentFill
          : detour
          ? b.detourFill
          : text || google
          ? 'transparent'
          : win
          ? b.cardHi
          : t.color.surfaceAlt,
        ...(win && !disabled
          ? primary
            ? b.accentShadow
            : detour
            ? b.detourShadow
            : {}
          : {}),
        opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        transform: [
          {
            scale:
              pressed && !reduceMotion && !google ? t.motion.pressScale : 1,
          },
        ],
      })}
    >
      {icon ? <Icon name={icon} color={fg} size={18} /> : null}
      <Text
        style={
          StyleSheet.create({
            root: {
              ...t.type.label,
              color: fg,
              textAlign: 'center',
              flexShrink: 1,
              fontWeight: b.kind === 'meta' ? '600' : '500',
            },
          }).root
        }
      >
        {children ?? label}
      </Text>
    </Pressable>
  );
}
function QuickActions({ items, onPress }: KitProps['QuickActions']) {
  const t = useTokens();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={StyleSheet.create({ root: { flexGrow: 0, flexShrink: 0 } }).root}
      contentContainerStyle={
        StyleSheet.create({
          root: {
            paddingHorizontal: 16,
            paddingVertical: t.brand!.kind === 'meta' ? 8 : 10,
            gap: 8,
          },
        }).root
      }
    >
      {items.map(item => (
        <Button
          key={item.key}
          size="sm"
          variant={item.kind ?? 'secondary'}
          icon={item.icon}
          label={item.label}
          onPress={() => onPress(item.key)}
        />
      ))}
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
  onAdd,
  busy,
  onStop,
}: KitProps['Composer']) {
  const t = useTokens(),
    b = t.brand!,
    safe = useSafeAreaInsets(),
    [focused, setFocused] = useState(false),
    meta = b.kind === 'meta',
    win = b.kind === 'win11';
  const mic = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="语音提问"
      accessibilityState={{ disabled: !micAvailable }}
      disabled={!micAvailable}
      onPress={onMic}
      style={
        StyleSheet.create({
          root: {
            width: meta ? 40 : 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: micAvailable ? 1 : 0.4,
          },
        }).root
      }
    >
      <Icon name="mic" size={24} color={meta ? t.color.accent : t.color.ink2} />
    </Pressable>
  );
  const input = (
    <View
      style={
        StyleSheet.create({
          root: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: meta ? 4 : 0,
            minHeight: meta ? 44 : win ? 49 : 54,
            paddingLeft: meta ? 4 : win ? 8 : 16,
            paddingRight: 4,
            backgroundColor: win
              ? t.color.surface
              : meta
              ? t.color.surface
              : t.color.surfaceAlt,
            borderRadius: 28,
          },
        }).root
      }
    >
      {meta ? (
        mic
      ) : win ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="添加"
          accessibilityState={{ disabled: !onAdd }}
          disabled={!onAdd}
          onPress={onAdd}
          hitSlop={4}
          style={
            StyleSheet.create({
              root: {
                width: 36,
                height: 42,
                alignItems: 'center',
                justifyContent: 'center',
              },
            }).root
          }
        >
          <Icon name="add" size={20} color={t.color.ink2} />
        </Pressable>
      ) : null}
      <TextInput
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        placeholderTextColor={t.color.ink2}
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={
          StyleSheet.create({
            root: {
              ...t.type.body,
              fontSize: win ? 15 : 16,
              flex: 1,
              minWidth: 0,
              color: t.color.ink,
              backgroundColor: meta ? t.color.surfaceFill : 'transparent',
              paddingHorizontal: meta ? 16 : 0,
              paddingVertical: meta ? 8 : 0,
              borderRadius: 19,
              minHeight: meta ? 38 : win ? 46 : 48,
            },
          }).root
        }
      />
      {!meta ? mic : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={busy ? '停止' : '发送'}
        accessibilityState={{ disabled: busy ? !onStop : sendDisabled }}
        disabled={busy ? !onStop : sendDisabled}
        onPress={busy ? onStop : onSend}
        android_ripple={{ color: t.color.pressed }}
        style={
          StyleSheet.create({
            root: {
              width: meta ? 40 : 44,
              height: 44,
              borderRadius: 24,
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: meta ? 'transparent' : b.accentFill,
              opacity: !busy && sendDisabled ? 0.45 : 1,
            },
          }).root
        }
      >
        {win ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Gradient
              colors={b.ai}
              style={StyleSheet.create({ root: { flex: 1 } }).root}
            />
          </View>
        ) : null}
        <Icon
          name={busy ? 'stop' : 'send'}
          size={busy ? 18 : 24}
          color={meta ? t.color.accent : win ? '#FFFFFF' : t.color.onAccent}
        />
      </Pressable>
    </View>
  );
  return (
    <View
      accessibilityLabel="提问输入区"
      accessibilityState={{ busy: !!busy }}
      style={
        StyleSheet.create({
          root: {
            paddingBottom: Math.max(12, safe.bottom),
            backgroundColor: meta ? t.color.surface : 'transparent',
            marginHorizontal: win ? 16 : 0,
            marginBottom: win ? 12 : 0,
            paddingHorizontal: win ? 0 : meta ? 0 : 16,
          },
        }).root
      }
    >
      {quote ? (
        <View
          style={
            StyleSheet.create({
              root: {
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                padding: 10,
                marginBottom: 6,
                backgroundColor: t.color.surfaceAlt,
                borderRadius: 12,
              },
            }).root
          }
        >
          <Text
            numberOfLines={2}
            style={
              StyleSheet.create({
                root: { ...t.type.caption, color: t.color.ink2, flex: 1 },
              }).root
            }
          >
            {quote.page && quote.excerpt !== undefined
              ? `引用 ${quote.page} · ${quote.excerpt}`
              : quote.label}
          </Text>
          <IconButton label="取消引用" icon="close" onPress={quote.onClear} />
        </View>
      ) : null}
      {win ? (
        <Gradient
          colors={b.ai}
          style={
            StyleSheet.create({
              root: {
                padding: focused ? 2 : 1.5,
                borderRadius: 28,
                ...b.aiGlow,
              },
            }).root
          }
        >
          {input}
        </Gradient>
      ) : (
        input
      )}
    </View>
  );
}

function StepProgress({
  steps,
  label,
  onPressStep,
  onPressBar,
  right,
}: KitProps['StepProgress']) {
  const t = useTokens(),
    b = t.brand!,
    meta = b.kind === 'meta',
    win = b.kind === 'win11';
  return (
    <View
      testID={`${b.kind}-step-progress`}
      style={
        StyleSheet.create({
          root: {
            backgroundColor: meta
              ? t.color.surface
              : win
              ? b.card ?? t.color.glass
              : 'transparent',
            marginHorizontal: win ? 16 : 0,
            marginBottom: win ? 12 : 0,
            padding: win ? 12 : 0,
            borderRadius: win ? 16 : 0,
            borderBottomWidth: meta ? StyleSheet.hairlineWidth : 0,
            borderColor: t.color.line,
          },
        }).root
      }
    >
      <View
        style={
          StyleSheet.create({
            root: {
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: win ? 0 : 16,
              paddingTop: win ? 0 : 6,
              paddingBottom: 4,
              gap: 8,
            },
          }).root
        }
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}，查看路线图`}
          onPress={onPressBar}
          hitSlop={10}
          style={
            StyleSheet.create({
              root: {
                flexDirection: win ? 'row' : 'column',
                alignItems: win ? 'center' : 'flex-start',
                flexShrink: 1,
              },
            }).root
          }
        >
          <Text
            style={
              StyleSheet.create({
                root: {
                  ...t.type.caption,
                  color: win ? t.color.accentInk : t.color.ink2,
                  fontWeight: '600',
                },
              }).root
            }
          >
            {label}
          </Text>
          {win ? (
            <Text
              numberOfLines={1}
              style={
                StyleSheet.create({
                  root: {
                    ...t.type.label,
                    fontSize: 13,
                    color: t.color.ink,
                    marginLeft: 6,
                  },
                }).root
              }
            >
              {steps.find(step => step.state === 'current')?.title ??
                steps.at(-1)?.title}
            </Text>
          ) : null}
        </Pressable>
        {right}
      </View>
      {win ? (
        <View
          style={
            StyleSheet.create({
              root: { flexDirection: 'row', gap: 5, paddingTop: 8 },
            }).root
          }
        >
          {steps.map((step, i) => (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`第 ${i + 1} 步 ${step.title}`}
              accessibilityState={{ selected: step.state === 'current' }}
              onPress={() => onPressStep(i)}
              hitSlop={8}
              style={StyleSheet.create({ root: { flex: 1, gap: 6 } }).root}
            >
              <View
                style={
                  StyleSheet.create({
                    root: {
                      height: 4,
                      borderRadius: 2,
                      overflow: 'hidden',
                      backgroundColor:
                        step.state === 'done' || step.state === 'skipped'
                          ? t.color.accent
                          : t.color.line,
                    },
                  }).root
                }
              >
                {step.state === 'current' ? (
                  <Gradient
                    colors={b.ai}
                    style={StyleSheet.create({ root: { flex: 1 } }).root}
                  />
                ) : null}
              </View>
              <Text
                numberOfLines={1}
                style={
                  StyleSheet.create({
                    root: {
                      ...t.type.caption,
                      fontSize: 10.5,
                      color:
                        step.state === 'current' ? t.color.ink : t.color.ink2,
                    },
                  }).root
                }
              >
                {step.title}
                {step.state === 'done' ? ' ✓' : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={
            StyleSheet.create({
              root: {
                gap: meta ? 2 : 8,
                flexGrow: meta ? 1 : 0,
                paddingHorizontal: meta ? 8 : 16,
                paddingTop: 4,
                paddingBottom: 10,
              },
            }).root
          }
        >
          {steps.map((step, i) => {
            const current = step.state === 'current',
              done = step.state === 'done',
              fg = current || done ? t.color.accentInk : t.color.ink2;
            const circle = (
              <View
                style={
                  StyleSheet.create({
                    root: {
                      width: meta ? 46 : 22,
                      height: meta ? 46 : 22,
                      borderRadius: 24,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: done
                        ? b.accentFill
                        : current
                        ? t.color.accentBg
                        : t.color.surfaceAlt,
                    },
                  }).root
                }
              >
                {done || step.state === 'skipped' ? (
                  <Icon
                    name={done ? 'check' : 'skip'}
                    size={meta ? 23 : 15}
                    color={done ? t.color.onAccent : fg}
                  />
                ) : (
                  <Text
                    style={
                      StyleSheet.create({
                        root: {
                          ...t.type.label,
                          fontSize: meta ? 17 : 13,
                          fontWeight: '600',
                          color: fg,
                        },
                      }).root
                    }
                  >
                    {i + 1}
                  </Text>
                )}
              </View>
            );
            return (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={`第 ${i + 1} 步 ${step.title}`}
                accessibilityState={{ selected: current }}
                onPress={() => onPressStep(i)}
                android_ripple={{ color: t.color.pressed }}
                style={
                  StyleSheet.create({
                    root: {
                      flex: meta ? 1 : undefined,
                      minWidth: meta ? 76 : undefined,
                      flexDirection: meta ? 'column' : 'row',
                      gap: 5,
                      alignItems: 'center',
                      padding: meta ? 2 : 8,
                      borderWidth: meta ? 0 : 1,
                      borderColor: current ? t.color.accent : t.color.line,
                      borderRadius: meta ? 0 : 9,
                      backgroundColor:
                        !meta && current ? b.secondaryContainer : 'transparent',
                    },
                  }).root
                }
              >
                {meta && current ? (
                  <Gradient
                    colors={b.ai}
                    style={
                      StyleSheet.create({
                        root: { padding: 3, borderRadius: 28 },
                      }).root
                    }
                  >
                    <View
                      style={
                        StyleSheet.create({
                          root: {
                            padding: 2,
                            borderRadius: 25,
                            backgroundColor: t.color.surface,
                          },
                        }).root
                      }
                    >
                      {circle}
                    </View>
                  </Gradient>
                ) : (
                  <View
                    style={
                      StyleSheet.create({
                        root: { marginVertical: meta ? 5 : 0 },
                      }).root
                    }
                  >
                    {circle}
                  </View>
                )}
                <Text
                  numberOfLines={1}
                  style={
                    StyleSheet.create({
                      root: {
                        ...t.type.caption,
                        color: fg,
                        fontWeight: current ? '600' : '400',
                        maxWidth: meta ? 76 : 180,
                        fontSize: meta ? 12 : 13,
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
      )}
    </View>
  );
}

function ListSection({
  title,
  subtitle,
  note,
  children,
  plain,
}: KitProps['ListSection']) {
  const t = useTokens(),
    kind = t.brand!.kind,
    google = kind === 'google';
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={title ?? '列表分组'}
      accessibilityState={{}}
      style={
        StyleSheet.create({
          root: {
            marginHorizontal: google ? 0 : kind === 'meta' ? 12 : 16,
            marginBottom: t.space.sectionGap,
          },
        }).root
      }
    >
      {title || subtitle ? (
        <View
          style={
            StyleSheet.create({
              root: {
                flexDirection: 'row',
                justifyContent: 'space-between',
                gap: 8,
                paddingHorizontal: google ? 24 : 4,
                paddingBottom: 8,
                paddingTop: google ? 8 : 0,
              },
            }).root
          }
        >
          <Text
            accessibilityRole="header"
            style={
              StyleSheet.create({
                root: {
                  ...t.type.label,
                  fontSize: kind === 'meta' ? 17 : 14,
                  fontWeight: kind === 'meta' ? '700' : '500',
                  color: google ? t.color.accent : t.color.ink,
                },
              }).root
            }
          >
            {title}
          </Text>
          <Text
            style={
              StyleSheet.create({
                root: { ...t.type.caption, color: t.color.ink2 },
              }).root
            }
          >
            {subtitle}
          </Text>
        </View>
      ) : null}
      <View
        style={
          StyleSheet.create({
            root: {
              backgroundColor:
                google || plain
                  ? 'transparent'
                  : kind === 'win11'
                  ? t.color.glass
                  : t.color.surface,
              borderRadius: google ? 0 : t.shape.md,
              overflow: 'hidden',
              ...(kind === 'win11'
                ? { borderWidth: 1, borderColor: t.color.glassLine }
                : kind === 'meta'
                ? t.elevation.card
                : {}),
            },
          }).root
        }
      >
        {children}
      </View>
      {note ? (
        <Text
          style={
            StyleSheet.create({
              root: {
                ...t.type.caption,
                color: t.color.ink2,
                paddingHorizontal: google ? 24 : 4,
                paddingTop: 8,
              },
            }).root
          }
        >
          {note}
        </Text>
      ) : null}
    </View>
  );
}
function Row({
  title,
  subtitle,
  right,
  chevron,
  onPress,
  tone,
}: KitProps['Row']) {
  const t = useTokens(),
    b = t.brand!,
    fg =
      tone === 'bad'
        ? t.color.badInk
        : tone === 'stuck'
        ? t.color.stuckInk
        : t.color.ink;
  const children = (
    <>
      <View style={StyleSheet.create({ root: { flex: 1, minWidth: 0 } }).root}>
        <Text
          style={
            StyleSheet.create({
              root: {
                ...t.type.body,
                fontSize: 16,
                color: fg,
                fontWeight: b.kind === 'meta' ? '600' : '400',
              },
            }).root
          }
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={
              StyleSheet.create({
                root: { ...t.type.caption, color: t.color.ink2, marginTop: 2 },
              }).root
            }
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {chevron && b.kind !== 'google' ? (
        <Icon name="chev" size={18} color={t.color.ink3} />
      ) : null}
    </>
  );
  const style = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    minHeight: b.kind === 'google' ? 56 : 52,
    gap: 12,
    paddingHorizontal: b.kind === 'google' ? 24 : 16,
    paddingVertical: 10,
  };
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle].filter(Boolean).join('，')}
      accessibilityState={{ disabled: false }}
      onPress={onPress}
      android_ripple={{ color: t.color.pressed }}
      style={({ pressed }) => [
        style,
        { backgroundColor: pressed ? t.color.pressed : 'transparent' },
      ]}
    >
      {children}
    </Pressable>
  ) : (
    <View style={style}>{children}</View>
  );
}
function Field({
  label,
  value,
  onChange,
  secure,
  multiline,
  placeholder,
  error,
  keyboardType,
}: KitProps['Field']) {
  const t = useTokens(),
    kind = t.brand!.kind;
  return (
    <View
      style={
        StyleSheet.create({
          root: {
            paddingHorizontal: kind === 'google' ? 24 : 16,
            paddingVertical: 10,
          },
        }).root
      }
    >
      <Text
        style={
          StyleSheet.create({
            root: { ...t.type.caption, color: t.color.ink2, marginBottom: 5 },
          }).root
        }
      >
        {label}
      </Text>
      <TextInput
        accessibilityRole="text"
        accessibilityLabel={label}
        accessibilityState={{}}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor={t.color.ink2}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
        style={
          StyleSheet.create({
            root: {
              ...t.type.body,
              color: t.color.ink,
              minHeight: multiline ? 96 : 44,
              padding: 10,
              borderWidth: 1,
              borderColor: error ? t.color.bad : t.color.fieldBorder,
              borderRadius: kind === 'meta' ? 6 : 8,
              backgroundColor: t.color.surfaceFill,
              textAlignVertical: multiline ? 'top' : 'center',
            },
          }).root
        }
      />
      {error ? (
        <Text
          accessibilityRole="alert"
          style={
            StyleSheet.create({
              root: { ...t.type.caption, color: t.color.badInk },
            }).root
          }
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
function Fab({ label, icon, onPress }: KitProps['Fab']) {
  const t = useTokens(),
    b = t.brand!,
    google = b.kind === 'google';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      android_ripple={{ color: t.color.pressed }}
      style={({ pressed }) => ({
        minHeight: google ? 56 : 48,
        flexDirection: 'row',
        alignItems: 'center',
        gap: google ? 12 : 6,
        paddingHorizontal: 20,
        borderRadius: google ? 16 : b.kind === 'meta' ? 8 : 999,
        backgroundColor: google ? t.color.accentBg : b.accentFill,
        opacity: pressed ? 0.85 : 1,
        ...t.elevation.fab,
      })}
    >
      <Icon
        name={icon}
        color={google ? t.color.accentInk : t.color.onAccent}
        size={24}
      />
      <Text
        style={
          StyleSheet.create({
            root: {
              ...t.type.label,
              color: google ? t.color.accentInk : t.color.onAccent,
              fontWeight: '600',
            },
          }).root
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}
function Dialog({
  visible,
  title,
  body,
  confirm,
  cancel,
  danger,
  onConfirm,
  onCancel,
}: KitProps['Dialog']) {
  const t = useTokens(),
    b = t.brand!,
    { reduceMotion } = useSkin(),
    google = b.kind === 'google';
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior="padding"
        style={
          StyleSheet.create({
            root: {
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              padding: 24,
            },
          }).root
        }
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭对话框"
          onPress={onCancel}
          style={[StyleSheet.absoluteFill, { backgroundColor: t.color.scrim }]}
        />
        <View
          accessibilityRole="alert"
          accessibilityViewIsModal
          onAccessibilityEscape={onCancel}
          style={
            StyleSheet.create({
              root: {
                width: '100%',
                maxWidth: 340,
                maxHeight: '85%',
                borderRadius: google ? 28 : b.kind === 'meta' ? 12 : 16,
                backgroundColor: google ? t.color.surfaceAlt : t.color.surface,
                padding: google ? 24 : 16,
                ...t.elevation.pop,
              },
            }).root
          }
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={StyleSheet.create({ root: { flexGrow: 0 } }).root}
          >
            <Text
              accessibilityRole="header"
              style={
                StyleSheet.create({
                  root: {
                    ...t.type.headline,
                    color: t.color.ink,
                    marginBottom: 10,
                    fontWeight: google ? '400' : '600',
                  },
                }).root
              }
            >
              {title}
            </Text>
            {typeof body === 'string' ? (
              <Text
                style={
                  StyleSheet.create({
                    root: { ...t.type.body, color: t.color.ink2 },
                  }).root
                }
              >
                {body}
              </Text>
            ) : (
              body
            )}
            <View
              testID={`${b.kind}-dialog-actions`}
              style={
                StyleSheet.create({
                  root: {
                    flexDirection: 'row',
                    gap: 8,
                    marginTop: 20,
                    justifyContent: 'flex-end',
                  },
                }).root
              }
            >
              {cancel ? (
                <View
                  style={
                    StyleSheet.create({
                      root: { flex: google ? undefined : 1 },
                    }).root
                  }
                >
                  <Button
                    size={google ? 'md' : 'block'}
                    variant={google ? 'text' : 'secondary'}
                    label={cancel}
                    onPress={onCancel}
                  />
                </View>
              ) : null}
              <View
                style={
                  StyleSheet.create({ root: { flex: google ? undefined : 1 } })
                    .root
                }
              >
                <Button
                  size={google ? 'md' : 'block'}
                  variant={danger ? 'danger' : google ? 'text' : 'primary'}
                  label={confirm}
                  onPress={onConfirm}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
function Toast({ message, tone }: KitProps['Toast']) {
  const t = useTokens(),
    b = t.brand!;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
      style={
        StyleSheet.create({
          root: {
            flexDirection: 'row',
            gap: 10,
            alignItems: 'center',
            alignSelf: 'center',
            maxWidth: '94%',
            backgroundColor: b.toastBg,
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderRadius: b.kind === 'google' ? 4 : 8,
            ...t.elevation.pop,
          },
        }).root
      }
    >
      {tone && tone !== 'default' ? (
        <Icon
          name={tone === 'ok' ? 'check' : tone === 'bad' ? 'warning' : 'branch'}
          color={b.toastInk}
          size={20}
        />
      ) : null}
      <Text
        style={
          StyleSheet.create({
            root: { ...t.type.label, color: b.toastInk, flexShrink: 1 },
          }).root
        }
      >
        {message}
      </Text>
    </View>
  );
}
function SelectionMenu({
  anchor,
  items,
  onSelect,
  onDismiss,
  visible = true,
}: KitProps['SelectionMenu']) {
  const t = useTokens(),
    b = t.brand!,
    safe = useSafeAreaInsets(),
    { height } = useWindowDimensions();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View
        style={StyleSheet.create({ root: { flex: 1 } }).root}
        accessibilityViewIsModal
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭选择菜单"
          onPress={onDismiss}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={
            StyleSheet.create({
              root: {
                position: 'absolute',
                top: Math.max(
                  safe.top + 8,
                  Math.min(height - 64, anchor.y - 52),
                ),
                left: 8,
                right: 8,
                alignItems: 'center',
              },
            }).root
          }
        >
          <ScrollView
            horizontal
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={
              StyleSheet.create({
                root: {
                  backgroundColor: b.menuBg,
                  flexDirection: 'row',
                  flexWrap: 'nowrap',
                  borderRadius: b.kind === 'meta' ? 20 : 8,
                  padding: 4,
                  ...t.elevation.pop,
                },
              }).root
            }
          >
            {items.map(item => (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={() => onSelect(item.key)}
                hitSlop={4}
                android_ripple={{ color: t.color.pressed }}
                style={
                  StyleSheet.create({
                    root: {
                      minHeight: 40,
                      paddingHorizontal: 12,
                      justifyContent: 'center',
                    },
                  }).root
                }
              >
                <Text
                  style={
                    StyleSheet.create({
                      root: { ...t.type.label, color: b.menuInk },
                    }).root
                  }
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
function Glass(props: KitProps['Glass']) {
  const t = useTokens();
  return <GlassSurface {...props} material={t.brand!.kind === 'win11'} />;
}
function UserBubble({ text, quote, detour }: KitProps['UserBubble']) {
  const t = useTokens(),
    b = t.brand!,
    google = b.kind === 'google';
  const fg = google
    ? detour
      ? t.color.detour
      : t.color.accentInk
    : detour
    ? b.onDetour
    : t.color.onAccent;
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={[quote, text].filter(Boolean).join('，')}
      accessibilityState={{}}
      style={
        StyleSheet.create({
          root: {
            alignSelf: 'flex-end',
            maxWidth: '82%',
            paddingHorizontal: b.kind === 'meta' ? 13 : 16,
            paddingVertical: 10,
            borderRadius: b.kind === 'meta' ? 18 : 20,
            borderBottomRightRadius: b.kind === 'meta' ? 18 : 5,
            backgroundColor: google
              ? detour
                ? t.color.detourBg
                : t.color.accentBg
              : detour
              ? b.detourFill
              : b.accentFill,
          },
        }).root
      }
    >
      {quote ? (
        <Text
          style={
            StyleSheet.create({
              root: {
                ...t.type.caption,
                color: fg,
                borderLeftWidth: 2,
                borderLeftColor: fg,
                paddingLeft: 8,
                marginBottom: 6,
              },
            }).root
          }
        >
          {quote}
        </Text>
      ) : null}
      <Text
        style={
          StyleSheet.create({
            root: { ...t.type.body, fontSize: 15, lineHeight: 23, color: fg },
          }).root
        }
      >
        {text}
      </Text>
    </View>
  );
}
function StepHeader({ step, title, pages, label }: KitProps['StepHeader']) {
  const t = useTokens(),
    b = t.brand!;
  return (
    <View
      accessibilityRole="header"
      accessibilityLabel={`${label}，第 ${step} 步，${title}，${pages}`}
      accessibilityState={{}}
      style={
        StyleSheet.create({
          root: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 9,
            marginTop: 14,
          },
        }).root
      }
    >
      {b.kind !== 'google' ? (
        <Gradient
          colors={b.ai}
          style={
            StyleSheet.create({
              root: {
                width: 30,
                height: 30,
                borderRadius: 15,
                padding: b.kind === 'meta' ? 3 : 0,
                alignItems: 'center',
                justifyContent: 'center',
              },
            }).root
          }
        >
          {b.kind === 'meta' ? (
            <View
              style={
                StyleSheet.create({
                  root: {
                    backgroundColor: t.color.surface,
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                }).root
              }
            >
              <Icon name="spark" size={14} color={t.color.accent} />
            </View>
          ) : (
            <Icon name="spark" size={17} color="#FFFFFF" />
          )}
        </Gradient>
      ) : null}
      <View style={StyleSheet.create({ root: { flex: 1, minWidth: 0 } }).root}>
        <Text
          style={
            StyleSheet.create({
              root: { ...t.type.caption, color: t.color.ink2 },
            }).root
          }
        >
          第 {step} 步
        </Text>
        <Text
          style={
            StyleSheet.create({
              root: { ...t.type.headline, color: t.color.ink },
            }).root
          }
        >
          {title}
        </Text>
      </View>
      <Text
        style={
          StyleSheet.create({
            root: { ...t.type.caption, color: t.color.ink2 },
          }).root
        }
      >
        {pages}
      </Text>
    </View>
  );
}
function Note({ tone, variant, icon, children }: KitProps['Note']) {
  const t = useTokens();
  if (variant !== 'ai' || t.brand?.kind !== 'win11')
    return <BaseNote tone={tone}>{children}</BaseNote>;
  const s = StyleSheet.create({
    root: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: t.shape.md - 4,
      borderWidth: 1,
      borderColor: t.brand.stroke,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    icon: { paddingTop: 2 },
    text: {
      ...t.type.caption,
      fontSize: t.type.caption.fontSize + 1,
      lineHeight: 20.15,
      color: t.color.ink2,
      flex: 1,
    },
  });
  return (
    <Gradient colors={t.brand.aiSoft} style={s.root}>
      {icon ? (
        <View style={s.icon}>
          <Icon name={icon} size={16} color={t.color.ink2} />
        </View>
      ) : null}
      <Text style={s.text}>{children}</Text>
    </Gradient>
  );
}

export const brandComponents: Partial<ComponentMap> = {
  Cover,
  AppBar,
  TabBar,
  IconButton,
  ModeSwitch,
  Segmented,
  Switch,
  Button,
  QuickActions,
  Composer,
  StepProgress,
  ListSection,
  Row,
  Field,
  Fab,
  Dialog,
  Toast,
  SelectionMenu,
  Glass,
  UserBubble,
  StepHeader,
  Note,
};
