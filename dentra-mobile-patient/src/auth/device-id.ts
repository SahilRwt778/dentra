import AsyncStorage from '@react-native-async-storage/async-storage';
import uuid from 'react-native-uuid';

// A stable per-install identifier — scopes the refresh token server-side
// so this install can be revoked without touching the patient's other
// devices (see dentra-api's refresh_tokens.device_id). Not sensitive,
// so plain AsyncStorage (unlike the refresh token itself) is fine.
const DEVICE_ID_KEY = 'dentra_patient_device_id';

let cached: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = uuid.v4() as string;
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  cached = id;
  return id;
}
