import axios from 'axios';
import { createVideoAudio } from '../src/common/services/video-audio';
import type { VideoSdk } from '../src/common/services/native-video';
const start = jest.fn().mockResolvedValue(undefined);
const stop = jest.fn().mockResolvedValue(undefined);
const sdk = {
  AudioSession: { startAudioSession: start, stopAudioSession: stop },
} as unknown as VideoSdk;
beforeEach(() => {
  jest.clearAllMocks();
});
test('a cancelled join never starts native audio', async () => {
  const audio = createVideoAudio(sdk);
  const result = await audio.start(() => false).catch(error => error);
  expect(axios.isCancel(result)).toBe(true);
  expect(start).not.toHaveBeenCalled();
});
test('a late cleanup from an older room cannot stop a newer audio session', async () => {
  const old = createVideoAudio(sdk);
  const current = createVideoAudio(sdk);
  await old.start(() => true);
  await current.start(() => true);
  await old.stop();
  expect(stop).not.toHaveBeenCalled();
  await current.stop();
  expect(stop).toHaveBeenCalledTimes(1);
});
test('logout while native audio is starting stops it before returning', async () => {
  let ready!: () => void;
  let valid = true;
  start.mockImplementationOnce(
    () =>
      new Promise<void>(resolve => {
        ready = resolve;
      }),
  );
  const audio = createVideoAudio(sdk);
  const result = audio.start(() => valid).catch(error => error);
  await new Promise<void>(resolve => setImmediate(resolve));
  valid = false;
  ready();
  expect(axios.isCancel(await result)).toBe(true);
  expect(stop).toHaveBeenCalledTimes(1);
});
test('a native start failure also releases audio resources', async () => {
  start.mockRejectedValueOnce(new Error('Audio unavailable'));
  await expect(createVideoAudio(sdk).start(() => true)).rejects.toThrow(
    'Audio unavailable',
  );
  expect(stop).toHaveBeenCalledTimes(1);
});
