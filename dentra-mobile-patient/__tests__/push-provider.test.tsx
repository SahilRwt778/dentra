import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { PatientPushProvider } from '../src/notifications/push-provider';
import { startPatientPush } from '../src/notifications/push-manager';
import {
  currentPushSession,
  resolvePushNotification,
  pushRequest,
} from '../src/notifications/push-session';
import { patientNavigationRef } from '../src/navigation/navigation-ref';

const mockDispatch = jest.fn();
const mockStop = jest.fn();
const scope = {
  userId: 'patient',
  sessionId: 'session',
  deviceId: 'phone',
  key: 'patient:session',
};
jest.mock('../src/store/hooks', () => ({
  useAppSelector: () => 'access-token',
  useAppDispatch: () => mockDispatch,
}));
jest.mock('../src/api/generated/patient-api', () => ({
  dentraApi: {
    util: {
      invalidateTags: (tags: string[]) => ({ type: 'invalidate', tags }),
    },
  },
}));
jest.mock('../src/navigation/navigation-ref', () => ({
  patientNavigationRef: { navigate: jest.fn() },
  whenPatientNavigationReady: (action: () => void) => action(),
}));
jest.mock('../src/notifications/push-manager', () => ({
  startPatientPush: jest.fn(),
  reconcilePatientPush: jest.fn(),
}));
jest.mock('../src/notifications/push-session', () => ({
  currentPushSession: jest.fn(),
  sessionFromToken: () => ({ key: 'patient:session' }),
  resolvePushNotification: jest.fn(),
  pushRequest: jest.fn(),
}));
let tree: Renderer.ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(currentPushSession).mockReturnValue(scope);
  jest.mocked(startPatientPush).mockReturnValue(mockStop);
  jest.mocked(pushRequest).mockResolvedValue(undefined);
});
afterEach(async () => {
  await act(async () => tree.unmount());
});
const render = () =>
  act(async () => {
    tree = Renderer.create(
      <PatientPushProvider>
        <Text>Patient app</Text>
      </PatientPushProvider>,
    );
  });

test('a notification tap resolves the owned record before opening a visit and marking it read', async () => {
  jest
    .mocked(resolvePushNotification)
    .mockResolvedValue({
      type: 'visit_summary_ready',
      appointmentId: 'visit-id',
    } as never);
  await render();
  await act(async () => {
    jest.mocked(startPatientPush).mock.calls[0][1].open('notification-id');
  });
  expect(resolvePushNotification).toHaveBeenCalledWith(
    scope,
    'notification-id',
    expect.any(AbortSignal),
  );
  expect(patientNavigationRef.navigate).toHaveBeenCalledWith('Visit', {
    appointmentId: 'visit-id',
  });
  expect(pushRequest).toHaveBeenCalledWith(
    scope,
    '/notifications/notification-id/read',
    'PATCH',
    undefined,
    expect.any(AbortSignal),
  );
});

test('foreign or stale account notifications cannot navigate or mark a record read', async () => {
  jest
    .mocked(resolvePushNotification)
    .mockRejectedValueOnce(new Error('not found'));
  await render();
  const callbacks = jest.mocked(startPatientPush).mock.calls[0][1];
  await act(async () => {
    callbacks.open('foreign-id');
  });
  expect(patientNavigationRef.navigate).not.toHaveBeenCalled();
  jest.mocked(resolvePushNotification).mockImplementationOnce(async () => {
    jest
      .mocked(currentPushSession)
      .mockReturnValue({ ...scope, key: 'other:session' });
    return {
      type: 'booking_confirmed',
      appointmentId: 'private-appointment',
    } as never;
  });
  await act(async () => {
    callbacks.open('old-id');
  });
  expect(patientNavigationRef.navigate).not.toHaveBeenCalled();
  expect(pushRequest).not.toHaveBeenCalled();
});

test('foreground delivery refreshes inbox and appointment data and shows a dismissible generic banner', async () => {
  await render();
  await act(async () => {
    jest.mocked(startPatientPush).mock.calls[0][1].message('notification-id');
  });
  expect(mockDispatch).toHaveBeenCalledWith({
    type: 'invalidate',
    tags: ['Notifications', 'Appointments', 'Consultations', 'Patients'],
  });
  expect(
    tree.root.findByProps({
      accessibilityLabel: 'New Dentra appointment update. View update',
    }),
  ).toBeDefined();
  await act(async () =>
    tree.root
      .findByProps({ accessibilityLabel: 'Dismiss update' })
      .props.onPress(),
  );
  expect(
    tree.root.findAllByProps({
      accessibilityLabel: 'New Dentra appointment update. View update',
    }),
  ).toHaveLength(0);
});
