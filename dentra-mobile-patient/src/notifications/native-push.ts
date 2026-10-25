import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform } from 'react-native';
import type { RemoteMessage } from '@react-native-firebase/messaging';
import { PUSH_ENABLED } from '@/config';

export type PushPermission = 'allowed' | 'denied' | 'not-determined';
export type PushMessage = { notificationId: string };
type MessagingModule = typeof import('@react-native-firebase/messaging');

function native() {
  if (!PUSH_ENABLED) return null;
  try {
    // An older installed development binary or an unconfigured build remains usable.
    const app =
      require('@react-native-firebase/app') as typeof import('@react-native-firebase/app');
    if (!app.getApps().length) return null;
    const sdk = require('@react-native-firebase/messaging') as MessagingModule;
    return { sdk, messaging: sdk.getMessaging(app.getApp()) };
  } catch {
    return null;
  }
}

function message(value: RemoteMessage | null): PushMessage | null {
  const id = value?.data?.notificationId;
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)
    ? { notificationId: id }
    : null;
}

export const nativePush = {
  available: () => native() !== null,
  async permission(): Promise<PushPermission> {
    const current = native();
    if (!current) return 'not-determined';
    const status = await current.sdk.hasPermission(current.messaging);
    if (status === 1 || status === 2) return 'allowed';
    if (
      Platform.OS === 'android' &&
      Number(Platform.Version) >= 33 &&
      !(await AsyncStorage.getItem('dentra_push_permission_requested'))
    )
      return 'not-determined';
    return status === -1 ? 'not-determined' : 'denied';
  },
  async requestPermission(): Promise<PushPermission> {
    const current = native();
    if (!current) return 'not-determined';
    if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      await AsyncStorage.setItem('dentra_push_permission_requested', 'true');
      return result === PermissionsAndroid.RESULTS.GRANTED
        ? 'allowed'
        : 'denied';
    }
    if (Platform.OS === 'android')
      return (await current.sdk.hasPermission(current.messaging)) === 1
        ? 'allowed'
        : 'denied';
    const result = await current.sdk.requestPermission(current.messaging);
    return result === 1 || result === 2
      ? 'allowed'
      : result === -1
      ? 'not-determined'
      : 'denied';
  },
  async token() {
    const current = native();
    if (!current) throw new Error('Phone notifications are unavailable.');
    await current.sdk.setAutoInitEnabled(current.messaging, true);
    if (Platform.OS === 'ios') {
      await current.sdk.registerDeviceForRemoteMessages(current.messaging);
      if (!(await current.sdk.getAPNSToken(current.messaging)))
        throw new Error('Phone notification registration is not ready.');
    }
    return current.sdk.getToken(current.messaging);
  },
  async removeToken() {
    const current = native();
    if (!current) return;
    await current.sdk.setAutoInitEnabled(current.messaging, false);
    await current.sdk.deleteToken(current.messaging);
  },
  onToken(callback: (token: string) => void) {
    const current = native();
    return current
      ? current.sdk.onTokenRefresh(current.messaging, callback)
      : () => {};
  },
  onMessage(callback: (value: PushMessage) => void) {
    const current = native();
    return current
      ? current.sdk.onMessage(current.messaging, value => {
          const update = message(value);
          if (update) callback(update);
        })
      : () => {};
  },
  onOpen(callback: (value: PushMessage) => void) {
    const current = native();
    return current
      ? current.sdk.onNotificationOpenedApp(current.messaging, value => {
          const update = message(value);
          if (update) callback(update);
        })
      : () => {};
  },
  async initialMessage() {
    const current = native();
    return current
      ? message(await current.sdk.getInitialNotification(current.messaging))
      : null;
  },
};

export function installBackgroundPushHandler() {
  const current = native();
  // FCM displays notification payloads in the background. Private records are fetched after an authenticated tap.
  current?.sdk.setBackgroundMessageHandler(current.messaging, async () => {});
}
