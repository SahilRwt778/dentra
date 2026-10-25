import React from 'react';
import { FlatList, Linking, Text, TextInput } from 'react-native';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { api } from '../src/api/client';
import { session } from '../src/features/auth/session';
import { createStoreHarness } from '../test-utils/store';
import { dentraApi } from '../src/store/dentraApi';
import { PatientsScreen } from '../src/features/patients/PatientsScreen';
import { PatientRecordScreen } from '../src/features/patients/PatientRecordScreen';
import { PatientCard } from '../src/features/patients/PatientCard';
import { PatientVisitCard } from '../src/features/patients/PatientVisitCard';
import { PatientProfileLink } from '../src/features/patients/PatientProfileLink';
import { ConsultationScreen } from '../src/features/consultation/ConsultationScreen';
import { Button } from '../src/components/ui/Button';
import { ToothIcon } from '../src/components/icons/ToothIcon';
import { DentalChart } from '../src/features/consultation/dental-chart/DentalChart';
import type {
  PatientRecord,
  PatientSummary,
} from '../src/common/types/patient';
import type { Appointment } from '../src/common/types/api';
import type { Consultation } from '../src/common/types/consultation';

const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();
let mockFocused = true;
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockFocused,
  useNavigation: () => ({ navigate: mockNavigate, dispatch: jest.fn() }),
  usePreventRemove: jest.fn(),
}));
jest.mock('../src/features/notifications/NotificationBell', () => ({
  NotificationBell: () => null,
}));
jest.mock('../src/features/video/VideoCallProvider', () => ({
  useVideoCall: () => ({ appointmentId: null, open: jest.fn() }),
}));

let tree: ReactTestRenderer;
let state: ReturnType<typeof createStoreHarness>;
let roster: PatientSummary[];
let records: Record<string, PatientRecord>;
let calls: string[];
let fail: string | null;
let pendingPatient: Promise<void> | undefined;
let consultation: Consultation;
const patient: PatientSummary = {
  id: 'patient-one',
  fullName: 'Synthetic Patient',
  age: 32,
  gender: 'female',
  mobile: '+919000001111',
  lastVisitDate: '2026-10-12',
  visitCount: 1,
  hasAllergies: true,
};
const appointment: Appointment = {
  id: 'completed-visit',
  patientId: patient.id,
  patientName: patient.fullName,
  patientAge: 32,
  patientGender: 'female',
  type: 'clinic',
  date: '2026-10-12',
  time: '10:30',
  status: 'completed',
  concern: 'Test completed concern',
  painScore: 3,
  swelling: false,
};
function reply(config: InternalAxiosRequestConfig, data: unknown) {
  return { config, data, status: 200, statusText: 'OK', headers: {} };
}
function failure(config: InternalAxiosRequestConfig, status = 503): never {
  throw new AxiosError(
    'Test request failure',
    'ERR_BAD_RESPONSE',
    config,
    undefined,
    {
      ...reply(config, {
        message:
          status === 404
            ? 'No such patient.'
            : 'Service temporarily unavailable.',
      }),
      status,
    },
  );
}
async function flush() {
  for (let index = 0; index < 8; index++)
    await new Promise<void>(resolve => setImmediate(resolve));
}
async function render(node: React.ReactNode) {
  await act(async () => {
    if (tree) tree.update(state.wrap(node));
    else tree = Renderer.create(state.wrap(node));
    await flush();
  });
}
function recordScreen(id = patient.id) {
  return (
    <PatientRecordScreen
      navigation={
        { navigate: mockNavigate, setOptions: mockSetOptions } as never
      }
      route={{
        key: 'patient-record',
        name: 'PatientRecord',
        params: { patientId: id },
      }}
    />
  );
}
function text() {
  return tree.root
    .findAllByType(Text)
    .flatMap(node => node.props.children)
    .flat()
    .filter(value => typeof value === 'string')
    .join(' ');
}
async function search(value: string) {
  await act(async () =>
    tree.root.findByType(TextInput).props.onChangeText(value),
  );
}
async function press(label: string) {
  await act(async () => {
    const target =
      tree.root
        .findAllByType(Button)
        .find(node => node.props.title === label) ??
      tree.root.findAll(
        node =>
          node.props.accessibilityLabel === label &&
          typeof node.props.onPress === 'function',
      )[0];
    target.props.onPress();
    await flush();
  });
}

