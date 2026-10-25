import React from 'react';
import { Alert, Text, TextInput } from 'react-native';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { createStoreHarness } from '../test-utils/store';
import { api } from '../src/api/client';
import { session } from '../src/features/auth/session';
import { dentraApi } from '../src/store/dentraApi';
import type { Appointment, Dentist } from '../src/common/types/api';
import type { Consultation } from '../src/common/types/consultation';
import type {
  MedicineForm,
  PrescriptionSignature,
} from '../src/common/types/prescription';
import { dateKey } from '../src/common/utils/date';
import { ConsultationScreen } from '../src/features/consultation/ConsultationScreen';
import { PrescriptionPreviewScreen } from '../src/features/consultation/prescription/PrescriptionPreviewScreen';
import { prescriptionFingerprint } from '../src/features/consultation/prescription/prescription-form';
import { Button } from '../src/components/ui/Button';
import { Checkbox } from '../src/components/forms/Checkbox';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockDispatch = jest.fn();
let mockDentist: Dentist;
let mockGuard: {
  prevent: boolean;
  callback: (event: { data: { action: { type: string } } }) => void;
};
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useNavigation: () => ({ navigate: mockNavigate, dispatch: mockDispatch }),
  usePreventRemove: (prevent: boolean, callback: typeof mockGuard.callback) => {
    mockGuard = { prevent, callback };
  },
}));
jest.mock('../src/features/auth/DentistGate', () => ({
  useDentist: () => mockDentist,
}));
jest.mock('../src/features/video/VideoCallProvider', () => ({
  useVideoCall: () => ({ appointmentId: null, open: jest.fn() }),
}));

type DraftBody = { prescriptionItems?: MedicineForm[]; diagnosis?: string };
let state: ReturnType<typeof createStoreHarness>;
let tree: ReactTestRenderer | undefined;
let appointment: Appointment;
let consultation: Consultation;
let allergies: string | null;
let writes: DraftBody[];
let signatures: PrescriptionSignature[];
let codeRequests: number;
let issuedFor: string;
let failSave: boolean;
let failAllergies: boolean;
let loseSignResponse: boolean;
let changeAfterCode: boolean;
let signingHold: Promise<void> | undefined;
const codeId = '00000000-0000-4000-8000-000000000111';
const item: MedicineForm = {
  medicineName: 'Test medicine',
  strength: 'Test strength',
  dose: 'Test dose',
  frequency: 'Test frequency',
  duration: 'Test duration',
  instructions: 'Test instructions',
};

function reply(config: InternalAxiosRequestConfig, data: unknown) {
  return { config, data, status: 200, statusText: 'OK', headers: {} };
}
function reject(
  config: InternalAxiosRequestConfig,
  status: number,
  message: string,
): never {
  throw new AxiosError(message, 'ERR_BAD_REQUEST', config, undefined, {
    ...reply(config, { message }),
    status,
  });
}
async function flush() {
  for (let n = 0; n < 8; n++)
    await new Promise<void>(resolve => setImmediate(resolve));
}
async function mount(preview = false) {
  await act(async () => {
    tree = Renderer.create(
      state.wrap(
        preview ? (
          <PrescriptionPreviewScreen
            navigation={{ goBack: mockGoBack } as never}
            route={{
              key: 'preview',
              name: 'PrescriptionPreview',
              params: { appointmentId: appointment.id },
            }}
          />
        ) : (
          <ConsultationScreen
            navigation={{} as never}
            route={{
              key: 'consultation',
              name: 'Consultation',
              params: { appointmentId: appointment.id },
            }}
          />
        ),
      ),
    );
    await flush();
  });
}
function button(title: string) {
  return tree!.root
    .findAllByType(Button)
    .find(node => node.props.title === title)!;
}
async function press(title: string) {
  await act(async () => {
    await button(title).props.onPress();
    await flush();
  });
}
function field(label: string) {
  return tree!.root
    .findAllByType(TextInput)
    .find(node => node.props.accessibilityLabel === label)!;
}
async function type(label: string, value: string) {
  await act(async () => field(label).props.onChangeText(value));
}
async function tab(label: string) {
  await act(async () => {
    tree!.root
      .findAll(
        node =>
          node.props.accessibilityRole === 'tab' &&
          node.props.accessibilityLabel === label &&
          typeof node.props.onPress === 'function',
      )[0]
      .props.onPress();
    await flush();
  });
}
function text() {
  return tree!.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .flat()
    .filter(value => typeof value === 'string')
    .join(' ');
}
async function fillMedicine(name = item.medicineName) {
  await type('Medicine (generic name)', name);
  await type('Dose', item.dose);
  await type('How often', item.frequency);
  await type('For how long', item.duration);
}
async function prepareCode(value = '5127') {
  await press('Request signing code');
  await type('Type your full name', mockDentist.fullName);
  await type('4-digit signing code', value);
}

