import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { KitProps, Tone } from '../contracts';
import { useSkin, useTokens } from '../context';
import { Icon } from '../Icon';
import { makeStyles } from '../makeStyles';
import * as Kit from '../proxy';
import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
} from 'react';

function tonePair(t: ReturnType<typeof useTokens>, tone: Tone = 'neutral') {
  const c = t.color;
  switch (tone) {
    case 'main':
    case 'accent':
      return [c.accent, c.accentBg];
    case 'detour':
      return [c.detour, c.detourBg];
    case 'stuck':
    case 'warn':
      return [c.stuckInk, c.stuckBg];
    case 'ok':
      return [c.ok, c.okBg];
    case 'bad':
      return [c.badInk, c.badBg];
    case 'derive':
      return [c.derive, c.deriveBg];
    case 'example':
      return [c.example, c.exampleBg];
    case 'pin':
      return [c.pin, c.pinBg];
    case 'muted':
      return [c.ink3, c.surfaceAlt];
    default:
      return [c.ink2, c.surfaceAlt];
  }
}

function textTone(
  t: ReturnType<typeof useTokens>,
  tone: Tone | undefined,
  fallback: string,
) {
  if (tone === 'ok') return t.color.ink;
  if (tone === 'muted') return t.color.ink2;
  if (tone === 'accent' || tone === 'main') return t.color.accentInk;
  return fallback;
}

export function Screen({ scroll, edges, children, style }: KitProps['Screen']) {
  const s = useStyles(),
    t = useTokens();
  const [scrollY, setScrollY] = useState(0);
  const [navigationHeight, setNavigationHeight] = useState(44);
  const parts = Children.toArray(children);
  const first = parts[0];
  const hasHeader =
    isValidElement<KitProps['AppBar']>(first) && first.type === Kit.AppBar;
  const floatingHeader = hasHeader && t.layout.groupedLists;
  const largeTitle = floatingHeader && first.props.variant === 'root';
  const header = hasHeader
    ? cloneElement(first, {
        scrollY,
        part: floatingHeader ? 'navigation' : 'all',
      })
    : null;
  const layout = StyleSheet.create({
    body: { flex: 1 },
    overlayHeader: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
    },
    scrollInset: { paddingTop: navigationHeight },
  });
  return (
    <SafeAreaView
      edges={edges}
      style={[s.screen, style]}
      accessibilityRole="none"
      accessibilityLabel="页面"
      accessibilityState={{}}
    >
      {scroll ? (
        <View style={layout.body}>
          {hasHeader ? (
            <View
              testID="screen-navigation"
              style={floatingHeader ? layout.overlayHeader : undefined}
              onLayout={event => {
                const height = event.nativeEvent.layout.height;
                if (height > 0) setNavigationHeight(height);
              }}
            >
              {header}
            </View>
          ) : null}
          <ScrollView
            onScroll={event => setScrollY(event.nativeEvent.contentOffset.y)}
            scrollEventThrottle={16}
            contentContainerStyle={[
              s.scrollContent,
              floatingHeader ? layout.scrollInset : undefined,
              largeTitle ? s.floatingTabSpace : undefined,
            ]}
            keyboardShouldPersistTaps="handled"
          >
            {largeTitle
              ? cloneElement(first, { scrollY, part: 'largeTitle' })
              : null}
            {hasHeader ? parts.slice(1) : children}
          </ScrollView>
        </View>
      ) : (
        children
      )}
    </SafeAreaView>
  );
}

export function AppBar({
  title,
  subtitle,
  variant,
  onBack,
  backLabel,
  right,
}: KitProps['AppBar']) {
  const s = useStyles();
  const t = useTokens();
  return (
    <View
      style={s.appBar}
      accessibilityRole="none"
      accessibilityLabel={title}
      accessibilityState={{}}
    >
      {variant === 'push' ? (
        <View style={s.barSide}>
          {onBack ? (
            <Kit.IconButton
              icon="back"
              label={backLabel ?? '返回'}
              onPress={onBack}
            />
          ) : null}
        </View>
      ) : null}
      <View style={[s.grow, variant === 'push' ? s.center : s.rootTitle]}>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={[variant === 'root' ? t.type.largeTitle : t.type.title, s.ink]}
        >
          {title}
        </Text>
        {subtitle ? <Text style={s.caption}>{subtitle}</Text> : null}
      </View>
      <View style={[s.barSide, s.right]}>{right}</View>
    </View>
  );
}

