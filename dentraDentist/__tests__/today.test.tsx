import React from 'react';
import { FlatList, Text } from 'react-native';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { api } from '../src/api/client';
import { session } from '../src/features/auth/session';
import { createStoreHarness } from '../test-utils/store';
import type { Appointment } from '../src/common/types/api';
import { TodayQueue } from '../src/features/today/TodayQueue';
import { TodayOverview } from '../src/features/today/TodayOverview';
import { AppointmentRow } from '../src/components/cards/AppointmentRow';
import { Button } from '../src/components/ui/Button';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useNavigation: () => ({ navigate: mockNavigate }),
}));
const appointment: Appointment = {
  id: 'later',
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
let tree: ReactTestRenderer, state: ReturnType<typeof createStoreHarness>;
let pages: Appointment[][], failSecond: boolean, calls: number[];
function reply(
  config: InternalAxiosRequestConfig,
  items: Appointment[],
  nextPage: number | null,
) {
  return {
    config,
    data: { items, nextPage },
    status: 200,
    statusText: 'OK',
    headers: {},
  };
}
async function flush() {
  for (let i = 0; i < 8; i++)
    await new Promise<void>(resolve => setImmediate(resolve));
}
async function mount() {
  await act(async () => {
    tree = Renderer.create(
      state.wrap(
        <TodayQueue
          date="2026-10-24"
          dentistName="Dr. Ananya Kapoor"
          hour={9}
        />,
      ),
    );
    await flush();
  });
}
function text() {
  return tree.root
    .findAllByType(Text)
    .flatMap(node => node.props.children)
    .flat(Infinity)
    .join(' ');
}
async function press(label: string) {
  await act(async () => {
    tree.root
      .findAll(node => typeof node.props.onPress === 'function')
      .find(node => node.props.accessibilityLabel === label)!
      .props.onPress();
    await flush();
  });
}
beforeEach(async () => {
  state = createStoreHarness();
  tree = undefined as never;
  calls = [];
  failSecond = false;
  mockNavigate.mockClear();
  await session.signIn({
    accessToken: 'synthetic-access',
    refreshToken: 'synthetic-refresh',
    expiresInSeconds: 900,
  });
  pages = [
    [
      appointment,
      { ...appointment, id: 'completed', time: '11:00', status: 'completed' },
      { ...appointment, id: 'cancelled', status: 'cancelled' },
    ],
    [
      {
        ...appointment,
        id: 'waiting',
        time: '10:00',
        status: 'waiting',
        swelling: true,
      },
      { ...appointment, id: 'earliest', time: '09:00' },
    ],
  ];
  api.defaults.adapter = async config => {
    const page = config.params.page as number;
    calls.push(page);
    if (failSecond && page === 2)
      throw new AxiosError('Offline', 'ERR_NETWORK');
    return reply(
      config,
      pages[page - 1],
      page < pages.length ? page + 1 : null,
    );
  };
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  state.cleanup();
  await session.clear();
});

test('uses the complete day for counts and waiting priority, with the queue in chronological order', async () => {
  // A new booking between paginated reads can repeat a row on the next page.
  pages[1].push(appointment);
  await mount();
  expect(calls).toEqual([1, 2]);
  const overview = tree.root.findByType(TodayOverview);
  expect(overview.props).toMatchObject({
    total: 4,
    waiting: 1,
    completed: 1,
    next: { id: 'waiting' },
  });
  expect(
    tree.root
      .findAllByType(AppointmentRow)
      .map(row => row.props.appointment.id),
  ).toEqual(['earliest', 'waiting', 'completed', 'later']);
  expect(text()).toContain('Good morning, Dr. Kapoor');
  expect(text()).toContain('Synthetic Patient is waiting');
  expect(text()).toContain('Swelling reported');
  await press('Open appointment');
  expect(mockNavigate).toHaveBeenCalledWith('Appointment', {
    appointmentId: 'waiting',
  });
});

test('prioritizes the active consultation and continues it through the consultation route', async () => {
  pages[0][0] = { ...appointment, status: 'in_consult' };
  await mount();
  await press('Continue consultation');
  expect(mockNavigate).toHaveBeenCalledWith('Consultation', {
    appointmentId: appointment.id,
  });
});

test('shows the prototype empty and all-completed states and opens Schedule', async () => {
  pages = [[]];
  await mount();
  expect(text()).toContain('No patients today');
  await press('View schedule');
  expect(mockNavigate).toHaveBeenCalledWith('Home', { screen: 'Schedule' });
  pages = [[{ ...appointment, status: 'completed' }]];
  await act(async () => {
    await tree.root.findByType(FlatList).props.onRefresh();
    await flush();
  });
  expect(text()).toContain('All done for today');
  expect(text()).not.toContain('No patients today');
});

test('does not show partial totals or the wrong next patient if a later page fails; retry loads the whole day', async () => {
  failSecond = true;
  await mount();
  expect(text()).toContain('Could not load today’s appointments');
  expect(tree.root.findAllByType(TodayOverview)).toHaveLength(0);
  expect(tree.root.findAllByType(AppointmentRow)).toHaveLength(0);
  failSecond = false;
  await act(async () => {
    await tree.root.findByType(Button).props.onPress();
    await flush();
  });
  expect(tree.root.findByType(TodayOverview).props.next.id).toBe('waiting');
  expect(calls).toEqual([1, 2, 1, 2]);
});
