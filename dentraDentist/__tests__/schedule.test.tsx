import React from 'react';
import { FlatList, Text } from 'react-native';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { api } from '../src/api/client';
import { session } from '../src/features/auth/session';
import { createStoreHarness } from '../test-utils/store';
import { dentraApi } from '../src/store/dentraApi';
import { inboxReceived } from '../src/store/notificationsSlice';
import type { Appointment, Dentist } from '../src/common/types/api';
import type { TimeOff } from '../src/common/types/availability';
import { ScheduleScreen } from '../src/features/schedule/ScheduleScreen';
import { ScheduleDays } from '../src/features/schedule/ScheduleDays';
import { AppointmentRow } from '../src/components/cards/AppointmentRow';
import { Button } from '../src/components/ui/Button';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('../src/common/utils/date', () => ({
  ...jest.requireActual('../src/common/utils/date'),
  dateKey: () => '2026-10-24',
}));
jest.mock('../src/features/notifications/NotificationBell', () => ({
  NotificationBell: () => null,
}));

let tree: ReactTestRenderer, state: ReturnType<typeof createStoreHarness>;
let dentist: Dentist, leaves: TimeOff[], days: Record<string, Appointment[][]>;
let requests: { path: string; date?: string; page?: number }[], fail: boolean;
let waitForWeek: Promise<void> | undefined;
const visit: Appointment = {
  id: 'late',
  patientId: 'patient-one',
  patientName: 'Synthetic Patient',
  patientAge: 30,
  patientGender: 'female',
  type: 'video',
  date: '2026-10-24',
  time: '17:00',
  status: 'booked',
  concern: 'Toothache',
  painScore: 2,
  swelling: false,
};
async function flush() {
  for (let i = 0; i < 10; i++)
    await new Promise<void>(resolve => setImmediate(resolve));
}
function reply(config: InternalAxiosRequestConfig, data: unknown) {
  return { config, data, status: 200, statusText: 'OK', headers: {} };
}
async function mount() {
  await state.store.dispatch(
    dentraApi.util.upsertQueryData('getDentist', undefined, dentist),
  );
  await act(async () => {
    tree = Renderer.create(state.wrap(<ScheduleScreen />));
    await flush();
  });
}
function text() {
  return tree.root
    .findAllByType(Text)
    .flatMap(node => node.props.children)
    .flat(Infinity)
    .join(' ')
    .replace(/\s+/g, ' ');
}
function ids() {
  return tree.root
    .findAllByType(AppointmentRow)
    .map(row => row.props.appointment.id);
}
async function press(label: string) {
  await act(async () => {
    tree.root
      .findAll(node => typeof node.props.onPress === 'function')
      .find(node => node.props.accessibilityLabel?.startsWith(label))!
      .props.onPress();
    await flush();
  });
}
beforeEach(async () => {
  state = createStoreHarness();
  tree = undefined as never;
  requests = [];
  leaves = [];
  fail = false;
  waitForWeek = undefined;
  mockNavigate.mockClear();
  await session.signIn({
    accessToken: 'synthetic-access',
    refreshToken: 'synthetic-refresh',
    expiresInSeconds: 900,
  });
  dentist = {
    id: 'dentist-one',
    fullName: 'Synthetic Dentist',
    mobile: '+919000000000',
    status: 'verified',
    qualification: 'BDS',
    specialization: 'General',
    councilRegNo: 'SYNTHETIC',
    yearsExperience: 5,
    languages: ['English'],
    offersVideo: true,
    videoWorkingDays: [0, 1, 2, 3, 4, 5, 6],
    feeVideoPaise: 10000,
    feeClinicPaise: 10000,
    clinics: [
      {
        id: 'clinic-one',
        name: 'Synthetic Clinic',
        hoursFrom: '10:00',
        hoursTo: '18:00',
        workingDays: [1, 2, 3, 4, 5, 6],
      },
    ],
    documents: [],
  };
  days = {
    '2026-10-24': [
      [visit, { ...visit, id: 'cancelled', status: 'cancelled' }],
      [{ ...visit, id: 'early', time: '09:00', swelling: true }, visit],
    ],
    '2026-10-25': [[{ ...visit, date: '2026-10-25', id: 'sunday' }]],
    '2026-11-07': [[{ ...visit, date: '2026-11-07', id: 'later-week' }]],
  };
  api.defaults.adapter = async config => {
    requests.push({
      path: config.url!,
      date: config.params?.date,
      page: config.params?.page,
    });
    if (config.url === '/dentists/me') return reply(config, dentist);
    if (config.url === '/dentists/me/time-off') return reply(config, leaves);
    const date = config.params.date as string,
      page = config.params.page as number;
    if (waitForWeek && date >= '2026-10-31' && date <= '2026-11-06')
      await waitForWeek;
    if (fail) throw new AxiosError('Synthetic offline', 'ERR_NETWORK');
    const pages = days[date] ?? [[]];
    return reply(config, {
      items: pages[page - 1],
      nextPage: page < pages.length ? page + 1 : null,
    });
  };
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  state.cleanup();
  await session.clear();
});

