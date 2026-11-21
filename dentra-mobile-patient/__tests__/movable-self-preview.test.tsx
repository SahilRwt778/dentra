import React, { useEffect } from 'react';
import {
  PanResponder,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { MovableSelfPreview } from '@dentra/video/src/MovableSelfPreview';

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
const dragging = jest.fn();

function Media() {
  useEffect(() => {
    mounted();
    return () => {
      unmounted();
    };
  }, []);
  return <View testID="camera-frame" />;
}
const content = <Media />;
function render(hidden = false, controlsVisible = true) {
  return (
    <MovableSelfPreview
      hidden={hidden}
      topInset={controlsVisible ? 80 : 0}
      bottomInset={controlsVisible ? 140 : 0}
      onPress={tapped}
      onDragChange={dragging}
    >
      {content}
    </MovableSelfPreview>
  );
}
function gesture(dx: number, dy: number, numberActiveTouches = 1) {
  return { dx, dy, numberActiveTouches } as PanResponderGestureState;
}
function handlers() {
  return responder.mock.calls.at(-1)![0];
}
function style() {
  return StyleSheet.flatten(
    tree.root.findByProps({ testID: 'self-preview' }).props.style,
  );
}
function position() {
  const transform = JSON.parse(JSON.stringify(style().transform));
  return { x: transform[0].translateX, y: transform[1].translateY };
}
async function layout(width: number, height: number) {
  await act(async () =>
    tree.root.findByProps({ testID: 'self-preview-bounds' }).props.onLayout({
      nativeEvent: { layout: { width, height, x: 0, y: 0 } },
    }),
  );
}
async function drag(dx: number, dy: number) {
  await act(async () => {
    handlers().onPanResponderGrant!(event, gesture(0, 0));
    handlers().onPanResponderMove!(event, gesture(dx, dy));
    handlers().onPanResponderRelease!(event, gesture(dx, dy));
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  responder = jest.spyOn(PanResponder, 'create');
  await act(async () => {
    tree = Renderer.create(render());
  });
  await layout(400, 800);
});
afterEach(async () => {
  await act(async () => tree.unmount());
  jest.restoreAllMocks();
});

test('the preview stays within safe edges and clear of the header and call controls', async () => {
  await drag(-5000, -5000);
  expect(position()).toEqual({ x: 12, y: 92 });
  await drag(60, 90);
  expect(position()).toEqual({ x: 72, y: 182 });
  await drag(5000, 5000);
  expect(position().x + style().width).toBeCloseTo(388);
  expect(position().y + style().height).toBeCloseTo(648);
  expect(dragging.mock.calls).toEqual([
    [true],
    [false],
    [true],
    [false],
    [true],
    [false],
  ]);
});

test('small motions remain taps and dragging never captures multiple fingers', async () => {
  expect(
    handlers().onMoveShouldSetPanResponderCapture!(event, gesture(3, 4)),
  ).toBe(false);
  expect(
    handlers().onMoveShouldSetPanResponderCapture!(event, gesture(15, 0)),
  ).toBe(true);
  expect(
    handlers().onMoveShouldSetPanResponderCapture!(event, gesture(15, 0, 2)),
  ).toBe(false);
  await act(async () =>
    tree.root
      .findByProps({ accessibilityLabel: 'Your video preview' })
      .props.onPress(),
  );
  expect(tapped).toHaveBeenCalledTimes(1);
});

test('rotation and changing controls keep the chosen position reachable', async () => {
  await drag(-5000, -5000);
  await drag(60, 90);
  const saved = position();
  await act(async () => tree.update(render(false, false)));
  expect(position()).toEqual(saved);
  await layout(800, 350);
  expect(position().x + style().width).toBeLessThanOrEqual(788);
  expect(position().y + style().height).toBeLessThanOrEqual(318);
  await act(async () => tree.update(render(false, true)));
  expect(position().y).toBeGreaterThanOrEqual(92);
  expect(position().y + style().height).toBeLessThanOrEqual(198);
});

test('moving, minimizing and restoring keep the same camera mounted and preserve position', async () => {
  const media = tree.root.findByType(Media);
  await drag(-5000, -5000);
  await drag(60, 90);
  const saved = position();
  await act(async () => tree.update(render(true)));
  await layout(160, 284);
  expect(
    handlers().onMoveShouldSetPanResponderCapture!(event, gesture(15, 0)),
  ).toBe(false);
  await act(async () => tree.update(render()));
  expect(position()).toEqual(saved);
  expect(tree.root.findByType(Media)).toBe(media);
  expect(mounted).toHaveBeenCalledTimes(1);
  expect(unmounted).not.toHaveBeenCalled();
});
