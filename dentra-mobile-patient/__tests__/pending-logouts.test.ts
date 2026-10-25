import * as Keychain from 'react-native-keychain';
import { queueLogout, flushPendingLogouts } from '../src/auth/pending-logouts';

let saved: string | undefined;
const mockFetch = jest.fn();
beforeEach(() => {
  saved = undefined;
  jest.clearAllMocks();
  jest
    .mocked(Keychain.getGenericPassword)
    .mockImplementation(async () =>
      saved
        ? {
            password: saved,
            username: 'pending-logouts',
            service: 'dentra_patient_pending_logouts',
            storage: 'KeystoreAESCBC' as Keychain.STORAGE_TYPE,
          }
        : false,
    );
  jest
    .mocked(Keychain.setGenericPassword)
    .mockImplementation(async (_user, value) => {
      saved = value;
      return {
        service: 'dentra_patient_pending_logouts',
        storage: 'KeystoreAESCBC' as Keychain.STORAGE_TYPE,
      };
    });
  jest.mocked(Keychain.resetGenericPassword).mockImplementation(async () => {
    saved = undefined;
    return true;
  });
  globalThis.fetch = mockFetch;
});

test('offline logout persists in Keychain, deduplicates, and retries without an access token', async () => {
  await queueLogout('opaque-refresh-token');
  await queueLogout('opaque-refresh-token');
  mockFetch.mockRejectedValueOnce(new Error('offline'));
  expect(await flushPendingLogouts()).toBe(false);
  expect(JSON.parse(saved!)).toEqual(['opaque-refresh-token']);
  mockFetch.mockResolvedValueOnce({ ok: true });
  expect(await flushPendingLogouts()).toBe(true);
  expect(saved).toBeUndefined();
  const [url, options] = mockFetch.mock.calls[1];
  expect(url).toContain('/auth/logout');
  expect(options.headers.Authorization).toBeUndefined();
  expect(JSON.parse(options.body)).toEqual({
    refreshToken: 'opaque-refresh-token',
  });
  expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
    'pending-logouts',
    expect.any(String),
    { service: 'dentra_patient_pending_logouts' },
  );
});
