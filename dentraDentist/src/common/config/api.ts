import { Platform } from 'react-native';

// For a physical phone, replace the development URL with your computer's LAN IP.
// Configure your deployed HTTPS API here before making a release build.
export const API_BASE_URL = __DEV__
  ? Platform.select({
      android: 'http://10.0.2.2:3000',
      default: 'http://localhost:3000',
    })
  : '';
export const API_TIMEOUT_MS = 20000;
