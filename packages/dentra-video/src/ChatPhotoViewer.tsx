import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react-native';
import { AppImage } from './AppImage';

const clamp = (value: number, limit: number) =>
  Math.max(-limit, Math.min(limit, value));

/** Pinch, drag and double-tap work on Android and iOS without replacing the chat route. */
export function ChatPhotoViewer({ uri, name }: { uri: string; name: string }) {
  const [zoom, setZoom] = useState(1);
  const [failed, setFailed] = useState(false);
  const position = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;
  const current = useRef({ zoom: 1, x: 0, y: 0, width: 0, height: 0 });
  const gesture = useRef({ zoom: 1, x: 0, y: 0, distance: 0 });
  const lastTap = useRef(0);
  const update = useCallback(
    (next: number, x = current.current.x, y = current.current.y) => {
      const state = current.current;
      state.zoom = Math.max(1, Math.min(4, next));
      state.x = clamp(x, (state.width * (state.zoom - 1)) / 2);
      state.y = clamp(y, (state.height * (state.zoom - 1)) / 2);
      scale.setValue(state.zoom);
      position.setValue({ x: state.x, y: state.y });
      setZoom(state.zoom);
    },
    [position, scale],
  );
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: event => {
          const touches = event.nativeEvent.touches;
          gesture.current = {
            ...current.current,
            distance:
              touches.length === 2
                ? Math.hypot(
                    touches[0].pageX - touches[1].pageX,
                    touches[0].pageY - touches[1].pageY,
                  )
                : 0,
          };
        },
        onPanResponderMove: (event, movement) => {
          const touches = event.nativeEvent.touches;
          const start = gesture.current;
          if (touches.length === 2) {
            const distance = Math.hypot(
              touches[0].pageX - touches[1].pageX,
              touches[0].pageY - touches[1].pageY,
            );
            if (!start.distance) {
              start.distance = distance;
              start.zoom = current.current.zoom;
            }
            if (start.distance)
              update((start.zoom * distance) / start.distance);
          } else if (!start.distance)
            update(start.zoom, start.x + movement.dx, start.y + movement.dy);
        },
        onPanResponderRelease: (_event, movement) => {
          if (
            Math.abs(movement.dx) + Math.abs(movement.dy) > 8 ||
            gesture.current.distance
          )
            return;
          const now = Date.now();
          if (now - lastTap.current < 300) {
            update(current.current.zoom > 1 ? 1 : 2, 0, 0);
            lastTap.current = 0;
          } else lastTap.current = now;
        },
      }),
    [update],
  );
  return (
    <View style={styles.viewer}>
      <View
        style={styles.canvas}
        onLayout={event => {
          const { width, height } = event.nativeEvent.layout;
          Object.assign(current.current, { width, height });
          update(current.current.zoom);
        }}
        {...pan.panHandlers}
      >
        {failed ? (
          <Text style={styles.hint}>
            Could not display this photo. Go back and try again.
          </Text>
        ) : (
          <Animated.View
            style={[
              styles.image,
              {
                transform: [
                  { translateX: position.x },
                  { translateY: position.y },
                  { scale },
                ],
              },
            ]}
          >
            <AppImage
              source={{ uri }}
              objectFit="contain"
              style={styles.image}
              accessibilityLabel={name}
              onError={() => setFailed(true)}
            />
          </Animated.View>
        )}
      </View>
      <Text style={styles.hint}>
        Pinch or double-tap to zoom · Drag to move
      </Text>
      <View style={styles.tools}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zoom out"
          disabled={zoom <= 1}
          onPress={() => update(zoom - 0.5)}
          style={styles.button}
        >
          <ZoomOut color={zoom <= 1 ? '#678089' : '#FFFFFF'} size={24} />
        </Pressable>
        <Text accessibilityLabel="Zoom percentage" style={styles.hint}>
          {Math.round(zoom * 100)}%
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zoom in"
          disabled={zoom >= 4}
          onPress={() => update(zoom + 0.5)}
          style={styles.button}
        >
          <ZoomIn color={zoom >= 4 ? '#678089' : '#FFFFFF'} size={24} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reset zoom"
          onPress={() => update(1, 0, 0)}
          style={styles.button}
        >
          <RotateCcw color="#FFFFFF" size={22} />
        </Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  viewer: { flex: 1, gap: 8 },
  canvas: {
    flex: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: { width: '100%', height: '100%' },
  tools: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 8,
  },
  button: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hint: { color: '#BFD1D8', fontSize: 12, textAlign: 'center' },
});
