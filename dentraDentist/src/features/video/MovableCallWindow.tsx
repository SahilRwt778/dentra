import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Point = { x: number; y: number };
const GAP = 12;

/** Moving the container keeps the same media tree and connection mounted. */
export function MovableCallWindow({
  minimized,
  systemPip = false,
  children,
}: {
  minimized: boolean;
  systemPip?: boolean;
  children: React.ReactNode;
}) {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [viewport, setViewport] = useState({
    width: window.width,
    height: window.height,
  });
  const [translation] = useState(() => new Animated.ValueXY());
  const savedPosition = useRef<Point | null>(null);
  const dragStart = useRef<Point>({ x: 0, y: 0 });
  const floating = minimized && !systemPip;
  const bounds = useMemo(() => {
    const left = Math.max(insets.left, GAP);
    const top = Math.max(insets.top, GAP);
    const width = Math.min(
      260,
      Math.max(1, viewport.width - left - Math.max(insets.right, GAP)),
    );
    const height = Math.min(
      290,
      Math.max(1, viewport.height - top - Math.max(insets.bottom, GAP)),
    );
    return {
      left,
      top,
      width,
      height,
      right: Math.max(
        left,
        viewport.width - Math.max(insets.right, GAP) - width,
      ),
      bottom: Math.max(
        top,
        viewport.height - Math.max(insets.bottom, GAP) - height,
      ),
    };
  }, [viewport, insets.left, insets.top, insets.right, insets.bottom]);

  const move = useCallback(
    (point: Point) => {
      const next = {
        x: Math.max(bounds.left, Math.min(bounds.right, point.x)),
        y: Math.max(bounds.top, Math.min(bounds.bottom, point.y)),
      };
      savedPosition.current = next;
      translation.setValue(next);
    },
    [bounds, translation],
  );

  useLayoutEffect(() => {
    // Start above the tabs; rotation and smaller layouts keep the window reachable.
    move(savedPosition.current ?? { x: bounds.right, y: bounds.bottom - 76 });
  }, [bounds, move]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        // Let taps reach the controls. Capture only after a finger actually moves.
        onMoveShouldSetPanResponderCapture: (_event, gesture) =>
          floating &&
          gesture.numberActiveTouches === 1 &&
          (Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6),
        onPanResponderGrant: () => {
          dragStart.current = savedPosition.current ?? {
            x: bounds.right,
            y: bounds.bottom,
          };
        },
        onPanResponderMove: (_event, gesture) => {
          move({
            x: dragStart.current.x + gesture.dx,
            y: dragStart.current.y + gesture.dy,
          });
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [bounds, floating, move],
  );

  return (
    <View
      testID="call-window-overlay"
      pointerEvents="box-none"
      style={styles.overlay}
      onLayout={({ nativeEvent: { layout } }) => {
        // OS PiP dimensions must not overwrite the user's in-app drag position.
        if (systemPip || layout.width <= 0 || layout.height <= 0) return;
        setViewport(current =>
          current.width === layout.width && current.height === layout.height
            ? current
            : { width: layout.width, height: layout.height },
        );
      }}
    >
      <Animated.View
        testID="call-window"
        {...responder.panHandlers}
        style={
          floating
            ? [
                styles.mini,
                {
                  width: bounds.width,
                  height: bounds.height,
                  transform: translation.getTranslateTransform(),
                },
              ]
            : styles.full
        }
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 90,
    elevation: 10,
  },
  full: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  mini: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#42606A',
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
});
