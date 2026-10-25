import React from 'react';
import {
  AppState,
  DeviceEventEmitter,
  NativeModules,
  Platform,
  View,
  type AppStateStatus,
} from 'react-native';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { useSystemPictureInPicture } from '../src/common/services/background-call';

const native = NativeModules.DentraCallBackground;
const platform = Platform.OS;
let tree: ReactTestRenderer;
let appState: (state: AppStateStatus) => void;
function Probe() {
  return (
    <View
      testID="pip-state"
      accessibilityState={{ selected: useSystemPictureInPicture() }}
    />
  );
}
function visible() {
  return tree.root.findByProps({ testID: 'pip-state' }).props.accessibilityState
    .selected;
}
async function mount() {
  await act(async () => {
    tree = Renderer.create(<Probe />);
  });
}
beforeEach(() => {
  jest.clearAllMocks();
  native.getPictureInPictureState.mockReset().mockResolvedValue(false);
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: 'android',
  });
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, listener) => {
      appState = listener;
      return { remove: jest.fn() };
    });
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  jest.restoreAllMocks();
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: platform,
  });
});

test('reads native PiP when the transition occurred before the React listener mounted', async () => {
  native.getPictureInPictureState.mockResolvedValueOnce(true);
  await mount();
  expect(visible()).toBe(true);
});

test('a late native snapshot cannot undo a newer PiP transition event', async () => {
  let resolve!: (value: boolean) => void;
  native.getPictureInPictureState.mockImplementationOnce(
    () =>
      new Promise<boolean>(finish => {
        resolve = finish;
      }),
  );
  await mount();
  await act(async () =>
    DeviceEventEmitter.emit('DentraCallBackground', {
      inPictureInPicture: true,
    }),
  );
  await act(async () => resolve(false));
  expect(visible()).toBe(true);
});

test('returning to the app recovers from a missed native exit event', async () => {
  native.getPictureInPictureState.mockResolvedValueOnce(true);
  await mount();
  expect(visible()).toBe(true);
  await act(async () => appState('active'));
  expect(visible()).toBe(false);
});

test('a late mount snapshot cannot overwrite the state read when returning to Dentra', async () => {
  let resolve!: (value: boolean) => void;
  native.getPictureInPictureState.mockImplementationOnce(
    () =>
      new Promise<boolean>(finish => {
        resolve = finish;
      }),
  );
  await mount();
  await act(async () => appState('active'));
  await act(async () => resolve(true));
  expect(visible()).toBe(false);
});

test('iOS uses the remote video view PiP without calling the Android bridge', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  await mount();
  expect(visible()).toBe(false);
  expect(native.getPictureInPictureState).not.toHaveBeenCalled();
});
