import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { joinVideo } from '../src/api/video-session';
import { baseApi } from '../src/api/base-api';
import { store } from '../src/store/store';
import { setAccessToken } from '../src/store/auth-slice';

const storage = vi.hoisted(() => ({ setRefreshToken: vi.fn() }));
vi.mock('@/auth/refresh-token-storage', () => ({
  getRefreshToken: () => 'synthetic-refresh-token',
  setRefreshToken: storage.setRefreshToken,
  clearRefreshToken: vi.fn(),
}));

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  store.dispatch(baseApi.util.resetApiState());
  store.dispatch(setAccessToken('expired-access-token'));
});
afterEach(() => {
  store.dispatch(baseApi.util.resetApiState());
  store.dispatch(setAccessToken(null));
  vi.unstubAllGlobals();
});

test('video join refreshes authentication and keeps meeting credentials outside Redux', async () => {
  const session = {
    provider: 'livekit',
    serverUrl: 'wss://synthetic.livekit.test',
    token: 'private-synthetic-join-token',
  };
  const authorization: (string | null)[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | Request) => {
      if (typeof input === 'string') {
        expect(new URL(input).pathname).toBe('/auth/refresh');
        return json({
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        });
      }
      expect(new URL(input.url).pathname).toBe(
        '/appointments/visit/video/token'
      );
      expect(input.method).toBe('POST');
      expect(await input.json()).toEqual({ platform: 'web' });
      authorization.push(input.headers.get('Authorization'));
      return authorization.length === 1
        ? json({ message: 'Expired' }, 401)
        : json(session);
    })
  );

  await expect(joinVideo('visit')).resolves.toEqual(session);

  expect(authorization).toEqual([
    'Bearer expired-access-token',
    'Bearer new-access-token',
  ]);
  expect(storage.setRefreshToken).toHaveBeenCalledWith('new-refresh-token');
  expect(store.getState().api.mutations).toEqual({});
  expect(JSON.stringify(store.getState())).not.toContain(session.token);
});

test('the consultation screen receives eligibility failures from the API', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => json({ message: 'This visit was cancelled.' }, 409))
  );
  await expect(joinVideo('visit')).rejects.toMatchObject({
    status: 409,
    data: { message: 'This visit was cancelled.' },
  });
});
