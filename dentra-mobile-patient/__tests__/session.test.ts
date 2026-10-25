import { refreshSession, invalidatePendingSession } from '../src/auth/session';
import {
  getRefreshToken,
  setRefreshToken,
} from '../src/auth/refresh-token-storage';

jest.mock('../src/auth/refresh-token-storage', () => ({
  getRefreshToken: jest.fn(),
  setRefreshToken: jest.fn(),
}));
const originalFetch = globalThis.fetch;
beforeEach(() => {
  invalidatePendingSession();
  jest.clearAllMocks();
  jest.mocked(getRefreshToken).mockResolvedValue('old-token');
  jest.mocked(setRefreshToken).mockResolvedValue(undefined);
});
afterAll(() => {
  globalThis.fetch = originalFetch;
});

test('simultaneous refreshes share one rotation and persist only the new refresh token', async () => {
  globalThis.fetch = jest.fn(
    async () =>
      ({
        ok: true,
        json: async () => ({
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
        }),
      } as Response),
  );
  const [first, second] = await Promise.all([
    refreshSession(),
    refreshSession(),
  ]);
  expect(first).toBe('new-access');
  expect(second).toBe('new-access');
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  expect(setRefreshToken).toHaveBeenCalledWith('new-refresh');
});

test('logging out during a refresh prevents the late response from restoring that session', async () => {
  let finish!: (value: Response) => void;
  globalThis.fetch = jest.fn(
    () =>
      new Promise<Response>(resolve => {
        finish = resolve;
      }),
  );
  const pending = refreshSession();
  await Promise.resolve();
  invalidatePendingSession();
  finish({
    ok: true,
    json: async () => ({
      accessToken: 'late-access',
      refreshToken: 'late-refresh',
    }),
  } as Response);
  expect(await pending).toBeNull();
  expect(setRefreshToken).not.toHaveBeenCalled();
});

test('an unauthenticated launch does not call the refresh endpoint', async () => {
  jest.mocked(getRefreshToken).mockResolvedValue(null);
  globalThis.fetch = jest.fn();
  expect(await refreshSession()).toBeNull();
  expect(globalThis.fetch).not.toHaveBeenCalled();
});