beforeEach(async () => {
  jest.clearAllMocks();
  state = createStoreHarness();
  tree = undefined;
  writes = [];
  signatures = [];
  codeRequests = 0;
  issuedFor = '';
  allergies = null;
  failSave = false;
  failAllergies = false;
  loseSignResponse = false;
  changeAfterCode = false;
  signingHold = undefined;
  await session.signIn({
    accessToken: 'synthetic-access',
    refreshToken: 'synthetic-refresh',
    expiresInSeconds: 900,
  });
  mockDentist = {
    id: 'dentist-test',
    fullName: 'Test Dentist',
    mobile: '+919999999999',
    status: 'verified',
    qualification: 'BDS',
    specialization: 'General dentistry',
    councilRegNo: 'TEST-REG',
    yearsExperience: 5,
    languages: ['English'],
    offersVideo: true,
    feeVideoPaise: 1000,
    feeClinicPaise: 2000,
    clinics: [],
    documents: [],
  };
  appointment = {
    id: 'rx-visit',
    patientId: 'rx-patient',
    patientName: 'Test Patient',
    patientAge: 30,
    patientGender: 'female',
    type: 'clinic',
    date: dateKey(),
    time: '10:00',
    status: 'in_consult',
    concern: 'Test concern',
    painScore: 0,
    swelling: false,
  };
  consultation = {
    appointmentId: appointment.id,
    chiefComplaint: 'Keep complaint',
    findings: 'Keep findings',
    diagnosis: 'Keep diagnosis',
    treatmentDone: 'Keep treatment',
    plan: 'Keep plan',
    followUpDate: null,
    isEdited: false,
    editedAt: null,
    prescription: {
      id: 'rx-one',
      signedAt: null,
      signedByDentistId: null,
      items: [{ ...item }],
    },
  };
  api.defaults.adapter = async config => {
    if (config.method === 'get') {
      if (config.url === `/appointments/${appointment.id}`)
        return reply(config, { ...appointment });
      if (config.url === `/appointments/${appointment.id}/consultation`)
        return reply(config, {
          ...consultation,
          prescription: consultation.prescription
            ? {
                ...consultation.prescription,
                items: consultation.prescription.items.map(value => ({
                  ...value,
                })),
              }
            : null,
        });
      if (config.url === `/dentists/me/patients/${appointment.patientId}`) {
        if (failAllergies)
          throw new AxiosError('Offline allergies', 'ERR_NETWORK', config);
        return reply(config, {
          id: appointment.patientId,
          allergies,
          chart: [],
          conditions: 'private-unneeded-history',
        });
      }
    }
    if (config.method === 'put') {
      const body: DraftBody = JSON.parse(config.data);
      writes.push(body);
      if (failSave) throw new AxiosError('Offline save', 'ERR_NETWORK', config);
      if (appointment.status !== 'in_consult')
        reject(config, 409, 'This appointment is not in consultation.');
      if (body.prescriptionItems && consultation.prescription?.signedAt)
        reject(config, 409, 'Prescription is signed.');
      consultation = {
        ...consultation,
        ...(body.diagnosis !== undefined ? { diagnosis: body.diagnosis } : {}),
      };
      if (body.prescriptionItems)
        consultation.prescription = {
          id: 'rx-one',
          signedAt: null,
          signedByDentistId: null,
          items: body.prescriptionItems,
        };
      return reply(config, { ...consultation });
    }
    if (config.method === 'post' && config.url?.endsWith('/prescription/otp')) {
      codeRequests++;
      if (appointment.status !== 'in_consult')
        reject(config, 409, 'This appointment is not in consultation.');
      if (changeAfterCode)
        consultation.prescription = {
          ...consultation.prescription!,
          items: [{ ...item, medicineName: 'Changed medicine' }],
        };
      issuedFor = prescriptionFingerprint(consultation.prescription);
      return reply(config, {
        otpId: codeId,
        expiresInSeconds: 300,
        resendAfterSeconds: 30,
      });
    }
    if (
      config.method === 'post' &&
      config.url?.endsWith('/prescription/sign')
    ) {
      const signature: PrescriptionSignature = JSON.parse(config.data);
      signatures.push(signature);
      if (signingHold) await signingHold;
      if (appointment.status !== 'in_consult')
        reject(config, 409, 'This appointment is not in consultation.');
      if (signature.otpId !== codeId || signature.confirmationCode !== '5127')
        reject(config, 422, 'Incorrect signing code.');
      if (issuedFor !== prescriptionFingerprint(consultation.prescription))
        reject(config, 422, 'Signing code does not match this prescription.');
      if (
        allergies === 'Penicillin' &&
        consultation.prescription!.items[0].medicineName === 'Amoxicillin' &&
        !signature.allergyOverrideAck
      )
        reject(config, 422, 'Allergy conflict: confirm allergyOverrideAck.');
      consultation.prescription = {
        ...consultation.prescription!,
        signedAt: '2026-10-24T00:00:00Z',
        signedByDentistId: mockDentist.id,
      };
      if (loseSignResponse)
        throw new AxiosError('Response lost', 'ERR_NETWORK', config);
      return reply(config, { ...consultation });
    }
    throw new Error(`Unexpected ${config.method} ${config.url}`);
  };
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  state.cleanup();
  await session.clear();
  jest.restoreAllMocks();
});

