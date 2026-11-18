import React from 'react';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { AppState, type AppStateStatus } from 'react-native';
import { useNotificationSync } from '../src/hooks/use-notification-sync';
import { apiCache } from '../src/api/cache';
import { baseApi } from '../src/api/base-api';
import { store } from '../src/store/store';
import type { PushState } from '../src/notifications/push-manager';

jest.mock('../src/auth/session', () => ({ refreshSession: jest.fn() }));
const originalFetch = globalThis.fetch;
const mockFetch = jest.fn();
let tree: ReactTestRenderer;
let foreground: (value: AppStateStatus) => void;
function Probe({ state }: { state: PushState }) {
  useNotificationSync(state);
  return null;
}
const view = (state: PushState) => (
  <Provider store={store}>
    <Probe state={state} />
  </Provider>
);
async function settle() {
  await act(async () => {
    await new Promise<void>(resolve => setImmediate(resolve));
  });
}
async function advance(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
  await settle();
}
beforeEach(() => {
  jest.useFakeTimers({
    doNotFake: ['setImmediate', 'queueMicrotask', 'nextTick'],
  });
  jest.clearAllMocks();
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, callback) => {
      foreground = callback;
      return { remove: jest.fn() };
    });
  store.dispatch(baseApi.util.resetApiState());
  mockFetch.mockImplementation(
    async () =>
      new Response(
        JSON.stringify({ items: [], nextCursor: null, unreadCount: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
  );
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

test('registered push makes one initial inbox request, then refreshes on delivery without periodic requests', async () => {
  await act(async () => {
    tree = Renderer.create(view('enabled'));
  });
  await settle();
  expect(mockFetch).toHaveBeenCalledTimes(1);
  await advance(35000);
  expect(mockFetch).toHaveBeenCalledTimes(1);
  await act(async () => {
    store.dispatch(apiCache.invalidateTags(['Notifications']));
  });
  await settle();
  expect(mockFetch).toHaveBeenCalledTimes(2);
  await advance(30000);
  expect(mockFetch).toHaveBeenCalledTimes(2);
  await act(async () => foreground('background'));
  await advance(30000);
  expect(mockFetch).toHaveBeenCalledTimes(2);
  await act(async () => foreground('active'));
  await settle();
  expect(mockFetch).toHaveBeenCalledTimes(3);
  await advance(30000);
  expect(mockFetch).toHaveBeenCalledTimes(3);
});

test('registration success cancels an existing poll and a push failure restores foreground polling', async () => {
  await act(async () => {
    tree = Renderer.create(view('error'));
  });
  await settle();
  await advance(10000);
  expect(mockFetch).toHaveBeenCalledTimes(2);
  await act(async () => tree.update(view('enabled')));
  await advance(30000);
  expect(mockFetch).toHaveBeenCalledTimes(2);
  await act(async () => tree.update(view('error')));
  await advance(10000);
  expect(mockFetch).toHaveBeenCalledTimes(3);
  await act(async () => foreground('background'));
  await advance(30000);
  expect(mockFetch).toHaveBeenCalledTimes(3);
  await act(async () => foreground('active'));
  await settle();
  expect(mockFetch).toHaveBeenCalledTimes(4);
});
