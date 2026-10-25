import { useEffect, useState } from 'react';
import {
  AppState,
  NativeEventEmitter,
  NativeModules,
  Platform,
} from 'react-native';

type BackgroundEvent = { inPictureInPicture: boolean; endedReason?: string };
type NativeCall = {
  start: (expiresAt: number) => Promise<void>;
  stop: () => Promise<void>;
  refresh: () => void;
  getPictureInPictureState?: () => Promise<boolean>;
  addListener: (name: string) => void;
  removeListeners: (count: number) => void;
};
function nativeCall(): NativeCall | undefined {
  return Platform.OS === 'android'
    ? NativeModules.DentraCallBackground
    : undefined;
}
let queue: Promise<unknown> = Promise.resolve();
let currentOwner: symbol | null = null;
function inOrder(work: () => Promise<void>) {
  const result = queue.then(work, work);
  queue = result.catch(() => undefined);
  return result;
}

/** The native foreground service belongs to one room, including during a cancelled join. */
export function createBackgroundCall() {
  const owner = Symbol('background-call');
  return {
    start(expiresAt: number, isCurrent: () => boolean) {
      return inOrder(async () => {
        if (!isCurrent()) throw new Error('Call changed.');
        const module = nativeCall();
        if (Platform.OS === 'android' && !module)
          throw new Error(
            'Rebuild and install Dentra to enable background video calls.',
          );
        currentOwner = owner;
        try {
          await module?.start(expiresAt);
          if (!isCurrent()) throw new Error('Call changed.');
        } catch (error) {
          currentOwner = null;
          await module?.stop().catch(() => undefined);
          throw error;
        }
      });
    },
    stop() {
      return inOrder(async () => {
        if (currentOwner !== owner) return;
        currentOwner = null;
        await nativeCall()?.stop();
      });
    },
  };
}

export function listenForCallBackground(
  listener: (event: BackgroundEvent) => void,
) {
  const module = nativeCall();
  if (!module) return { remove() {} };
  return new NativeEventEmitter(module).addListener(
    'DentraCallBackground',
    value => listener(value as BackgroundEvent),
  );
}
export function useSystemPictureInPicture() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let mounted = true;
    let revision = 0;
    const subscription = listenForCallBackground(event => {
      revision++;
      setVisible(event.inPictureInPicture);
    });
    function syncNativeState() {
      const requestedRevision = ++revision;
      nativeCall()
        ?.getPictureInPictureState?.()
        .then(value => {
          // A transition event is newer than a snapshot requested before it.
          if (mounted && requestedRevision === revision) setVisible(value);
        })
        .catch(() => undefined);
    }
    syncNativeState();
    const appState = AppState.addEventListener('change', syncNativeState);
    return () => {
      mounted = false;
      subscription.remove();
      appState.remove();
    };
  }, []);
  return visible;
}
export function refreshBackgroundCall() {
  nativeCall()?.refresh();
}
