import React from 'react';
import { Alert, Text } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import RazorpayCheckout from 'react-native-razorpay';
import { AppointmentScreen } from '../src/screens/AppointmentScreen';
import { Button, ErrorState } from '../src/components/ui';
import type { Appointment } from '../src/api/types';
import type { PatientScreenProps } from '../src/navigation/types';

jest.mock('react-native-razorpay', () => ({ open: jest.fn() }));
const mockLoad = jest.fn();
const mockRefetch = jest.fn();
let mockAppointment: Appointment;
jest.mock('../src/api/appointments', () => ({
  useAppointmentQuery: () => ({ data: mockAppointment, refetch: mockRefetch }),
  useLoadAppointment: () => mockLoad,
  useCancelAppointmentMutation: () => [jest.fn(), {}],
  useRescheduleAppointmentMutation: () => [jest.fn(), {}],
}));
jest.mock('../src/api/dentists', () => ({
  useDentistQuery: () => ({ data: {} }),
}));
jest.mock('../src/api/patients', () => ({
  usePatientQuery: () => ({ data: { fullName: 'Test patient' } }),
}));
jest.mock('../src/video/video-call-provider', () => ({
  useVideoCall: () => ({ open: jest.fn() }),
}));

let tree: Renderer.ReactTestRenderer;
const props = {
  route: { params: { appointmentId: 'test-appointment' } },
  navigation: { goBack: jest.fn(), navigate: jest.fn() },
} as unknown as PatientScreenProps<'Appointment'>;
const payButton = () =>
  tree.root
    .findAllByType(Button)
    .find(button => button.props.title === 'Pay ₹10');
async function mount() {
  await act(async () => {
    tree = Renderer.create(<AppointmentScreen {...props} />);
  });
}
async function pay() {
  await act(async () => {
    payButton()!.props.onPress();
  });
}
beforeEach(() => {
  jest.clearAllMocks();
  mockAppointment = {
    id: 'test-appointment',
    status: 'in_consult',
    type: 'video',
    dentistName: 'Test dentist',
    date: '2099-01-01',
    time: '10:00',
    payment: {
      status: 'failed',
      amountPaise: 1000,
      gatewayOrderId: 'order_test',
      gatewayKeyId: 'rzp_test_fixture',
    },
  };
  mockLoad.mockImplementation(async () => mockAppointment);
  (RazorpayCheckout.open as jest.Mock).mockResolvedValue({
    razorpay_payment_id: 'pay_test',
  });
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});

test('an in-consultation appointment with a failed payment can retry checkout after a fresh read', async () => {
  await mount();
  expect(payButton()).toBeDefined();
  expect(
    tree.root
      .findAllByType(Button)
      .find(button => button.props.title === 'Open video consultation')?.props
      .disabled,
  ).toBe(true);
  await pay();
  expect(mockLoad).toHaveBeenCalledWith('test-appointment');
  expect(RazorpayCheckout.open).toHaveBeenCalledWith(
    expect.objectContaining({ order_id: 'order_test', amount: 1000 }),
  );
  expect(mockRefetch).toHaveBeenCalled();
  expect(tree.root.findAllByType(ErrorState)).toHaveLength(0);
});
test('a payment captured since the last poll does not open checkout again', async () => {
  mockLoad.mockImplementation(async () => {
    mockAppointment = {
      ...mockAppointment,
      payment: { ...mockAppointment.payment, status: 'paid' },
    };
    return mockAppointment;
  });
  await mount();
  await pay();
  expect(RazorpayCheckout.open).not.toHaveBeenCalled();
  expect(payButton()).toBeUndefined();
});
test('expired checkout holds show an explanation without an unusable Pay button', async () => {
  mockAppointment.payment!.expiresAt = '2000-01-01T00:00:00Z';
  await mount();
  expect(payButton()).toBeUndefined();
  expect(tree.root.findByType(ErrorState).props.message).toMatch(/expired/);
});
test('a failed status refresh does not charge using cached appointment data', async () => {
  mockLoad.mockRejectedValueOnce({ status: 'FETCH_ERROR' });
  await mount();
  await pay();
  expect(RazorpayCheckout.open).not.toHaveBeenCalled();
  expect(tree.root.findByType(ErrorState).props.message).toMatch(
    /Could not refresh payment status/,
  );
});

jest.mock('../src/api/files', () => ({
  useAppointmentFilesQuery: () => ({ data: [], refetch: jest.fn() }),
  usePatientFilesQuery: () => ({
    currentData: { items: [], nextPage: null },
    refetch: jest.fn(),
  }),
  useUploadPatientFile: () => jest.fn(),
  useDownloadPatientFile: () => jest.fn(),
  useRemovePatientFile: () => jest.fn(),
}));

test('shows a clinic receipt and asks the patient to contact the clinic for a refund', async () => {
  mockAppointment = {
    ...mockAppointment,
    type: 'clinic',
    status: 'booked',
    payment: {
      amountPaise: 50029,
      method: 'pay_at_clinic',
      status: 'paid',
      collection: {
        id: 'synthetic-clinic-receipt',
        amountPaise: 50029,
        method: 'cash',
        collectedAt: '2026-10-24T10:00:00Z',
      },
    },
  };
  const alert = jest.spyOn(Alert, 'alert');
  await mount();
  const content = tree.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .flat(Infinity)
    .filter(value => typeof value === 'string')
    .join(' ');
  expect(content).toContain('Paid at clinic');
  expect(content).toContain('Cash');
  expect(content).toContain('synthetic-clinic-receipt');
  expect(content).toContain('IST');
  expect(payButton()).toBeUndefined();
  await act(async () =>
    tree.root
      .findAllByType(Button)
      .find(button => button.props.title === 'Cancel appointment')!
      .props.onPress(),
  );
  expect(alert.mock.calls.at(-1)![1]).toContain('Contact the clinic directly');
  expect(alert.mock.calls.at(-1)![1]).not.toContain('original payment method');
  alert.mockRestore();
});