test('validates, adds, edits, removes and saves medicines without overwriting notes, chart or plan', async () => {
  consultation.prescription = null;
  await mount();
  await tab('Rx');
  await press('Add medicine');
  await press('Add to prescription');
  expect(text()).toContain(
    'Add the medicine name, dose, how often and for how long.',
  );
  expect(writes).toHaveLength(0);
  await fillMedicine();
  await press('Add to prescription');
  await press('Edit medicine 1');
  await type('Medicine (generic name)', 'Edited medicine');
  await press('Update medicine');
  await press('Save prescription');
  expect(writes[0]).toEqual({
    prescriptionItems: [
      {
        ...item,
        medicineName: 'Edited medicine',
        strength: '',
        instructions: '',
      },
    ],
  });
  expect(consultation.diagnosis).toBe('Keep diagnosis');
  expect(consultation.plan).toBe('Keep plan');
  await press('Remove medicine 1');
  await press('Save prescription');
  expect(writes[1]).toEqual({ prescriptionItems: [] });
  expect(button('Preview and sign')).toBeUndefined();
});

test('keeps a partially filled medicine across tabs and includes it in the Back warning', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  await mount();
  await tab('Rx');
  await press('Add medicine');
  await type('Medicine (generic name)', 'Unfinished medicine');
  expect(button('Save prescription').props.disabled).toBe(true);
  await tab('Note');
  expect(mockGuard.prevent).toBe(true);
  await act(async () =>
    mockGuard.callback({ data: { action: { type: 'GO_BACK' } } }),
  );
  expect(alert).toHaveBeenCalledTimes(1);
  await tab('Rx');
  expect(field('Medicine (generic name)').props.value).toBe(
    'Unfinished medicine',
  );
  expect(writes).toHaveLength(0);
});

test('preview saves unsaved notes before medicines and navigates with only the appointment ID', async () => {
  await mount();
  await type('Diagnosis', 'Updated diagnosis');
  await tab('Rx');
  await press('Edit medicine 1');
  await type('Medicine (generic name)', 'Edited medicine');
  await press('Update medicine');
  await press('Preview and sign');
  expect(writes).toEqual([
    { diagnosis: 'Updated diagnosis' },
    { prescriptionItems: [{ ...item, medicineName: 'Edited medicine' }] },
  ]);
  expect(mockNavigate).toHaveBeenCalledWith('PrescriptionPreview', {
    appointmentId: appointment.id,
  });
});

