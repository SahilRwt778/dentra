import React, { useEffect } from 'react';
import {
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { MovableCallWindow } from '../src/features/video/MovableCallWindow';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 30, bottom: 20, left: 0, right: 0 }),
}));

let tree: ReactTestRenderer;
let responder: jest.SpyInstance<
  ReturnType<typeof PanResponder.create>,
  Parameters<typeof PanResponder.create>
>;
const event = {} as GestureResponderEvent;
const mounted = jest.fn();
const unmounted = jest.fn();
const tapped = jest.fn();
function Media() {
  useEffect(() => {
    mounted();
    return () => {
      unmounted();
    };
  }, []);
  return (
    <View testID="connected-media">
      <Pressable onPress={tapped} accessibilityLabel="Mute" />
    </View>
  );
}
const content = <Media />;
function render(minimized: boolean, systemPip = false) {
  return (
    <MovableCallWindow minimized={minimized} systemPip={systemPip}>
      {content}
    </MovableCallWindow>
  );
}
function gesture(
  dx: number,
  dy: number,
  numberActiveTouches = 1,
): PanResponderGestureState {
  return {
    dx,
    dy,
    numberActiveTouches,
    stateID: 1,
    moveX: dx,
    moveY: dy,
    x0: 0,
    y0: 0,
    vx: 0,
    vy: 0,
  };
}
function handlers() {
  return responder.mock.calls.at(-1)![0];
}
function style() {
  return StyleSheet.flatten(
    tree.root.findByProps({ testID: 'call-window' }).props.style,
  );
}
function position() {
  const transform = JSON.parse(JSON.stringify(style().transform));
  return { x: transform[0].translateX, y: transform[1].translateY };
}
async function layout(width: number, height: number) {
  await act(async () =>
    tree.root.findByProps({ testID: 'call-window-overlay' }).props.onLayout({
      nativeEvent: { layout: { width, height, x: 0, y: 0 } },
    }),
  );
}
async function drag(dx: number, dy: number) {
  await act(async () => {
    handlers().onPanResponderGrant!(event, gesture(0, 0));
    handlers().onPanResponderMove!(event, gesture(dx, dy));
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  responder = jest.spyOn(PanResponder, 'create');
  await act(async () => {
    tree = Renderer.create(render(true));
  });
  await layout(400, 800);
});
afterEach(async () => {
  await act(async () => tree.unmount());
  jest.restoreAllMocks();
});

test('drags freely, stays inside safe edges, and starts each new drag at its saved position', async () => {
  await drag(-5000, -5000);
  expect(position()).toEqual({ x: 12, y: 30 });
  await drag(60, 90);
  expect(position()).toEqual({ x: 72, y: 120 });
  await drag(5000, 5000);
  expect(position()).toEqual({ x: 128, y: 490 });
});

test('resizing or rotation keeps the whole window and its controls on screen', async () => {
  await drag(5000, 5000);
  await layout(320, 380);
  expect(position()).toEqual({ x: 48, y: 70 });
  await layout(250, 250);
  expect(style()).toMatchObject({ width: 226, height: 200 });
  expect(position()).toEqual({ x: 12, y: 30 });
});

test('small movements and multi-touch leave taps alone; full-screen calls do not drag', async () => {
  const shouldDrag = (dx: number, dy: number, touches = 1) =>
    handlers().onMoveShouldSetPanResponderCapture!(
      event,
      gesture(dx, dy, touches),
    );
  expect(shouldDrag(3, 4)).toBe(false);
  expect(shouldDrag(0, 10)).toBe(true);
  expect(shouldDrag(10, 0, 2)).toBe(false);
  await act(async () =>
    tree.root.findByProps({ accessibilityLabel: 'Mute' }).props.onPress(),
  );
  expect(tapped).toHaveBeenCalledTimes(1);
  await act(async () => tree.update(render(false)));
  expect(shouldDrag(30, 50)).toBe(false);
});

test('moving, expanding, and minimizing preserve the media instance and window position', async () => {
  const media = tree.root.findByType(Media);
  await drag(-5000, -5000);
  await drag(60, 90);
  const saved = position();
  await act(async () => tree.update(render(false)));
  expect(style()).toMatchObject({ top: 0, right: 0, bottom: 0, left: 0 });
  expect(style().transform).toBeUndefined();
  await act(async () => tree.update(render(true)));
  expect(position()).toEqual(saved);
  expect(tree.root.findByType(Media)).toBe(media);
  expect(mounted).toHaveBeenCalledTimes(1);
  expect(unmounted).not.toHaveBeenCalled();
});

test('system PiP fills the viewport and preserves the drag position when returning to the app', async () => {
  const media = tree.root.findByType(Media);
  await drag(-5000, -5000);
  await drag(60, 90);
  const saved = position();
  await act(async () => tree.update(render(true, true)));
  await layout(160, 284);
  expect(style()).toMatchObject({ top: 0, right: 0, bottom: 0, left: 0 });
  expect(style().width).toBeUndefined();
  expect(style().height).toBeUndefined();
  expect(style().borderRadius).toBeUndefined();
  expect(style().transform).toBeUndefined();
  expect(
    handlers().onMoveShouldSetPanResponderCapture!(event, gesture(20, 30)),
  ).toBe(false);
  await act(async () => tree.update(render(true)));
  await layout(400, 800);
  expect(position()).toEqual(saved);
  expect(tree.root.findByType(Media)).toBe(media);
  expect(mounted).toHaveBeenCalledTimes(1);
  expect(unmounted).not.toHaveBeenCalled();
});