beforeEach(async () => {
  tree = undefined as never;
  state = createStoreHarness();
  calls = [];
  fail = null;
  pendingPatient = undefined;
  mockFocused = true;
  mockNavigate.mockClear();
  mockSetOptions.mockClear();
  roster = [
    patient,
    {
      ...patient,
      id: 'patient-two',
      fullName: 'Another Patient',
      mobile: '+919000002222',
      age: null,
      gender: null,
      lastVisitDate: null,
      visitCount: 0,
      hasAllergies: false,
    },
  ];
  records = {
    [patient.id]: {
      ...patient,
      dateOfBirth: '1994-06-15',
      city: 'Test city',
      preferredLanguage: 'English',
      allergies: 'Test allergy',
      conditions: 'Test condition',
      medications: 'Test current medicine',
      emergencyContact: 'Test emergency contact',
      guardian: {
        name: 'Test guardian',
        relationship: 'Parent',
        mobile: '+919000003333',
      },
      chart: [{ toothNumber: '36', status: 'filled' }],
      appointments: [
        {
          id: 'booked-visit',
          date: '2026-10-25',
          time: '11:00',
          type: 'video',
          clinicName: null,
          concern: 'Test upcoming concern',
          diagnosis: null,
          status: 'booked',
        },
        {
          id: appointment.id,
          date: appointment.date,
          time: appointment.time,
          type: 'clinic',
          clinicName: 'Test clinic',
          concern: appointment.concern,
          diagnosis: 'Saved diagnosis',
          status: 'completed',
        },
      ],
    },
    'patient-two': {
      ...roster[1],
      dateOfBirth: '1990-01-01',
      city: null,
      preferredLanguage: 'English',
      allergies: null,
      conditions: null,
      medications: null,
      emergencyContact: null,
      guardian: null,
      chart: [],
      appointments: [],
    },
  };
  consultation = {
    appointmentId: appointment.id,
    chiefComplaint: 'Saved complaint',
    findings: 'Saved findings',
    diagnosis: 'Saved diagnosis',
    treatmentDone: 'Saved treatment',
    plan: 'Saved patient advice',
    planItems: [
      {
        procedure: 'Saved procedure',
        teeth: ['36'],
        estimatedCostPaise: 12345,
      },
    ],
    followUpDate: '2026-12-04',
    isEdited: false,
    editedAt: null,
    prescription: null,
  };
  await session.signIn({
    accessToken: 'synthetic-patients-access',
    refreshToken: 'synthetic-patients-refresh',
    expiresInSeconds: 900,
  });
  api.defaults.adapter = async config => {
    calls.push(`${config.method} ${config.url}`);
    if (config.url === fail)
      failure(config, fail.endsWith(patient.id) ? 404 : 503);
    if (config.url === '/dentists/me/patients') return reply(config, roster);
    if (config.url?.startsWith('/dentists/me/patients/')) {
      const id = config.url.split('/').at(-1)!;
      if (id === patient.id && pendingPatient) await pendingPatient;
      if (!records[id]) failure(config, 404);
      return reply(config, { ...records[id] });
    }
    if (config.method === 'post' && config.url?.endsWith('/complete')) {
      roster = roster.map(item =>
        item.id === patient.id
          ? { ...item, visitCount: 2, lastVisitDate: '2026-10-25' }
          : item,
      );
      records[patient.id] = {
        ...records[patient.id],
        appointments: records[patient.id].appointments.map(visit =>
          visit.id === 'booked-visit'
            ? { ...visit, status: 'completed' }
            : visit,
        ),
      };
      return reply(config, { ...appointment, id: 'booked-visit' });
    }
    if (config.url === `/appointments/${appointment.id}/consultation`)
      return reply(config, consultation);
    if (config.url === `/appointments/${appointment.id}`)
      return reply(config, appointment);
    throw new Error(`Unexpected ${config.method} ${config.url}`);
  };
});
afterEach(async () => {
  await act(async () => {
    tree?.unmount();
    await flush();
  });
  state.cleanup();
  await session.clear();
  jest.restoreAllMocks();
});

