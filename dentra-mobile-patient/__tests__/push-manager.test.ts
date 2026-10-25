import { nativePush } from '../src/notifications/native-push';
import {
  currentPushSession,
  pushDeliveryAvailable,
  registerPushToken,
  unregisterPushDevice,
  type PushSession,
} from '../src/notifications/push-session';
import {
  startPatientPush,
  stopPatientPush,
  reconcilePatientPush,
} from '../src/notifications/push-manager';

jest.mock('../src/notifications/native-push', () => ({
  nativePush: {
    available: jest.fn(() => true),
    permission: jest.fn(),
    requestPermission: jest.fn(),
    token: jest.fn(),
    removeToken: jest.fn(),
    onToken: jest.fn(),
    onMessage: jest.fn(),
    onOpen: jest.fn(),
    initialMessage: jest.fn(),
  },
}));
jest.mock('../src/notifications/push-session', () => ({
  currentPushSession: jest.fn(),
  pushDeliveryAvailable: jest.fn(),
  registerPushToken: jest.fn(),
  unregisterPushDevice: jest.fn(),
}));
const native = jest.mocked(nativePush);
const sessions = {
  current: jest.mocked(currentPushSession),
  available: jest.mocked(pushDeliveryAvailable),
  register: jest.mocked(registerPushToken),
  unregister: jest.mocked(unregisterPushDevice),
};
const scope: PushSession = {
  userId: 'patient-a',
  sessionId: 'session-a',
  deviceId: 'phone',
  key: 'patient-a:session-a',
};
const callbacks = () => ({
  state: jest.fn(),
  message: jest.fn(),
  open: jest.fn(),
});
beforeEach(async () => {
  await stopPatientPush();
  jest.resetAllMocks();
  native.available.mockReturnValue(true);
  native.permission.mockResolvedValue('not-determined');
  native.requestPermission.mockResolvedValue('allowed');
  native.token.mockResolvedValue('fcm-token');
  native.removeToken.mockResolvedValue(undefined);
  native.initialMessage.mockResolvedValue(null);
  for (const subscribe of [native.onToken, native.onMessage, native.onOpen])
    subscribe.mockReturnValue(jest.fn());
  sessions.current.mockReturnValue(scope);
  sessions.available.mockResolvedValue({ available: true });
  sessions.register.mockResolvedValue(undefined);
  sessions.unregister.mockResolvedValue(undefined);
});
afterEach(() => stopPatientPush());

test('permission is requested only after enabling, and a denied permission removes registration', async () => {
  const events = callbacks();
  startPatientPush(scope, events);
  await reconcilePatientPush();
  expect(native.requestPermission).not.toHaveBeenCalled();
  expect(native.token).not.toHaveBeenCalled();
  expect(events.state).toHaveBeenLastCalledWith('off');
  await reconcilePatientPush(true);
  expect(sessions.register).toHaveBeenLastCalledWith(
    scope,
    'fcm-token',
    expect.any(String),
    expect.any(AbortSignal),
  );
  native.permission.mockResolvedValue('denied');
  await reconcilePatientPush();
  expect(sessions.unregister).toHaveBeenLastCalledWith(
    scope,
    expect.any(AbortSignal),
  );
  expect(events.state).toHaveBeenLastCalledWith('denied');
});

test('disabled backend delivery never prompts or obtains a device token', async () => {
  sessions.available.mockResolvedValue({ available: false });
  const events = callbacks();
  startPatientPush(scope, events);
  await reconcilePatientPush(true);
  expect(events.state).toHaveBeenLastCalledWith('unavailable');
  expect(native.requestPermission).not.toHaveBeenCalled();
  expect(native.token).not.toHaveBeenCalled();
});

test('logout while token acquisition is pending cannot register the old account', async () => {
  native.permission.mockResolvedValue('allowed');
  let finish!: (token: string) => void;
  let acquired!: () => void;
  const waiting = new Promise<void>(resolve => {
    acquired = resolve;
  });
  native.token.mockImplementation(() => {
    acquired();
    return new Promise(resolve => {
      finish = resolve;
    });
  });
  startPatientPush(scope, callbacks());
  await waiting;
  const stopped = stopPatientPush(true);
  sessions.current.mockReturnValue(null);
  finish('old-account-token');
  await stopped;
  expect(sessions.register).not.toHaveBeenCalled();
  expect(native.removeToken).toHaveBeenCalledTimes(1);
});

test('rotated tokens update the current session and callbacks from a stopped session are ignored', async () => {
  native.permission.mockResolvedValue('allowed');
  const events = callbacks();
  startPatientPush(scope, events);
  await reconcilePatientPush();
  const rotate = native.onToken.mock.calls[0][0];
  const message = native.onMessage.mock.calls[0][0];
  const open = native.onOpen.mock.calls[0][0];
  rotate('rotated-token');
  await reconcilePatientPush();
  expect(sessions.register).toHaveBeenCalledWith(
    scope,
    'rotated-token',
    expect.any(String),
    expect.any(AbortSignal),
  );
  message({ notificationId: 'current-message' });
  expect(events.message).toHaveBeenCalledWith('current-message');
  await stopPatientPush();
  sessions.register.mockClear();
  rotate('late-token');
  message({ notificationId: 'late-message' });
  open({ notificationId: 'late-open' });
  await reconcilePatientPush();
  expect(sessions.register).not.toHaveBeenCalled();
  expect(events.message).toHaveBeenCalledTimes(1);
  expect(events.open).not.toHaveBeenCalled();
});
