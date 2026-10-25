import React from 'react';
import { Alert, Text, TextInput } from 'react-native';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { createStoreHarness } from '../test-utils/store';
import { api } from '../src/api/client';
import { session } from '../src/features/auth/session';
import { dentraApi } from '../src/store/dentraApi';
import type { Appointment } from '../src/common/types/api';
import type {
  ClinicalNote,
  Consultation,
} from '../src/common/types/consultation';
import type { ToothFinding } from '../src/common/types/dental-chart';
import { dateKey } from '../src/common/utils/date';
import { ConsultationScreen } from '../src/features/consultation/ConsultationScreen';
import { DentalChart } from '../src/features/consultation/dental-chart/DentalChart';
import { Button } from '../src/components/ui/Button';
import { ToothIcon } from '../src/components/icons/ToothIcon';

const mockDispatch = jest.fn();
let mockFocused = true;
let mockGuard: {
  prevent: boolean;
  callback: (event: { data: { action: { type: string } } }) => void;
};
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockFocused,
  useNavigation: () => ({ dispatch: mockDispatch }),
  usePreventRemove: (prevent: boolean, callback: typeof mockGuard.callback) => {
    mockGuard = { prevent, callback };
  },
}));
jest.mock('../src/features/video/VideoCallProvider', () => ({
  useVideoCall: () => ({ appointmentId: null, open: jest.fn() }),
}));

type DraftRequest = Partial<ClinicalNote> & { chart?: ToothFinding[] };
let state: ReturnType<typeof createStoreHarness>;
let tree: ReactTestRenderer | undefined;
let appointment: Appointment;
let consultation: Consultation;
let teeth: ToothFinding[];
let writes: DraftRequest[];
let patientReads: number;
let failRead: boolean;
let failWrite: boolean;
let failConfirmation: boolean;
let holdRead: Promise<void> | undefined;

