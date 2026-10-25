import axios from 'axios';
import type { VideoSdk } from './native-video';

let queue: Promise<unknown> = Promise.resolve();
let audioOwner: symbol | null = null;
function runInOrder(work: () => Promise<void>) {
  const pending = queue.then(work, work);
  queue = pending.catch(() => {});
  return pending;
}

// Each connection owns its audio session; a late cleanup cannot stop a newer call.
export function createVideoAudio(sdk: VideoSdk) {
  const owner = Symbol('video-audio');
  return {
    start(isCurrent: () => boolean) {
      return runInOrder(async () => {
        if (!isCurrent()) throw new axios.CanceledError('Call changed.');
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
          throw new axios.CanceledError('Call changed.');
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