test('failed note saving keeps the doctor on the note error and does not open signing', async () => {
  await mount();
  await type('Diagnosis', 'Unsaved diagnosis');
  await tab('Rx');
  failSave = true;
  await press('Preview and sign');
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(field('Diagnosis').props.value).toBe('Unsaved diagnosis');
  expect(text()).toContain('Cannot reach Dentra.');
  expect(writes).toEqual([{ diagnosis: 'Unsaved diagnosis' }]);
});

test('a failed medicine save retains edits for retry', async () => {
  await mount();
  await tab('Rx');
  await press('Edit medicine 1');
  await type('Medicine (generic name)', 'Retry medicine');
  await press('Update medicine');
  failSave = true;
  await press('Save prescription');
  expect(text()).toContain('Retry medicine');
  expect(mockGuard.prevent).toBe(true);
  failSave = false;
  await press('Save prescription');
  expect(text()).toContain('Prescription saved');
  expect(mockGuard.prevent).toBe(false);
});

test('signing requires the full name and a four-digit backend code, then becomes read-only', async () => {
  await mount(true);
  await prepareCode('51x27');
  expect(field('4-digit signing code').props.value).toBe('5127');
  await type('Type your full name', 'Wrong name');
  await press('Sign prescription');
  expect(signatures).toHaveLength(0);
  await type('Type your full name', mockDentist.fullName);
  await press('Sign prescription');
  expect(signatures).toEqual([{ otpId: codeId, confirmationCode: '5127' }]);
  expect(text()).toContain('Signed prescription');
  expect(button('Sign prescription')).toBeUndefined();
  expect(
    dentraApi.endpoints.getConsultation.select(appointment.id)(
      state.store.getState(),
    ).data?.prescription?.signedAt,
  ).toBeTruthy();
  expect(JSON.stringify(state.store.getState())).not.toContain(
    'confirmationCode',
  );
});

test('flags allergies and requires an explicit acknowledgement before signing', async () => {
  allergies = 'Penicillin';
  consultation.prescription!.items[0].medicineName = 'Amoxicillin';
  await mount(true);
  expect(text()).toContain('allergy conflict (Penicillin)');
  await prepareCode();
  await press('Sign prescription');
  expect(signatures).toHaveLength(0);
  await act(async () => tree!.root.findByType(Checkbox).props.onChange(true));
  await press('Sign prescription');
  expect(signatures[0].allergyOverrideAck).toBe(true);
  expect(text()).toContain('Signed prescription');
});

test('allergy lookup failure blocks code requests until the data can be verified', async () => {
  failAllergies = true;
  await mount(true);
  expect(button('Request signing code').props.disabled).toBe(true);
  expect(text()).not.toContain('No allergies recorded.');
  expect(codeRequests).toBe(0);
  failAllergies = false;
  await press('Reload prescription');
  await prepareCode();
  await press('Sign prescription');
  expect(signatures).toHaveLength(1);
});

test('allergies changed after OTP request must be reviewed before the signing request is sent', async () => {
  consultation.prescription!.items[0].medicineName = 'Amoxicillin';
  await mount(true);
  await prepareCode();
  allergies = 'Penicillin';
  await press('Sign prescription');
  expect(signatures).toHaveLength(0);
  expect(text()).toContain('The recorded allergies changed.');
  await act(async () => tree!.root.findByType(Checkbox).props.onChange(true));
  await press('Sign prescription');
  expect(signatures[0].allergyOverrideAck).toBe(true);
});

test('changes during code issuance invalidate the preview challenge instead of signing another list', async () => {
  await mount(true);
  changeAfterCode = true;
  await press('Request signing code');
  expect(text()).toContain('Changed medicine');
  expect(text()).toContain('The prescription changed.');
  expect(field('4-digit signing code')).toBeUndefined();
  expect(signatures).toHaveLength(0);
});

test('changes after code issuance require a fresh review and code', async () => {
  await mount(true);
  await prepareCode();
  consultation.prescription = {
    ...consultation.prescription!,
    items: [{ ...item, medicineName: 'New server medicine' }],
  };
  await press('Sign prescription');
  expect(signatures).toHaveLength(0);
  expect(text()).toContain('New server medicine');
  expect(text()).toContain('The prescription changed.');
});

