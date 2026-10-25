import { createStoreHarness } from '../test-utils/store';
import React from 'react';
import { FlatList, Text } from 'react-native';
import ReactTestRenderer, {
  act,
  type ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { type InternalAxiosRequestConfig } from 'axios';
import { api } from '../src/api/client';
import { session } from '../src/features/auth/session';
import { DayAppointments } from '../src/features/appointments/DayAppointments';
import { AppointmentCard } from '../src/components/cards/AppointmentCard';
import { Button } from '../src/components/ui/Button';
import type { Appointment } from '../src/common/types/api';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useNavigation: () => ({ navigate: mockNavigate }),
}));
const appointment: Appointment = {
  id: 'visit-one',
  patientId: 'patient-one',
  patientName: 'Patient One',
  patientAge: 30,
  patientGender: 'female',
  type: 'video',
  date: '2026-10-18',
  time: '10:00',
  status: 'waiting',
  concern: 'Toothache',
  painScore: 8,
  swelling: false,
};
let renderer: Renderer;
let state: ReturnType<typeof createStoreHarness>;
function response(
  config: InternalAxiosRequestConfig,
  items: Appointment[],
  nextPage: number | null = null,
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
  for (let n = 0; n < 5; n++)
    await new Promise<void>(resolve => setImmediate(resolve));
}
beforeEach(async () => {
  state = createStoreHarness();
  await session.signIn({
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresInSeconds: 900,
  });
  jest.clearAllMocks();
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  state.cleanup();
  await session.clear();
});

test('loads a selected day, paginates and resets to page one when the day changes', async () => {
  const calls: { date: string; page: number }[] = [];
  api.defaults.adapter = async config => {
    calls.push(config.params);
    return response(
      config,
      [
        {
          ...appointment,
          id: config.params.page === 1 ? 'visit-one' : 'visit-two',
        },
      ],
      config.params.page === 1 ? 2 : null,
    );
  };
  await act(async () => {
    renderer = ReactTestRenderer.create(
      state.wrap(<DayAppointments key="2026-10-18" date="2026-10-18" />),
    );
    await flush();
  });
  expect(
    renderer.root
      .findAllByType(AppointmentCard)
      .map(node => node.props.appointment.id),
  ).toEqual(['visit-one']);
  await act(async () => {
    renderer.root
      .findAllByType(Button)
      .find(node => node.props.title === 'Next')!
      .props.onPress();
    await flush();
  });
  expect(calls.at(-1)).toEqual({ date: '2026-10-18', page: 2 });
  expect(
    renderer.root
      .findAllByType(AppointmentCard)
      .map(node => node.props.appointment.id),
  ).toEqual(['visit-two']);
  await act(async () => {
    renderer.update(
      state.wrap(<DayAppointments key="2026-10-19" date="2026-10-19" />),
    );
    await flush();
  });
  expect(calls.at(-1)).toEqual({ date: '2026-10-19', page: 1 });
});

test('a late response for a previous day cannot overwrite the current day', async () => {
  let finish!: () => void;
  const pending = new Promise<void>(resolve => {
    finish = resolve;
  });
  api.defaults.adapter = async config => {
    if (config.params.date === '2026-10-18') {
      await pending;
      return response(config, [appointment]);
    }
    return response(config, [
      { ...appointment, id: 'new-day-visit', patientName: 'Patient Two' },
    ]);
  };
  await act(async () => {
    renderer = ReactTestRenderer.create(
      state.wrap(<DayAppointments key="old" date="2026-10-18" />),
    );
    await flush();
  });
  await act(async () => {
    renderer.update(
      state.wrap(<DayAppointments key="new" date="2026-10-19" />),
    );
    await flush();
  });
  await act(async () => {
    finish();
    await flush();
  });
  expect(
    renderer.root
      .findAllByType(AppointmentCard)
      .map(node => node.props.appointment.id),
  ).toEqual(['new-day-visit']);
});

test('today hides cancelled appointments, surfaces severe pain and opens details using only the id', async () => {
  api.defaults.adapter = async config =>
    response(config, [
      appointment,
      { ...appointment, id: 'cancelled', status: 'cancelled' },
    ]);
  await act(async () => {
    renderer = ReactTestRenderer.create(
      state.wrap(<DayAppointments date="2026-10-18" today />),
    );
    await flush();
  });
  const cards = renderer.root.findAllByType(AppointmentCard);
  expect(cards).toHaveLength(1);
  expect(
    renderer.root
      .findAllByType(Text)
      .some(node => node.props.children === 'Patient reported severe pain'),
  ).toBe(true);
  await act(async () => cards[0].props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith('Appointment', {
    appointmentId: 'visit-one',
  });
});

test('pull to refresh reloads the current page', async () => {
  let count = 0;
  api.defaults.adapter = async config => {
    count++;
    return response(config, count === 1 ? [] : [appointment]);
  };
  await act(async () => {
    renderer = ReactTestRenderer.create(
      state.wrap(<DayAppointments date="2026-10-18" />),
    );
    await flush();
  });
  expect(renderer.root.findAllByType(AppointmentCard)).toHaveLength(0);
  await act(async () => {
    renderer.root.findByType(FlatList).props.onRefresh();
    await flush();
  });
  expect(renderer.root.findAllByType(AppointmentCard)).toHaveLength(1);
});
