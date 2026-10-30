import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type ComponentRef,
} from 'react';
import {
  Keyboard,
  ScrollView,
  TextInput,
  findNodeHandle,
  type ScrollViewProps,
} from 'react-native';

/** 在键盘已经展开时切换字段，以及键盘改变高度时，继续露出焦点输入框。 */
export const KeyboardScrollView = forwardRef<
  ComponentRef<typeof ScrollView>,
  ScrollViewProps
>(function FocusAwareScrollView(props, ref) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const focusedTarget = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useImperativeHandle(ref, () => scroll.current!);
  const reveal = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const input = TextInput.State.currentlyFocusedInput();
      const target = input && findNodeHandle(input);
      if (target && target === focusedTarget.current)
        scroll.current?.scrollResponderScrollNativeHandleToKeyboard(
          target,
          24,
          true,
        );
    }, 50);
  }, []);
  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', reveal);
    return () => {
      subscription.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [reveal]);
  return (
    <ScrollView
      {...props}
      ref={scroll}
      keyboardShouldPersistTaps={props.keyboardShouldPersistTaps ?? 'handled'}
      onFocusCapture={event => {
        focusedTarget.current = event.nativeEvent.target;
        props.onFocusCapture?.(event);
        if (Keyboard.isVisible()) reveal();
      }}
      onBlurCapture={event => {
        if (focusedTarget.current === event.nativeEvent.target)
          focusedTarget.current = null;
        props.onBlurCapture?.(event);
      }}
    />
  );
});
