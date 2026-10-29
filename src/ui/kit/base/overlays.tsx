import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  findNodeHandle,
  useWindowDimensions,
} from 'react-native';
import BottomSheet, {
  BottomSheetFooter,
  BottomSheetScrollView,
  type BottomSheetBackgroundProps,
  type BottomSheetFooterProps,
  useBottomSheetInternal,
} from '@gorhom/bottom-sheet';
import { BlurView } from '@react-native-community/blur';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  DialogProps,
  GlassProps,
  SelectionMenuProps,
  SheetProps,
  ToastProps,
} from '../contracts';
import { useSkin, useTokens } from '../context';
import { Button } from '../proxy';
import { Icon } from '../Icon';

/** 同一 View 容器切换材质，只替换背景，不重建内容子树。 */
export function GlassSurface({
  strength,
  style,
  children,
  blurEnabled,
  material = false,
}: GlassProps & { material?: boolean }) {
  const tokens = useTokens();
  const skin = useSkin();
  const enabled =
    material &&
    tokens.capabilities.blur &&
    blurEnabled !== false &&
    skin.blurEnabled !== false &&
    (Platform.OS === 'android' || Platform.OS === 'ios');
  const fill = material
    ? strength === 'strong'
      ? tokens.color.glassStrong
      : tokens.color.glass
    : tokens.color.surface;
  const surfaceStyle = StyleSheet.create({
    root: {
      overflow: 'hidden',
      backgroundColor: fill,
      borderColor: material ? tokens.color.glassLine : tokens.color.line,
      borderWidth: material ? StyleSheet.hairlineWidth : 0,
    },
  }).root;
  return (
    <View
      accessibilityRole="none"
      accessibilityLabel="材质容器"
      accessibilityState={{ disabled: false }}
      style={[surfaceStyle, style]}
    >
      {enabled ? (
        <BlurView
          testID="glass-blur"
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          blurType={tokens.scheme === 'dark' ? 'dark' : 'light'}
          blurAmount={strength === 'strong' ? 30 : 22}
          reducedTransparencyFallbackColor={tokens.color.surface}
        />
      ) : null}
      {children}
    </View>
  );
}

export function Glass(props: GlassProps) {
  return <GlassSurface {...props} />;
}

function SheetBackground({ style }: BottomSheetBackgroundProps) {
  const tokens = useTokens();
  const inset = useSkin().skin.id === 'glass';
  const sheetBackgroundStyle = StyleSheet.create({
    root: {
      borderTopLeftRadius: tokens.shape.sheet,
      borderTopRightRadius: tokens.shape.sheet,
      borderBottomLeftRadius: inset ? tokens.shape.sheet : 0,
      borderBottomRightRadius: inset ? tokens.shape.sheet : 0,
    },
  }).root;
  return (
    <GlassSurface
      material={inset}
      strength="strong"
      style={[style, sheetBackgroundStyle]}
    />
  );
}

