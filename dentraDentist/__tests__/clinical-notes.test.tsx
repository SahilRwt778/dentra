import React from 'react';
import { Alert, Text, TextInput } from 'react-native';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { api } from '../src/api/client';
import { session } from '../src/features/auth/session';
import type { Appointment } from '../src/common/types/api';
import type { Consultation } from '../src/common/types/consultation';
import { dateKey } from '../src/common/utils/date';
import { dentraApi } from '../src/store/dentraApi';
import { createStoreHarness } from '../test-utils/store';
import { ConsultationScreen } from '../src/features/consultation/ConsultationScreen';
import { ConsultationAction } from '../src/features/consultation/ConsultationAction';
import { Button } from '../src/components/ui/Button';

const mockNavigate = jest.fn();
const mockDispatch = jest.fn();
const mockOpenVideo = jest.fn();
let mockCallId: string | null = null;
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
jest.mock('../src/features/video/VideoCallProvider', () => ({
  useVideoCall: () => ({ appointmentId: mockCallId, open: mockOpenVideo }),
}));

let state: ReturnType<typeof createStoreHarness>;
let tree: ReactTestRenderer | undefined;
let appointment: Appointment;
let consultation: Consultation;
let writes: { url: string; method: string; body: Record<string, string> }[];
let failSave: 'offline' | 'lost-response' | null;
let startConflict: boolean;
let holdSave: Promise<void> | undefined;

