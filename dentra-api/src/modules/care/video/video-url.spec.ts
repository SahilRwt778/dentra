import { videoClientUrl } from './video-url';

test('uses the Android emulator alias only for development loopback URLs', () => {
  expect(videoClientUrl('ws://localhost:7880', 'android')).toBe(
    'ws://10.0.2.2:7880'
  );
  expect(videoClientUrl('ws://localhost:7880', 'ios')).toBe(
    'ws://localhost:7880'
  );
  expect(videoClientUrl('wss://project.livekit.cloud', 'android')).toBe(
    'wss://project.livekit.cloud'
  );
  expect(videoClientUrl('ws://192.168.1.2:7880', 'android')).toBe(
    'ws://192.168.1.2:7880'
  );
});