function SheetHeader({
  title,
  subtitle,
  onClose,
}: Pick<SheetProps, 'title' | 'subtitle' | 'onClose'>) {
  const t = useTokens(),
    inset = t.layout.groupedLists;
  const s = StyleSheet.create({
    grab: {
      width: 36,
      height: inset ? 5 : 4,
      borderRadius: inset ? 3 : 2,
      backgroundColor: inset ? t.color.ink3 : '#DDD',
      alignSelf: 'center',
      marginTop: inset ? 7 : 8,
    },
    header: {
      paddingTop: 10,
      paddingHorizontal: inset ? 52 : 16,
      paddingBottom: inset ? 8 : 6,
      flexShrink: 0,
    },
    title: {
      ...t.type.body,
      fontSize: inset ? 17 : 16,
      fontWeight: '600',
      lineHeight: inset ? 22.1 : 24,
      color: t.color.ink,
      textAlign: inset ? 'center' : 'left',
    },
    subtitle: {
      ...t.type.caption,
      fontSize: 12,
      lineHeight: inset ? 17.4 : 18,
      fontWeight: '400',
      color: inset ? t.color.ink2 : t.color.ink3,
      textAlign: inset ? 'center' : 'left',
      marginTop: inset ? 2 : 0,
    },
    close: {
      position: 'absolute',
      right: 14,
      top: 6,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: t.color.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: { backgroundColor: t.color.pressed },
  });
  return (
    <View testID="sheet-header" accessible={false}>
      <View testID="sheet-grab" style={s.grab} />
      <View style={s.header}>
        <Text accessibilityRole="header" style={s.title}>
          {title}
        </Text>
        {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
        {inset ? (
          <Pressable
            testID="sheet-close"
            accessibilityRole="button"
            accessibilityLabel="关闭浮层"
            accessibilityState={{ disabled: false }}
            onPress={onClose}
            hitSlop={8}
            style={({ pressed }) => [s.close, pressed && s.pressed]}
          >
            <Icon name="close" size={15} color={t.color.ink2} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
function SheetActions({
  actions,
}: {
  actions: NonNullable<SheetProps['actions']>;
}) {
  const t = useTokens(),
    inset = t.layout.groupedLists;
  const ordered = inset
    ? [...actions].sort(
        (a, b) => Number(b.kind === 'primary') - Number(a.kind === 'primary'),
      )
    : actions;
  const s = StyleSheet.create({
    footer: {
      flexDirection: inset ? 'column' : 'row',
      flexShrink: 0,
      gap: 8,
      paddingTop: inset ? 12 : 8,
      paddingHorizontal: 16,
      paddingBottom: inset ? 18 : 4,
    },
    cell: { flex: 1 },
    empty: { height: inset ? 16 : 0 },
  });
  return actions.length ? (
    <View testID="sheet-actions" style={s.footer}>
      {ordered.map((action, index) => (
        <View
          key={`${action.label}-${index}`}
          style={inset ? undefined : s.cell}
        >
          <Button
            variant={action.kind}
            size="block"
            onPress={action.onPress}
            label={action.label}
            disabled={action.disabled}
          />
        </View>
      ))}
    </View>
  ) : (
    <View testID="sheet-bottom-space" style={s.empty} />
  );
}

/** Register ordinary RN inputs without replacing their component or event handlers. */
function SheetContent({ children }: PropsWithChildren) {
  const context = useBottomSheetInternal(true);
  const registered = useRef(new Set<number>());
  useEffect(() => {
    const targets = registered.current;
    return () => {
      if (!context) return;
      const state = context.animatedKeyboardState.get();
      if (state.target !== undefined && targets.has(state.target))
        context.animatedKeyboardState.set(current => ({
          ...current,
          target: undefined,
        }));
      for (const target of targets)
        context.textInputNodesRef.current.delete(target);
    };
  }, [context]);
  return (
    <View
      testID="sheet-content"
      accessible={false}
      onFocusCapture={event => {
        if (!context) return;
        const target = event.nativeEvent.target;
        registered.current.add(target);
        context.textInputNodesRef.current.add(target);
        context.animatedKeyboardState.set(state => ({ ...state, target }));
      }}
      onBlurCapture={event => {
        if (!context) return;
        const focused = findNodeHandle(TextInput.State.currentlyFocusedInput());
        const state = context.animatedKeyboardState.get();
        if (
          state.target === event.nativeEvent.target &&
          (!focused || !context.textInputNodesRef.current.has(focused))
        )
          context.animatedKeyboardState.set(current => ({
            ...current,
            target: undefined,
          }));
      }}
    >
      {children}
    </View>
  );
}

/** The body keeps the same keyed parent chain while header/footer scroll policy changes. */
export function Sheet({
  visible,
  title,
  subtitle,
  onClose,
  actions = [],
  detent = 'auto',
  children,
}: SheetProps) {
  const tokens = useTokens(),
    { reduceMotion } = useSkin();
  const inset = tokens.layout.groupedLists;
  const safe = useSafeAreaInsets(),
    { height } = useWindowDimensions();
  const snapPoints = useMemo(
    () =>
      detent === 'auto'
        ? undefined
        : [detent === 'half' ? '50%' : inset ? '84%' : '82%'],
    [detent, inset],
  );
  const s = StyleSheet.create({
    root: { flex: 1 },
    container: { marginHorizontal: inset ? 8 : 0 },
    scrollContent: { paddingBottom: inset ? 0 : Math.max(10, safe.bottom) },
    body: {
      paddingTop: 4,
      paddingHorizontal: inset ? 18 : 16,
      paddingBottom: inset ? 6 : 8,
    },
    footerSurface: {
      backgroundColor: tokens.color.glassStrong,
      borderBottomLeftRadius: tokens.shape.sheet,
      borderBottomRightRadius: tokens.shape.sheet,
      overflow: 'hidden',
    },
    scrim: { backgroundColor: tokens.color.scrim },
  });
  const renderHeader = useCallback(
    () => <SheetHeader title={title} subtitle={subtitle} onClose={onClose} />,
    [title, subtitle, onClose],
  );
  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={0} style={s.footerSurface}>
        <SheetActions actions={actions} />
      </BottomSheetFooter>
    ),
    [actions, s.footerSurface],
  );
  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onClose}
    >
      <GestureHandlerRootView
        style={s.root}
        accessibilityViewIsModal
        onAccessibilityEscape={onClose}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭浮层"
          accessibilityState={{ disabled: false }}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, s.scrim]}
        />
        <BottomSheet
          index={0}
          snapPoints={snapPoints}
          enableDynamicSizing={detent === 'auto'}
          maxDynamicContentSize={height * (inset ? 0.84 : 0.82)}
          enablePanDownToClose
          animateOnMount={!reduceMotion}
          overrideReduceMotion={
            reduceMotion ? ReduceMotion.Always : ReduceMotion.System
          }
          detached={inset}
          bottomInset={inset ? 8 : 0}
          topInset={safe.top}
          containerStyle={s.container}
          backgroundComponent={SheetBackground}
          handleComponent={inset ? renderHeader : null}
          footerComponent={inset ? renderFooter : undefined}
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          android_keyboardInputMode="adjustResize"
          onClose={onClose}
          accessible={false}
          accessibilityLabel={title}
          accessibilityRole="none"
          accessibilityState={{ expanded: visible }}
        >
          <BottomSheetScrollView
            testID="sheet-scroll-body"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets
            showsVerticalScrollIndicator={false}
            enableFooterMarginAdjustment={inset}
            contentContainerStyle={s.scrollContent}
          >
            <SheetContent key="sheet-content">
              {!inset ? (
                <SheetHeader
                  key="paper-header"
                  title={title}
                  subtitle={subtitle}
                  onClose={onClose}
                />
              ) : null}
              <View key="sheet-body" testID="sheet-body" style={s.body}>
                {children}
              </View>
              {!inset ? (
                <SheetActions key="paper-footer" actions={actions} />
              ) : null}
            </SheetContent>
          </BottomSheetScrollView>
        </BottomSheet>
      </GestureHandlerRootView>
    </Modal>
  );
}

