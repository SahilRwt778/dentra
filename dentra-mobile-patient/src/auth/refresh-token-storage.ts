import * as Keychain from 'react-native-keychain';

// The refresh token lives in the OS Keychain/Keystore, not AsyncStorage
// — it's the one credential in this app that must survive on secure
// storage (see DENTRA_ARCHITECTURE.md's auth table). Keychain's
// generic-password API wants a username alongside the secret; the
// value itself is irrelevant here, only the password field is used.
const SERVICE = 'dentra_patient_refresh_token';

export async function getRefreshToken(): Promise<string | null> {
  const creds = await Keychain.getGenericPassword({ service: SERVICE });
  return creds ? creds.password : null;
}

export async function setRefreshToken(token: string): Promise<void> {
  await Keychain.setGenericPassword('dentra-patient', token, {
    service: SERVICE,
  });
}

export async function clearRefreshToken(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SERVICE });
}
