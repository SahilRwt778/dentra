import React, { createContext } from 'react';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { AppState, type AppStateStatus } from 'react-native';
import { useAppointmentQuery } from '../src/api/appointments';
import { useAppointments } from '../src/hooks/use-appointments';
import { useAppointmentQueryOptions } from '../src/hooks/use-appointment-query-options';
import { PushContext } from '../src/notifications/push-context';
import type { PushState } from '../src/notifications/push-manager';
import { apiCache } from '../src/api/cache';
import { baseApi } from '../src/api/base-api';
import { store } from '../src/store/store';

jest.mock('../src/auth/session', () => ({ refreshSession: jest.fn() }));
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => require('react').useContext(mockFocusContext),
}));

const mockFocusContext = createContext(true);
const originalFetch = globalThis.fetch;
const mockFetch = jest.fn();
const foregroundListeners = new Set<(value: AppStateStatus) => void>();
let tree: ReactTestRenderer;

function List() {
  useAppointments();
  return null;
}
function Detail({ confirmingPayment }: { confirmingPayment: boolean }) {
  const options = useAppointmentQueryOptions({
    awaitingPaymentConfirmation: confirmingPayment,
  });
  useAppointmentQuery('test-appointment', options);
  return null;
}
function view({
  pushState = 'enabled',
  listFocused = true,
  detailFocused,
  confirmingPayment = false,
}: {
  pushState?: PushState;
  listFocused?: boolean;
  detailFocused?: boolean;
  confirmingPayment?: boolean;
} = {}) {
  return (
    <Provider store={store}>
      <PushContext.Provider
        value={{ state: pushState, enable: async () => {} }}
      >
        <mockFocusContext.Provider value={listFocused}>
          <List />
        </mockFocusContext.Provider>
        {detailFocused !== undefined && (
          <mockFocusContext.Provider value={detailFocused}>
            <Detail confirmingPayment={confirmingPayment} />
          </mockFocusContext.Provider>
        )}
      </PushContext.Provider>
    </Provider>
  );
}
const requests = (path: string) =>
  mockFetch.mock.calls.filter(([request]: [Request]) =>
    new URL(request.url).pathname.endsWith(path),
  ).length;
async function settle() {
  await act(async () => {
    await new Promise<void>(resolve => setImmediate(resolve));
  });
}
async function advance(ms: number) {
  await act(async () => jest.advanceTimersByTimeAsync(ms));
  await settle();
}
async function changeAppState(state: AppStateStatus) {
  await act(async () =>
    foregroundListeners.forEach(listener => listener(state)),
  );
  await settle();
}
beforeEach(() => {
  jest.useFakeTimers({
    doNotFake: ['setImmediate', 'queueMicrotask', 'nextTick'],
  });
  jest.clearAllMocks();
  foregroundListeners.clear();
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, callback) => {
      foregroundListeners.add(callback);
      return { remove: () => foregroundListeners.delete(callback) };
    });
  store.dispatch(baseApi.util.resetApiState());
  mockFetch.mockImplementation(async (request: Request) => {
    const appointment = { id: 'test-appointment', status: 'booked' };
    return new Response(
      JSON.stringify(
        new URL(request.url).pathname.endsWith('/appointments')
          ? { items: [appointment], nextPage: null }
          : appointment,
      ),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  });
  globalThis.fetch = mockFetch;
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  store.dispatch(baseApi.util.resetApiState());
  globalThis.fetch = originalFetch;
  jest.restoreAllMocks();
  jest.clearAllTimers();
  jest.useRealTimers();
});

test('registered push stops routine requests; a push update refreshes only the visible appointment', async () => {
  await act(async () => {
    tree = Renderer.create(view());
  });
  await settle();
  await advance(45000);
  expect(requests('/appointments')).toBe(1);

  await act(async () =>
    tree.update(view({ listFocused: false, detailFocused: true })),
  );
  await settle();
  await advance(45000);
  expect(requests('/appointments')).toBe(1);
  expect(requests('/test-appointment')).toBe(1);

  await act(async () => {
    store.dispatch(apiCache.invalidateTags(['Appointments']));
  });
  await settle();
  expect(requests('/appointments')).toBe(1);
  expect(requests('/test-appointment')).toBe(2);

  await act(async () => tree.update(view({ detailFocused: false })));
  await settle();
  expect(requests('/appointments')).toBe(2);
  await advance(30000);
  expect(requests('/test-appointment')).toBe(2);
  expect(requests('/appointments')).toBe(2);
});

test('fallback polling stops behind another screen and in the background, then refreshes on return', async () => {
  await act(async () => {
    tree = Renderer.create(view({ pushState: 'error' }));
  });
  await settle();
  await advance(15000);
  expect(requests('/appointments')).toBe(2);

  await act(async () =>
    tree.update(
      view({ pushState: 'error', listFocused: false, detailFocused: true }),
    ),
  );
  await settle();
  await advance(15000);
  expect(requests('/appointments')).toBe(2);
  expect(requests('/test-appointment')).toBe(2);

  await changeAppState('background');
  await advance(45000);
  expect(requests('/appointments')).toBe(2);
  expect(requests('/test-appointment')).toBe(2);
  await changeAppState('active');
  expect(requests('/test-appointment')).toBe(3);
});

test('payment confirmation keeps its short polling even with push, pauses in background, and stops after confirmation', async () => {
  const options = {
    listFocused: false,
    detailFocused: true,
    confirmingPayment: true,
  };
  await act(async () => {
    tree = Renderer.create(view(options));
  });
  await settle();
  await advance(3000);
  expect(requests('/test-appointment')).toBe(2);
  expect(requests('/appointments')).toBe(0);
  await changeAppState('inactive');
  await advance(15000);
  expect(requests('/test-appointment')).toBe(2);
  await changeAppState('active');
  expect(requests('/test-appointment')).toBe(3);
  await act(async () =>
    tree.update(view({ ...options, confirmingPayment: false })),
  );
  await advance(30000);
  expect(requests('/test-appointment')).toBe(3);
});

test('successful push registration cancels an existing appointment polling timer', async () => {
  await act(async () => {
    tree = Renderer.create(view({ pushState: 'off' }));
  });
  await settle();
  await advance(15000);
  expect(requests('/appointments')).toBe(2);
  await act(async () => tree.update(view()));
  await advance(45000);
  expect(requests('/appointments')).toBe(2);
});