export function Dialog({
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
      justifyContent: 'center',
      padding: 24,
    },
  }).root;
  const dialogScrollStyle = StyleSheet.create({
    root: { maxHeight: '90%', flexGrow: 0 },
  }).root;
  const dialogContentStyle = StyleSheet.create({
    root: { alignItems: 'center' },
  }).root;
  const dialogPanelStyle = StyleSheet.create({
    root: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: tokens.color.surface,
      borderRadius: tokens.shape.lg,
      overflow: 'hidden',
    },
  }).root;
  const dialogTitleStyle = StyleSheet.create({
    root: {
      color: tokens.color.ink,
      textAlign: 'center',
      paddingTop: 18,
      paddingHorizontal: 16,
      paddingBottom: 4,
      fontSize: 16,
    },
  }).root;
  const dialogActionsStyle = StyleSheet.create({
    root: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: tokens.color.line,
    },
  }).root;
  const dialogParts = StyleSheet.create({
    body: {
      color: tokens.color.ink2,
      paddingHorizontal: 18,
      paddingTop: 8,
      paddingBottom: 16,
      fontSize: 14,
      lineHeight: 23.1,
    },
    bodySlot: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 16 },
    button: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
    buttonText: { fontSize: 15, color: tokens.color.accentInk },
    confirmText: {
      fontSize: 15,
      fontWeight: '600',
      color: tokens.color.accentInk,
    },
  });
  const dialogCancelStyle = StyleSheet.create({ root: { flex: 1 } }).root;
  const dialogConfirmStyle = StyleSheet.create({
    root: {
      flex: 1,
      borderLeftWidth: cancel ? StyleSheet.hairlineWidth : 0,
      borderColor: tokens.color.line,
    },
  }).root;
  return (
    <Modal
      transparent
      visible={visible}
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
          contentContainerStyle={dialogContentStyle}
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode="interactive"
        >
          <View
            accessibilityViewIsModal
            accessibilityRole="alert"
            accessibilityLabel={title}
            accessibilityState={{ expanded: visible }}
            onAccessibilityEscape={onCancel}
            style={dialogPanelStyle}
          >
            <Text
              accessibilityRole="header"
              style={[tokens.type.headline, dialogTitleStyle]}
            >
              {title}
            </Text>
            {typeof body === 'string' ? (
              <Text style={[tokens.type.body, dialogParts.body]}>{body}</Text>
            ) : (
              <View testID="dialog-body-slot" style={dialogParts.bodySlot}>
                {body}
              </View>
            )}
            <View style={dialogActionsStyle}>
              {cancel ? (
                <View style={dialogCancelStyle}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={cancel}
                    onPress={onCancel}
                    style={dialogParts.button}
                  >
                    <Text style={dialogParts.buttonText}>{cancel}</Text>
                  </Pressable>
                </View>
              ) : null}
              <View style={dialogConfirmStyle}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={confirm}
                  onPress={onConfirm}
                  style={dialogParts.button}
                >
                  <Text style={dialogParts.confirmText}>{confirm}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

export function Toast({ message, tone = 'default' }: ToastProps) {
  const tokens = useTokens();
  const backgroundColor =
    tone === 'ok'
      ? tokens.color.ok
      : tone === 'detour'
      ? tokens.color.detour
      : tone === 'bad'
      ? tokens.color.bad
      : tokens.color.ink;
  const toastStyle = StyleSheet.create({
    root: {
      alignSelf: 'center',
      maxWidth: '92%',
      minHeight: 48,
      justifyContent: 'center',
      borderRadius: tokens.shape.sm,
      backgroundColor,
      paddingHorizontal: tokens.space.pageX,
      paddingVertical: tokens.space.gap,
      ...tokens.elevation.pop,
    },
  }).root;
  const toastTextStyle = StyleSheet.create({
    root: { color: tokens.color.surface, textAlign: 'center' },
  }).root;
  return (
    <View
      pointerEvents="none"
      accessibilityRole="alert"
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
      accessibilityState={{ disabled: false }}
      style={toastStyle}
    >
      <Text style={[tokens.type.caption, toastTextStyle]}>{message}</Text>
    </View>
  );
}

export function SelectionMenuSurface({
  anchor,
  items,
  onSelect,
  onDismiss,
  visible = true,
  material = false,
}: SelectionMenuProps & { material?: boolean }) {
  const tokens = useTokens();
  const dimensions = useWindowDimensions();
  const safe = useSafeAreaInsets();
  const [measuredHeight, setMeasuredHeight] = useState(56);
  const width = Math.min(
    dimensions.width - 2 * tokens.space.pageX,
    Math.max(anchor.w, items.length * 76),
  );
  const left = Math.max(
    tokens.space.pageX,
    Math.min(
      anchor.x + anchor.w / 2 - width / 2,
      dimensions.width - tokens.space.pageX - width,
    ),
  );
  const proposedTop = anchor.y - measuredHeight - tokens.space.gap;
  const top = Math.max(
    safe.top,
    Math.min(
      proposedTop > safe.top
        ? proposedTop
        : anchor.y + anchor.h + tokens.space.gap,
      dimensions.height - safe.bottom - measuredHeight,
    ),
  );
  const foreground = material ? tokens.color.ink : tokens.color.surface;
  const { reduceMotion } = useSkin();
  const menuStyle = StyleSheet.create({
    root: {
      position: 'absolute',
      left,
      top,
      width,
    },
  }).root;
  const menuSurfaceStyle = StyleSheet.create({
    root: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: material ? 4 : 0,
      bottom: material ? 4 : 0,
      borderRadius: material ? 14 : tokens.shape.sm,
      backgroundColor: material ? tokens.color.glassStrong : tokens.color.ink,
      ...tokens.elevation.pop,
    },
  }).root;
  const menuItemsStyle = StyleSheet.create({
    root: {
      flexDirection: 'row',
      flexWrap: 'nowrap',
      padding: material ? 0 : 3,
    },
  }).root;
  const menuTextStyle = StyleSheet.create({
    root: { color: foreground, textAlign: 'center' },
  }).root;
  const menuContentStyle = StyleSheet.create({
    root: { flexDirection: 'row', flexWrap: 'nowrap' },
  }).root;
  const materialTextStyle = StyleSheet.create({ root: { fontSize: 14 } }).root;
  const menuTargetStyle = StyleSheet.create({
    root: {
      minHeight: 48,
      minWidth: 48,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: material ? 4 : 0,
    },
  }).root;
  return (
    <Modal
      transparent
      visible={visible}
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onDismiss}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        accessibilityRole="button"
        accessibilityLabel="关闭选择菜单"
        accessibilityState={{ disabled: false }}
        onPress={onDismiss}
      />
      <View style={menuStyle}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <GlassSurface
            material={material}
            strength="strong"
            style={menuSurfaceStyle}
          />
        </View>
        <View
          accessibilityRole="menu"
          accessibilityLabel="段落操作"
          accessibilityState={{ expanded: visible }}
          onLayout={event => setMeasuredHeight(event.nativeEvent.layout.height)}
          style={menuItemsStyle}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={menuContentStyle}
          >
            {items.map((item, index) => (
              <Pressable
                key={item.key}
                accessibilityRole="menuitem"
                accessibilityLabel={item.label}
                accessibilityState={{ disabled: false }}
                onPress={() => onSelect(item.key)}
                style={menuTargetStyle}
              >
                {({ pressed }) => (
                  <View
                    style={
                      StyleSheet.create({
                        root: {
                          minHeight: 40,
                          justifyContent: 'center',
                          paddingHorizontal: material ? 11 : tokens.space.gap,
                          paddingVertical: material ? 0 : tokens.space.gap,
                          borderLeftWidth:
                            material && index > 0
                              ? StyleSheet.hairlineWidth
                              : 0,
                          borderColor: tokens.color.line,
                          backgroundColor: pressed
                            ? tokens.color.pressed
                            : undefined,
                        },
                      }).root
                    }
                  >
                    <Text
                      style={[
                        tokens.type.label,
                        menuTextStyle,
                        material && materialTextStyle,
                      ]}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>
                  </View>
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function SelectionMenu(props: SelectionMenuProps) {
  return <SelectionMenuSurface {...props} />;
}
