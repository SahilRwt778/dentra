import React from 'react';
import { Alert, Text, TextInput } from 'react-native';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { api } from '../src/api/client';
import { session } from '../src/features/auth/session';
import { ConsultationScreen } from '../src/features/consultation/ConsultationScreen';
import { Button } from '../src/components/ui/Button';
import { DateField } from '../src/components/forms/DateField';
import { dentraApi } from '../src/store/dentraApi';
import { callOpened } from '../src/store/videoSlice';
import { createStoreHarness } from '../test-utils/store';
import type { Appointment } from '../src/common/types/api';
import type { Consultation } from '../src/common/types/consultation';
import type { ToothFinding } from '../src/common/types/dental-chart';

let mockGuard = false;
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useNavigation: () => ({ navigate: jest.fn(), dispatch: jest.fn() }),
  usePreventRemove: (prevent: boolean) => {
    mockGuard = prevent;
  },
}));
jest.mock('../src/features/video/VideoCallProvider', () => ({
  useVideoCall: () => ({ appointmentId: null, open: jest.fn() }),
}));

let state: ReturnType<typeof createStoreHarness>;
let tree: ReactTestRenderer;
let appointment: Appointment;
let consultation: Consultation;
let teeth: ToothFinding[];
let writes: { method: string; body: Record<string, unknown> }[];
let failSave: boolean;
let completeFailure: 'offline' | 'lost-response' | 'unsigned' | null;
let holdComplete: Promise<void> | undefined;
let alert: jest.SpyInstance;

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
  for (let index = 0; index < 10; index++)
    await new Promise<void>(resolve => setImmediate(resolve));
}
async function mount() {
  await act(async () => {
    tree = Renderer.create(
      state.wrap(
        <ConsultationScreen
          navigation={{} as never}
          route={{
            key: 'completion',
            name: 'Consultation',
            params: { appointmentId: appointment.id },
          }}
        />,
      ),
    );
    await flush();
  });
}
function button(title: string) {
  return tree.root
    .findAllByType(Button)
    .find(node => node.props.title === title);
}
async function press(title: string) {
  await act(async () => {
    await button(title)!.props.onPress();
    await flush();
  });
}
async function tab(label: string) {
  await act(async () => {
    tree.root
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
function field(label: string) {
  return tree.root
    .findAllByType(TextInput)
    .find(node => node.props.accessibilityLabel === label)!;
}
async function type(label: string, value: string) {
  await act(async () => field(label).props.onChangeText(value));
}
function text() {
  return tree.root
    .findAllByType(Text)
    .flatMap(node => node.props.children)
    .flat()
    .filter(value => typeof value === 'string')
    .join(' ');
}
async function confirm() {
  const action = alert.mock.calls
    .at(-1)?.[2]
    ?.find((option: { text: string }) => option.text === 'Save and complete');
  expect(action).toBeTruthy();
  await act(async () => {
    await action.onPress();
    await flush();
  });
}

beforeEach(async () => {
  state = createStoreHarness();
  alert = jest.spyOn(Alert, 'alert');
  writes = [];
  teeth = [];
  failSave = false;
  completeFailure = null;
  holdComplete = undefined;
  await session.signIn({
    accessToken: 'synthetic-complete-access',
    refreshToken: 'synthetic-complete-refresh',
    expiresInSeconds: 900,
  });
  appointment = {
    id: 'completion-visit',
    patientId: 'patient-one',
    patientName: 'Synthetic Patient',
    patientAge: 32,
    patientGender: 'female',
    type: 'clinic',
    date: '2026-10-24',
    time: '10:00',
    status: 'in_consult',
    concern: 'Test concern',
    painScore: 3,
    swelling: false,
  };
  consultation = {
    appointmentId: appointment.id,
    chiefComplaint: 'Keep complaint',
    findings: 'Keep findings',
    diagnosis: 'Test diagnosis',
    treatmentDone: 'Keep treatment',
    plan: 'Keep advice',
    planItems: [],
    followUpDate: '2026-11-01',
    isEdited: false,
    editedAt: null,
    prescription: null,
  };
  api.defaults.adapter = async config => {
    if (config.method === 'get') {
      if (config.url?.endsWith('/consultation'))
        return reply(config, { ...consultation });
      if (config.url === `/dentists/me/patients/${appointment.patientId}`)
        return reply(config, {
          id: appointment.patientId,
          allergies: null,
          chart: teeth,
        });
      return reply(config, { ...appointment });
    }
    const body = JSON.parse(config.data || '{}');
    writes.push({ method: config.method!, body });
    if (config.method === 'post') {
      if (holdComplete) await holdComplete;
      if (completeFailure === 'offline')
        throw new AxiosError('Offline', 'ERR_NETWORK', config);
      if (completeFailure === 'unsigned')
        reject(config, 422, 'Sign the prescription before completing.');
      appointment = { ...appointment, status: 'completed' };
      if (completeFailure === 'lost-response')
        throw new AxiosError('Response lost', 'ERR_NETWORK', config);
      return reply(config, { ...appointment });
    }
    if (failSave) throw new AxiosError('Offline', 'ERR_NETWORK', config);
    if (body.chart) teeth = body.chart;
    if (body.prescriptionItems) consultation.prescription = null;
    consultation = { ...consultation, ...body };
    return reply(config, { ...consultation });
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

test('confirmation can be cancelled without saving or completing', async () => {
  await mount();
  await type('Diagnosis', 'Unsaved diagnosis');
  await press('Complete consultation');
  expect(alert).toHaveBeenLastCalledWith(
    'Complete consultation?',
    expect.any(String),
    expect.any(Array),
    expect.any(Object),
  );
  const cancel = alert.mock.calls
    .at(-1)![2]
    .find((option: { text: string }) => option.text === 'Keep editing');
  await act(async () => cancel.onPress());
  expect(writes).toHaveLength(0);
  expect(mockGuard).toBe(true);
  expect(field('Diagnosis').props.value).toBe('Unsaved diagnosis');
});

test('saves note, chart, plan and follow-up before completing and makes all sections read-only', async () => {
  await mount();
  state.store.dispatch(
    callOpened({
      appointmentId: appointment.id,
      patientName: appointment.patientName,
    }),
  );
  await type('Diagnosis', 'Saved mobile diagnosis');
  await tab('Chart');
  await act(async () => {
    tree.root
      .findAll(
        node =>
          node.props.accessibilityLabel?.startsWith('Tooth 36:') &&
          typeof node.props.onPress === 'function',
      )[0]
      .props.onPress();
  });
  await tab('Plan');
  await type('Plan and advice for the patient', 'Updated advice');
  await act(async () =>
    tree.root.findByType(DateField).props.onChange('2026-12-04'),
  );
  await press('Complete consultation');
  await confirm();
  expect(writes).toEqual([
    { method: 'put', body: { diagnosis: 'Saved mobile diagnosis' } },
    {
      method: 'put',
      body: { chart: [{ toothNumber: '36', status: 'caries' }] },
    },
    {
      method: 'put',
      body: { plan: 'Updated advice', followUpDate: '2026-12-04' },
    },
    { method: 'post', body: {} },
  ]);
  expect(text()).toContain('Consultation completed');
  expect(tree.root.findByType(DateField).props.disabled).toBe(true);
  expect(button('Complete consultation')).toBeUndefined();
  expect(button('Save treatment plan')).toBeUndefined();
  expect(mockGuard).toBe(false);
  expect(state.store.getState().video.call).toBeNull();
  await tab('Note');
  expect(field('Diagnosis').props.value).toBe('Saved mobile diagnosis');
  expect(field('Diagnosis').props.editable).toBe(false);
  await tab('Plan');
  expect(field('Plan and advice for the patient').props.value).toBe(
    'Updated advice',
  );
});

test('blocks missing diagnosis and unfinished procedure or medicine editors without writing', async () => {
  consultation.diagnosis = '';
  await mount();
  await press('Complete consultation');
  expect(text()).toContain('Add a diagnosis');
  await type('Diagnosis', 'Test diagnosis');
  await tab('Plan');
  await press('Add procedure');
  await type('Procedure', 'Unfinished procedure');
  await tab('Note');
  await press('Complete consultation');
  expect(field('Procedure').props.value).toBe('Unfinished procedure');
  expect(text()).toContain('Add or cancel the procedure');
  await press('Cancel procedure edit');
  await tab('Rx');
  await press('Add medicine');
  await tab('Note');
  await press('Complete consultation');
  expect(text()).toContain('Add or cancel the medicine');
  expect(writes).toHaveLength(0);
  expect(alert).not.toHaveBeenCalled();
});

test('an unsigned prescription must be signed and opening Rx loads allergy information', async () => {
  consultation.prescription = {
    id: 'rx',
    signedAt: null,
    signedByDentistId: null,
    items: [
      {
        medicineName: 'Test medicine',
        strength: null,
        dose: 'Test dose',
        frequency: 'Test frequency',
        duration: 'Test duration',
        instructions: null,
      },
    ],
  };
  await mount();
  await press('Complete consultation');
  expect(text()).toContain(
    'Preview and sign the prescription before completing.',
  );
  expect(text()).toContain('No allergies recorded.');
  expect(button('Preview and sign')!.props.disabled).toBe(false);
  expect(writes).toHaveLength(0);
});

test('completes with an existing signed prescription without rewriting its medicines', async () => {
  consultation.prescription = {
    id: 'signed-rx',
    signedAt: '2026-10-24T03:00:00Z',
    signedByDentistId: 'dentist-one',
    items: [
      {
        medicineName: 'Signed medicine',
        strength: null,
        dose: 'Test dose',
        frequency: 'Test frequency',
        duration: 'Test duration',
        instructions: null,
      },
    ],
  };
  await mount();
  await type('Diagnosis', 'Updated diagnosis');
  await press('Complete consultation');
  await confirm();
  expect(writes).toEqual([
    { method: 'put', body: { diagnosis: 'Updated diagnosis' } },
    { method: 'post', body: {} },
  ]);
  expect(consultation.prescription?.signedAt).toBe('2026-10-24T03:00:00Z');
  await tab('Rx');
  expect(text()).toContain('Signed medicine');
  expect(button('Add medicine')).toBeUndefined();
  expect(button('View signed prescription')).toBeTruthy();
});

test('removing the last unsigned medicine saves the empty list before completing without a prescription', async () => {
  consultation.prescription = {
    id: 'unsigned-rx',
    signedAt: null,
    signedByDentistId: null,
    items: [
      {
        medicineName: 'Test medicine',
        strength: null,
        dose: 'Test dose',
        frequency: 'Test frequency',
        duration: 'Test duration',
        instructions: null,
      },
    ],
  };
  await mount();
  await tab('Rx');
  await press('Remove medicine 1');
  await press('Complete consultation');
  await confirm();
  expect(writes).toEqual([
    { method: 'put', body: { prescriptionItems: [] } },
    { method: 'post', body: {} },
  ]);
  expect(text()).toContain('Consultation completed');
  expect(mockGuard).toBe(false);
});

test('a failed draft save stops completion, retains the date and allows retry', async () => {
  await mount();
  await tab('Plan');
  await type('Plan and advice for the patient', 'Advice to retry');
  await press('Clear follow-up date');
  failSave = true;
  await press('Complete consultation');
  await confirm();
  expect(writes).toEqual([
    { method: 'put', body: { plan: 'Advice to retry', followUpDate: null } },
  ]);
  expect(field('Plan and advice for the patient').props.value).toBe(
    'Advice to retry',
  );
  expect(tree.root.findByType(DateField).props.value).toBeNull();
  expect(text()).toContain('The visit is still open.');
  expect(mockGuard).toBe(true);
  failSave = false;
  await press('Complete consultation');
  await confirm();
  expect(consultation.followUpDate).toBeNull();
  expect(appointment.status).toBe('completed');
  expect(mockGuard).toBe(false);
});

test.each(['offline', 'lost-response'] as const)(
  'reconciles a %s completion response with the server status',
  async failure => {
    await mount();
    completeFailure = failure;
    await press('Complete consultation');
    await confirm();
    expect(writes.filter(write => write.method === 'post')).toHaveLength(1);
    if (failure === 'lost-response') {
      expect(text()).toContain('Consultation completed');
      expect(button('Complete consultation')).toBeUndefined();
      expect(
        dentraApi.endpoints.getAppointment.select(appointment.id)(
          state.store.getState(),
        ).data?.status,
      ).toBe('completed');
    } else {
      expect(appointment.status).toBe('in_consult');
      expect(button('Complete consultation')).toBeTruthy();
      completeFailure = null;
      await press('Complete consultation');
      await confirm();
      expect(text()).toContain('Consultation completed');
    }
  },
);

test('server validation keeps a consultation open after all local drafts are saved', async () => {
  await mount();
  await type('Diagnosis', 'Saved diagnosis');
  completeFailure = 'unsigned';
  await press('Complete consultation');
  await confirm();
  expect(consultation.diagnosis).toBe('Saved diagnosis');
  expect(appointment.status).toBe('in_consult');
  expect(text()).toContain('Sign the prescription before completing.');
  expect(field('Diagnosis').props.editable).toBe(true);
});

test('rapid confirmation taps send one completion request and lock editing while it is in flight', async () => {
  await mount();
  let release!: () => void;
  holdComplete = new Promise<void>(resolve => {
    release = resolve;
  });
  await press('Complete consultation');
  const action = alert.mock.calls
    .at(-1)![2]
    .find((option: { text: string }) => option.text === 'Save and complete');
  let pending: Promise<void>;
  await act(async () => {
    pending = action.onPress();
    action.onPress();
    await flush();
  });
  expect(writes.filter(write => write.method === 'post')).toHaveLength(1);
  expect(field('Diagnosis').props.editable).toBe(false);
  expect(mockGuard).toBe(true);
  await act(async () => {
    release();
    await pending;
    await flush();
  });
  expect(mockGuard).toBe(false);
});

test('clearing a date survives saving, refetch and reopening without clearing plan items', async () => {
  consultation.planItems = [
    { procedure: 'Keep procedure', teeth: ['36'], estimatedCostPaise: 0 },
  ];
  await mount();
  await tab('Plan');
  await press('Clear follow-up date');
  consultation = { ...consultation, findings: 'Changed on web' };
  await act(async () => {
    state.store.dispatch(
      dentraApi.util.invalidateTags([
        { type: 'Consultation', id: appointment.id },
      ]),
    );
    await flush();
  });
  expect(tree.root.findByType(DateField).props.value).toBeNull();
  await press('Save treatment plan');
  expect(writes).toEqual([{ method: 'put', body: { followUpDate: null } }]);
  expect(consultation.planItems?.[0].procedure).toBe('Keep procedure');
  await act(async () => {
    tree.unmount();
    await flush();
  });
  await mount();
  await tab('Plan');
  expect(tree.root.findByType(DateField).props.value).toBeNull();
  expect(text()).toContain('Keep procedure');
});