function reply(config: InternalAxiosRequestConfig, data: unknown) {
  return { config, data, status: 200, statusText: 'OK', headers: {} };
}
function screen() {
  return (
    <ConsultationScreen
      navigation={{} as never}
      route={{
        key: 'chart-visit',
        name: 'Consultation',
        params: { appointmentId: appointment.id },
      }}
    />
  );
}
async function flush() {
  for (let n = 0; n < 8; n++)
    await new Promise<void>(resolve => setImmediate(resolve));
}
async function mount() {
  await act(async () => {
    tree = Renderer.create(state.wrap(screen()));
    await flush();
  });
}
async function pressLabel(label: string) {
  await act(async () => {
    tree!.root
      .findAll(
        node =>
          node.props.accessibilityLabel === label &&
          typeof node.props.onPress === 'function',
      )[0]
      .props.onPress();
    await flush();
  });
}
async function tapTooth(number: string) {
  await act(async () => {
    tree!.root
      .findAll(
        node =>
          String(node.props.accessibilityLabel).startsWith(
            `Tooth ${number}:`,
          ) && typeof node.props.onPress === 'function',
      )[0]
      .props.onPress();
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
function text() {
  return tree!.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .flat()
    .filter(value => typeof value === 'string')
    .join(' ');
}
function chart() {
  return tree!.root.findByType(DentalChart).props;
}

beforeEach(async () => {
  jest.clearAllMocks();
  state = createStoreHarness();
  tree = undefined;
  mockFocused = true;
  writes = [];
  patientReads = 0;
  failRead = false;
  failWrite = false;
  failConfirmation = false;
  holdRead = undefined;
  await session.signIn({
    accessToken: 'synthetic-access',
    refreshToken: 'synthetic-refresh',
    expiresInSeconds: 900,
  });
  appointment = {
    id: 'chart-visit',
    patientId: 'chart-patient',
    patientName: 'Test Patient',
    patientAge: 30,
    patientGender: 'female',
    type: 'clinic',
    date: dateKey(),
    time: '10:00',
    status: 'in_consult',
    concern: 'Check-up',
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
      id: 'signed-rx',
      signedAt: '2026-10-23T10:00:00Z',
      signedByDentistId: 'dentist',
      items: [],
    },
  };
  teeth = [
    { toothNumber: '36', status: 'filled' },
    { toothNumber: '48', status: 'missing' },
  ];
  api.defaults.adapter = async config => {
    if (config.method === 'get') {
      if (config.url === `/appointments/${appointment.id}`)
        return reply(config, { ...appointment });
      if (config.url === `/appointments/${appointment.id}/consultation`)
        return reply(config, { ...consultation });
      if (config.url === `/dentists/me/patients/${appointment.patientId}`) {
        patientReads++;
        if (holdRead) await holdRead;
        if (failRead)
          throw new AxiosError(
            'Could not load patient chart',
            'ERR_NETWORK',
            config,
          );
        return reply(config, {
          id: appointment.patientId,
          chart: teeth.map(tooth => ({ ...tooth })),
          mobile: 'private-mobile-not-needed',
          conditions: 'private-history-not-needed',
        });
      }
    }
    if (
      config.method === 'put' &&
      config.url === `/appointments/${appointment.id}/consultation`
    ) {
      const body: DraftRequest = JSON.parse(config.data);
      writes.push(body);
      if (appointment.status !== 'in_consult')
        throw new AxiosError(
          'This appointment is not in consultation.',
          'ERR_BAD_REQUEST',
          config,
          undefined,
          {
            ...reply(config, {
              message: 'This appointment is not in consultation.',
            }),
            status: 409,
          },
        );
      if (failWrite)
        throw new AxiosError('Chart save unavailable', 'ERR_NETWORK', config);
      for (const change of body.chart ?? []) {
        teeth = [
          ...teeth.filter(tooth => tooth.toothNumber !== change.toothNumber),
          change,
        ];
      }
      const note = { ...body };
      delete note.chart;
      consultation = { ...consultation, ...note };
      if (failConfirmation) failRead = true;
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

test('loads the chart only on demand, with all 32 teeth in patient-right/left FDI order', async () => {
  await mount();
  expect(patientReads).toBe(0);
  await pressLabel('Chart');
  const labels = [
    ...new Set(
      tree!.root
        .findAll(node =>
          /^Tooth \d{2}:/.test(String(node.props.accessibilityLabel)),
        )
        .map(node => node.props.accessibilityLabel as string),
    ),
  ];
  expect(labels.map(label => label.match(/\d{2}/)![0])).toEqual([
    '18',
    '17',
    '16',
    '15',
    '14',
    '13',
    '12',
    '11',
    '21',
    '22',
    '23',
    '24',
    '25',
    '26',
    '27',
    '28',
    '48',
    '47',
    '46',
    '45',
    '44',
    '43',
    '42',
    '41',
    '31',
    '32',
    '33',
    '34',
    '35',
    '36',
    '37',
    '38',
  ]);
  expect(chart().form).toMatchObject({ '36': 'filled', '48': 'missing' });
  const chartNode = tree!.root.findByType(DentalChart);
  expect(chartNode.findAllByType(ToothIcon)).toHaveLength(32);
  const filled = chartNode.findAll(
    node =>
      node.props.accessibilityLabel === 'Tooth 36: Filled' &&
      typeof node.props.onPress === 'function',
  )[0];
  expect(filled.findByType(ToothIcon).props).toMatchObject({
    fill: '#E8F2FC',
    dashed: false,
  });
  const missing = chartNode.findAll(
    node =>
      node.props.accessibilityLabel === 'Tooth 48: Missing' &&
      typeof node.props.onPress === 'function',
  )[0];
  expect(missing.findByType(ToothIcon).props).toMatchObject({
    fill: 'none',
    dashed: true,
  });
  expect(JSON.stringify(state.store.getState())).not.toMatch(
    /private-mobile-not-needed|private-history-not-needed/,
  );
});

test('saves changed teeth only, clears existing findings with healthy, and reopens saved values', async () => {
  await mount();
  await pressLabel('Chart');
  await tapTooth('14');
  await pressLabel('Mark Healthy');
  await tapTooth('36');
  await press('Save chart');
  expect(writes).toHaveLength(1);
  expect(writes[0]).toEqual({
    chart: [
      { toothNumber: '14', status: 'caries' },
      { toothNumber: '36', status: 'healthy' },
    ],
  });
  expect(consultation.diagnosis).toBe('Keep diagnosis');
  expect(consultation.plan).toBe('Keep plan');
  expect(consultation.prescription?.signedAt).toBeTruthy();
  expect(text()).toContain('Chart saved');
  expect(mockGuard.prevent).toBe(false);
  await act(async () => tree!.unmount());
  tree = undefined;
  await mount();
  await pressLabel('Chart');
  expect(chart().form).toMatchObject({
    '14': 'caries',
    '36': 'healthy',
    '48': 'missing',
  });
});

test('tapping a newly marked tooth again clears the pending finding without sending an empty status', async () => {
  await mount();
  await pressLabel('Chart');
  await tapTooth('14');
  expect(mockGuard.prevent).toBe(true);
  await tapTooth('14');
  expect(chart().form['14']).toBe('healthy');
  expect(button('Save chart').props.disabled).toBe(true);
  expect(mockGuard.prevent).toBe(false);
  expect(writes).toHaveLength(0);
});

test('switching Note/Chart retains both drafts and saving one keeps the other protected', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  await mount();
  await pressLabel('Chart');
  await tapTooth('14');
  await pressLabel('Note');
  await act(async () =>
    tree!.root
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel === 'Diagnosis')!
      .props.onChangeText('Unsaved note'),
  );
  await pressLabel('Chart');
  await press('Save chart');
  expect(mockGuard.prevent).toBe(true);
  await act(async () =>
    mockGuard.callback({ data: { action: { type: 'GO_BACK' } } }),
  );
  expect(alert).toHaveBeenCalledTimes(1);
  await pressLabel('Note');
  expect(
    tree!.root
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel === 'Diagnosis')!.props.value,
  ).toBe('Unsaved note');
  await press('Save draft');
  expect(mockGuard.prevent).toBe(false);
  expect(writes).toEqual([
    { chart: [{ toothNumber: '14', status: 'caries' }] },
    { diagnosis: 'Unsaved note' },
  ]);
  await pressLabel('Chart');
  expect(chart().form['14']).toBe('caries');
});

test('a failed save retains the chart draft and supports retry', async () => {
  await mount();
  await pressLabel('Chart');
  await tapTooth('14');
  failWrite = true;
  await press('Save chart');
  expect(chart().form['14']).toBe('caries');
  expect(text()).toContain(
    'Cannot reach Dentra. Check your connection and try again.',
  );
  expect(mockGuard.prevent).toBe(true);
  failWrite = false;
  await press('Save chart');
  expect(text()).toContain('Chart saved');
  expect(writes).toHaveLength(2);
  expect(mockGuard.prevent).toBe(false);
});

test('does not claim confirmation when the write succeeds but reading the saved chart fails', async () => {
  await mount();
  await pressLabel('Chart');
  await tapTooth('14');
  failConfirmation = true;
  await press('Save chart');
  expect(text()).toContain(
    'Your chart changes were saved, but the latest chart could not be loaded.',
  );
  expect(text()).not.toContain('Chart saved');
  expect(mockGuard.prevent).toBe(true);
  expect(chart().form['14']).toBe('caries');
  failConfirmation = false;
  failRead = false;
  await press('Save chart');
  expect(text()).toContain('Chart saved');
  expect(mockGuard.prevent).toBe(false);
});

test('a rejected chart save refreshes closed visit status and retains unsaved markings read-only', async () => {
  await mount();
  await pressLabel('Chart');
  await tapTooth('14');
  appointment.status = 'completed';
  await press('Save chart');
  expect(chart().editable).toBe(false);
  expect(chart().form['14']).toBe('caries');
  expect(button('Save chart')).toBeUndefined();
  expect(mockGuard.prevent).toBe(true);
  expect(text()).toContain('This appointment is not in consultation.');
  expect(teeth.some(tooth => tooth.toothNumber === '14')).toBe(false);
});

test('completed visits show the current chart read-only and never send chart changes', async () => {
  appointment.status = 'completed';
  await mount();
  await pressLabel('Chart');
  expect(text()).toContain(
    'Current patient chart, including changes from other visits.',
  );
  expect(chart().editable).toBe(false);
  await tapTooth('36');
  expect(chart().form['36']).toBe('filled');
  expect(writes).toHaveLength(0);
  expect(button('Save chart')).toBeUndefined();
});

test('duplicate taps send one write, and confirmation can finish while the screen is covered', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  await mount();
  await pressLabel('Chart');
  await tapTooth('14');
  let release!: () => void;
  holdRead = new Promise<void>(resolve => {
    release = resolve;
  });
  const save = button('Save chart').props.onPress;
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
  mockFocused = false;
  await act(async () => tree!.update(state.wrap(screen())));
  await act(async () => {
    release();
    await pending;
    await flush();
  });
  mockFocused = true;
  await act(async () => tree!.update(state.wrap(screen())));
  expect(text()).toContain('Chart saved');
  expect(button('Save chart').props.loading).toBe(false);
  expect(mockGuard.prevent).toBe(false);
});

test('a load error shows retry rather than an empty chart that could overwrite patient findings', async () => {
  failRead = true;
  await mount();
  await pressLabel('Chart');
  expect(tree!.root.findAllByType(DentalChart)).toHaveLength(0);
  expect(button('Save chart')).toBeUndefined();
  failRead = false;
  await press('Reload dental chart');
  expect(chart().form['36']).toBe('filled');
  expect(writes).toHaveLength(0);
});

test('a refreshed chart preserves local edits and a save does not overwrite other teeth changed elsewhere', async () => {
  await mount();
  await pressLabel('Chart');
  await tapTooth('14');
  teeth = [
    { toothNumber: '36', status: 'filled' },
    { toothNumber: '48', status: 'rct' },
  ];
  await act(async () => {
    state.store.dispatch(
      dentraApi.util.invalidateTags([
        { type: 'PatientChart', id: appointment.patientId },
      ]),
    );
    await flush();
  });
  expect(chart().form['14']).toBe('caries');
  await press('Save chart');
  expect(writes[0]).toEqual({
    chart: [{ toothNumber: '14', status: 'caries' }],
  });
  expect(chart().form['48']).toBe('rct');
  expect(chart().form['14']).toBe('caries');
});

test('manual Refresh shows new findings on other teeth while retaining a local draft', async () => {
  await mount();
  await pressLabel('Chart');
  await tapTooth('14');
  teeth = [
    { toothNumber: '36', status: 'crown' },
    { toothNumber: '48', status: 'missing' },
  ];
  await pressLabel('Refresh dental chart');
  expect(chart().form['36']).toBe('crown');
  expect(chart().form['14']).toBe('caries');
  expect(chart().changedTeeth).toEqual(['14']);
  expect(mockGuard.prevent).toBe(true);
  expect(writes).toHaveLength(0);
});
