import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { NotificationsScreen } from '../src/screens/NotificationsScreen';
import { Button, Card, Empty, ErrorState } from '../src/components/ui';
import type { PatientScreenProps } from '../src/navigation/types';
import type { PatientAppointmentNotification } from '../src/api/generated/patient-api';

const mockNavigate = jest.fn();
const mockRead = jest.fn();
const mockReadAll = jest.fn();
const mockOlder = jest.fn();
const mockRefetch = jest.fn();
let mockData: {
  items: PatientAppointmentNotification[];
  nextCursor: string | null;
  unreadCount: number;
};
let mockError: unknown;
jest.mock('../src/api/generated/patient-api', () => ({
  useGetNotificationsQuery: () => ({
    data: mockData,
    error: mockError,
    refetch: mockRefetch,
    isLoading: false,
    isFetching: false,
  }),
  useLazyGetNotificationsQuery: () => [mockOlder],
  usePatchNotificationsByNotificationIdReadMutation: () => [mockRead],
  usePostNotificationsReadAllMutation: () => [
    mockReadAll,
    { isLoading: false },
  ],
}));

function update(
  type: PatientAppointmentNotification['type'],
  id: string = type,
): PatientAppointmentNotification {
  return {
    id,
    type,
    appointmentId: `appointment-${id}`,
    dentistName: 'Dr Test',
    date: '2027-06-15',
    time: '10:30',
    appointmentType: 'clinic',
    paymentRequired: false,
    createdAt: '2027-06-14T04:30:00Z',
    readAt: null,
  };
}
const props = {
  navigation: { navigate: mockNavigate, goBack: jest.fn() },
} as unknown as PatientScreenProps<'Notifications'>;
let tree: Renderer.ReactTestRenderer;
const render = async () => {
  await act(async () => {
    tree = Renderer.create(<NotificationsScreen {...props} />);
  });
};
const screenText = () =>
  tree.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .flat(Infinity)
    .join(' ');
beforeEach(() => {
  jest.clearAllMocks();
  mockData = { items: [], nextCursor: null, unreadCount: 0 };
  mockError = undefined;
  mockRead.mockImplementation(({ notificationId }) => ({
    unwrap: () =>
      Promise.resolve({
        ...mockData.items.find(item => item.id === notificationId),
        readAt: '2027-06-14T05:00:00Z',
      }),
  }));
  mockReadAll.mockReturnValue({
    unwrap: () => Promise.resolve({ markedRead: 1 }),
  });
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});

test('an empty inbox shows a useful state and disables mark-all', async () => {
  await render();
  expect(tree.root.findByType(Empty).props.message).toContain(
    'appointment reminders',
  );
  expect(
    tree.root.findByProps({
      accessibilityLabel: 'Mark all notifications as read',
    }).props.disabled,
  ).toBe(true);
});

test('renders saved event types, outstanding payment and the previous rescheduled time', async () => {
  mockData = {
    items: [
      update('booking_confirmed'),
      { ...update('booking_confirmed', 'pending'), paymentRequired: true },
      update('appointment_cancelled'),
      {
        ...update('appointment_rescheduled'),
        previousDate: '2027-06-14',
        previousTime: '11:00',
      },
      update('appointment_reminder'),
      update('visit_summary_ready'),
    ],
    nextCursor: null,
    unreadCount: 6,
  };
  await render();
  for (const title of [
    'Appointment confirmed',
    'Booking received',
    'Appointment cancelled',
    'Appointment rescheduled',
    'Appointment reminder',
    'Visit summary ready',
  ])
    expect(screenText()).toContain(title);
  expect(screenText()).toContain('complete payment');
  expect(screenText()).toContain('Previously');
  expect(screenText()).toContain('IST');
  expect(tree.root.findAllByType(Card)).toHaveLength(6);
});

test('opens cancellation details and the completed visit while marking only the chosen notification read', async () => {
  const cancellation = update('appointment_cancelled'),
    visit = update('visit_summary_ready');
  mockData = { items: [cancellation, visit], nextCursor: null, unreadCount: 2 };
  await render();
  for (const item of [cancellation, visit]) {
    const card = tree.root
      .findAllByType(Card)
      .find(node =>
        node.props.label.startsWith(
          item.type === 'visit_summary_ready'
            ? 'Visit summary ready'
            : 'Appointment cancelled',
        ),
      )!;
    await act(async () => card.props.onPress());
    expect(mockRead).toHaveBeenCalledWith({ notificationId: item.id });
    expect(mockNavigate).toHaveBeenCalledWith(
      item.type === 'visit_summary_ready' ? 'Visit' : 'Appointment',
      { appointmentId: item.appointmentId },
    );
  }
});

test('retries older pages without duplicate entries and marks only the displayed snapshot through its newest ID', async () => {
  const newest = {
    ...update('booking_confirmed', 'newest'),
    createdAt: '2027-06-14T05:00:00Z',
  };
  const older = update('appointment_reminder', 'older');
  mockData = { items: [newest], nextCursor: 'cursor-1', unreadCount: 2 };
  mockOlder
    .mockReturnValueOnce({ unwrap: () => Promise.reject(new Error('offline')) })
    .mockReturnValueOnce({
      unwrap: () =>
        Promise.resolve({
          items: [newest, older],
          nextCursor: null,
          unreadCount: 2,
        }),
    });
  await render();
  await act(async () => tree.root.findByType(Button).props.onPress());
  expect(tree.root.findByType(ErrorState).props.message).toContain('older');
  await act(async () => tree.root.findByType(ErrorState).props.retry());
  expect(mockOlder).toHaveBeenLastCalledWith({ cursor: 'cursor-1' }, false);
  expect(tree.root.findAllByType(Card)).toHaveLength(2);
  const markAll = tree.root.findByProps({
    accessibilityLabel: 'Mark all notifications as read',
  });
  await act(async () => markAll.props.onPress());
  expect(mockReadAll).toHaveBeenCalledWith({ body: { through: newest.id } });
});

test('offers retry when loading the inbox fails', async () => {
  mockError = { status: 'FETCH_ERROR' };
  await render();
  await act(async () => tree.root.findByType(ErrorState).props.retry());
  expect(mockRefetch).toHaveBeenCalledTimes(1);
});
