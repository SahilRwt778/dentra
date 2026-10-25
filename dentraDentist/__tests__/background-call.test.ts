import { NativeModules, Platform } from 'react-native';
import { createBackgroundCall } from '../src/common/services/background-call';

const native = NativeModules.DentraCallBackground;
const originalPlatform = Platform.OS;
beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: 'android',
  });
  NativeModules.DentraCallBackground = native;
});
afterEach(() => {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: originalPlatform,
  });
  NativeModules.DentraCallBackground = native;
});

test('late cleanup from an older room cannot stop the newer foreground service', async () => {
  const first = createBackgroundCall(),
    second = createBackgroundCall();
  await first.start(Date.now() + 60000, () => true);
  await second.start(Date.now() + 60000, () => true);
  await first.stop();
  expect(native.stop).not.toHaveBeenCalled();
  await second.stop();
  expect(native.stop).toHaveBeenCalledTimes(1);
});

test('backgrounding or logout during native startup releases the late service', async () => {
  let release!: () => void;
  let current = true;
  native.start.mockImplementationOnce(
    () =>
      new Promise<void>(resolve => {
        release = resolve;
      }),
  );
  const call = createBackgroundCall();
  const pending = call.start(Date.now() + 60000, () => current);
  await Promise.resolve();
  current = false;
  release();
  await expect(pending).rejects.toThrow('Call changed');
  await call.stop();
  expect(native.stop).toHaveBeenCalledTimes(1);
});

test('native startup failure cleans up and permits a later call', async () => {
  native.start.mockRejectedValueOnce(new Error('Unavailable'));
  await expect(
    createBackgroundCall().start(Date.now() + 60000, () => true),
  ).rejects.toThrow('Unavailable');
  expect(native.stop).toHaveBeenCalledTimes(1);
  const next = createBackgroundCall();
  await next.start(Date.now() + 60000, () => true);
  await next.stop();
  expect(native.stop).toHaveBeenCalledTimes(2);
});

test('an older Android binary requests a rebuild; iOS uses native audio and RTC PiP instead', async () => {
  NativeModules.DentraCallBackground = undefined;
  await expect(
    createBackgroundCall().start(Date.now() + 60000, () => true),
  ).rejects.toThrow('Rebuild and install');
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  const ios = createBackgroundCall();
  await ios.start(Date.now() + 60000, () => true);
  await ios.stop();
  expect(native.start).not.toHaveBeenCalled();
});
