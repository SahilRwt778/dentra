import { Platform } from 'react-native';
declare const process: {
  env: {
    DENTRA_API_URL?: string;
    DENTRA_SUPPORT_EMAIL?: string;
    DENTRA_PUSH_ENABLED?: string;
    DENTRA_PUSH_IOS_ENABLED?: string;
  };
};

// 10.0.2.2 is the Android emulator's alias for the host machine's
// localhost (there's no such mapping on a real device — this only
// covers the emulator workflow this app is being developed against).
// iOS Simulator shares the host's network namespace, so plain
// localhost works there unchanged.
export const API_BASE_URL = (
  process.env.DENTRA_API_URL ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000')
).replace(/\/$/, '');
export const SUPPORT_EMAIL =
  process.env.DENTRA_SUPPORT_EMAIL || 'support@dentra.in';

export const PUSH_ENABLED =
  process.env.DENTRA_PUSH_ENABLED === 'true' &&
  (Platform.OS !== 'ios' || process.env.DENTRA_PUSH_IOS_ENABLED === 'true');
