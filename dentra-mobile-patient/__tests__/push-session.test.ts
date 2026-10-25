import { Base64 } from 'js-base64';
import {
  sessionFromToken,
  pushRequest,
  registerPushToken,
} from '../src/notifications/push-session';
import { refreshSession } from '../src/auth/session';
import { flushPendingLogouts } from '../src/auth/pending-logouts';
import { store } from '../src/store/store';

jest.mock('../src/auth/session', () => ({ refreshSession: jest.fn() }));
jest.mock('../src/auth/pending-logouts', () => ({
  flushPendingLogouts: jest.fn(),
}));
jest.mock('../src/store/store', () => ({
  store: { getState: jest.fn(), dispatch: jest.fn() },
}));
const token = (sub: string, sid = 'session', role = 'patient') =>
  `header.${Base64.encodeURI(
    JSON.stringify({ sub, sid, did: 'phone', role }),
  )}.signature`;
const a = token('a');
let active: string | null;
const mockFetch = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  active = a;
  jest
    .mocked(store.getState)
    .mockImplementation(
      () =>
        ({ auth: { accessToken: active } } as ReturnType<
          typeof store.getState
        >),
    );
  jest.mocked(flushPendingLogouts).mockResolvedValue(true);
  globalThis.fetch = mockFetch;
  mockFetch.mockResolvedValue({ ok: true, status: 204 });
});

test('decodes the signed session scope without relying on a browser atob global', () => {
  expect(sessionFromToken(a)).toEqual({
    userId: 'a',
    sessionId: 'session',
    deviceId: 'phone',
    key: 'a:session',
  });
  for (const invalid of [
    null,
    'garbage',
    token('a', 'session', 'dentist'),
    'a.eyJyb2xlIjoicGF0aWVudCJ9.b',
  ])
    expect(sessionFromToken(invalid)).toBeNull();
});

test('an expired token is retried only within its original session family', async () => {
  const refreshed = `${a}new`;
  jest.mocked(refreshSession).mockResolvedValue(refreshed);
  mockFetch
    .mockResolvedValueOnce({ ok: false, status: 401 })
    .mockResolvedValueOnce({ ok: true, status: 204 });
  await pushRequest(
    sessionFromToken(a)!,
    '/notifications/push-device',
    'DELETE',
  );
  expect(mockFetch).toHaveBeenCalledTimes(2);
  expect(mockFetch.mock.calls[1][1].headers.Authorization).toBe(
    `Bearer ${refreshed}`,
  );
});

test('a request returning after an account switch never refreshes or accepts the previous account response', async () => {
  mockFetch.mockImplementationOnce(async () => {
    active = token('b');
    return { ok: false, status: 401 };
  });
  await expect(
    pushRequest(sessionFromToken(a)!, '/notifications/id', 'GET'),
  ).rejects.toThrow('Session ended');
  expect(refreshSession).not.toHaveBeenCalled();
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

test('registration waits for encrypted offline logout revocations before binding the installation', async () => {
  jest.mocked(flushPendingLogouts).mockResolvedValue(false);
  await expect(
    registerPushToken(
      sessionFromToken(a)!,
      'fcm-token',
      'android',
      new AbortController().signal,
    ),
  ).rejects.toThrow('earlier logout');
  expect(mockFetch).not.toHaveBeenCalled();
});