function reply(config: InternalAxiosRequestConfig, data: unknown) {
  return { config, data, status: 200, statusText: 'OK', headers: {} };
}
function conflict(config: InternalAxiosRequestConfig, message: string): never {
  throw new AxiosError(message, 'ERR_BAD_REQUEST', config, undefined, {
    ...reply(config, { message }),
    status: 409,
    statusText: 'Conflict',
  });
}
async function flush() {
  for (let index = 0; index < 8; index++)
    await new Promise<void>(resolve => setImmediate(resolve));
}
async function mount(screen?: React.ReactNode) {
  await act(async () => {
    tree = Renderer.create(
      state.wrap(
        screen ?? (
          <ConsultationScreen
            navigation={{} as never}
            route={{
              key: 'note-one',
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
function field(label: string) {
  return tree!.root
    .findAllByType(TextInput)
    .find(node => node.props.accessibilityLabel === label)!;
}
async function type(label: string, value: string) {
  await act(async () => field(label).props.onChangeText(value));
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
function text() {
  return tree!.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .flat()
    .filter(value => typeof value === 'string')
    .join(' ');
}

beforeEach(async () => {
  jest.clearAllMocks();
  state = createStoreHarness();
  tree = undefined;
  writes = [];
  failSave = null;
  startConflict = false;
  holdSave = undefined;
  mockCallId = null;
  await session.signIn({
    accessToken: 'synthetic-access',
    refreshToken: 'synthetic-refresh',
    expiresInSeconds: 900,
  });
  appointment = {
    id: 'visit-one',
    patientId: 'patient-one',
    patientName: 'Test Patient',
    patientAge: 32,
    patientGender: 'female',
    type: 'clinic',
    date: dateKey(),
    time: '10:00',
    status: 'in_consult',
    concern: 'Toothache',
    symptomArea: 'Upper left',
    symptomSince: 'Two days',
    painScore: 5,
    swelling: false,
  };
  consultation = {
    appointmentId: appointment.id,
    chiefComplaint: 'Existing complaint',
    findings: 'Existing findings',
    diagnosis: 'Existing diagnosis',
    treatmentDone: 'Existing treatment',
    plan: 'Keep existing advice',
    followUpDate: '2026-11-01',
    isEdited: false,
    editedAt: null,
    prescription: {
      id: 'rx-one',
      signedAt: '2026-10-23T10:00:00Z',
      signedByDentistId: 'dentist-one',
      items: [
        {
          medicineName: 'Synthetic medicine',
          strength: null,
          dose: 'Test dose',
          frequency: 'Test frequency',
          duration: 'Test duration',
          instructions: null,
        },
      ],
    },
  };
  api.defaults.adapter = async config => {
    if (config.method === 'get') {
      if (config.url === `/appointments/${appointment.id}`)
        return reply(config, { ...appointment });
      if (config.url === `/appointments/${appointment.id}/consultation`)
        return reply(config, { ...consultation });
    }
    if (
      config.method === 'post' &&
      config.url === `/appointments/${appointment.id}/start`
    ) {
      writes.push({ url: config.url, method: config.method, body: {} });
      appointment = { ...appointment, status: 'in_consult' };
      if (startConflict) conflict(config, 'Not ready to start.');
      return reply(config, { ...appointment });
    }
    if (
      config.method === 'put' &&
      config.url === `/appointments/${appointment.id}/consultation`
    ) {
      const body = JSON.parse(config.data);
      writes.push({ url: config.url, method: config.method, body });
      if (holdSave) await holdSave;
      if (appointment.status !== 'in_consult')
        conflict(config, 'This appointment is not in consultation.');
      if (failSave === 'offline')
        throw new AxiosError('Network unavailable', 'ERR_NETWORK', config);
      consultation = { ...consultation, ...body };
      if (failSave === 'lost-response')
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

test('saves only changed notes and preserves an existing signed prescription and plan', async () => {
  await mount();
  expect(field('Chief complaint').props.value).toBe('Existing complaint');
  expect(text()).toContain('Reported by patient');
  await type('Examination findings', 'Updated findings\nSecond line');
  await press('Save draft');
  expect(writes).toEqual([
    {
      url: '/appointments/visit-one/consultation',
      method: 'put',
      body: { findings: 'Updated findings\nSecond line' },
    },
  ]);
  expect(consultation.plan).toBe('Keep existing advice');
  expect(consultation.prescription?.signedAt).toBeTruthy();
  expect(consultation.prescription?.items).toHaveLength(1);
  expect(text()).toContain('Draft saved');
  expect(button('Save draft').props.disabled).toBe(true);
  expect(mockGuard.prevent).toBe(false);
  await act(async () => tree!.unmount());
  tree = undefined;
  await mount();
  expect(field('Examination findings').props.value).toBe(
    'Updated findings\nSecond line',
  );
});

test('allows clearing a note and saving a draft without a diagnosis', async () => {
  await mount();
  await type('Chief complaint', '');
  await type('Diagnosis', '');
  await press('Save draft');
  expect(writes[0].body).toEqual({ chiefComplaint: '', diagnosis: '' });
  expect(text()).toContain('Draft saved');
});

test('refreshing the query does not overwrite unsaved input or send unrelated fields', async () => {
  await mount();
  await type('Diagnosis', 'Unsaved local diagnosis');
  consultation = { ...consultation, findings: 'Updated on web' };
  await act(async () => {
    state.store.dispatch(
      dentraApi.util.invalidateTags([
        { type: 'Consultation', id: appointment.id },
      ]),
    );
    await flush();
  });
  expect(field('Diagnosis').props.value).toBe('Unsaved local diagnosis');
  await press('Save draft');
  expect(writes[0].body).toEqual({ diagnosis: 'Unsaved local diagnosis' });
  expect(field('Examination findings').props.value).toBe('Updated on web');
});

test.each(['offline', 'lost-response'] as const)(
  'retains edits after a %s failure and supports retry',
  async failure => {
    await mount();
    failSave = failure;
    await type('Diagnosis', 'Retry diagnosis');
    await press('Save draft');
    expect(field('Diagnosis').props.value).toBe('Retry diagnosis');
    expect(mockGuard.prevent).toBe(true);
    expect(text()).not.toContain('Draft saved');
    failSave = null;
    await press('Save draft');
    expect(writes).toHaveLength(2);
    expect(consultation.diagnosis).toBe('Retry diagnosis');
    expect(text()).toContain('Draft saved');
  },
);

test('Back warns about unsaved changes and dispatches the original action only after discard', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  await mount();
  await type('Diagnosis', 'Unsaved diagnosis');
  expect(mockGuard.prevent).toBe(true);
  const action = { type: 'GO_BACK' };
  await act(async () => mockGuard.callback({ data: { action } }));
  expect(alert).toHaveBeenLastCalledWith(
    'Discard unsaved changes?',
    expect.any(String),
    expect.any(Array),
  );
  expect(mockDispatch).not.toHaveBeenCalled();
  const discard = alert.mock.calls
    .at(-1)![2]!
    .find(option => option.text === 'Discard changes')!;
  await act(async () => discard.onPress!());
  expect(mockDispatch).toHaveBeenCalledWith(action);
  expect(writes).toHaveLength(0);
});

test('rapid taps send one save and Back waits while it is in flight', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  let release!: () => void;
  holdSave = new Promise<void>(resolve => {
    release = resolve;
  });
  await mount();
  await type('Diagnosis', 'Single save');
  const save = button('Save draft').props.onPress;
  let pending!: Promise<void>;
  await act(async () => {
    pending = save();
    await flush();
  });
  await act(async () => {
    await save();
    mockGuard.callback({ data: { action: { type: 'GO_BACK' } } });
  });
  expect(writes).toHaveLength(1);
  expect(alert).toHaveBeenLastCalledWith('Saving draft', expect.any(String));
  expect(mockDispatch).not.toHaveBeenCalled();
  await act(async () => {
    release();
    await pending;
    await flush();
  });
  expect(text()).toContain('Draft saved');
});

test('completed visits are read-only', async () => {
  appointment.status = 'completed';
  await mount();
  expect(field('Diagnosis').props.editable).toBe(false);
  expect(button('Save draft')).toBeUndefined();
  await type('Diagnosis', 'Forbidden change');
  expect(field('Diagnosis').props.value).toBe('Existing diagnosis');
  expect(writes).toHaveLength(0);
});

test('a visit closed on another device rejects the save and keeps the unsaved note visible', async () => {
  await mount();
  await type('Diagnosis', 'Still unsaved');
  appointment.status = 'completed';
  await press('Save draft');
  expect(field('Diagnosis').props.value).toBe('Still unsaved');
  expect(field('Diagnosis').props.editable).toBe(false);
  expect(consultation.diagnosis).toBe('Existing diagnosis');
  expect(text()).toContain('This appointment is not in consultation.');
  expect(mockGuard.prevent).toBe(true);
});

test.each([false, true])(
  'starts a visit and opens notes, including an already-started conflict (%s)',
  async alreadyStarted => {
    appointment.status = 'waiting';
    startConflict = alreadyStarted;
    await mount(<ConsultationAction appointment={{ ...appointment }} />);
    await press('Start consultation');
    expect(writes).toEqual([
      { url: '/appointments/visit-one/start', method: 'post', body: {} },
    ]);
    expect(mockNavigate).toHaveBeenCalledWith('Consultation', {
      appointmentId: 'visit-one',
    });
  },
);

test('future visits cannot be started from the mobile action', async () => {
  appointment.status = 'booked';
  appointment.date = '2099-12-01';
  await mount(<ConsultationAction appointment={appointment} />);
  const action = tree!.root.findByType(Button);
  expect(action.props.disabled).toBe(true);
  await act(async () => action.props.onPress());
  expect(writes).toHaveLength(0);
  expect(mockNavigate).not.toHaveBeenCalled();
});

test('returns to the same video consultation without sending or discarding notes', async () => {
  appointment.type = 'video';
  mockCallId = appointment.id;
  await mount();
  await type('Diagnosis', 'In-call note');
  await press('Return to video consultation');
  expect(mockOpenVideo).toHaveBeenCalledWith({
    appointmentId: 'visit-one',
    patientName: 'Test Patient',
  });
  expect(field('Diagnosis').props.value).toBe('In-call note');
  expect(mockGuard.prevent).toBe(true);
  expect(writes).toHaveLength(0);
});
