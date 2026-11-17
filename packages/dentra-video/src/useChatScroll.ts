import { useEffect, useRef } from 'react';
import {
  ScrollView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

/** Native content is measured after React effects, so scrolling must also follow layout events. */
export function useChatScroll(
  tail: string | undefined,
  visible: boolean,
  conversationId: string,
) {
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const pending = useRef(true);
  const atBottom = useRef(true);
  const position = useRef({ height: 0, offset: 0 });
  const history = useRef<{
    height: number;
    offset: number;
    tail?: string;
  } | null>(null);
  function end() {
    if (visible && (pending.current || atBottom.current))
      scroll.current?.scrollToEnd({ animated: false });
  }
  useEffect(() => {
    if (!visible) return;
    pending.current = true;
    history.current = null;
    scroll.current?.scrollToEnd({ animated: false });
    const frame = requestAnimationFrame(() =>
      scroll.current?.scrollToEnd({ animated: false }),
    );
    return () => cancelAnimationFrame(frame);
  }, [tail, visible, conversationId]);
  return {
    scroll,
    onLayout: end,
    onContentSizeChange(_width: number, height: number) {
      position.current.height = height;
      const anchor = history.current;
      if (anchor && anchor.tail === tail && height !== anchor.height) {
        history.current = null;
        pending.current = false;
        atBottom.current = false;
        scroll.current?.scrollTo({
          y: Math.max(0, anchor.offset + height - anchor.height),
          animated: false,
        });
      } else end();
    },
    onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
      const { contentOffset, layoutMeasurement, contentSize } =
        event.nativeEvent;
      position.current = {
        height: contentSize.height,
        offset: contentOffset.y,
      };
      atBottom.current =
        contentSize.height - layoutMeasurement.height - contentOffset.y < 64;
      if (atBottom.current) pending.current = false;
    },
    onScrollBeginDrag() {
      pending.current = false;
    },
    preserveHistory() {
      history.current = { ...position.current, tail };
      pending.current = false;
      atBottom.current = false;
    },
  };
}
