import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { BookingScreen } from '../src/screens/BookingScreen';
import { Button, Card, Checkbox, Choice } from '../src/components/ui';
import type { PatientScreenProps } from '../src/navigation/types';
import { launchImageLibrary } from 'react-native-image-picker';

const mockBook = jest.fn();
const mockUploadFile = jest.fn();
jest.mock('../src/api/generated/patient-api', () => {
  const dentist = {
    id: 'dentist-1',
    fullName: 'Dr. Test',
    specialization: 'General Dentist',
    clinics: [{ id: 'clinic-1', name: 'Test Clinic' }],
    feeClinicPaise: 50000,
    offersVideo: true,
  };
  return {
    useGetDentistsByDentistIdQuery: (
      _arg: unknown,
      options: { skip: boolean },
    ) => ({ data: options.skip ? undefined : dentist }),
    useGetDentistsQuery: () => ({ currentData: { items: [dentist] } }),
    useGetPatientsMeQuery: () => ({
      data: { id: 'patient-1', fullName: 'Test Patient' },
    }),
    useGetDentistsByDentistIdSlotsQuery: () => ({
      currentData: { slots: ['10:00'] },
    }),
    usePostAppointmentsMutation: () => [mockBook],
  };
});
jest.mock('../src/lib/checkout', () => ({
  openCheckout: jest.fn(async () => undefined),
}));

let tree: Renderer.ReactTestRenderer;
const navigation = {
  goBack: jest.fn(),
  replace: jest.fn(),
  addListener: jest.fn(() => () => undefined),
};
async function press(title: string) {
  const button = tree.root
    .findAllByType(Button)
    .find(b => b.props.title === title)!;
  expect(button.props.disabled).not.toBe(true);
  await act(async () => {
    await button.props.onPress();
  });
}
async function choose(title: string) {
  const choice = tree.root
    .findAllByType(Choice)
    .find(c => c.props.title === title)!;
  await act(async () => choice.props.onPress());
}
async function fillBooking(withPhoto = false) {
  await act(async () => {
    tree = Renderer.create(
      <BookingScreen
        route={{ params: undefined } as PatientScreenProps<'Booking'>['route']}
        navigation={
          navigation as unknown as PatientScreenProps<'Booking'>['navigation']
        }
      />,
    );
  });
  expect(
    tree.root.findAllByType(Button).find(b => b.props.title === 'Continue')
      ?.props.disabled,
  ).toBe(true);
  await choose('Toothache');
  await press('Continue');
  expect(
    tree.root.findAllByType(Button).find(b => b.props.title === 'Continue')
      ?.props.disabled,
  ).toBe(true);
  await choose('Upper left');
  await choose('2–3 days');
  if (withPhoto) await press('Choose photos');
  await press('Continue');
  await choose('In-clinic visit');
  await press('Continue');
  await act(async () =>
    tree.root
      .findAllByType(Card)
      .find(c => c.props.onPress)!
      .props.onPress(),
  );
  await press('Continue');
  await choose('10:00 AM');
  expect(
    tree.root
      .findAllByType(Button)
      .find(b => b.props.title === 'Confirm booking')?.props.disabled,
  ).toBe(true);
  await act(async () => tree.root.findByType(Checkbox).props.onChange(true));
}

afterEach(async () => {
  await act(async () => tree?.unmount());
  jest.clearAllMocks();
});

test('booking requires concerns, details, a slot and consent, then submits the selected clinic', async () => {
  mockBook.mockReturnValue({
    unwrap: async () => ({
      id: 'appointment-1',
      payment: { status: 'due_at_clinic' },
    }),
  });
  await fillBooking();
  await press('Confirm booking');
  expect(mockBook).toHaveBeenCalledTimes(1);
  expect(mockBook.mock.calls[0][0].bookAppointment).toEqual(
    expect.objectContaining({
      dentistId: 'dentist-1',
      clinicId: 'clinic-1',
      type: 'clinic',
      time: '10:00',
      concerns: ['Toothache'],
      symptomArea: 'Upper left',
      symptomSince: '2–3 days',
      paymentMethod: 'pay_at_clinic',
      idempotencyKey: expect.any(String),
    }),
  );
  expect(navigation.replace).toHaveBeenCalledWith('Appointment', {
    appointmentId: 'appointment-1',
    justBooked: true,
  });
});

test('retrying after a timeout reuses the booking idempotency key', async () => {
  mockBook
    .mockReturnValueOnce({
      unwrap: async () => {
        throw { status: 'TIMEOUT_ERROR' };
      },
    })
    .mockReturnValueOnce({
      unwrap: async () => ({
        id: 'appointment-1',
        payment: { status: 'due_at_clinic' },
      }),
    });
  await fillBooking();
  await press('Confirm booking');
  expect(navigation.replace).not.toHaveBeenCalled();
  await press('Confirm booking');
  expect(mockBook.mock.calls[0][0].bookAppointment.idempotencyKey).toBe(
    mockBook.mock.calls[1][0].bookAppointment.idempotencyKey,
  );
});

test('booking sends uploaded attachment IDs with the consented appointment', async () => {
  (launchImageLibrary as jest.Mock).mockResolvedValueOnce({
    assets: [
      {
        uri: 'file:///tooth.png',
        fileName: 'Tooth.png',
        type: 'image/png',
        fileSize: 100,
      },
    ],
  });
  mockUploadFile.mockResolvedValue({ id: 'uploaded-photo' });
  mockBook.mockReturnValue({
    unwrap: async () => ({
      id: 'appointment-with-photo',
      payment: { status: 'due_at_clinic' },
    }),
  });
  await fillBooking(true);
  await press('Confirm booking');
  expect(mockUploadFile).toHaveBeenCalledTimes(1);
  expect(mockBook.mock.calls[0][0].bookAppointment.attachmentIds).toEqual([
    'uploaded-photo',
  ]);
  expect(mockBook.mock.calls[0][0].bookAppointment.photoUrls).toBeUndefined();
});

jest.mock('../src/api/files', () => ({
  useAppointmentFilesQuery: () => ({ data: [], refetch: jest.fn() }),
  usePatientFilesQuery: () => ({
    currentData: { items: [], nextPage: null },
    refetch: jest.fn(),
  }),
  useUploadPatientFile: () => mockUploadFile,
  useDownloadPatientFile: () => jest.fn(),
  useRemovePatientFile: () => jest.fn(),
}));
