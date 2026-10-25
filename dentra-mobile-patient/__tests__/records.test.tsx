import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Share, Text } from 'react-native';
import { RecordsScreen, VisitScreen } from '../src/screens/RecordsScreen';
import { AppointmentCard } from '../src/components/appointment-card';
import { Button } from '../src/components/ui';
import type { PatientScreenProps } from '../src/navigation/types';

const mockNavigate = jest.fn();
const mockDownloadDocument = jest.fn();
jest.mock('../src/api/care-documents', () => ({ useDownloadCareDocument: () => mockDownloadDocument }));
const mockAppointment = {
  id: 'visit-1',
  dentistId: 'dentist-1',
  dentistName: 'Dr. Test',
  status: 'completed',
  date: '2026-10-17',
  concern: 'Test concern',
  type: 'clinic',
};
const mockSummary = {
  diagnosis: 'Test diagnosis',
  treatmentDone: 'Test treatment',
  plan: 'Test follow-up plan',
  planItems: [
    { procedure: 'Test planned procedure', teeth: ['36', '37'], estimatedCostPaise: 12345 },
    { procedure: 'Test general procedure', teeth: [], estimatedCostPaise: null },
  ],
  followUpDate: '2026-10-30',
  prescription: {
    signedAt: '2026-10-17T06:00:00Z',
    items: [
      {
        medicineName: 'Test medicine',
        strength: 'Test strength',
        dose: 'Test dose',
        frequency: 'Test frequency',
        duration: 'Test duration',
        instructions: 'Test instructions',
      },
    ],
  },
};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('../src/hooks/use-appointments', () => ({
  useAppointments: () => ({
    items: [
      mockAppointment,
      { ...mockAppointment, id: 'booked', status: 'booked' },
      { ...mockAppointment, id: 'cancelled', status: 'cancelled' },
    ],
    isLoading: false,
    isFetching: false,
    refetch: jest.fn(),
  }),
}));
jest.mock('../src/hooks/use-visit-summaries', () => ({
  useVisitSummaries: () => ({
    summaries: { 'visit-1': mockSummary },
    loading: false,
    error: false,
  }),
}));
jest.mock('../src/api/generated/patient-api', () => ({
  useGetAppointmentsByAppointmentIdQuery: () => ({ data: mockAppointment }),
  useGetAppointmentsByAppointmentIdConsultationQuery: (
    _arg: unknown,
    options: { skip: boolean },
  ) => ({ data: options.skip ? undefined : mockSummary }),
  useGetPatientsMeChartQuery: () => ({ data: [], refetch: jest.fn() }),
}));

let tree: Renderer.ReactTestRenderer;
const navigation = { goBack: jest.fn(), navigate: mockNavigate };
const props = {
  route: { params: { appointmentId: 'visit-1' } },
  navigation,
} as unknown as PatientScreenProps<'Visit'>;
function screenText() {
  return tree.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .flat(Infinity)
    .join(' ');
}
afterEach(async () => {
  await act(async () => tree?.unmount());
  mockAppointment.status = 'completed';
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

test('records lists completed visits and opens the matching visit summary', async () => {
  await act(async () => {
    tree = Renderer.create(<RecordsScreen />);
  });
  const visits = tree.root.findAllByType(AppointmentCard);
  expect(visits).toHaveLength(1);
  await act(async () => visits[0].props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith('Visit', {
    appointmentId: 'visit-1',
  });
});

test('a completed visit shows the saved plan and signed prescription, and shares the same details', async () => {
  const share = jest
    .spyOn(Share, 'share')
    .mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
  await act(async () => {
    tree = Renderer.create(<VisitScreen {...props} />);
  });
  expect(screenText()).toContain('Test diagnosis');
  expect(screenText()).toContain('Test follow-up plan');
  expect(screenText()).toContain('Test planned procedure');
  expect(screenText()).toContain('Teeth: 36, 37');
  expect(screenText()).toContain('Estimated cost: ₹123.45');
  expect(screenText()).toContain('Cost not estimated');
  expect(screenText()).toContain('Test medicine');
  expect(screenText()).toContain('Test instructions');
  await act(async () => {
    await tree.root
      .findAllByType(Button)
      .find(button => button.props.title === 'Share visit summary')!
      .props.onPress();
  });
  expect(share).toHaveBeenCalledWith(
    expect.objectContaining({
      message: expect.stringContaining('Test medicine Test strength'),
    }),
  );
  expect(share).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Test planned procedure\nTeeth: 36, 37\nEstimated cost: ₹123.45') }));
  await act(async () =>
    tree.root
      .findAllByType(Button)
      .find(button => button.props.title === 'Book a follow-up')!
      .props.onPress(),
  );
  expect(mockNavigate).toHaveBeenCalledWith('Booking', {
    dentistId: 'dentist-1',
  });
});

test('an unfinished appointment never displays or shares a draft consultation', async () => {
  mockAppointment.status = 'in_consult';
  await act(async () => {
    tree = Renderer.create(<VisitScreen {...props} />);
  });
  expect(screenText()).toContain('This visit is not completed yet');
  expect(screenText()).not.toContain('Test diagnosis');
  expect(screenText()).not.toContain('Test medicine');
  expect(
    tree.root
      .findAllByType(Button)
      .some(button => button.props.title === 'Share visit summary'),
  ).toBe(false);
});


jest.mock('../src/api/files', () => ({
  useAppointmentFilesQuery: () => ({ data: [], refetch: jest.fn() }),
  usePatientFilesQuery: () => ({ currentData: { items: [], nextPage: null }, refetch: jest.fn() }),
  useUploadPatientFile: () => jest.fn(),
  useDownloadPatientFile: () => jest.fn(),
  useRemovePatientFile: () => jest.fn(),
}));
