import * as Keychain from 'react-native-keychain';

const SESSION_SERVICE = 'com.dentradentist.session';
const DEVICE_SERVICE = 'com.dentradentist.device';

export const tokenStorage = {
  async read(): Promise<string | null> {
    const value = await Keychain.getGenericPassword({
      service: SESSION_SERVICE,
    });
    return value ? value.password : null;
  },
  async write(token: string): Promise<void> {
    const saved = await Keychain.setGenericPassword('dentra-dentist', token, {
      service: SESSION_SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    if (!saved)
      throw new Error(
        'Could not securely save your session. Please try again.',
      );
  },
  async clear(): Promise<void> {
    await Keychain.resetGenericPassword({ service: SESSION_SERVICE });
  },
};
let devicePromise: Promise<string> | undefined;
export function getDeviceId(): Promise<string> {
  if (!devicePromise) {
    devicePromise = (async () => {
      const value = await Keychain.getGenericPassword({
        service: DEVICE_SERVICE,
      });
      if (value) return value.password;
      // This is a non-secret installation label, not an authentication credential.
      const id = `dentist-mobile-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;
      const saved = await Keychain.setGenericPassword('installation', id, {
        service: DEVICE_SERVICE,
      });
      if (!saved)
        throw new Error('Could not save this device. Please try again.');
      return id;
    })().catch(error => {
      devicePromise = undefined;
      throw error;
    });
  }
  return devicePromise;
}
