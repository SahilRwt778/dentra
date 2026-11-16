import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { FollowUpScreen } from '../src/screens/FollowUpScreen';
import { SlotPicker } from '../src/components/slot-picker';
import { Button, Choice } from '../src/components/ui';
import type { PatientScreenProps } from '../src/navigation/types';

const mockBook = jest.fn();
const mockReplace = jest.fn();
const mockRefetch = jest.fn();
let mockCanBook = true;
jest.mock('../src/api/generated/patient-api', () => ({
  useGetConsultationCaseQuery: () => ({
    currentData: {
      id: 'case',
      dentistId: 'dentist',
      dentistName: 'Case dentist',
      concern: 'Original concern',
      expiresAt: '2030-06-03T06:00:00Z',
      canBookFollowUp: mockCanBook,
    },
    refetch: mockRefetch,
  }),
  useBookConsultationFollowUpMutation: () => [mockBook, { isLoading: false }],
  useGetDentistsByDentistIdQuery: () => ({
    data: { offersVideo: true, clinics: [{ id: 'clinic', name: 'Clinic' }] },
  }),
  useGetDentistsByDentistIdSlotsQuery: () => ({
    currentData: { slots: ['10:00', '11:20', '11:30', '11:40', '12:00'] },
  }),
}));
let tree: Renderer.ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  mockCanBook = true;
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
async function renderBooking() {
  await act(async () => {
    tree = Renderer.create(
      <FollowUpScreen
        route={
          {
            params: { caseId: 'case' },
          } as PatientScreenProps<'FollowUp'>['route']
        }
        navigation={
          {
            goBack: jest.fn(),
            replace: mockReplace,
          } as unknown as PatientScreenProps<'FollowUp'>['navigation']
        }
      />,
    );
  });
  await act(async () => {
    tree.root.findByType(SlotPicker).props.onDate('2030-06-03');
    tree.root.findByType(SlotPicker).props.onTime('11:20');
  });
}
async function confirm() {
  await act(async () =>
    tree.root
      .findAllByType(Button)
      .find(b => b.props.title === 'Confirm free follow-up')!
      .props.onPress(),
  );
}
test('a free booking keeps its retry key and navigates directly to the appointment', async () => {
  mockBook
    .mockReturnValueOnce({
      unwrap: async () => {
        throw new Error('Connection lost');
      },
    })
    .mockReturnValueOnce({ unwrap: async () => ({ id: 'follow-up' }) });
  await renderBooking();
  await confirm();
  expect(mockReplace).not.toHaveBeenCalled();
  await confirm();
  const first = mockBook.mock.calls[0][0];
  expect(first).toMatchObject({
    caseId: 'case',
    followUpBooking: { type: 'video', date: '2030-06-03', time: '11:20' },
  });
  expect(first.followUpBooking).not.toHaveProperty('paymentMethod');
  expect(mockBook.mock.calls[1][0].followUpBooking.idempotencyKey).toBe(
    first.followUpBooking.idempotencyKey,
  );
  expect(mockReplace).toHaveBeenCalledWith('Appointment', {
    appointmentId: 'follow-up',
    justBooked: true,
  });
});
test('slot choices exclude the exact expiry boundary and all later times', async () => {
  await act(async () => {
    tree = Renderer.create(
      <SlotPicker
        dentistId="dentist"
        type="video"
        date="2030-06-03"
        time=""
        onDate={jest.fn()}
        onTime={jest.fn()}
        expiresAt="2030-06-03T06:00:00Z"
      />,
    );
  });
  // 06:00 UTC = 11:30 IST. Only the starts strictly before the deadline are covered.
  const labels = tree.root.findAllByType(Choice).map(node => node.props.title);
  expect(labels).toContain('11:20 AM');
  expect(labels).not.toContain('11:30 AM');
  expect(labels).not.toContain('11:40 AM');
  expect(labels).not.toContain('12:00 PM');
});
test('an expired pass offers no booking action', async () => {
  mockCanBook = false;
  await act(async () => {
    tree = Renderer.create(
      <FollowUpScreen
        route={
          {
            params: { caseId: 'case' },
          } as PatientScreenProps<'FollowUp'>['route']
        }
        navigation={
          {
            goBack: jest.fn(),
          } as unknown as PatientScreenProps<'FollowUp'>['navigation']
        }
      />,
    );
  });
  expect(tree.root.findAllByType(SlotPicker)).toHaveLength(0);
  expect(
    tree.root
      .findAllByType(Button)
      .find(b => b.props.title === 'Confirm free follow-up'),
  ).toBeUndefined();
});
