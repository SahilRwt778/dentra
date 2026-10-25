import type { nativeVideo } from './native-video';
type VideoSdk = NonNullable<ReturnType<typeof nativeVideo>>;

let queue: Promise<unknown> = Promise.resolve();
let audioOwner: symbol | null = null;
function runInOrder(work: () => Promise<void>) {
  const pending = queue.then(work, work);
  queue = pending.catch(() => {});
  return pending;
}

// Each connection owns its audio session; a late cleanup cannot stop a newer call.
export function createCallAudio(sdk: VideoSdk) {
  const owner = Symbol('video-audio');
  return {
    start(isCurrent: () => boolean) {
      return runInOrder(async () => {
        if (!isCurrent()) throw new Error('Call changed.');
        audioOwner = owner;
        try {
          await sdk.AudioSession.startAudioSession();
        } catch (error) {
          audioOwner = null;
          await sdk.AudioSession.stopAudioSession().catch(() => {});
          throw error;
        }
        if (!isCurrent()) {
          audioOwner = null;
          await sdk.AudioSession.stopAudioSession();
          throw new Error('Call changed.');
        }
      });
    },
    stop() {
      return runInOrder(async () => {
        if (audioOwner !== owner) return;
        audioOwner = null;
        await sdk.AudioSession.stopAudioSession();
      });
    },
  };
}
