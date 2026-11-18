import React from 'react';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { AppState, Text, type AppStateStatus } from 'react-native';
import type { ConsultationCaseQuery } from '@dentra/call-core';
import { useConversationInbox } from '../src/hooks/use-conversation-inbox';
import { PushContext } from '../src/notifications/push-context';
import type { PushState } from '../src/notifications/push-manager';
import { apiCache } from '../src/api/cache';
import { baseApi } from '../src/api/base-api';
import { store } from '../src/store/store';

jest.mock('../src/auth/session', () => ({ refreshSession: jest.fn() }));
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockFocused,
}));
let mockFocused = true;
const originalFetch = globalThis.fetch;
const mockFetch = jest.fn();
const listeners = new Set<(value: AppStateStatus) => void>();
let tree: ReactTestRenderer;

function Inbox({ query }: { query?: ConsultationCaseQuery }) {
  const result = useConversationInbox(query);
  return (
    <Text>
      {result.currentData?.items
        .map(item => (item.canMessage ? 'Open' : 'Closed'))
        .join(',')}
    </Text>
  );
}
function view({
  pushState = 'enabled',
  badge = false,
}: { pushState?: PushState; badge?: boolean } = {}) {
  return (
    <Provider store={store}>
      <PushContext.Provider
        value={{ state: pushState, enable: async () => {} }}
      >
        {badge && <Inbox />}
        <Inbox query={{ page: 1, filter: 'all' }} />
      </PushContext.Provider>
    </Provider>
  );
}
async function settle() {
  await act(async () => {
    await new Promise<void>(resolve => setImmediate(resolve));
    await jest.advanceTimersByTimeAsync(20);
  });
}
async function advance(ms: number) {
  await act(async () => jest.advanceTimersByTimeAsync(ms));
  await settle();
}
async function appState(state: AppStateStatus) {
  await act(async () => listeners.forEach(listener => listener(state)));
  await settle();
}
beforeEach(() => {
  jest.useFakeTimers({
    doNotFake: ['setImmediate', 'queueMicrotask', 'nextTick'],
  });
  jest.clearAllMocks();
  mockFocused = true;
  listeners.clear();
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, listener) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    });
  store.dispatch(baseApi.util.resetApiState());
  mockFetch.mockImplementation(
    async () =>
      new Response(
        JSON.stringify({ items: [], nextPage: null, unreadCount: 0 }),
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

test('badge and All inbox share one request; registered push refreshes their data without polling', async () => {
  await act(async () => {
    tree = Renderer.create(view({ badge: true }));
  });
  await settle();
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(
    new URL((mockFetch.mock.calls[0][0] as Request).url).searchParams.get(
      'filter',
    ),
  ).toBe('all');
  await advance(35000);
  expect(mockFetch).toHaveBeenCalledTimes(1);
  await act(async () => {
    store.dispatch(apiCache.invalidateTags(['Consultation Cases']));
  });
  await settle();
  expect(mockFetch).toHaveBeenCalledTimes(2);
  await advance(30000);
  expect(mockFetch).toHaveBeenCalledTimes(2);
});

test('fallback polling stops after registration and while hidden, then refreshes on screen return', async () => {
  await act(async () => {
    tree = Renderer.create(view({ pushState: 'off' }));
  });
  await settle();
  await advance(10000);
  expect(mockFetch).toHaveBeenCalledTimes(2);
  await act(async () => tree.update(view()));
  await advance(30000);
  expect(mockFetch).toHaveBeenCalledTimes(2);
  await act(async () => tree.update(view({ pushState: 'error' })));
  await advance(10000);
  expect(mockFetch).toHaveBeenCalledTimes(3);
  mockFocused = false;
  await act(async () => tree.update(view({ pushState: 'error' })));
  await advance(30000);
  expect(mockFetch).toHaveBeenCalledTimes(3);
  mockFocused = true;
  await act(async () => tree.update(view({ pushState: 'error' })));
  await settle();
  expect(mockFetch).toHaveBeenCalledTimes(4);
});

test('backgrounding cancels fallback requests and resuming fetches fresh conversation data', async () => {
  await act(async () => {
    tree = Renderer.create(view({ pushState: 'denied' }));
  });
  await settle();
  expect(mockFetch).toHaveBeenCalledTimes(1);
  await appState('background');
  await advance(35000);
  expect(mockFetch).toHaveBeenCalledTimes(1);
  await appState('active');
  expect(mockFetch).toHaveBeenCalledTimes(2);
});

test('a pass expiry triggers one refresh using server time, even when the phone clock differs', async () => {
  const offset = 5 * 60 * 60 * 1000;
  const deadline = Date.now() + offset + 35000;
  mockFetch.mockImplementation(
    async () =>
      new Response(
        JSON.stringify({
          items: [
            {
              id: 'case',
              canMessage: Date.now() + offset < deadline,
              expiresAt: new Date(deadline).toISOString(),
              serverNow: new Date(Date.now() + offset).toISOString(),
            },
          ],
          nextPage: null,
          unreadCount: 0,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
  );
  await act(async () => {
    tree = Renderer.create(view({ badge: true }));
  });
  await settle();
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(
    tree.root.findAllByType(Text).map(text => text.props.children),
  ).toEqual(['Open', 'Open']);
  await advance(30000);
  expect(mockFetch).toHaveBeenCalledTimes(1);
  await advance(5500);
  expect(mockFetch).toHaveBeenCalledTimes(2);
  expect(
    tree.root.findAllByType(Text).map(text => text.props.children),
  ).toEqual(['Closed', 'Closed']);
  await advance(30000);
  expect(mockFetch).toHaveBeenCalledTimes(2);
});
