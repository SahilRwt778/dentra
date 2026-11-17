import React from 'react';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { useChatScroll } from '@dentra/video/src/useChatScroll';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

let timeline: ReturnType<typeof useChatScroll>;
let tree: ReactTestRenderer;
const scrollToEnd = jest.fn(),
  scrollTo = jest.fn();
function Probe({
  tail = '2',
  visible = true,
}: {
  tail?: string;
  visible?: boolean;
}) {
  timeline = useChatScroll(tail, visible, 'conversation');
  Object.assign(timeline.scroll, { current: { scrollToEnd, scrollTo } });
  return null;
}
const position = (offset: number, height = 1600) =>
  ({
    nativeEvent: {
      contentOffset: { y: offset },
      contentSize: { height },
      layoutMeasurement: { height: 400 },
    },
  } as NativeSyntheticEvent<NativeScrollEvent>);
beforeEach(async () => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  await act(async () => {
    tree = Renderer.create(<Probe />);
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
  jest.useRealTimers();
});

test('opening a conversation scrolls after native content and viewport measurements arrive', () => {
  scrollToEnd.mockClear();
  timeline.onContentSizeChange(390, 1600);
  timeline.onLayout();
  expect(scrollToEnd).toHaveBeenCalledWith({ animated: false });
});

test('a received message moves to the latest message even if the recipient was reading higher up', async () => {
  timeline.onScroll(position(300));
  timeline.onScrollBeginDrag();
  scrollToEnd.mockClear();
  await act(async () => tree.update(<Probe tail="3" />));
  timeline.onContentSizeChange(390, 1800);
  expect(scrollToEnd).toHaveBeenCalledWith({ animated: false });
});

test('loading earlier history preserves the visible message instead of jumping to the end', () => {
  timeline.onScroll(position(100));
  timeline.preserveHistory();
  scrollToEnd.mockClear();
  timeline.onContentSizeChange(390, 2200);
  expect(scrollTo).toHaveBeenCalledWith({ y: 700, animated: false });
  expect(scrollToEnd).not.toHaveBeenCalled();
});

test('returning to a focused conversation scrolls to its latest messages', async () => {
  await act(async () => tree.update(<Probe visible={false} />));
  scrollToEnd.mockClear();
  timeline.onContentSizeChange(390, 1800);
  expect(scrollToEnd).not.toHaveBeenCalled();
  await act(async () => tree.update(<Probe visible />));
  timeline.onLayout();
  expect(scrollToEnd).toHaveBeenCalledWith({ animated: false });
});
