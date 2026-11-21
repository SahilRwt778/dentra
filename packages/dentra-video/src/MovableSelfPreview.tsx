import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Point = { x: number; y: number };
const GAP = 12;

/** Move the preview container without replacing its camera view or media track. */
export function MovableSelfPreview({
  children,
  hidden = false,
  topInset = 0,
  bottomInset = 0,
  onPress,
  onDragChange,
  testID = 'self-preview',
}: {
  children: React.ReactNode;
  hidden?: boolean;
  topInset?: number;
  bottomInset?: number;
  onPress: () => void;
  onDragChange: (dragging: boolean) => void;
  testID?: string;
}) {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [viewport, setViewport] = useState({
    width: window.width,
    height: window.height,
  });
  const [translation] = useState(() => new Animated.ValueXY());
  const position = useRef<Point | null>(null);
  const dragStart = useRef<Point>({ x: 0, y: 0 });
  const moved = useRef(false);

  const bounds = useMemo(() => {
    const left = Math.max(insets.left, GAP);
    const top = Math.max(insets.top, topInset) + GAP;
    const rightEdge = viewport.width - Math.max(insets.right, GAP);
    const bottomEdge =
      viewport.height - Math.max(insets.bottom, bottomInset) - GAP;
    const availableWidth = Math.max(1, rightEdge - left);
    const availableHeight = Math.max(1, bottomEdge - top);
    const width = Math.min(
      120,
      availableWidth * 0.3,
      availableHeight * 0.5 * 0.75,
    );
    const height = width / 0.75;
    return {
      left,
      top,
      width,
      height,
      right: Math.max(left, rightEdge - width),
      bottom: Math.max(top, bottomEdge - height),
    };
  }, [
    viewport,
    insets.left,
    insets.right,
    insets.top,
    insets.bottom,
    topInset,
    bottomInset,
  ]);

  const move = useCallback(
    (point: Point) => {
      const next = {
        x: Math.max(bounds.left, Math.min(bounds.right, point.x)),
        y: Math.max(bounds.top, Math.min(bounds.bottom, point.y)),
      };
      position.current = next;
      translation.setValue(next);
    },
    [bounds, translation],
  );

  useLayoutEffect(() => {
    if (hidden) return;
    // Keep the chosen position when controls hide, the phone rotates, or the call is restored.
    move(
      moved.current && position.current
        ? position.current
        : { x: bounds.right, y: bounds.bottom },
    );
  }, [bounds, hidden, move]);

  useEffect(() => {
    if (hidden) onDragChange(false);
  }, [hidden, onDragChange]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        // Small movements remain taps; dragging cancels the underlying Pressable.
        onMoveShouldSetPanResponderCapture: (_event, gesture) =>
          !hidden &&
          gesture.numberActiveTouches === 1 &&
          (Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6),
        onPanResponderGrant: () => {
          moved.current = true;
          dragStart.current = position.current ?? {
            x: bounds.right,
            y: bounds.bottom,
          };
          onDragChange(true);
        },
        onPanResponderMove: (_event, gesture) =>
          move({
            x: dragStart.current.x + gesture.dx,
            y: dragStart.current.y + gesture.dy,
          }),
        onPanResponderRelease: () => onDragChange(false),
        onPanResponderTerminate: () => onDragChange(false),
        onPanResponderTerminationRequest: () => false,
      }),
    [bounds, hidden, move, onDragChange],
  );

  return (
    <View
      testID={`${testID}-bounds`}
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, hidden && styles.hidden]}
      onLayout={({ nativeEvent: { layout } }) => {
        // Ignore OS picture-in-picture sizes so restoring keeps the saved position.
        if (hidden || layout.width <= 0 || layout.height <= 0) return;
        setViewport(current =>
          current.width === layout.width && current.height === layout.height
            ? current
            : { width: layout.width, height: layout.height },
        );
      }}
    >
      <Animated.View
        testID={testID}
        {...responder.panHandlers}
        style={[
          styles.tile,
          {
            width: bounds.width,
            height: bounds.height,
            transform: translation.getTranslateTransform(),
          },
        ]}
      >
        <Pressable
          style={styles.fill}
          accessibilityRole="button"
          accessibilityLabel="Your video preview"
          accessibilityHint="Drag to move your preview. Tap to toggle call controls."
          onPress={onPress}
          accessibilityActions={[
            { name: 'moveLeft', label: 'Move preview left' },
            { name: 'moveRight', label: 'Move preview right' },
            { name: 'moveUp', label: 'Move preview up' },
            { name: 'moveDown', label: 'Move preview down' },
          ]}
          onAccessibilityAction={({ nativeEvent: { actionName } }) => {
            const current = position.current ?? {
              x: bounds.right,
              y: bounds.bottom,
            };
            const offsets: Record<string, Point> = {
              moveLeft: { x: -40, y: 0 },
              moveRight: { x: 40, y: 0 },
              moveUp: { x: 0, y: -40 },
              moveDown: { x: 0, y: 40 },
            };
            const offset = offsets[actionName];
            if (!offset) return;
            moved.current = true;
            move({ x: current.x + offset.x, y: current.y + offset.y });
          }}
        >
          <View pointerEvents="none" style={styles.content}>
            {children}
            <Text style={styles.label}>You</Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { display: 'none' },
  tile: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#36515B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  fill: { flex: 1 },
  content: { flex: 1, justifyContent: 'center' },
  label: {
    position: 'absolute',
    bottom: 7,
    left: 7,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.5)',
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
