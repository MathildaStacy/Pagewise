import {
  Pressable,
  ScrollView,
  Switch as NativeSwitch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { KitProps, Tone } from '../contracts';
import { useTokens } from '../context';
import { Icon } from '../Icon';
import { makeStyles } from '../makeStyles';
import * as Kit from '../proxy';

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
  const s = useStyles();
  return (
    <SafeAreaView
      edges={edges}
      style={[s.screen, style]}
      accessibilityRole="none"
      accessibilityLabel="页面"
      accessibilityState={{}}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
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
      <View style={[s.grow, variant === 'push' && s.center]}>
        <Text
          accessibilityRole="header"
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
              color={active === item.key ? t.color.accentInk : t.color.ink2}
            />
            {item.badge != null ? (
              <Text style={s.badge}>{item.badge}</Text>
            ) : null}
          </View>
          <Text
            style={[
              s.micro,
              { color: active === item.key ? t.color.accentInk : t.color.ink2 },
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
  return (
    <View
      style={s.mode}
      accessibilityRole="radiogroup"
      accessibilityLabel="学习方式"
      accessibilityState={{}}
    >
      {(
        [
          { key: 'read', label: '读书' },
          { key: 'listen', label: '听讲' },
        ] as const
      ).map(item => (
        <Pressable
          key={item.key}
          accessibilityRole="radio"
          accessibilityLabel={item.label}
          accessibilityState={{ checked: value === item.key }}
          onPress={() => onChange(item.key)}
          style={({ pressed }) => [
            s.modeItem,
            value === item.key && { backgroundColor: t.color.accent },
            pressed && { opacity: 0.75 },
          ]}
        >
          <Text
            style={[
              s.label,
              {
                color:
                  value === item.key ? t.color.onAccent : t.color.accentInk,
              },
            ]}
          >
            {item.label}
          </Text>
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
  const s = useStyles();
  const t = useTokens();
  return (
    <View style={s.switchTarget}>
      <NativeSwitch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityRole="switch"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ checked: value, disabled: !!disabled }}
        trackColor={{ false: t.color.line, true: t.color.accent }}
        thumbColor={t.color.surface}
      />
    </View>
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
        <Text style={[s.label, { color: fg }]}>{label ?? children}</Text>
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
      onPress={onPress}
      style={({ pressed }) => [
        s.iconButton,
        pressed && s.pressed,
        disabled && { opacity: 0.45 },
      ]}
    >
      <Icon name={icon} size={22} color={t.color.ink2} />
      {badge != null ? <Text style={s.badge}>{badge}</Text> : null}
    </Pressable>
  );
}

export function QuickActions({ items, onPress }: KitProps['QuickActions']) {
  const s = useStyles();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.quick}
      accessibilityRole="toolbar"
      accessibilityLabel="快捷动作"
      accessibilityState={{}}
    >
      {items.map(item => (
        <Kit.Button
          key={item.key}
          variant={item.kind ?? 'ghost'}
          size="sm"
          label={item.label}
          icon={item.icon}
          onPress={() => onPress(item.key)}
        />
      ))}
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
          <Text style={[s.caption, s.grow]}>{quote.label}</Text>
          <Kit.IconButton
            icon="close"
            label="取消引用"
            onPress={quote.onClear}
          />
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
          <Kit.Button
            variant="primary"
            icon="send"
            label="发送"
            disabled={sendDisabled}
            onPress={onSend}
          />
        )}
      </View>
    </View>
  );
}

export function StepProgress({
  steps,
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
          onPress={onPressBar}
          accessibilityRole="button"
          accessibilityLabel={`${label}，查看路线图`}
          accessibilityState={{}}
          style={s.progressLabel}
        >
          <Text style={s.caption}>{label}</Text>
        </Pressable>
        <View style={s.grow} />
        {right}
      </View>
      <View style={s.inline}>
        {steps.map((step, index) => (
          <Pressable
            key={`${index}-${step.title}`}
            onPress={onPressBar}
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
                {
                  backgroundColor:
                    step.state === 'done'
                      ? t.color.stepDone
                      : step.state === 'current'
                      ? t.color.stepCur
                      : t.color.stepTodo,
                },
                step.state === 'skipped' && s.skippedMark,
              ]}
            />
            {step.state === 'done' ? (
              <Icon name="check" size={14} color={t.color.accent} />
            ) : step.state === 'skipped' ? (
              <Icon name="skip" size={14} color={t.color.ink3} />
            ) : (
              <Text
                style={[
                  s.micro,
                  step.state === 'current' && { color: t.color.accent },
                ]}
              >
                {index + 1}
              </Text>
            )}
          </Pressable>
        ))}
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
      <Text style={[s.label, s.grow, { color: t.color.detour }]}>{title}</Text>
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
        <Text style={s.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
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
            { color: tone ? textTone(t, tone, fg) : t.color.ink },
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
          style={[s.caption, { color: t.color.badInk }]}
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
  return (
    <View
      style={[s.note, { backgroundColor: bg }]}
      accessibilityRole={tone === 'bad' ? 'alert' : 'text'}
      accessibilityLabel={typeof children === 'string' ? children : '提示'}
      accessibilityState={{}}
    >
      {typeof children === 'string' || typeof children === 'number' ? (
        <Text style={[s.caption, { color: textTone(t, tone, fg) }]}>
          {children}
        </Text>
      ) : (
        children
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
      style={[s.tag, { backgroundColor: bg, borderColor: fg }]}
      accessibilityRole="text"
      accessibilityLabel={label}
      accessibilityState={{}}
    >
      <Text style={[s.micro, { color: textTone(t, tone, fg) }]}>{label}</Text>
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
        style={[s.fill, { width: `${progress * 100}%`, backgroundColor: fg }]}
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
            style={[s.stage, { backgroundColor: bg }]}
          >
            <Text style={[s.micro, { color: textTone(t, tone, fg) }]}>
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
  const width = size === 'sm' ? 42 : size === 'lg' ? 84 : 54;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${title}，书封面`}
      accessibilityState={{}}
      style={[
        s.cover,
        { width, minHeight: width * 1.37, backgroundColor: color },
      ]}
    >
      <Text style={[s.micro, { color: t.color.onAccent }]}>{title}</Text>
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
      style={[s.dot, { backgroundColor: fg }]}
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
        {
          borderColor: fg,
          backgroundColor: status === 'done' ? fg : t.color.surface,
        },
      ]}
    >
      {status === 'done' ? (
        <Icon name="check" size={12} color={t.color.onAccent} />
      ) : status === 'learning' ? (
        <View style={[s.dot, { backgroundColor: fg }]} />
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
}: KitProps['CheckRow']) {
  const s = useStyles();
  const t = useTokens();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityLabel={title}
      accessibilityState={{ checked }}
      style={({ pressed }) => [s.row, pressed && s.pressed]}
    >
      <View
        style={[
          s.check,
          {
            backgroundColor: checked ? t.color.accent : t.color.surface,
            borderColor: checked ? t.color.accent : t.color.line,
          },
        ]}
      >
        {checked ? (
          <Icon name="check" color={t.color.onAccent} size={14} />
        ) : null}
      </View>
      <View style={s.grow}>
        <Text style={s.body}>{title}</Text>
        {subtitle ? <Text style={s.caption}>{subtitle}</Text> : null}
      </View>
      {tag ? <Kit.Tag label={tag} /> : null}
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
      <Text style={[s.label, { color: t.color.onAccent }]}>{label}</Text>
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
  grow: { flex: 1, minWidth: 0 },
  center: { alignItems: 'center' },
  right: { alignItems: 'flex-end' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ink: { color: t.color.ink },
  body: { ...t.type.body, color: t.color.ink },
  label: { ...t.type.label, color: t.color.ink2, textAlign: 'center' },
  caption: { ...t.type.caption, color: t.color.ink2 },
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
  barSide: { minWidth: 48, justifyContent: 'center' },
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
    minHeight: 48,
    paddingVertical: 8,
    paddingHorizontal: 8,
    justifyContent: 'center',
    borderRadius: t.shape.xs,
  },
  segmentOn: { backgroundColor: t.color.surface, ...t.elevation.card },
  mode: {
    flexDirection: 'row',
    backgroundColor: t.color.accentBg,
    padding: 2,
    borderRadius: t.shape.pill,
  },
  modeItem: {
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
    borderRadius: t.shape.pill,
  },
  switchTarget: {
    minHeight: 48,
    minWidth: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: t.shape.pill,
  },
  smallButton: { paddingHorizontal: 12, paddingVertical: 8 },
  blockButton: { alignSelf: 'stretch' },
  iconButton: {
    minHeight: 48,
    minWidth: 48,
    padding: 10,
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
  },
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
    color: t.color.ink,
    flex: 1,
    minHeight: 48,
    maxHeight: 180,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: t.shape.pill,
    borderWidth: 1,
    borderColor: t.color.line,
    backgroundColor: t.color.surface,
  },
  quote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
    backgroundColor: t.color.surfaceAlt,
    borderTopWidth: 1,
    borderTopColor: t.color.line,
  },
  progressRoot: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 6,
    backgroundColor: t.color.surface,
    borderBottomWidth: 1,
    borderBottomColor: t.color.line,
  },
  progressLabel: { minHeight: 48, justifyContent: 'center' },
  stepTarget: {
    minHeight: 48,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
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
    minHeight: 48,
    borderWidth: 1,
    borderColor: t.color.line,
    borderRadius: t.shape.sm,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: t.color.surface,
  },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  note: { borderRadius: t.shape.sm, paddingVertical: 8, paddingHorizontal: 10 },
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
  stageStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  stage: {
    flexGrow: 1,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: t.shape.xs,
    alignItems: 'center',
  },
  cover: {
    borderRadius: t.shape.xs,
    padding: 5,
    justifyContent: 'flex-end',
    ...t.elevation.card,
  },
  dot: { width: 8, height: 8, borderRadius: t.shape.pill },
  sectionStatus: {
    width: 18,
    height: 18,
    borderRadius: t.shape.pill,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  check: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderRadius: t.shape.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    alignSelf: 'flex-end',
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: t.shape.pill,
    backgroundColor: t.color.ink,
    ...t.elevation.fab,
  },
  empty: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 12,
  },
}));