test('loads the roster through Axios/Redux and searches names and formatted phone numbers locally', async () => {
  await render(<PatientsScreen />);
  expect(tree.root.findAllByType(PatientCard)).toHaveLength(2);
  expect(text()).toContain('Allergy on file');
  expect(text()).toContain('Last visit 12 Oct 2026');
  expect(text()).toContain('No visits yet');
  await search('  SYNTHETIC   patient  ');
  expect(
    tree.root.findAllByType(PatientCard).map(node => node.props.patient.id),
  ).toEqual([patient.id]);
  await search('+91 (90000) 02222');
  expect(
    tree.root.findAllByType(PatientCard).map(node => node.props.patient.id),
  ).toEqual(['patient-two']);
  await search('not-found');
  expect(text()).toContain('No patients match');
  await press('Clear patient search');
  expect(tree.root.findAllByType(PatientCard)).toHaveLength(2);
  expect(calls).toEqual(['get /dentists/me/patients']);
  await act(async () =>
    tree.root.findAllByType(PatientCard)[0].props.onPress(),
  );
  expect(mockNavigate).toHaveBeenCalledWith('PatientRecord', {
    patientId: patient.id,
  });
});

test('shows request failures, retries, and an honest empty roster', async () => {
  fail = '/dentists/me/patients';
  await render(<PatientsScreen />);
  expect(text()).toContain('Could not load patients');
  expect(text()).not.toContain('No patients yet');
  fail = null;
  roster = [];
  await press('Try again');
  expect(text()).toContain('No patients yet');
  roster = [patient];
  await act(async () => {
    tree.root.findByType(FlatList).props.onRefresh();
    await flush();
  });
  expect(tree.root.findAllByType(PatientCard)).toHaveLength(1);
  fail = '/dentists/me/patients';
  await act(async () => {
    tree.root.findByType(FlatList).props.onRefresh();
    await flush();
  });
  expect(tree.root.findAllByType(PatientCard)).toHaveLength(0);
});

test('shows demographics, guardian, medical history, current chart and opens the appropriate visit screen', async () => {
  await render(recordScreen());
  expect(mockSetOptions).toHaveBeenLastCalledWith({ title: patient.fullName });
  expect(text()).toContain('Test allergy');
  expect(text()).toContain('Test condition');
  expect(text()).toContain('Test current medicine');
  expect(text()).toContain('Test guardian');
  expect(text()).toContain('Test emergency contact');
  expect(text()).toContain('Current patient chart across visits.');
  const tooth = tree.root.findAll(
    node =>
      node.props.accessibilityLabel === 'Tooth 36: Filled' &&
      typeof node.props.onPress === 'function',
  )[0];
  expect(tooth.props.disabled).toBe(true);
  expect(
    tree.root.findByType(DentalChart).findAllByType(ToothIcon),
  ).toHaveLength(32);
  expect(text()).toContain('12 Oct 2026');
  expect(text()).toContain('10:30 AM');
  const visits = tree.root.findAllByType(PatientVisitCard);
  await act(async () => visits[0].props.onPress());
  expect(mockNavigate).toHaveBeenLastCalledWith('Appointment', {
    appointmentId: 'booked-visit',
  });
  await act(async () => visits[1].props.onPress());
  expect(mockNavigate).toHaveBeenLastCalledWith('Consultation', {
    appointmentId: appointment.id,
  });
  expect(calls.every(call => call.startsWith('get '))).toBe(true);
});