test('shows complete day counts, compact chronological rows and hides cancelled bookings', async () => {
  await mount();
  expect(new Set(requests.filter(r => r.date).map(r => r.date)).size).toBe(7);
  expect(ids()).toEqual(['early', 'late']);
  expect(text()).toContain('1 cancelled appointment hidden.');
  expect(text()).toContain('Swelling reported');
  expect(
    tree.root.findAll(
      node =>
        node.props.accessibilityLabel === 'Today, 24 Oct 2026, 2 appointments',
    ).length,
  ).toBeGreaterThan(0);
  await press('Tomorrow,');
  expect(ids()).toEqual(['sunday']);
  await act(async () => tree.root.findByType(AppointmentRow).props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith('Appointment', {
    appointmentId: 'sunday',
  });
});

test('uses saved video and clinic days and all-day leave without hiding existing bookings', async () => {
  dentist.offersVideo = false;
  leaves = [
    {
      id: 'leave',
      startDate: '2026-10-28',
      endDate: '2026-10-28',
      allDay: true,
      fromTime: null,
      toTime: null,
      reason: 'Synthetic',
    },
  ];
  await mount();
  // Sunday remains visible when an earlier booking exists, even if hours changed later.
  await press('Tomorrow,');
  expect(ids()).toEqual(['sunday']);
  await act(async () => {
    tree.root.findByType(ScheduleDays).props.onSelect('2026-10-28');
    await flush();
  });
  expect(text()).toContain('You have all-day time off on this date.');
  days['2026-10-25'] = [[]];
  await act(async () => {
    await tree.root.findByType(FlatList).props.onRefresh();
    await flush();
  });
  await press('Tomorrow,');
  expect(text()).toContain('No consultation hours are set for this day.');
  expect(ids()).toEqual([]);
});

test('allows an empty Sunday when video hours are enabled on Sunday', async () => {
  days['2026-10-25'] = [[]];
  await mount();
  await press('Tomorrow,');
  expect(text()).toContain('No appointments tomorrow.');
  expect(text()).not.toContain('No consultation hours');
  expect(
    tree.root.findAll(
      node =>
        node.props.accessibilityLabel ===
        'Tomorrow, 25 Oct 2026, 0 appointments',
    ).length,
  ).toBeGreaterThan(0);
});

test('week navigation hides the previous week while loading and ignores a late older response', async () => {
  await mount();
  let release!: () => void;
  waitForWeek = new Promise<void>(resolve => {
    release = resolve;
  });
  await press('Next week');
  expect(ids()).toEqual([]);
  await press('Next week');
  expect(ids()).toEqual(['later-week']);
  await act(async () => {
    release();
    await flush();
  });
  expect(ids()).toEqual(['later-week']);
  await press('Return to today');
  expect(ids()).toEqual(['early', 'late']);
  expect(tree.root.findByType(ScheduleDays).props.selectedDate).toBe(
    '2026-10-24',
  );
});

test('failed reads show a retry instead of false empty data; booking updates refresh the week', async () => {
  fail = true;
  await mount();
  expect(text()).toContain('Could not load schedule');
  expect(ids()).toEqual([]);
  fail = false;
  await act(async () => {
    await tree.root.findByType(Button).props.onPress();
    await flush();
  });
  expect(ids()).toEqual(['early', 'late']);
  days['2026-10-24'][0].push({ ...visit, id: 'new', time: '08:00' });
  await act(async () => {
    state.store.dispatch(inboxReceived([]));
    state.store.dispatch(
      inboxReceived([
        {
          id: 'new-booking',
          type: 'appointment_booked',
          appointmentId: 'new',
          patientName: 'Synthetic Patient',
          date: '2026-10-24',
          time: '08:00',
          appointmentType: 'video',
          createdAt: '2026-10-24T00:00:00Z',
          readAt: null,
        },
      ]),
    );
    await flush();
  });
  expect(ids()).toEqual(['new', 'early', 'late']);
});
