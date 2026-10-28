import { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import BottomSheet, {
  BottomSheetScrollView,
  type BottomSheetBackgroundProps,
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
import { Button, IconButton } from '../proxy';

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

/**
 * Sheet 在两个皮肤里保持同一个函数引用。这里只切换布局和背景，
 * 保证已经打开的表单、children 内部状态和浮层可见性不因换皮肤丢失。
 */
export function Sheet({
  visible,
  title,
  subtitle,
  onClose,
  actions = [],
  detent = 'auto',
  children,
}: SheetProps) {
  const tokens = useTokens();
  const { skin, reduceMotion } = useSkin();
  const inset = skin.id === 'glass';
  const safe = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const snapPoints = useMemo(
    () => (detent === 'auto' ? undefined : [detent === 'half' ? '50%' : '90%']),
    [detent],
  );
  const orderedActions = inset
    ? [...actions].sort(
        (a, b) => Number(b.kind === 'primary') - Number(a.kind === 'primary'),
      )
    : actions;

  const sheetRootStyle = StyleSheet.create({ root: { flex: 1 } }).root;
  const sheetContainerStyle = StyleSheet.create({
    root: { marginHorizontal: inset ? 8 : 0 },
  }).root;
  const sheetContentStyle = StyleSheet.create({
    root: {
      paddingBottom: inset ? 18 : Math.max(10, safe.bottom),
    },
  }).root;
  const sheetHeaderStyle = StyleSheet.create({
    root: {
      paddingHorizontal: tokens.space.pageX,
      paddingBottom: tokens.space.gap,
      minHeight: 48,
      justifyContent: 'center',
    },
  }).root;
  const sheetTitleStyle = StyleSheet.create({
    root: {
      color: tokens.color.ink,
      textAlign: inset ? 'center' : 'left',
      paddingRight: 48,
      paddingLeft: inset ? 48 : 0,
    },
  }).root;
  const sheetSubtitleStyle = StyleSheet.create({
    root: {
      color: tokens.color.ink2,
      textAlign: inset ? 'center' : 'left',
    },
  }).root;
  const sheetCloseStyle = StyleSheet.create({
    root: {
      position: 'absolute',
      right: tokens.space.gap,
      top: 0,
    },
  }).root;
  const sheetActionsStyle = StyleSheet.create({
    root: {
      flexDirection: inset ? 'column' : 'row',
      flexWrap: 'wrap',
      gap: tokens.space.gap,
      paddingHorizontal: tokens.space.pageX,
      paddingTop: tokens.space.rowY,
    },
  }).root;
  const sheetActionCellStyle = StyleSheet.create({
    root: { flexGrow: 1 },
  }).root;
  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={sheetRootStyle}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭浮层"
          accessibilityState={{ disabled: false }}
          onPress={onClose}
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: tokens.color.scrim },
          ]}
        />
        <BottomSheet
          index={0}
          snapPoints={snapPoints}
          enableDynamicSizing={detent === 'auto'}
          maxDynamicContentSize={height * (inset ? 0.78 : 0.82)}
          enablePanDownToClose
          animateOnMount={!reduceMotion}
          overrideReduceMotion={
            reduceMotion ? ReduceMotion.Always : ReduceMotion.System
          }
          detached={inset}
          bottomInset={inset ? Math.max(8, safe.bottom) : 0}
          topInset={safe.top}
          containerStyle={sheetContainerStyle}
          backgroundComponent={SheetBackground}
          handleIndicatorStyle={{ backgroundColor: tokens.color.ink3 }}
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
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={sheetContentStyle}
          >
            <View
              accessible={false}
              accessibilityViewIsModal
              onAccessibilityEscape={onClose}
            >
              <View style={sheetHeaderStyle}>
                <Text
                  accessibilityRole="header"
                  style={[
                    inset ? tokens.type.title : tokens.type.headline,
                    sheetTitleStyle,
                  ]}
                >
                  {title}
                </Text>
                {subtitle ? (
                  <Text style={[tokens.type.caption, sheetSubtitleStyle]}>
                    {subtitle}
                  </Text>
                ) : null}
                <View style={sheetCloseStyle}>
                  <IconButton icon="close" label="关闭浮层" onPress={onClose} />
                </View>
              </View>
              <View style={{ paddingHorizontal: tokens.space.pageX }}>
                {children}
              </View>
              <View style={sheetActionsStyle}>
                {orderedActions.map((action, index) => (
                  <View
                    key={`${action.label}-${index}`}
                    style={inset ? undefined : sheetActionCellStyle}
                  >
                    <Button
                      variant={action.kind}
                      size="block"
                      onPress={action.onPress}
                      label={action.label}
                    />
                  </View>
                ))}
              </View>
            </View>
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
      padding: tokens.space.pageX,
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
      padding: tokens.space.pageX,
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
  const dialogCancelStyle = StyleSheet.create({ root: { flexGrow: 1 } }).root;
  const dialogConfirmStyle = StyleSheet.create({ root: { flexGrow: 1 } }).root;
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
            <Text
              style={[
                tokens.type.body,
                {
                  color: tokens.color.ink2,
                  paddingHorizontal: tokens.space.pageX,
                  paddingBottom: tokens.space.pageX,
                },
              ]}
            >
              {body}
            </Text>
            <View style={dialogActionsStyle}>
              {cancel ? (
                <View style={dialogCancelStyle}>
                  <Button
                    variant="text"
                    size="block"
                    label={cancel}
                    onPress={onCancel}
                  />
                </View>
              ) : null}
              <View style={dialogConfirmStyle}>
                <Button
                  variant="text"
                  size="block"
                  label={confirm}
                  onPress={onConfirm}
                />
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
      borderRadius: material ? tokens.shape.pill : tokens.shape.sm,
      backgroundColor: material ? tokens.color.glassStrong : tokens.color.ink,
      ...tokens.elevation.pop,
    },
  }).root;
  const menuItemsStyle = StyleSheet.create({
    root: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: material ? 0 : 3,
    },
  }).root;
  const menuTextStyle = StyleSheet.create({
    root: { color: foreground, textAlign: 'center' },
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
      <GlassSurface material={material} strength="strong" style={menuStyle}>
        <View
          accessibilityRole="menu"
          accessibilityLabel="段落操作"
          accessibilityState={{ expanded: visible }}
          onLayout={event => setMeasuredHeight(event.nativeEvent.layout.height)}
          style={menuItemsStyle}
        >
          {items.map((item, index) => (
            <Pressable
              key={item.key}
              accessibilityRole="menuitem"
              accessibilityLabel={item.label}
              accessibilityState={{ disabled: false }}
              onPress={() => onSelect(item.key)}
              style={({ pressed }) => ({
                flexGrow: 1,
                minHeight: 48,
                minWidth: 72,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: tokens.space.gap,
                paddingVertical: tokens.space.gap,
                borderLeftWidth:
                  material && index > 0 ? StyleSheet.hairlineWidth : 0,
                borderColor: tokens.color.line,
                backgroundColor: pressed ? tokens.color.pressed : undefined,
              })}
            >
              <Text style={[tokens.type.label, menuTextStyle]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </GlassSurface>
    </Modal>
  );
}

export function SelectionMenu(props: SelectionMenuProps) {
  return <SelectionMenuSurface {...props} />;
}