test('opens a formatted patient mobile in the phone app and reports an unavailable dialer', async () => {
  records[patient.id].mobile = '+91 (90000) 01111';
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await render(recordScreen());
  await press(`Call ${patient.fullName}`);
  expect(openURL).toHaveBeenCalledWith('tel:+919000001111');
  openURL.mockRejectedValueOnce(new Error('No phone app'));
  await press(`Call ${patient.fullName}`);
  expect(text()).toContain('Your device could not open the phone app.');
});

test('missing medical data is labelled as unrecorded and the guardian card is omitted', async () => {
  await render(recordScreen('patient-two'));
  expect(text()).toContain('Not recorded');
  expect(text()).toContain('No findings recorded.');
  expect(text()).toContain('No appointments yet');
  expect(text()).not.toContain('Guardian');
  expect(text()).not.toContain('Test allergy');
});

test('a late response for the previous patient never displays their data on another patient record', async () => {
  let release!: () => void;
  pendingPatient = new Promise<void>(resolve => {
    release = resolve;
  });
  await render(recordScreen());
  expect(text()).toContain('Loading patient record');
  await render(recordScreen('patient-two'));
  expect(text()).toContain('Another Patient');
  await act(async () => {
    release();
    await flush();
  });
  expect(text()).not.toContain('Synthetic Patient');
  expect(text()).not.toContain('Test allergy');
});

test('a rejected refresh hides the previous record and supports retry', async () => {
  await render(recordScreen());
  expect(text()).toContain('Test allergy');
  fail = `/dentists/me/patients/${patient.id}`;
  await act(async () => {
    tree.root.findByType(FlatList).props.onRefresh();
    await flush();
  });
  expect(text()).toContain('Could not load patient');
  expect(mockSetOptions).toHaveBeenLastCalledWith({ title: 'Patient record' });
  expect(text()).not.toContain('Test allergy');
  expect(tree.root.findAllByType(PatientVisitCard)).toHaveLength(0);
  fail = null;
  await press('Try again');
  expect(text()).toContain('Test allergy');
});

test('completing a consultation refreshes the roster visit counts and patient history', async () => {
  await render(
    <>
      <PatientsScreen />
      {recordScreen()}
    </>,
  );
  await act(async () => {
    await state.store
      .dispatch(
        dentraApi.endpoints.completeConsultation.initiate('booked-visit'),
      )
      .unwrap();
    await flush();
  });
  expect(tree.root.findAllByType(PatientCard)[0].props.patient.visitCount).toBe(
    2,
  );
  expect(tree.root.findAllByType(PatientVisitCard)[0].props.visit.status).toBe(
    'completed',
  );
});

test('patient profile links and completed summary shared-file links navigate using IDs only', async () => {
  await render(<PatientProfileLink patientId={patient.id} />);
  await press('View patient profile');
  expect(mockNavigate).toHaveBeenCalledWith('PatientRecord', {
    patientId: patient.id,
  });
  await render(
    <ConsultationScreen
      navigation={{ navigate: mockNavigate } as never}
      route={{
        key: 'past-visit',
        name: 'Consultation',
        params: { appointmentId: appointment.id },
      }}
    />,
  );
  expect(
    tree.root
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel === 'Diagnosis')!.props.value,
  ).toBe('Saved diagnosis');
  expect(
    tree.root
      .findAllByType(TextInput)
      .every(node => node.props.editable === false),
  ).toBe(true);
  await press('View appointment and shared files');
  expect(mockNavigate).toHaveBeenLastCalledWith('Appointment', {
    appointmentId: appointment.id,
  });
  expect(calls.every(call => call.startsWith('get '))).toBe(true);
});

test('a hidden Patients tab does not start a roster request', async () => {
  mockFocused = false;
  await render(<PatientsScreen />);
  expect(calls).toHaveLength(0);
});
