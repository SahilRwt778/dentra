import React from 'react';
import { Alert, Text } from 'react-native';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { api } from '../src/api/client';
import { session } from '../src/features/auth/session';
import { createStoreHarness } from '../test-utils/store';
import { testPatientRecord } from '../test-utils/patient';
import type { PatientRecord } from '../src/common/types/patient';
import { dentraApi } from '../src/store/dentraApi';
import type { Appointment } from '../src/common/types/api';
import { addDays, dateKey } from '../src/common/utils/date';
import { AppointmentScreen } from '../src/features/appointments/AppointmentScreen';
import { RescheduleAppointmentScreen } from '../src/features/appointments/reschedule/RescheduleAppointmentScreen';
import { Button } from '../src/components/ui/Button';
import { DateField } from '../src/components/forms/DateField';
import { availableAppointmentActions } from '../src/features/appointments/appointment-actions';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockPreventRemove = false;
const mockPreventRemoveGuards = new Map<string, boolean>();
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useNavigation: () => ({ navigate: mockNavigate, dispatch: jest.fn() }),
  usePreventRemove: (prevent: boolean) => {
    const guardId = require('react').useId();
    mockPreventRemoveGuards.set(guardId, prevent);
    mockPreventRemove = [...mockPreventRemoveGuards.values()].some(Boolean);
  },
}));
jest.mock('../src/features/attachments/AppointmentAttachments', () => ({
  AppointmentAttachments: () => null,
}));
jest.mock('../src/features/video/VideoCallProvider', () => ({
  useVideoCall: () => ({ appointmentId: null, open: jest.fn() }),
}));