test('wrong codes remain unsigned and an expired challenge cannot send a signature', async () => {
  const clock = jest.spyOn(Date, 'now');
  const start = Date.now();
  clock.mockReturnValue(start);
  await mount(true);
  await prepareCode('0000');
  await press('Sign prescription');
  expect(text()).toContain('Incorrect signing code.');
  expect(consultation.prescription?.signedAt).toBeNull();
  await type('4-digit signing code', '5127');
  clock.mockReturnValue(start + 301000);
  await press('Sign prescription');
  expect(signatures).toHaveLength(1);
  expect(text()).toContain('before it expires.');
});

test('duplicate signing taps send one request and Back waits for its result', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  await mount(true);
  await prepareCode();
  let release!: () => void;
  signingHold = new Promise<void>(resolve => {
    release = resolve;
  });
  const sign = button('Sign prescription').props.onPress;
  let pending!: Promise<void>;
  await act(async () => {
    pending = sign();
    await flush();
  });
  await act(async () => {
    await sign();
    mockGuard.callback({ data: { action: { type: 'GO_BACK' } } });
  });
  expect(signatures).toHaveLength(1);
  expect(alert).toHaveBeenLastCalledWith(
    'Prescription request in progress',
    expect.any(String),
  );
  await act(async () => {
    release();
    await pending;
    await flush();
  });
  expect(text()).toContain('Signed prescription');
});

test('recovers a committed signature after its response is lost', async () => {
  await mount(true);
  await prepareCode();
  loseSignResponse = true;
  await press('Sign prescription');
  expect(signatures).toHaveLength(1);
  expect(text()).toContain('Signed prescription');
  expect(text()).not.toContain('Cannot reach Dentra.');
  expect(button('Sign prescription')).toBeUndefined();
});

test('signed medicines stay immutable and patient availability is shown only after completion', async () => {
  consultation.prescription!.signedAt = '2026-10-24T00:00:00Z';
  consultation.prescription!.signedByDentistId = mockDentist.id;
  await mount();
  await tab('Rx');
  expect(button('Edit medicine 1')).toBeUndefined();
  expect(button('Add medicine')).toBeUndefined();
  expect(button('Save prescription')).toBeUndefined();
  await act(async () => tree!.unmount());
  tree = undefined;
  appointment.status = 'completed';
  await mount(true);
  expect(text()).toContain(
    'This signed prescription is available in the patient app.',
  );
  expect(button('Request signing code')).toBeUndefined();
  expect(writes).toHaveLength(0);
});

test('resending honours the server cooldown and clears the previously entered code', async () => {
  const start = Date.now();
  const clock = jest.spyOn(Date, 'now').mockReturnValue(start);
  await mount(true);
  await prepareCode();
  const resend = tree!.root
    .findAllByType(Button)
    .find(node => String(node.props.title).startsWith('Resend code in'))!;
  expect(resend.props.disabled).toBe(true);
  await act(async () => {
    await resend.props.onPress();
    await flush();
  });
  expect(codeRequests).toBe(1);
  clock.mockReturnValue(start + 31000);
  await act(async () => {
    await resend.props.onPress();
    await flush();
  });
  expect(codeRequests).toBe(2);
  expect(field('4-digit signing code').props.value).toBe('');
});

test('a visit closed on another device rejects signing and switches the preview to read-only', async () => {
  await mount(true);
  await prepareCode();
  appointment.status = 'completed';
  await press('Sign prescription');
  expect(consultation.prescription?.signedAt).toBeNull();
  expect(text()).toContain('This appointment is not in consultation.');
  expect(button('Sign prescription')).toBeUndefined();
  expect(field('4-digit signing code')).toBeUndefined();
});

test('incomplete legacy medicine rows cannot request a signing code', async () => {
  consultation.prescription!.items[0].duration = '';
  await mount(true);
  await press('Request signing code');
  expect(codeRequests).toBe(0);
  expect(text()).toContain(
    'Add the medicine name, dose, how often and for how long.',
  );
});
