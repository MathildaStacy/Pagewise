import Renderer, { act } from 'react-test-renderer';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useStableHandlers, useStickToBottom } from '@ui/kit';
import type { StickToBottomOptions } from '@ui/kit';

const scrollEvent = (offset: number) =>
  ({
    nativeEvent: {
      contentOffset: { x: 0, y: offset },
      contentSize: { width: 300, height: 1000 },
      layoutMeasurement: { width: 300, height: 400 },
    },
  } as NativeSyntheticEvent<NativeScrollEvent>);

function mountStick(
  options: StickToBottomOptions = {},
  native?: { scrollToEnd: jest.Mock },
) {
  const list = {
    scrollToEnd: jest.fn(),
    getNativeScrollRef: () => native,
  };
  const ref = { current: list };
  let stick!: ReturnType<typeof useStickToBottom>;
  function Probe(props: StickToBottomOptions) {
    stick = useStickToBottom(ref, props);
    return null;
  }
  let renderer!: Renderer.ReactTestRenderer;
  act(() => {
    renderer = Renderer.create(<Probe {...options} />);
  });
  return {
    list,
    stick: () => stick,
    update: (next: StickToBottomOptions) =>
      act(() => renderer.update(<Probe {...next} />)),
  };
}

it('follows content growth until the reader scrolls up, then resumes at the bottom', () => {
  const { list, stick } = mountStick();
  stick().listProps.onContentSizeChange();
  expect(list.scrollToEnd).toHaveBeenCalledTimes(1);
  stick().listProps.onScrollBeginDrag();
  stick().listProps.onScroll(scrollEvent(100));
  stick().listProps.onScrollEndDrag(scrollEvent(100));
  stick().listProps.onContentSizeChange();
  expect(list.scrollToEnd).toHaveBeenCalledTimes(1);
  stick().listProps.onScrollBeginDrag();
  stick().listProps.onScrollEndDrag(scrollEvent(590));
  stick().listProps.onContentSizeChange();
  expect(list.scrollToEnd).toHaveBeenCalledTimes(2);
});

it('ignores programmatic scroll offsets and resumes when a new turn starts', () => {
  const { list, stick, update } = mountStick({ resumeWhen: false });
  // A glide toward the end reports mid-way offsets without a drag.
  stick().listProps.onScroll(scrollEvent(10));
  stick().listProps.onContentSizeChange();
  expect(list.scrollToEnd).toHaveBeenCalledTimes(1);
  stick().listProps.onScrollBeginDrag();
  stick().listProps.onScrollEndDrag(scrollEvent(0));
  update({ resumeWhen: true });
  stick().scrollToEnd();
  expect(list.scrollToEnd).toHaveBeenCalledTimes(2);
});

it('keeps following when streamed content grows before a programmatic glide ends', () => {
  const { list, stick } = mountStick();
  stick().listProps.onContentSizeChange();
  // The old bottom is now above the growing response, without any user gesture.
  stick().listProps.onMomentumScrollEnd(scrollEvent(500));
  stick().listProps.onContentSizeChange();
  expect(list.scrollToEnd).toHaveBeenCalledTimes(2);
});

it('uses the native content end instead of FlatList cell height estimates', () => {
  const native = { scrollToEnd: jest.fn() };
  const { list, stick } = mountStick({}, native);
  stick().listProps.onContentSizeChange();
  expect(native.scrollToEnd).toHaveBeenCalledWith({ animated: true });
  expect(list.scrollToEnd).not.toHaveBeenCalled();
});

it('resumes following when user momentum reaches the bottom', () => {
  const { list, stick } = mountStick();
  stick().listProps.onScrollBeginDrag();
  stick().listProps.onScrollEndDrag(scrollEvent(100));
  stick().listProps.onContentSizeChange();
  expect(list.scrollToEnd).not.toHaveBeenCalled();
  stick().listProps.onMomentumScrollEnd(scrollEvent(590));
  stick().listProps.onContentSizeChange();
  expect(list.scrollToEnd).toHaveBeenCalledTimes(1);
});

it('does not interrupt a reader dragging near the bottom', () => {
  const { list, stick } = mountStick();
  stick().listProps.onScrollBeginDrag();
  stick().listProps.onScroll(scrollEvent(590));
  stick().listProps.onContentSizeChange();
  expect(list.scrollToEnd).not.toHaveBeenCalled();
  stick().listProps.onScrollEndDrag(scrollEvent(590));
  stick().listProps.onContentSizeChange();
  expect(list.scrollToEnd).toHaveBeenCalledTimes(1);
});

it('keeps a stable identity and honours disabled', () => {
  const { list, stick, update } = mountStick();
  const first = stick();
  update({ disabled: true });
  expect(stick()).toBe(first);
  stick().listProps.onContentSizeChange();
  expect(list.scrollToEnd).not.toHaveBeenCalled();
});

it('stable handlers keep identity while calling the latest implementation', () => {
  const calls: string[] = [];
  let handlers!: { press(id: string): void };
  function Probe({ tag }: { tag: string }) {
    handlers = useStableHandlers({
      press: (id: string) => calls.push(tag + id),
    });
    return null;
  }
  let renderer!: Renderer.ReactTestRenderer;
  act(() => {
    renderer = Renderer.create(<Probe tag="a" />);
  });
  const first = handlers;
  act(() => renderer.update(<Probe tag="b" />));
  expect(handlers).toBe(first);
  first.press('1');
  expect(calls).toEqual(['b1']);
});