let state: ReturnType<typeof createStoreHarness>;
let tree: ReactTestRenderer;
let appointment: Appointment;
let patientRecord: PatientRecord;
let failHistory: boolean;
let slots: Map<string, string[]>;
let writes: { path: string; body: Record<string, unknown> }[];
let slotRequests: { date: string; type: string; clinicId?: string }[];
let mode: 'offline' | 'lost-response' | 'conflict' | null;
let failSlotsDate: string | null;
let holdPost: Promise<void> | undefined;
let holdSlots: { date: string; promise: Promise<void> } | undefined;

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
  for (let index = 0; index < 8; index++)
    await new Promise<void>(resolve => setImmediate(resolve));
}
async function mount(reschedule = false) {
  await act(async () => {
    tree = Renderer.create(
      state.wrap(
        reschedule ? (
          <RescheduleAppointmentScreen
            navigation={{ goBack: mockGoBack } as never}
            route={{
              key: 'move',
              name: 'RescheduleAppointment',
              params: { appointmentId: appointment.id },
            }}
          />
        ) : (
          <AppointmentScreen
            navigation={{} as never}
            route={{
              key: 'details',
              name: 'Appointment',
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
  return tree.root
    .findAllByType(Button)
    .find(node => node.props.title === title);
}
function text() {
  return tree.root
    .findAllByType(Text)
    .flatMap(node => node.props.children)
    .flat()
    .filter(value => typeof value === 'string')
    .join(' ');
}
async function press(label: string) {
  await act(async () => {
    const action =
      button(label) ??
      tree.root.findAll(
        node =>
          node.props.accessibilityLabel === label &&
          typeof node.props.onPress === 'function',
      )[0];
    await action.props.onPress();
    await flush();
  });
}
async function selectDate(date: string) {
  await act(async () => {
    tree.root.findByType(DateField).props.onChange(date);
    await flush();
  });
}
async function confirmCancellation() {
  const calls = jest.mocked(Alert.alert).mock.calls;
  const cancel = calls
    .at(-1)![2]!
    .find(action => action.text === 'Cancel appointment')!;
  await act(async () => {
    await cancel.onPress!();
    await flush();
  });
}

beforeEach(async () => {
  mockPreventRemoveGuards.clear();
  state = createStoreHarness();
  tree = undefined as never;
  writes = [];
  slotRequests = [];
  mode = null;
  failSlotsDate = null;
  failHistory = false;
  patientRecord = testPatientRecord();
  holdPost = undefined;
  holdSlots = undefined;
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  jest.spyOn(Alert, 'alert');
  appointment = {
    id: 'manage-visit',
    patientId: 'patient-one',
    patientName: 'Synthetic Patient',
    patientAge: 32,
    patientGender: 'female',
    dentistId: 'dentist-one',
    clinicId: 'clinic-one',
    clinicName: 'Test clinic',
    date: addDays(dateKey(), 1),
    time: '10:00',
    type: 'clinic',
    status: 'booked',
    concern: 'Test concern',
    painScore: 3,
    swelling: false,
    payment: {
      amountPaise: 50000,
      status: 'due_at_clinic',
      method: 'pay_at_clinic',
    },
  };
  slots = new Map([
    [appointment.date, ['11:00', '12:00']],
    [addDays(appointment.date, 1), ['13:00']],
  ]);
  await session.signIn({
    accessToken: 'synthetic-actions-access',
    refreshToken: 'synthetic-actions-refresh',
    expiresInSeconds: 900,
  });
  api.defaults.adapter = async config => {
    if (config.method === 'get') {
      if (config.url?.startsWith('/dentists/me/patients/')) {
        if (failHistory)
          reject(config, 403, 'Patient history is no longer available.');
        return reply(config, patientRecord);
      }
      if (config.url?.endsWith('/slots')) {
        const request = { ...config.params };
        slotRequests.push(request);
        const available = [...(slots.get(request.date) ?? [])];
        const pending = holdSlots;
        if (pending && pending.date === request.date) await pending.promise;
        if (failSlotsDate === request.date)
          reject(config, 503, 'Availability could not be loaded.');
        return reply(config, { date: request.date, slots: available });
      }
      if (config.url === '/appointments')
        return reply(config, {
          items: config.params.date === appointment.date ? [appointment] : [],
          nextPage: null,
        });
      return reply(config, { ...appointment });
    }
    const path = config.url!;
    const body = JSON.parse(config.data || '{}');
    writes.push({ path, body });
    if (holdPost) await holdPost;
    if (mode === 'offline')
      throw new AxiosError('Offline', 'ERR_NETWORK', config);
    if (mode === 'conflict') {
      if (path.endsWith('/reschedule'))
        slots.set(
          body.date,
          (slots.get(body.date) ?? []).filter(time => time !== body.time),
        );
      reject(config, 409, 'The new slot was just taken.');
    }
    if (path.endsWith('/check-in'))
      appointment = { ...appointment, status: 'waiting' };
    if (path.endsWith('/cancel'))
      appointment = {
        ...appointment,
        status: 'cancelled',
        payment: appointment.payment
          ? { ...appointment.payment, status: 'cancelled' }
          : undefined,
      };
    if (path.endsWith('/reschedule'))
      appointment = { ...appointment, date: body.date, time: body.time };
    if (mode === 'lost-response')
      throw new AxiosError('Response lost', 'ERR_NETWORK', config);
    return reply(config, { ...appointment });
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

test("arrival is limited to today's booked clinic visit and updates the appointment through Axios/Redux", async () => {
  appointment.date = dateKey();
  await mount();
  await press('Mark patient as arrived');
  expect(writes).toEqual([
    { path: '/appointments/manage-visit/check-in', body: {} },
  ]);
  expect(text()).toContain('Patient marked as arrived.');
  expect(button('Mark patient as arrived')).toBeUndefined();
  expect(button('Reschedule appointment')).toBeUndefined();
  expect(button('Cancel appointment')).toBeTruthy();
  expect(
    state.store.getState().dentraApi.queries['getAppointment("manage-visit")']
      ?.data,
  ).toMatchObject({ status: 'waiting' });
});

test('only eligible statuses expose actions, and rescheduling navigates with the appointment ID', async () => {
  expect(
    availableAppointmentActions({
      ...appointment,
      type: 'video',
      date: dateKey(),
    }).checkIn,
  ).toBe(false);
  expect(availableAppointmentActions(appointment).checkIn).toBe(false);
  expect(
    availableAppointmentActions({
      ...appointment,
      date: addDays(dateKey(), -1),
    }).checkIn,
  ).toBe(false);
  for (const status of ['in_consult', 'completed', 'cancelled'] as const)
    expect(availableAppointmentActions({ ...appointment, status })).toEqual({
      checkIn: false,
      reschedule: false,
      cancel: false,
    });
  await mount();
  await press('Reschedule appointment');
  expect(mockNavigate).toHaveBeenCalledWith('RescheduleAppointment', {
    appointmentId: appointment.id,
  });
  expect(writes).toHaveLength(0);
});

test('loads medical history and opens only another completed visit from the patient history', async () => {
  patientRecord = testPatientRecord({
    allergies: 'Synthetic allergy',
    hasAllergies: true,
    conditions: 'Synthetic condition',
    appointments: [
      {
        id: 'past-visit',
        date: '2026-10-12',
        time: '10:30',
        type: 'clinic',
        clinicName: 'Test clinic',
        concern: 'Past concern',
        diagnosis: 'Saved diagnosis',
        status: 'completed',
      },
      {
        id: appointment.id,
        date: appointment.date,
        time: appointment.time,
        type: 'clinic',
        clinicName: 'Test clinic',
        concern: 'Current concern',
        diagnosis: 'Current diagnosis',
        status: 'completed',
      },
      {
        id: 'cancelled-visit',
        date: '2026-10-11',
        time: '11:00',
        type: 'clinic',
        clinicName: 'Test clinic',
        concern: 'Cancelled concern',
        diagnosis: null,
        status: 'cancelled',
      },
    ],
  });
  await mount();
  expect(text()).toContain('Synthetic allergy');
  expect(text()).toContain('Synthetic condition');
  expect(text()).toContain('Saved diagnosis');
  expect(text()).not.toContain('Current diagnosis');
  expect(text()).not.toContain('Cancelled concern');
  await press('View visit from 12 Oct 2026');
  expect(mockNavigate).toHaveBeenCalledWith('Consultation', {
    appointmentId: 'past-visit',
  });
  expect(writes).toHaveLength(0);
});

test('a rejected history refresh hides the cached medical history and supports retry', async () => {
  patientRecord.allergies = 'Synthetic allergy';
  await mount();
  expect(text()).toContain('Synthetic allergy');
  failHistory = true;
  await press('Refresh appointment');
  expect(text()).not.toContain('Synthetic allergy');
  expect(text()).toContain('Patient history is no longer available.');
  failHistory = false;
  await press('Retry patient history');
  expect(text()).toContain('Synthetic allergy');
  expect(writes).toHaveLength(0);
});

test('completed appointments open the saved summary without starting a new consultation', async () => {
  appointment.status = 'completed';
  await mount();
  expect(button('Start consultation')).toBeUndefined();
  expect(button('Cancel appointment')).toBeUndefined();
  await press('View visit summary');
  expect(mockNavigate).toHaveBeenCalledWith('Consultation', {
    appointmentId: appointment.id,
  });
  expect(writes).toHaveLength(0);
});

test('cancellation requires confirmation and rechecks a schedule changed while the confirmation was open', async () => {
  await mount();
  await press('Cancel appointment');
  const keep = jest
    .mocked(Alert.alert)
    .mock.calls.at(-1)![2]!
    .find(action => action.text === 'Keep appointment')!;
  await act(async () => keep.onPress!());
  expect(writes).toHaveLength(0);
  await press('Cancel appointment');
  appointment = { ...appointment, date: addDays(appointment.date, 1) };
  await confirmCancellation();
  expect(writes).toHaveLength(0);
  expect(text()).toContain('This appointment changed.');
  await press('Cancel appointment');
  await confirmCancellation();
  expect(writes).toEqual([
    { path: '/appointments/manage-visit/cancel', body: {} },
  ]);
  expect(text()).toContain('Appointment cancelled.');
  expect(button('Cancel appointment')).toBeUndefined();
});

test.each(['check-in', 'cancel'] as const)(
  'a lost %s response is reconciled without repeating the action',
  async action => {
    appointment.date = dateKey();
    mode = 'lost-response';
    await mount();
    if (action === 'check-in') await press('Mark patient as arrived');
    else {
      await press('Cancel appointment');
      await confirmCancellation();
    }
    expect(writes).toHaveLength(1);
    expect(appointment.status).toBe(
      action === 'cancel' ? 'cancelled' : 'waiting',
    );
    expect(
      button(
        action === 'cancel' ? 'Cancel appointment' : 'Mark patient as arrived',
      ),
    ).toBeUndefined();
  },
);

test('a pending action locks other appointment controls and ignores rapid duplicate taps', async () => {
  appointment.date = dateKey();
  let release!: () => void;
  holdPost = new Promise<void>(resolve => {
    release = resolve;
  });
  await mount();
  const arrive = button('Mark patient as arrived')!.props.onPress;
  let pending: Promise<void>;
  await act(async () => {
    pending = arrive();
    arrive();
    await flush();
  });
  expect(writes).toHaveLength(1);
  expect(mockPreventRemove).toBe(true);
  expect(button('Cancel appointment')!.props.disabled).toBe(true);
  expect(button('Start consultation')!.props.disabled).toBe(true);
  await act(async () => {
    release();
    await pending;
    await flush();
  });
  expect(mockPreventRemove).toBe(false);
});

test('rescheduling uses clinic availability, clears the old time when the day changes, and preserves payment', async () => {
  const original = { ...appointment };
  await mount(true);
  expect(slotRequests[0]).toEqual({
    type: 'clinic',
    clinicId: 'clinic-one',
    date: original.date,
  });
  expect(tree.root.findByType(DateField).props.allowClear).toBe(false);
  await press('New time 11:00 AM');
  await selectDate(addDays(original.date, 1));
  expect(button('Confirm new time')!.props.disabled).toBe(true);
  await press('New time 1:00 PM');
  await press('Confirm new time');
  expect(writes).toEqual([
    {
      path: '/appointments/manage-visit/reschedule',
      body: {
        date: addDays(original.date, 1),
        time: '13:00',
        expectedDate: original.date,
        expectedTime: original.time,
      },
    },
  ]);
  expect(appointment.payment).toEqual(original.payment);
  expect(appointment.clinicId).toBe(original.clinicId);
  expect(text()).toContain('Appointment rescheduled');
  await press('Back to appointment');
  expect(mockGoBack).toHaveBeenCalledTimes(1);
});

test('video availability omits clinicId and empty or failed availability cannot be confirmed', async () => {
  appointment = {
    ...appointment,
    type: 'video',
    clinicId: null,
    clinicName: null,
  };
  failSlotsDate = appointment.date;
  await mount(true);
  expect(slotRequests[0].clinicId).toBeUndefined();
  expect(text()).toContain('Availability could not be loaded.');
  expect(button('Confirm new time')!.props.disabled).toBe(true);
  failSlotsDate = null;
  slots.set(appointment.date, []);
  await press('Reload available times');
  expect(text()).toContain('No available times on this date.');
  expect(writes).toHaveLength(0);
});

test("late availability for the previous day cannot replace the selected day's slots", async () => {
  const oldDate = appointment.date;
  let release!: () => void;
  holdSlots = {
    date: oldDate,
    promise: new Promise<void>(resolve => {
      release = resolve;
    }),
  };
  await mount(true);
  await selectDate(addDays(oldDate, 1));
  await act(async () => {
    release();
    await flush();
  });
  expect(text()).toContain('1:00 PM');
  expect(
    tree.root.findAll(
      node => node.props.accessibilityLabel === 'New time 11:00 AM',
    ),
  ).toHaveLength(0);
});

test('a newly taken slot clears selection, refreshes availability and allows another choice', async () => {
  await mount(true);
  await press('New time 11:00 AM');
  mode = 'conflict';
  await press('Confirm new time');
  expect(text()).toContain('The new slot was just taken.');
  expect(button('Confirm new time')!.props.disabled).toBe(true);
  expect(
    tree.root.findAll(
      node => node.props.accessibilityLabel === 'New time 11:00 AM',
    ),
  ).toHaveLength(0);
  mode = null;
  await press('New time 12:00 PM');
  await press('Confirm new time');
  expect(text()).toContain('Appointment rescheduled');
});

test('an externally moved visit requires review before another reschedule can be submitted', async () => {
  await mount(true);
  await press('New time 11:00 AM');
  appointment = {
    ...appointment,
    date: addDays(appointment.date, 1),
    time: '12:00',
  };
  await act(async () => {
    state.store.dispatch(dentraApi.util.invalidateTags(['Appointments']));
    await flush();
  });
  expect(text()).toContain('This appointment was moved on another device.');
  expect(button('Confirm new time')!.props.disabled).toBe(true);
  await press('Review updated time');
  await press('New time 1:00 PM');
  await press('Confirm new time');
  expect(writes[0].body).toMatchObject({
    expectedDate: appointment.date,
    expectedTime: '12:00',
  });
});

test.each(['offline', 'lost-response'] as const)(
  'rescheduling handles a %s response and keeps a safe retry',
  async failure => {
    await mount(true);
    await press('New time 11:00 AM');
    mode = failure;
    await press('Confirm new time');
    expect(writes).toHaveLength(1);
    if (failure === 'lost-response')
      expect(text()).toContain('Appointment rescheduled');
    else {
      expect(button('Confirm new time')!.props.disabled).toBe(false);
      mode = null;
      await press('Confirm new time');
      expect(text()).toContain('Appointment rescheduled');
    }
  },
);

test('a waiting visit cannot be rescheduled and does not request slots', async () => {
  appointment.status = 'waiting';
  await mount(true);
  expect(slotRequests).toHaveLength(0);
  expect(text()).toContain('This appointment can no longer be rescheduled.');
  expect(button('Confirm new time')).toBeUndefined();
});

test('rescheduling refreshes cached schedules for both the original and new day', async () => {
  const oldDay = appointment.date;
  const newDay = addDays(oldDay, 1);
  const originalPage = state.store.dispatch(
    dentraApi.endpoints.getDayAppointments.initiate({ date: oldDay, page: 1 }),
  );
  const newPage = state.store.dispatch(
    dentraApi.endpoints.getDayAppointments.initiate({ date: newDay, page: 1 }),
  );
  try {
    await Promise.all([originalPage.unwrap(), newPage.unwrap()]);
    await mount(true);
    await selectDate(newDay);
    await press('New time 1:00 PM');
    await press('Confirm new time');
    const originalResult = dentraApi.endpoints.getDayAppointments.select({
      date: oldDay,
      page: 1,
    })(state.store.getState());
    const newResult = dentraApi.endpoints.getDayAppointments.select({
      date: newDay,
      page: 1,
    })(state.store.getState());
    expect(originalResult.data?.items).toHaveLength(0);
    expect(newResult.data?.items.map(item => item.id)).toEqual([
      appointment.id,
    ]);
  } finally {
    originalPage.unsubscribe();
    newPage.unsubscribe();
  }
});
