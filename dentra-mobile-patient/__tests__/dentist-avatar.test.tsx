import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import FastImage from 'react-native-fast-image';
import { Text } from 'react-native';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { DentistAvatar } from '../src/components/dentist-avatar';
import { AppointmentCard } from '../src/components/appointment-card';
import { baseApi } from '../src/api/base-api';
import authReducer from '../src/store/auth-slice';
import type { Appointment } from '../src/api/types';

jest.mock('../src/auth/session', () => ({ refreshSession: jest.fn() }));
const originalFetch = globalThis.fetch;
const mockFetch = jest.fn();
let tree: ReactTestRenderer;
let store: ReturnType<typeof makeStore>;
function makeStore() {
  return configureStore({
    reducer: { auth: authReducer, [baseApi.reducerPath]: baseApi.reducer },
    middleware: defaults => defaults().concat(baseApi.middleware),
    enhancers: defaults => defaults({ autoBatch: false }),
  });
}
const appointment: Appointment = {
  id: 'next-visit',
  dentistId: 'dentist-one',
  dentistName: 'Dr. Test Dentist',
  date: '2026-11-18',
  time: '17:10',
  status: 'booked',
  type: 'video',
  concern: 'Toothache',
};
const photo = '/profile-photos/dentist/one?signature=synthetic';
const profileResponse = (url = photo) =>
  new Response(
    JSON.stringify({
      id: 'dentist-one',
      fullName: 'Dr. Test Dentist',
      profilePhotoUrl: url,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
async function flush() {
  for (let i = 0; i < 8; i++) {
    await jest.advanceTimersByTimeAsync(0);
    await new Promise<void>(resolve => setImmediate(resolve));
  }
}
async function render(content: React.ReactNode) {
  await act(async () => {
    const view = <Provider store={store}>{content}</Provider>;
    if (tree) tree.update(view);
    else tree = Renderer.create(view);
    await flush();
  });
}
beforeEach(() => {
  jest.useFakeTimers({
    doNotFake: ['setImmediate', 'queueMicrotask', 'nextTick'],
  });
  tree = undefined as never;
  store = makeStore();
  mockFetch.mockReset().mockImplementation(async () => profileResponse());
  globalThis.fetch = mockFetch;
});
afterEach(async () => {
  await act(async () => {
    tree?.unmount();
  });
  await act(async () => {
    store.dispatch(baseApi.util.resetApiState());
    await flush();
  });
  globalThis.fetch = originalFetch;
  jest.clearAllTimers();
  jest.useRealTimers();
});

test('Home appointment cards share one profile request when the appointment response omits the photo', async () => {
  await render(
    <>
      <AppointmentCard appointment={appointment} onPress={jest.fn()} />
      <AppointmentCard
        appointment={{
          ...appointment,
          id: 'latest-visit',
          status: 'completed',
        }}
        onPress={jest.fn()}
      />
    </>,
  );
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(new URL(mockFetch.mock.calls[0][0].url).pathname).toBe(
    '/dentists/dentist-one',
  );
  expect(
    tree.root.findAllByType(FastImage).map(node => node.props.source.uri),
  ).toEqual([expect.stringContaining(photo), expect.stringContaining(photo)]);
});

test('uses an appointment photo directly and does not fetch another profile', async () => {
  await render(
    <AppointmentCard
      appointment={{ ...appointment, dentistPhotoUrl: photo }}
      onPress={jest.fn()}
    />,
  );
  expect(tree.root.findByType(FastImage).props.source.uri).toContain(photo);
  expect(mockFetch).not.toHaveBeenCalled();
});

test('respects an explicitly removed photo and does not restore it from the profile', async () => {
  await render(
    <DentistAvatar
      dentistId="dentist-one"
      name="Test Dentist"
      photoUrl={null}
    />,
  );
  expect(tree.root.findAllByType(FastImage)).toHaveLength(0);
  expect(mockFetch).not.toHaveBeenCalled();
  expect(tree.root.findByType(Text).props.children).toBe('TD');
});

test('keeps initials and the appointment usable if the profile lookup fails', async () => {
  mockFetch.mockImplementation(
    async () =>
      new Response(JSON.stringify({ message: 'Unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  await render(
    <AppointmentCard appointment={appointment} onPress={jest.fn()} />,
  );
  expect(tree.root.findAllByType(FastImage)).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).toContain('Toothache');
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

test('does not show a previous dentist photo while another dentist profile is loading', async () => {
  await render(<DentistAvatar dentistId="dentist-one" name="First Dentist" />);
  expect(tree.root.findByType(FastImage).props.source.uri).toContain(photo);
  let reply: (value: Response) => void = () => {};
  mockFetch.mockImplementationOnce(
    () =>
      new Promise<Response>(resolve => {
        reply = resolve;
      }),
  );
  await render(<DentistAvatar dentistId="dentist-two" name="Second Dentist" />);
  expect(tree.root.findAllByType(FastImage)).toHaveLength(0);
  expect(tree.root.findByType(Text).props.children).toBe('SD');
  await act(async () => {
    reply(profileResponse('/profile-photos/dentist/two'));
    await flush();
  });
  expect(tree.root.findByType(FastImage).props.source.uri).toContain(
    '/profile-photos/dentist/two',
  );
});