export function TabBar({ items, active, onSelect }: KitProps['TabBar']) {
  const s = useStyles();
  const t = useTokens();
  return (
    <View
      style={s.tabBar}
      accessibilityRole="tablist"
      accessibilityLabel="主导航"
      accessibilityState={{}}
    >
      {items.map(item => (
        <Pressable
          key={item.key}
          accessibilityRole="tab"
          accessibilityLabel={item.label}
          accessibilityState={{ selected: active === item.key }}
          onPress={() => onSelect(item.key)}
          style={({ pressed }) => [s.tab, pressed && s.pressed]}
        >
          <View>
            <Icon
              name={item.icon}
              size={22}
              color={active === item.key ? t.color.accent : t.color.ink3}
            />
            {item.badge != null ? (
              <Text style={s.badge}>{item.badge}</Text>
            ) : null}
          </View>
          <Text
            style={[
              s.micro,
              StyleSheet.create({
                root: {
                  color: active === item.key ? t.color.accent : t.color.ink3,
                },
              }).root,
            ]}
          >
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Segmented({
  options,
  value,
  onChange,
  accessibilityLabel,
}: KitProps['Segmented']) {
  const s = useStyles();
  return (
    <View
      style={s.segmented}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel ?? '选项'}
      accessibilityState={{}}
    >
      {options.map(option => (
        <Pressable
          key={option.key}
          accessibilityRole="radio"
          accessibilityLabel={option.label}
          accessibilityState={{ checked: value === option.key }}
          hitSlop={7}
          onPress={() => onChange(option.key)}
          style={({ pressed }) => [
            s.segment,
            value === option.key && s.segmentOn,
            pressed && s.pressed,
          ]}
        >
          <Text style={[s.label, value === option.key && s.strong]}>
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function ModeSwitch({ value, onChange }: KitProps['ModeSwitch']) {
  const s = useStyles();
  const t = useTokens();
  const { reduceMotion } = useSkin();
  const slide = useRef(new Animated.Value(value === 'read' ? 48 : 0)).current;
  useEffect(() => {
    if (reduceMotion) {
      slide.setValue(value === 'read' ? 48 : 0);
      return;
    }
    const animation = Animated.timing(slide, {
      toValue: value === 'read' ? 48 : 0,
      duration: 260,
      easing: Easing.bezier(0.3, 0.7, 0, 1),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [value, reduceMotion, slide]);
  return (
    <View
      style={s.mode}
      accessibilityRole="radiogroup"
      accessibilityLabel="学习方式"
      accessibilityState={{}}
    >
      <View style={s.modeTrack} />
      <Animated.View
        testID="paper-mode-thumb"
        pointerEvents="none"
        style={[s.modeThumb, { transform: [{ translateX: slide }] }]}
      />
      {(
        [
          { key: 'listen', label: '伴读' },
          { key: 'read', label: '原文' },
        ] as const
      ).map(item => (
        <Pressable
          key={item.key}
          accessibilityRole="radio"
          accessibilityLabel={item.label}
          accessibilityState={{ checked: value === item.key }}
          hitSlop={9}
          onPress={() => onChange(item.key)}
          style={({ pressed }) => [s.modeItem, pressed && { opacity: 0.75 }]}
        >
          <View style={s.modeVisual}>
            <Text
              style={[
                s.label,
                StyleSheet.create({
                  root: {
                    color:
                      value === item.key ? t.color.onAccent : t.color.accentInk,
                    fontWeight: value === item.key ? '600' : '500',
                  },
                }).root,
              ]}
            >
              {item.label}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

export function Switch({
  value,
  onChange,
  accessibilityLabel,
  disabled,
}: KitProps['Switch']) {
  const t = useTokens();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      hitSlop={12}
      style={
        StyleSheet.create({
          root: {
            width: 42,
            height: 24,
            borderRadius: 12,
            backgroundColor: value ? t.color.accent : t.color.switchOff,
            opacity: disabled ? 0.45 : 1,
          },
        }).root
      }
    >
      <View
        style={
          StyleSheet.create({
            root: {
              position: 'absolute',
              left: value ? 20 : 2,
              top: 2,
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: t.color.continueInk,
              boxShadow: '0 1px 2px rgba(0,0,0,.2)',
            },
          }).root
        }
      />
    </Pressable>
  );
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  disabled,
  onPress,
  children,
  label,
  accessibilityLabel,
}: KitProps['Button']) {
  const s = useStyles();
  const t = useTokens();
  const solid =
    variant === 'primary' || variant === 'detour' || variant === 'danger';
  const bg =
    variant === 'primary'
      ? t.color.accent
      : variant === 'detour'
      ? t.color.detour
      : variant === 'danger'
      ? t.color.bad
      : variant === 'ghost'
      ? t.color.surface
      : variant === 'text'
      ? undefined
      : t.color.surfaceAlt;
  const fg = solid
    ? t.color.onAccent
    : variant === 'text'
    ? t.color.accentInk
    : t.color.ink;
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
      hitSlop={size === 'sm' ? 9 : 3}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        size === 'block' && s.blockButton,
        size === 'sm' && s.smallButton,
        {
          backgroundColor: bg,
          borderColor: variant === 'ghost' ? t.color.line : bg,
          borderWidth: variant === 'ghost' ? 1 : 0,
        },
        pressed && { opacity: 0.75 },
        disabled && { opacity: 0.45 },
      ]}
    >
      {icon ? <Icon name={icon} size={18} color={fg} /> : null}
      {children &&
      typeof children !== 'string' &&
      typeof children !== 'number' ? (
        children
      ) : (
        <Text
          style={[
            s.label,
            StyleSheet.create({
              label: {
                fontSize:
                  size === 'sm' ? t.type.label.fontSize : t.type.body.fontSize,
                fontWeight: '500',
                color: fg,
              },
            }).label,
          ]}
        >
          {label ?? children}
        </Text>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  badge,
  disabled,
}: KitProps['IconButton']) {
  const s = useStyles();
  const t = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        s.iconButton,
        pressed && s.pressed,
        disabled && { opacity: 0.45 },
      ]}
    >
      <Icon
        name={icon}
        size={t.layout.groupedLists ? 24 : 22}
        color={t.layout.groupedLists ? t.color.accent : t.color.ink2}
      />
      {badge != null ? <Text style={s.badge}>{badge}</Text> : null}
    </Pressable>
  );
}

export function QuickActions({ items, onPress }: KitProps['QuickActions']) {
  const s = useStyles();
  const t = useTokens();
  return (
    <ScrollView
      horizontal
      style={s.quickViewport}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.quick}
      accessibilityRole="toolbar"
      accessibilityLabel="快捷动作"
      accessibilityState={{}}
    >
      {items.map(item => {
        const solid = item.kind === 'primary' || item.kind === 'detour';
        const color = solid ? t.color.onAccent : t.color.ink2;
        const background =
          item.kind === 'primary'
            ? t.color.accent
            : item.kind === 'detour'
            ? t.color.detour
            : t.color.surface;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ disabled: false }}
            onPress={() => onPress(item.key)}
            style={s.quickTarget}
          >
            {({ pressed }) => (
              <View
                style={[
                  s.quickChip,
                  StyleSheet.create({
                    root: {
                      backgroundColor: background,
                      borderColor: solid ? background : t.color.line,
                    },
                  }).root,
                  pressed && s.quickPressed,
                ]}
              >
                {item.icon ? (
                  <Icon name={item.icon} color={color} size={16} />
                ) : null}
                <Text
                  style={[
                    s.quickLabel,
                    StyleSheet.create({ root: { color } }).root,
                    solid && s.quickStrong,
                  ]}
                >
                  {item.label}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Composer({
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
}: KitProps['Composer']) {
  const s = useStyles();
  const t = useTokens();
  return (
    <View
      accessibilityRole="none"
      accessibilityLabel="提问输入区"
      accessibilityState={{ busy: !!busy }}
      style={s.composerRoot}
    >
      {quote ? (
        <View style={s.quote}>
          {quote.page && quote.excerpt !== undefined ? (
            <>
              <Text style={s.caption}>引用</Text>
              <Text numberOfLines={1} style={[s.caption, s.grow]}>
                {quote.page} · {quote.excerpt}
              </Text>
            </>
          ) : (
            <Text numberOfLines={1} style={[s.caption, s.grow]}>
              {quote.label}
            </Text>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="取消引用"
            accessibilityState={{}}
            onPress={quote.onClear}
            hitSlop={10}
            style={s.quoteClose}
          >
            <Icon name="close" size={14} color={t.color.ink2} />
          </Pressable>
        </View>
      ) : null}
      <View style={s.composer}>
        <TextInput
          accessibilityLabel={placeholder}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={t.color.ink2}
          multiline
          style={s.input}
        />
        {micAvailable && onMic ? (
          <Kit.IconButton icon="mic" label="语音输入" onPress={onMic} />
        ) : null}
        {busy && onStop ? (
          <Kit.Button
            variant="primary"
            icon="stop"
            label="停止"
            onPress={onStop}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="发送"
            accessibilityState={{ disabled: !!sendDisabled }}
            disabled={sendDisabled}
            onPress={onSend}
            style={s.sendTarget}
          >
            {({ pressed }) => (
              <View
                style={[
                  s.sendCircle,
                  StyleSheet.create({
                    root: {
                      backgroundColor: sendDisabled
                        ? t.color.ink3
                        : t.color.accent,
                    },
                  }).root,
                  pressed && s.quickPressed,
                ]}
              >
                <View style={s.sendArrow}>
                  <Icon name="arrowDown" size={20} color={t.color.onAccent} />
                </View>
              </View>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function StepProgress({
  steps,
  onPressStep,
  label,
  onPressBar,
  right,
}: KitProps['StepProgress']) {
  const s = useStyles();
  const t = useTokens();
  return (
    <View
      style={s.progressRoot}
      accessibilityRole="none"
      accessibilityLabel={label}
      accessibilityState={{}}
    >
      <View style={s.inline}>
        <Pressable
          hitSlop={10}
          onPress={onPressBar}
          accessibilityRole="button"
          accessibilityLabel={`${label}，查看路线图`}
          accessibilityState={{}}
          style={s.progressLabel}
        >
          <Text
            style={[
              s.caption,
              StyleSheet.create({ root: { color: t.color.ink3 } }).root,
            ]}
          >
            {label}
          </Text>
        </Pressable>
        <View style={s.progressSteps}>
          {steps.map((step, index) => (
            <Pressable
              key={`${index}-${step.title}`}
              hitSlop={{ top: 15, bottom: 15, left: 0, right: 0 }}
              onPress={() => onPressStep(index)}
              accessibilityRole="button"
              accessibilityLabel={`${index + 1}. ${step.title}，${
                {
                  done: '已讲',
                  current: '当前',
                  skipped: '已跳过',
                  todo: '未讲',
                }[step.state]
              }`}
              accessibilityState={{ selected: step.state === 'current' }}
              style={s.stepTarget}
            >
              <View
                style={[
                  s.stepMark,
                  StyleSheet.create({
                    root: {
                      backgroundColor:
                        step.state === 'done'
                          ? t.color.stepDone
                          : step.state === 'current'
                          ? t.color.stepCur
                          : t.color.stepTodo,
                    },
                  }).root,
                  step.state === 'skipped' && s.skippedMark,
                ]}
              />
            </Pressable>
          ))}
        </View>
        {right}
      </View>
    </View>
  );
}

export function DetourBanner({
  title,
  onBack,
  backLabel,
}: KitProps['DetourBanner']) {
  const s = useStyles();
  const t = useTokens();
  return (
    <View
      style={s.detour}
      accessibilityRole="none"
      accessibilityLabel={`岔路：${title}`}
      accessibilityState={{}}
    >
      <Icon name="branch" color={t.color.detour} />
      <Text
        style={[
          s.label,
          s.grow,
          StyleSheet.create({ root: { color: t.color.detour } }).root,
        ]}
      >
        {title}
      </Text>
      <Kit.Button
        variant="detour"
        size="sm"
        label={backLabel}
        onPress={onBack}
      />
    </View>
  );
}

export function ListSection({
  title,
  subtitle,
  note,
  children,
}: KitProps['ListSection']) {
  const s = useStyles();
  return (
    <View
      style={s.section}
      accessibilityRole="none"
      accessibilityLabel={title ?? '列表分组'}
      accessibilityState={{}}
    >
      {title ? (
        <View style={s.sectionHeading}>
          <Text style={[s.sectionTitle, s.grow]} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text style={s.sectionNote}>{subtitle}</Text> : null}
        </View>
      ) : null}
      {children}
      {note ? <Text style={s.sectionNote}>{note}</Text> : null}
    </View>
  );
}

export function Row({
  title,
  subtitle,
  right,
  chevron,
  onPress,
  tone,
}: KitProps['Row']) {
  const s = useStyles();
  const t = useTokens();
  const [fg] = tonePair(t, tone);
  const content = (
    <>
      <View style={s.grow}>
        <Text
          style={[
            s.body,
            StyleSheet.create({
              root: { color: tone ? textTone(t, tone, fg) : t.color.ink },
            }).root,
          ]}
        >
          {title}
        </Text>
        {subtitle ? <Text style={s.caption}>{subtitle}</Text> : null}
      </View>
      {right}
      {chevron ? <Icon name="chev" size={20} color={t.color.ink3} /> : null}
    </>
  );
  return onPress ? (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle].filter(Boolean).join('，')}
      accessibilityState={{}}
      style={({ pressed }) => [s.row, pressed && s.pressed]}
    >
      {content}
    </Pressable>
  ) : (
    <View
      style={s.row}
      accessibilityRole="none"
      accessibilityLabel={[title, subtitle].filter(Boolean).join('，')}
      accessibilityState={{}}
    >
      {content}
    </View>
  );
}

export function Field({
  label,
  value,
  onChange,
  secure,
  multiline,
  placeholder,
  error,
  keyboardType,
}: KitProps['Field']) {
  const s = useStyles();
  const t = useTokens();
  return (
    <View
      style={s.field}
      accessibilityRole="none"
      accessibilityLabel={label}
      accessibilityState={{}}
    >
      <Text style={s.caption}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor={t.color.ink2}
        keyboardType={keyboardType}
        style={[
          s.fieldInput,
          multiline && s.multiline,
          error && { borderColor: t.color.bad },
        ]}
      />
      {error ? (
        <Text
          accessibilityRole="alert"
          style={[
            s.caption,
            StyleSheet.create({ root: { color: t.color.badInk } }).root,
          ]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function Note({ tone, children }: KitProps['Note']) {
  const s = useStyles();
  const t = useTokens();
  const [fg, bg] = tonePair(t, tone);
  const parts = Children.toArray(children);
  const plain = parts.every(
    value => typeof value === 'string' || typeof value === 'number',
  );
  const text = plain ? parts.join('') : null;
  return (
    <View
      style={[
        s.note,
        StyleSheet.create({ root: { backgroundColor: bg } }).root,
      ]}
      accessibilityRole={tone === 'bad' ? 'alert' : 'text'}
      accessibilityLabel={text ?? '提示'}
      accessibilityState={{}}
    >
      {plain ? (
        <Text
          style={[
            s.caption,
            StyleSheet.create({ root: { color: textTone(t, tone, fg) } }).root,
          ]}
        >
          {text}
        </Text>
      ) : (
        parts.map((child, index) =>
          typeof child === 'string' || typeof child === 'number' ? (
            <Text
              key={index}
              style={[
                s.caption,
                StyleSheet.create({ root: { color: textTone(t, tone, fg) } })
                  .root,
              ]}
            >
              {child}
            </Text>
          ) : (
            child
          ),
        )
      )}
    </View>
  );
}

export function Tag({ tone, label }: KitProps['Tag']) {
  const s = useStyles();
  const t = useTokens();
  const [fg, bg] = tonePair(t, tone);
  return (
    <View
      style={[
        s.tag,
        StyleSheet.create({ root: { backgroundColor: bg, borderColor: fg } })
          .root,
      ]}
      accessibilityRole="text"
      accessibilityLabel={label}
      accessibilityState={{}}
    >
      <Text
        style={[
          s.micro,
          StyleSheet.create({ root: { color: textTone(t, tone, fg) } }).root,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export function ProgressBar({ value, tone }: KitProps['ProgressBar']) {
  const s = useStyles();
  const t = useTokens();
  const [fg] = tonePair(t, tone ?? 'accent');
  const progress = Math.min(1, Math.max(0, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="进度"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      accessibilityState={{}}
      style={s.track}
    >
      <View
        style={[
          s.fill,
          StyleSheet.create({
            root: { width: `${progress * 100}%`, backgroundColor: fg },
          }).root,
        ]}
      />
    </View>
  );
}

export function StageStrip({ stages }: KitProps['StageStrip']) {
  const s = useStyles();
  const t = useTokens();
  return (
    <View
      style={s.stageStrip}
      accessibilityRole="none"
      accessibilityLabel="解析阶段"
      accessibilityState={{}}
    >
      {stages.map((stage, index) => {
        const tone: Tone =
          stage.state === 'done'
            ? 'ok'
            : stage.state === 'current'
            ? 'accent'
            : stage.state === 'error'
            ? 'bad'
            : 'muted';
        const [fg, bg] = tonePair(t, tone);
        return (
          <View
            key={`${index}-${stage.label}`}
            accessibilityRole="text"
            accessibilityLabel={`${stage.label}，${
              { done: '完成', current: '进行中', error: '失败', todo: '等待' }[
                stage.state
              ]
            }`}
            accessibilityState={{ busy: stage.state === 'current' }}
            style={[
              s.stage,
              StyleSheet.create({ root: { backgroundColor: bg } }).root,
            ]}
          >
            <Text
              style={[
                s.micro,
                StyleSheet.create({ root: { color: textTone(t, tone, fg) } })
                  .root,
              ]}
            >
              {stage.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function Cover({ title, color, size = 'md' }: KitProps['Cover']) {
  const s = useStyles();
  const t = useTokens();
  const width =
    size === 'sm' ? 42 : size === 'lg' ? (t.layout.groupedLists ? 62 : 84) : 54;
  const height =
    size === 'lg' && t.layout.groupedLists ? 84 : (width * 74) / 54;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${title}，书封面`}
      accessibilityState={{}}
      style={[
        s.cover,
        StyleSheet.create({
          root: {
            width,
            height,
            backgroundColor: color,
          },
        }).root,
      ]}
    >
      {t.layout.groupedLists ? (
        <Svg
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          width={width}
          height={height}
        >
          <Defs>
            <LinearGradient id="cover-sheen" x1="0" y1="0.4" x2="1" y2="0.6">
              <Stop offset="0" stopColor="#000" stopOpacity={0.22} />
              <Stop offset="0.05" stopColor="#000" stopOpacity={0.22} />
              <Stop offset="0.07" stopColor="#fff" stopOpacity={0.18} />
              <Stop offset="0.3" stopColor="#fff" stopOpacity={0} />
              <Stop offset="1" stopColor="#fff" stopOpacity={0.08} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#cover-sheen)" />
        </Svg>
      ) : null}
      <Text
        style={
          StyleSheet.create({
            root: {
              color: '#fff',
              fontSize: 10,
              lineHeight: 12.5,
              fontWeight: t.layout.groupedLists ? '700' : '600',
              flexShrink: 1,
            },
          }).root
        }
        numberOfLines={3}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
      >
        {Array.from(title).slice(0, 12).join('')}
      </Text>
    </View>
  );
}

export function StatusDot({ tone }: KitProps['StatusDot']) {
  const s = useStyles();
  const t = useTokens();
  const [fg] = tonePair(t, tone);
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${tone}状态`}
      accessibilityState={{}}
      style={[s.dot, StyleSheet.create({ root: { backgroundColor: fg } }).root]}
    />
  );
}

export function SectionStatusIcon({ status }: KitProps['SectionStatusIcon']) {
  const s = useStyles();
  const t = useTokens();
  const fg =
    status === 'done'
      ? t.color.ok
      : status === 'learning'
      ? t.color.accent
      : t.color.line;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={
        { new: '未学', learning: '学习中', done: '已学' }[status]
      }
      accessibilityState={{}}
      style={[
        s.sectionStatus,
        StyleSheet.create({
          root: {
            borderColor: fg,
            backgroundColor:
              status === 'done'
                ? fg
                : status === 'learning' && t.layout.groupedLists
                ? 'transparent'
                : status === 'learning'
                ? '#fff'
                : t.color.surface,
            overflow: 'hidden',
          },
        }).root,
      ]}
    >
      {status === 'done' ? (
        <Icon name="check" size={12} color={t.color.onAccent} />
      ) : status === 'learning' ? (
        <View
          style={
            StyleSheet.create({
              root: {
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0,
                width: '50%',
                backgroundColor: fg,
              },
            }).root
          }
        />
      ) : null}
    </View>
  );
}

export function CheckRow({
  checked,
  title,
  subtitle,
  tag,
  onToggle,
  tone,
}: KitProps['CheckRow']) {
  const s = useStyles();
  const t = useTokens();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityLabel={title}
      accessibilityState={{ checked }}
      style={({ pressed }) => [s.checkRow, pressed && s.pressed]}
    >
      <View
        style={[
          s.check,
          StyleSheet.create({
            root: {
              backgroundColor: checked
                ? tone === 'stuck' && t.layout.groupedLists
                  ? t.color.stuck
                  : t.color.accent
                : t.color.surface,
              borderColor: checked
                ? tone === 'stuck' && t.layout.groupedLists
                  ? t.color.stuck
                  : t.color.accent
                : t.color.ink3,
            },
          }).root,
        ]}
      >
        {checked ? (
          <Icon name="check" color={t.color.onAccent} size={14} />
        ) : null}
      </View>
      <View style={s.grow}>
        <View style={s.checkTitleLine}>
          <Text style={s.checkText}>{title}</Text>
          {tag ? <Kit.Tag label={tag} tone="detour" /> : null}
        </View>
        {subtitle ? <Text style={s.checkSubtitle}>{subtitle}</Text> : null}
      </View>
    </Pressable>
  );
}

export function Fab({ label, icon, onPress }: KitProps['Fab']) {
  const s = useStyles();
  const t = useTokens();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{}}
      style={({ pressed }) => [s.fab, pressed && { opacity: 0.8 }]}
    >
      <Icon name={icon} color={t.color.onAccent} />
      <Text
        style={[
          s.label,
          StyleSheet.create({ root: { color: t.color.onAccent } }).root,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Empty({ title, body, action }: KitProps['Empty']) {
  const s = useStyles();
  return (
    <View
      style={s.empty}
      accessibilityRole="none"
      accessibilityLabel={title ?? body}
      accessibilityState={{}}
    >
      {title ? <Text style={s.sectionTitle}>{title}</Text> : null}
      <Text style={s.caption}>{body}</Text>
      {action}
    </View>
  );
}

const useStyles = makeStyles(t => ({
  screen: { flex: 1, backgroundColor: t.color.bg },
  scrollContent: { flexGrow: 1 },
  floatingTabSpace: { paddingBottom: 110 },
  grow: { flex: 1, minWidth: 0 },
  rootTitle: { paddingLeft: 10 },
  center: { alignItems: 'center' },
  right: { alignItems: 'flex-end' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ink: { color: t.color.ink },
  body: { ...t.type.body, color: t.color.ink },
  label: { ...t.type.label, color: t.color.ink2, textAlign: 'center' },
  caption: { ...t.type.caption, color: t.color.ink3 },
  micro: { ...t.type.micro, color: t.color.ink2 },
  strong: { fontWeight: '600', color: t.color.ink },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: 6,
    backgroundColor: t.color.surface,
    borderBottomWidth: 1,
    borderBottomColor: t.color.line,
  },
  barSide: { minWidth: 40, justifyContent: 'center' },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: t.color.line,
    backgroundColor: t.color.surface,
  },
  tab: {
    flex: 1,
    minHeight: 58,
    paddingVertical: 7,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  badge: {
    ...t.type.micro,
    ...t.type.num,
    color: t.color.onAccent,
    backgroundColor: t.color.bad,
    borderRadius: t.shape.pill,
    paddingHorizontal: 4,
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 16,
    textAlign: 'center',
  },
  pressed: { backgroundColor: t.color.pressed },
  segmented: {
    flexDirection: 'row',
    backgroundColor: t.color.surfaceAlt,
    padding: 2,
    borderRadius: t.shape.sm,
    gap: 2,
  },
  segment: {
    flex: 1,
    minHeight: 30,
    paddingVertical: 0,
    paddingHorizontal: 8,
    justifyContent: 'center',
    borderRadius: 6,
  },
  segmentOn: {
    backgroundColor: t.color.surface,
    boxShadow: '0 1px 2px rgba(0,0,0,.08)',
  },
  mode: {
    height: 30,
    padding: 2,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 15,
  },
  modeTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: t.color.accentBg,
    borderRadius: 15,
  },
  modeItem: {
    minHeight: 26,
    width: 48,
    justifyContent: 'center',
    borderRadius: 13,
  },
  modeThumb: {
    position: 'absolute',
    left: 2,
    top: 2,
    bottom: 2,
    width: 48,
    borderRadius: 13,
    overflow: 'hidden',
    backgroundColor: t.color.accent,
    boxShadow: '0 1px 3px rgba(30,63,122,.3)',
  },
  modeVisual: {
    paddingHorizontal: 0,
    minHeight: 26,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 13,
  },
  switchTarget: {
    minHeight: 48,
    minWidth: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    minHeight: 42,
    paddingVertical: 0,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: t.shape.pill,
  },
  smallButton: { minHeight: 30, paddingHorizontal: 12, paddingVertical: 0 },
  blockButton: { alignSelf: 'stretch' },
  iconButton: {
    minHeight: t.layout.groupedLists ? 44 : 40,
    minWidth: t.layout.groupedLists ? 44 : 40,
    padding: 8,
    borderRadius: t.shape.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 2,
    backgroundColor: t.color.surface,
    borderTopWidth: 1,
    borderTopColor: t.color.line,
  },
  quickViewport: { flexGrow: 0, flexShrink: 0 },
  quickTarget: { minHeight: 32, minWidth: 48, justifyContent: 'center' },
  quickChip: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderRadius: 16,
  },
  quickLabel: { ...t.type.label, fontWeight: '400' },
  quickStrong: { fontWeight: '600' },
  quickPressed: { opacity: 0.7 },
  composerRoot: { backgroundColor: t.color.surface },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
  },
  input: {
    ...t.type.body,
    fontSize: 15,
    lineHeight: 22.5,
    color: t.color.ink,
    flex: 1,
    minHeight: 40,
    maxHeight: 110,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: t.shape.pill,
    borderWidth: 1,
    borderColor: t.color.line,
    backgroundColor: t.color.surface,
  },
  sendTarget: {
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendCircle: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  sendArrow: { transform: [{ rotate: '180deg' }] },
  quote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: t.color.surfaceAlt,
    borderTopWidth: 1,
    borderTopColor: t.color.line,
  },
  quoteClose: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRoot: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
    backgroundColor: t.color.surface,
    borderBottomWidth: 1,
    borderBottomColor: t.color.line,
  },
  progressLabel: { minHeight: 19, justifyContent: 'center' },
  progressSteps: { flex: 1, flexDirection: 'row', gap: 3 },
  stepTarget: {
    minHeight: 19,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skippedMark: {
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: t.color.ink3,
  },
  stepMark: { alignSelf: 'stretch', height: 4, borderRadius: t.shape.xs },
  detour: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: t.color.detourBg,
  },
  section: { backgroundColor: t.color.surface, marginBottom: 8 },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...t.type.headline,
    color: t.color.ink,
    paddingTop: 12,
    paddingBottom: 6,
    paddingHorizontal: t.space.pageX,
  },
  sectionNote: {
    ...t.type.caption,
    color: t.color.ink2,
    paddingHorizontal: t.space.pageX,
    paddingVertical: 8,
  },
  row: {
    minHeight: 48,
    paddingVertical: t.space.rowY,
    paddingHorizontal: t.space.pageX,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: t.color.surface,
    borderBottomWidth: 1,
    borderBottomColor: t.color.line,
  },
  field: {
    paddingVertical: 10,
    paddingHorizontal: t.space.pageX,
    gap: 4,
    backgroundColor: t.color.surface,
    borderBottomWidth: 1,
    borderBottomColor: t.color.line,
  },
  fieldInput: {
    ...t.type.body,
    color: t.color.ink,
    minHeight: t.layout.groupedLists ? 25 : 39,
    borderWidth: t.layout.groupedLists ? 0 : 1,
    borderColor: t.color.fieldBorder,
    borderRadius: t.layout.groupedLists ? 0 : 8,
    paddingVertical: t.layout.groupedLists ? 0 : 8,
    paddingHorizontal: t.layout.groupedLists ? 0 : 10,
    backgroundColor: t.color.surface,
  },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  note: {
    borderRadius: t.layout.groupedLists ? 14 : 8,
    paddingVertical: t.layout.groupedLists ? 10 : 8,
    paddingHorizontal: t.layout.groupedLists ? 14 : 10,
  },
  tag: {
    borderWidth: 1,
    borderRadius: t.shape.xs,
    paddingHorizontal: 4,
    paddingVertical: 1,
    alignSelf: 'flex-start',
  },
  track: {
    height: 6,
    borderRadius: t.shape.xs,
    overflow: 'hidden',
    backgroundColor: t.color.surfaceAlt,
  },
  fill: { height: '100%', borderRadius: t.shape.xs },
  stageStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: t.layout.groupedLists ? 10 : 8,
  },
  stage: {
    flexGrow: 1,
    paddingVertical: t.layout.groupedLists ? 3.3 : 3,
    paddingHorizontal: 6,
    borderRadius: t.layout.groupedLists ? 12 : 4,
    alignItems: 'center',
  },
  cover: {
    borderRadius: t.layout.groupedLists ? 7 : 4,
    padding: t.layout.groupedLists ? 6 : 5,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    ...t.elevation.card,
  },
  dot: { width: 8, height: 8, borderRadius: t.shape.pill },
  sectionStatus: {
    width: t.layout.groupedLists ? 20 : 16,
    height: t.layout.groupedLists ? 20 : 16,
    borderRadius: t.shape.pill,
    borderWidth: t.layout.groupedLists ? 1.6 : 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkTitleLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  checkText: {
    fontSize: t.layout.groupedLists ? 15 : 14,
    lineHeight: t.layout.groupedLists ? 21.75 : 21.7,
    color: t.color.ink,
  },
  checkSubtitle: {
    fontSize: 13,
    lineHeight: 18.85,
    color: t.color.ink2,
    marginTop: 2,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: t.layout.groupedLists ? 'center' : 'flex-start',
    gap: t.layout.groupedLists ? 12 : 10,
    paddingVertical: t.layout.groupedLists ? 12 : 11,
    paddingHorizontal: 14,
    borderBottomWidth: t.layout.groupedLists ? 0 : 1,
    borderColor: t.color.line,
    backgroundColor: t.color.surface,
    borderRadius: t.layout.groupedLists ? 18 : 0,
    marginBottom: t.layout.groupedLists ? 8 : 0,
  },
  check: {
    width: t.layout.groupedLists ? 24 : 19,
    height: t.layout.groupedLists ? 24 : 19,
    borderWidth: 1.5,
    borderRadius: t.layout.groupedLists ? 12 : 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    alignSelf: 'flex-end',
    minHeight: t.layout.groupedLists ? 50 : 48,
    paddingHorizontal: t.layout.groupedLists ? 20 : 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: t.shape.pill,
    backgroundColor: t.layout.groupedLists ? t.color.accent : t.color.ink,
    ...t.elevation.fab,
  },
  empty: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 12,
  },
}));
