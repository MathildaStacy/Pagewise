import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type RefObject,
} from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

export interface ScrollsToEnd {
  scrollToEnd(options?: { animated?: boolean }): void;
  getNativeScrollRef?(): object | null | undefined;
}
export interface StickToBottomOptions {
  /** 距底部小于该值（像素）视为仍在底部。 */
  threshold?: number;
  /** 由 false 变为 true 时恢复跟随，例如用户刚开始新一轮提问。 */
  resumeWhen?: boolean;
  /** 暂停自动滚动，例如正在定位到某一项。 */
  disabled?: boolean;
  animated?: boolean;
}

/**
 * 内容增长时贴住底部；用户上滑阅读就暂停，滑回底部再继续。
 * 把 listProps 展开到 FlatList / ScrollView 上即可，与皮肤无关。
 */
export function useStickToBottom(
  ref: RefObject<ScrollsToEnd | null>,
  {
    threshold = 64,
    resumeWhen = false,
    disabled = false,
    animated = true,
  }: StickToBottomOptions = {},
) {
  const following = useRef(true),
    resumed = useRef(resumeWhen),
    config = useRef({ threshold, disabled, animated });
  useLayoutEffect(() => {
    config.current = { threshold, disabled, animated };
  });
  useEffect(() => {
    if (resumeWhen && !resumed.current) following.current = true;
    resumed.current = resumeWhen;
  }, [resumeWhen]);
  // Stable identity so callers can list it as an effect dependency.
  return useMemo(() => {
    let dragging = false,
      userScrolling = false;
    // Only user-driven scrolls decide whether to follow; programmatic glides pass through mid-way offsets.
    const measure = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      following.current =
        contentSize.height - layoutMeasurement.height - contentOffset.y <
        config.current.threshold;
    };
    const scrollToEnd = (options: { animated?: boolean } = {}) => {
      if (!config.current.disabled && !dragging && following.current) {
        // A programmatic glide can finish at an old bottom while content grows.
        // Its momentum events must not change the reader's follow preference.
        userScrolling = false;
        const list = ref.current,
          native = list?.getNativeScrollRef?.(),
          optionsToUse = {
            animated: options.animated ?? config.current.animated,
          };
        // FlatList.scrollToEnd estimates the last cell's height, which can lag
        // behind streaming text. The native view knows the actual content end.
        if (
          native &&
          'scrollToEnd' in native &&
          typeof native.scrollToEnd === 'function'
        )
          native.scrollToEnd(optionsToUse);
        else list?.scrollToEnd(optionsToUse);
      }
    };
    return {
      scrollToEnd,
      listProps: {
        scrollEventThrottle: 32,
        onContentSizeChange: () => scrollToEnd(),
        onScrollBeginDrag: () => {
          dragging = true;
          userScrolling = true;
        },
        onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
          if (userScrolling) measure(event);
        },
        onScrollEndDrag: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
          dragging = false;
          measure(event);
        },
        onMomentumScrollEnd: (
          event: NativeSyntheticEvent<NativeScrollEvent>,
        ) => {
          if (userScrolling) measure(event);
          userScrolling = false;
        },
      },
    };
  }, [ref]);
}
