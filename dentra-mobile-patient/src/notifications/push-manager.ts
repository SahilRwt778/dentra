import { Platform } from 'react-native';
import { nativePush } from './native-push';
import {
  currentPushSession,
  pushDeliveryAvailable,
  registerPushToken,
  unregisterPushDevice,
  type PushSession,
} from './push-session';

export type PushState =
  | 'unavailable'
  | 'off'
  | 'denied'
  | 'enabled'
  | 'error'
  | 'busy';
type Callbacks = {
  state: (value: PushState) => void;
  message: (id: string) => void;
  open: (id: string) => void;
};
let revision = 0;
let active:
  | {
      scope: PushSession;
      callbacks: Callbacks;
      controller: AbortController;
      cleanup: (() => void)[];
    }
  | undefined;
let tail: Promise<unknown> = Promise.resolve();
function serial(operation: () => Promise<void>) {
  const result = tail.then(operation, operation);
  tail = result.catch(() => undefined);
  return result;
}

export function stopPatientPush(removeToken = false) {
  revision++;
  active?.controller.abort();
  active?.cleanup.forEach(remove => remove());
  active = undefined;
  if (removeToken) return serial(() => nativePush.removeToken());
  return Promise.resolve();
}

export function startPatientPush(scope: PushSession, callbacks: Callbacks) {
  stopPatientPush();
  const current = {
    scope,
    callbacks,
    controller: new AbortController(),
    cleanup: [] as (() => void)[],
  };
  active = current;
  if (!nativePush.available()) {
    callbacks.state('unavailable');
    return () => {
      if (active === current) stopPatientPush();
    };
  }
  const valid = () =>
    active === current &&
    currentPushSession()?.key === scope.key &&
    !current.controller.signal.aborted;
  current.cleanup.push(
    nativePush.onToken(token => {
      const version = revision;
      serial(async () => {
        if (
          !valid() ||
          revision !== version ||
          (await nativePush.permission()) !== 'allowed'
        )
          return;
        await registerPushToken(
          scope,
          token,
          Platform.OS as 'android' | 'ios',
          current.controller.signal,
        );
        if (valid()) callbacks.state('enabled');
      }).catch(() => {
        if (valid()) callbacks.state('error');
      });
    }),
    nativePush.onMessage(value => {
      if (valid()) callbacks.message(value.notificationId);
    }),
    nativePush.onOpen(value => {
      if (valid()) callbacks.open(value.notificationId);
    }),
  );
  nativePush
    .initialMessage()
    .then(value => {
      if (value && valid()) callbacks.open(value.notificationId);
    })
    .catch(() => undefined);
  reconcilePatientPush().catch(() => undefined);
  return () => {
    if (active === current) stopPatientPush();
  };
}

export function reconcilePatientPush(requestPermission = false) {
  const current = active;
  const version = revision;
  if (!current || !nativePush.available()) return Promise.resolve();
  const valid = () =>
    active === current &&
    revision === version &&
    currentPushSession()?.key === current.scope.key;
  return serial(async () => {
    if (!valid()) return;
    current.callbacks.state('busy');
    try {
      if (
        !(await pushDeliveryAvailable(current.scope, current.controller.signal))
          .available
      ) {
        if (valid()) current.callbacks.state('unavailable');
        return;
      }
      if (!valid()) return;
      const permission = requestPermission
        ? await nativePush.requestPermission()
        : await nativePush.permission();
      if (!valid()) return;
      if (permission !== 'allowed') {
        await unregisterPushDevice(current.scope, current.controller.signal);
        if (valid())
          current.callbacks.state(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const token = await nativePush.token();
      if (!valid()) return;
      await registerPushToken(
        current.scope,
        token,
        Platform.OS as 'android' | 'ios',
        current.controller.signal,
      );
      if (valid()) current.callbacks.state('enabled');
    } catch {
      if (valid()) current.callbacks.state('error');
    }
  });
}
