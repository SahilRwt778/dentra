/* eslint-env jest */
jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WhenUnlockedThisDeviceOnly' },
  getGenericPassword: jest.fn().mockResolvedValue(false),
  setGenericPassword: jest.fn().mockResolvedValue({ service: 'test' }),
  resetGenericPassword: jest.fn().mockResolvedValue(true),
}));
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
global.IS_REACT_ACT_ENVIRONMENT = true;

// Use the same URI-capable multipart implementation as the phone.
// eslint-disable-next-line @react-native/no-deep-imports -- The Jest Node global lacks React Native's URI multipart API.
global.FormData = require('react-native/Libraries/Network/FormData').default;

// Native vector rendering is verified by the Android/iOS builds.
jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  return Object.fromEntries(
    [
      'AlertCircle',
      'Toothbrush',
      'ShieldCheck',
      'Clock3',
      'CalendarDays',
      'UsersRound',
      'Search',
      'ShieldX',
      'Check',
      'FileText',
      'Upload',
      'AlertTriangle',
      'ChevronRight',
      'ChevronLeft',
      'Wallet',
      'MapPin',
      'Video',
      'CheckCircle2',
      'Bell',
      'BellRing',
      'X',
      'ImageIcon',
      'Pencil',
      'Trash2',
      'ArrowLeft',
      'Camera',
      'CameraOff',
      'Maximize2',
      'Mic',
      'MicOff',
      'PhoneOff',
      'RefreshCw',
      'Landmark',
    ].map(name => [name, View]),
  );
});

// Background-call native bridge is linked by the Android build.
require('react-native').NativeModules.DentraCallBackground = {
  start: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
  refresh: jest.fn(),
  getPictureInPictureState: jest.fn().mockResolvedValue(false),
  addListener: jest.fn(),
  removeListeners: jest.fn(),
};
