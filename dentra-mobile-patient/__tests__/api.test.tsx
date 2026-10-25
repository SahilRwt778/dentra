import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { usePatientQuery, useUpdatePatientMutation } from '../src/api/patients';
import { errorMessage } from '../src/api/errors';
import { baseApi } from '../src/api/base-api';
import { store } from '../src/store/store';
import { setAccessToken } from '../src/store/auth-slice';
import { joinVideo } from '../src/api/video';
import { testVideoCredentials } from '../test-utils/video';

const mockRefresh = jest.fn();
jest.mock('../src/auth/session', () => ({
  refreshSession: () => mockRefresh(),
}));

const originalFetch = globalThis.fetch;
const mockFetch = jest.fn();
let tree: Renderer.ReactTestRenderer;
let profile: ReturnType<typeof usePatientQuery>;
let update: ReturnType<typeof useUpdatePatientMutation>[0];

function Patient({ load = true }: { load?: boolean }) {
  profile = usePatientQuery(undefined, { skip: !load });
  [update] = useUpdatePatientMutation();
  return null;
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function render(load = true) {
  await act(async () => {
    tree = Renderer.create(
      <Provider store={store}>
        <Patient load={load} />
      </Provider>,
    );
  });
}

async function settle(ready: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10);
    });
    if (ready()) return;
  }
  throw new Error('The API query did not settle.');
}

beforeEach(() => {
  jest.useFakeTimers({
    doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'],
  });
  jest.clearAllMocks();
  globalThis.fetch = mockFetch;
  store.dispatch(baseApi.util.resetApiState());
  store.dispatch(setAccessToken('synthetic-access-token'));
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  await act(async () => {
    store.dispatch(baseApi.util.resetApiState());
    store.dispatch(setAccessToken(null));
    // Drain cache/subscription notifications after the renderer has unsubscribed.
    await jest.advanceTimersByTimeAsync(1000);
  });
  jest.clearAllTimers();
  jest.useRealTimers();
  globalThis.fetch = originalFetch;
});

test('updating a profile through the simple API sends plain fields and refreshes the cached query', async () => {
  let fullName = 'Test Patient';
  const requests: {
    method: string;
    authorization: string | null;
    body?: unknown;
  }[] = [];
  mockFetch.mockImplementation(async (request: Request) => {
    expect(new URL(request.url).pathname).toBe('/patients/me');
    const body = request.method === 'PATCH' ? await request.json() : undefined;
    requests.push({
      method: request.method,
      authorization: request.headers.get('Authorization'),
      body,
    });
    if (body) fullName = body.fullName;
    return json({ id: 'patient', fullName });
  });
  await render();
  await settle(() => profile.data?.fullName === 'Test Patient');

  await act(async () => {
    await update({ fullName: 'Updated Patient' });
  });
  await settle(() => profile.data?.fullName === 'Updated Patient');

  expect(requests.map(request => request.method)).toEqual([
    'GET',
    'PATCH',
    'GET',
  ]);
  expect(requests[1].body).toEqual({ fullName: 'Updated Patient' });
  expect(
    requests.every(
      request => request.authorization === 'Bearer synthetic-access-token',
    ),
  ).toBe(true);
});

test('an expired access token refreshes once and retries the query with the replacement token', async () => {
  const authorization: (string | null)[] = [];
  mockRefresh.mockResolvedValue('replacement-access-token');
  mockFetch.mockImplementation(async (request: Request) => {
    authorization.push(request.headers.get('Authorization'));
    return authorization.length === 1
      ? json({ message: 'Expired access token' }, 401)
      : json({ id: 'patient', fullName: 'Test Patient' });
  });
  await render();
  await settle(() => profile.isSuccess);

  expect(mockRefresh).toHaveBeenCalledTimes(1);
  expect(authorization).toEqual([
    'Bearer synthetic-access-token',
    'Bearer replacement-access-token',
  ]);
  expect(store.getState().auth.accessToken).toBe('replacement-access-token');
});

test('an action rejects server validation errors that screens can display as a readable message', async () => {
  mockFetch.mockResolvedValue(
    json({ message: ['Enter a valid email', 'Enter a full name'] }, 400),
  );
  await render(false);
  let failure: unknown;
  await act(async () => {
    try {
      await update({ email: 'invalid' });
    } catch (error) {
      failure = error;
    }
  });
  expect(errorMessage(failure)).toBe('Enter a valid email. Enter a full name');
  expect(mockRefresh).not.toHaveBeenCalled();
});

test('joining video refreshes authentication without caching meeting credentials in Redux', async () => {
  const session = testVideoCredentials('patient');
  const authorization: (string | null)[] = [];
  mockRefresh.mockResolvedValue('replacement-access-token');
  mockFetch.mockImplementation(async (request: Request) => {
    expect(new URL(request.url).pathname).toBe(
      '/appointments/visit/video/token',
    );
    expect(request.method).toBe('POST');
    expect(await request.json()).toEqual({ platform: 'android' });
    authorization.push(request.headers.get('Authorization'));
    return authorization.length === 1
      ? json({ message: 'Expired access token' }, 401)
      : json(session);
  });

  await expect(joinVideo('visit', 'android')).resolves.toEqual(session);

  expect(authorization).toEqual([
    'Bearer synthetic-access-token',
    'Bearer replacement-access-token',
  ]);
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  expect(store.getState().api.mutations).toEqual({});
  expect(JSON.stringify(store.getState())).not.toContain(
    session.token,
  );
});

test('video join preserves the server error for the consultation screen', async () => {
  mockFetch.mockResolvedValue(
    json({ message: 'This appointment was cancelled.' }, 409),
  );
  await expect(joinVideo('visit', 'ios')).rejects.toMatchObject({
    status: 409,
    data: { message: 'This appointment was cancelled.' },
  });
  expect(store.getState().api.mutations).toEqual({});
});
