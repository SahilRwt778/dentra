import React from 'react';
import { Text, TextInput } from 'react-native';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { api } from '../src/api/client';
import { session } from '../src/features/auth/session';
import { ConsultationScreen } from '../src/features/consultation/ConsultationScreen';
import { Button } from '../src/components/ui/Button';
import { dentraApi } from '../src/store/dentraApi';
import { createStoreHarness } from '../test-utils/store';
import type { Appointment } from '../src/common/types/api';
import type { Consultation } from '../src/common/types/consultation';
import { validateProcedure } from '../src/features/consultation/treatment-plan/treatment-plan-form';

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
let writes: Record<string, unknown>[];
let offline: boolean;
let holdSave: Promise<void> | undefined;
const route = {
  key: 'plan-test',
  name: 'Consultation',
  params: { appointmentId: 'plan-visit' },
} as const;
function reply(config: InternalAxiosRequestConfig, data: unknown) {
  return { config, data, status: 200, statusText: 'OK', headers: {} };
}
async function flush() {
  for (let index = 0; index < 8; index++)
    await new Promise<void>(resolve => setImmediate(resolve));
}
async function mount() {
  await act(async () => {
    tree = Renderer.create(
      state.wrap(<ConsultationScreen navigation={{} as never} route={route} />),
    );
    await flush();
  });
  await tab('Plan');
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
function button(title: string) {
  return tree.root
    .findAllByType(Button)
    .find(node => node.props.title === title)!;
}
async function press(title: string) {
  await act(async () => {
    const action =
      button(title) ??
      tree.root.findAll(
        node =>
          node.props.accessibilityLabel === title &&
          typeof node.props.onPress === 'function',
      )[0];
    await action.props.onPress();
    await flush();
  });
}
async function type(label: string, value: string) {
  await act(async () =>
    tree.root
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel === label)!
      .props.onChangeText(value),
  );
}
async function tooth(number: string) {
  await act(async () =>
    tree.root
      .findAll(
        node =>
          node.props.accessibilityLabel === `Plan tooth ${number}` &&
          typeof node.props.onPress === 'function',
      )[0]
      .props.onPress(),
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
async function addProcedure() {
  await press('Add procedure');
  await type('Procedure', 'Test procedure');
  await tooth('36');
  await type('Estimated cost (₹, optional)', '123.45');
  await press('Add to treatment plan');
}
beforeEach(async () => {
  state = createStoreHarness();
  writes = [];
  offline = false;
  holdSave = undefined;
  await session.signIn({
    accessToken: 'synthetic-plan-access',
    refreshToken: 'synthetic-plan-refresh',
    expiresInSeconds: 900,
  });
  appointment = {
    id: 'plan-visit',
    patientId: 'patient-one',
    patientName: 'Synthetic Patient',
    patientAge: 32,
    patientGender: 'female',
    concern: 'Synthetic concern',
    painScore: 3,
    swelling: false,
    type: 'clinic',
    date: '2026-10-24',
    time: '10:00',
    status: 'in_consult',
  };
  consultation = {
    appointmentId: appointment.id,
    chiefComplaint: 'Keep complaint',
    findings: 'Keep findings',
    diagnosis: 'Keep diagnosis',
    treatmentDone: 'Keep treatment',
    plan: 'Keep advice',
    planItems: [],
    followUpDate: '2026-11-01',
    isEdited: false,
    editedAt: null,
    prescription: null,
  };
  api.defaults.adapter = async config => {
    if (config.method === 'get')
      return reply(
        config,
        config.url?.endsWith('/consultation')
          ? { ...consultation }
          : { ...appointment },
      );
    const changes = JSON.parse(config.data);
    writes.push(changes);
    if (holdSave) await holdSave;
    if (offline) throw new AxiosError('Offline', 'ERR_NETWORK', config);
    consultation = { ...consultation, ...changes };
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

test('saves exact paise and selected teeth through Axios/Redux, preserving all other consultation sections', async () => {
  await mount();
  await addProcedure();
  expect(mockGuard).toBe(true);
  await type('Plan and advice for the patient', 'Patient-facing advice');
  await press('Save treatment plan');
  expect(writes).toEqual([
    {
      plan: 'Patient-facing advice',
      planItems: [
        {
          procedure: 'Test procedure',
          teeth: ['36'],
          estimatedCostPaise: 12345,
        },
      ],
    },
  ]);
  expect(consultation.followUpDate).toBe('2026-11-01');
  expect(consultation.diagnosis).toBe('Keep diagnosis');
  expect(mockGuard).toBe(false);
  expect(text()).toContain('Treatment plan saved');
  await act(async () => {
    tree.unmount();
    await flush();
  });
  await mount();
  expect(text()).toContain('Test procedure');
  expect(text()).toContain('Teeth: 36');
});

test('keeps an unfinished procedure and advice while switching tabs or refetching', async () => {
  await mount();
  await press('Add procedure');
  await type('Procedure', 'Unfinished procedure');
  await tooth('11');
  await tab('Note');
  await type('Diagnosis', 'Unsaved diagnosis');
  consultation = { ...consultation, plan: 'Updated on another device' };
  await act(async () => {
    state.store.dispatch(
      dentraApi.util.invalidateTags([
        { type: 'Consultation', id: appointment.id },
      ]),
    );
    await flush();
  });
  await tab('Plan');
  expect(
    tree.root
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel === 'Procedure')!.props.value,
  ).toBe('Unfinished procedure');
  expect(button('Save treatment plan').props.disabled).toBe(true);
  expect(mockGuard).toBe(true);
  await press('Add to treatment plan');
  await press('Save treatment plan');
  expect(writes[0]).toEqual({
    planItems: [
      {
        procedure: 'Unfinished procedure',
        teeth: ['11'],
        estimatedCostPaise: null,
      },
    ],
  });
  await tab('Note');
  expect(
    tree.root
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel === 'Diagnosis')!.props.value,
  ).toBe('Unsaved diagnosis');
  expect(mockGuard).toBe(true);
});

test('rejects invalid estimates without writing and preserves the form after a failed save', async () => {
  await mount();
  await press('Add procedure');
  await type('Procedure', 'Test procedure');
  for (const invalid of ['-1', '1.234', '1e5', '10000001']) {
    await type('Estimated cost (₹, optional)', invalid);
    await press('Add to treatment plan');
    expect(writes).toHaveLength(0);
    expect(button('Add to treatment plan')).toBeTruthy();
  }
  await type('Estimated cost (₹, optional)', '0');
  await press('Add to treatment plan');
  offline = true;
  await press('Save treatment plan');
  expect(text()).toContain('Test procedure');
  expect(mockGuard).toBe(true);
  offline = false;
  await press('Save treatment plan');
  expect(consultation.planItems?.[0].estimatedCostPaise).toBe(0);
  expect(mockGuard).toBe(false);
});

test('removing the last saved procedure sends an explicit empty list without clearing advice', async () => {
  consultation.planItems = [
    { procedure: 'Saved procedure', teeth: [], estimatedCostPaise: null },
  ];
  await mount();
  await press('Remove procedure 1');
  await press('Save treatment plan');
  expect(writes).toEqual([{ planItems: [] }]);
  expect(consultation.plan).toBe('Keep advice');
});

test('editing a saved procedure replaces that procedure and can clear its estimate', async () => {
  consultation.planItems = [
    {
      procedure: 'Original procedure',
      teeth: ['36'],
      estimatedCostPaise: 10000,
    },
  ];
  await mount();
  await press('Edit procedure 1');
  await type('Procedure', 'Updated procedure');
  await tooth('36');
  await tooth('11');
  await type('Estimated cost (₹, optional)', '');
  await press('Update procedure');
  await press('Save treatment plan');
  expect(writes).toEqual([
    {
      planItems: [
        {
          procedure: 'Updated procedure',
          teeth: ['11'],
          estimatedCostPaise: null,
        },
      ],
    },
  ]);
  expect(text()).not.toContain('Original procedure');
});

test('a pending save prevents duplicate writes and a completed appointment has no plan editing actions', async () => {
  await mount();
  await addProcedure();
  let release!: () => void;
  holdSave = new Promise<void>(resolve => {
    release = resolve;
  });
  const save = button('Save treatment plan').props.onPress;
  await act(async () => {
    save();
    save();
    await flush();
  });
  expect(writes).toHaveLength(1);
  await act(async () => {
    release();
    await flush();
  });
  appointment = { ...appointment, status: 'completed' };
  await act(async () => {
    state.store.dispatch(dentraApi.util.invalidateTags(['Appointments']));
    await flush();
  });
  expect(
    tree.root
      .findAllByType(Button)
      .some(
        node =>
          node.props.title === 'Save treatment plan' ||
          node.props.title === 'Add procedure',
      ),
  ).toBe(false);
  expect(
    tree.root
      .findAllByType(TextInput)
      .find(
        node =>
          node.props.accessibilityLabel === 'Plan and advice for the patient',
      )!.props.editable,
  ).toBe(false);
});

test('procedure validation keeps unknown costs distinct from a zero estimate and rejects invalid teeth', () => {
  expect(
    validateProcedure({ procedure: 'Test', teeth: [], estimatedCost: '' })
      .estimatedCostPaise,
  ).toBeNull();
  expect(
    validateProcedure({ procedure: 'Test', teeth: [], estimatedCost: '0.01' })
      .estimatedCostPaise,
  ).toBe(1);
  expect(() =>
    validateProcedure({
      procedure: 'Test',
      teeth: ['55' as never],
      estimatedCost: '',
    }),
  ).toThrow('valid permanent teeth');
});
