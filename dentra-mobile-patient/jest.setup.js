/* eslint-env jest */
jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn(async () => false),
  setGenericPassword: jest.fn(async () => true),
  resetGenericPassword: jest.fn(async () => true),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
}));
jest.mock('react-native-razorpay', () => ({
  open: jest.fn(async () => ({ razorpay_payment_id: 'test' })),
}));
jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: props => React.createElement(View, props),
    DateTimePickerAndroid: { open: jest.fn() },
  };
});
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }) =>
      React.createElement(View, null, children),
    SafeAreaView: ({ children, ...props }) =>
      React.createElement(View, props, children),
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});
require('react-native-gesture-handler/jestSetup');
// Match the native modules supplied by the picker/file mocks below.
jest.mock('react-native/Libraries/TurboModule/TurboModuleRegistry', () => {
  const registry = jest.requireActual('react-native/Libraries/TurboModule/TurboModuleRegistry');
  return {
    ...registry,
    get: name => ['ImagePicker', 'RNDocumentPicker', 'ReactNativeBlobUtil'].includes(name) ? {} : registry.get(name),
  };
});
jest.mock('react-native-image-picker', () => ({ launchCamera: jest.fn(async () => ({ didCancel: true })), launchImageLibrary: jest.fn(async () => ({ didCancel: true })) }));
jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(async () => []), types: { pdf: 'application/pdf' },
  errorCodes: { OPERATION_CANCELED: 'OPERATION_CANCELED' },
  isErrorWithCode: error => !!error && typeof error.code === 'string',
}));
jest.mock('react-native-blob-util', () => ({
  fs: {
    dirs: { CacheDir: '/test-cache' }, exists: jest.fn(async () => false),
    mkdir: jest.fn(async () => undefined), writeFile: jest.fn(async () => undefined), unlink: jest.fn(async () => undefined),
  },
  android: { actionViewIntent: jest.fn(async () => true) },
  ios: { openDocument: jest.fn(async () => undefined) },
}));

// Background-call native bridge is linked by the Android build.
require('react-native').NativeModules.DentraCallBackground = {
  start: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
  refresh: jest.fn(),
  getPictureInPictureState: jest.fn().mockResolvedValue(false),
  addListener: jest.fn(),
  removeListeners: jest.fn(),
};
