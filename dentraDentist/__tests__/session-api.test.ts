import axios, {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import * as Keychain from 'react-native-keychain';
import { api } from '../src/api/client';
import { publicHttp } from '../src/api/http';
import { session } from '../src/features/auth/session';
import { authApi } from '../src/api/auth.api';
import { dentistsApi } from '../src/api/dentists.api';
import { appointmentsApi } from '../src/api/appointments.api';
import { tokenStorage } from '../src/common/services/secure-storage';

function response(
  config: InternalAxiosRequestConfig,
  data: unknown,
  status = 200,
): AxiosResponse {
  return { config, data, status, statusText: String(status), headers: {} };
}
function reject(config: InternalAxiosRequestConfig, status: number) {
  return Promise.reject(
    new AxiosError(
      'Request failed',
      undefined,
      config,
      undefined,
      response(config, { message: 'Request failed' }, status),
    ),
  );
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}
const tokens = {
  accessToken: 'access-one',
  refreshToken: 'refresh-one',
  expiresInSeconds: 900,
};
const rotated = {
  ...tokens,
  accessToken: 'access-two',
  refreshToken: 'refresh-two',
};
beforeEach(async () => {
  await session.clear();
  jest.clearAllMocks();
  api.defaults.adapter = async config =>
    response(config, { items: [], nextPage: null });
  publicHttp.defaults.adapter = async config => response(config, rotated);
});

test('sends dentist OTP purpose, exactly four digits, and a stable installation id', async () => {
  const calls: InternalAxiosRequestConfig[] = [];
  publicHttp.defaults.adapter = async config => {
    calls.push(config);
    return response(config, tokens);
  };
  await authApi.requestOtp('+919999000001');
  await authApi.verifyOtp('otp-id', '4821');
  await authApi.verifyOtp('another-id', '3742');
  expect(calls.map(call => call.url)).toEqual([
    '/auth/otp/request',
    '/auth/otp/verify',
    '/auth/otp/verify',
  ]);
  expect(JSON.parse(calls[0].data)).toEqual({
    mobile: '+919999000001',
    purpose: 'dentist',
  });
  const verify = JSON.parse(calls[1].data);
  expect(verify).toMatchObject({
    otpId: 'otp-id',
    code: '4821',
    deviceId: expect.stringMatching(/^dentist-mobile-/),
  });
  expect(JSON.parse(calls[2].data).deviceId).toBe(verify.deviceId);
});

test('concurrent unauthorized requests rotate once and replay with the new access token', async () => {
  await session.signIn(tokens);
  const refreshStarted = deferred<void>();
  const release = deferred<void>();
  let refreshes = 0;
  publicHttp.defaults.adapter = async config => {
    refreshes++;
    refreshStarted.resolve();
    await release.promise;
    expect(JSON.parse(config.data)).toEqual({
      refreshToken: tokens.refreshToken,
    });
    return response(config, rotated);
  };
  api.defaults.adapter = async config =>
    config.headers.get('Authorization') === `Bearer ${tokens.accessToken}`
      ? reject(config, 401)
      : response(config, { items: [], nextPage: null });
  const first = appointmentsApi.list('2026-10-18');
  const second = appointmentsApi.list('2026-10-19');
  await refreshStarted.promise;
  release.resolve();
  await Promise.all([first, second]);
  expect(refreshes).toBe(1);
  expect(session.getAccessToken()).toBe(rotated.accessToken);
  expect(Keychain.setGenericPassword).toHaveBeenLastCalledWith(
    'dentra-dentist',
    rotated.refreshToken,
    expect.anything(),
  );
});

test('temporary refresh failure preserves secure session and can retry', async () => {
  await session.signIn(tokens);
  publicHttp.defaults.adapter = async () => {
    throw new AxiosError('Network Error', 'ERR_NETWORK');
  };
  await expect(session.refresh()).rejects.toThrow('Network Error');
  expect(Keychain.resetGenericPassword).not.toHaveBeenCalled();
  expect(session.isSignedIn()).toBe(true);
  publicHttp.defaults.adapter = async config => response(config, rotated);
  await session.refresh();
  expect(session.getAccessToken()).toBe(rotated.accessToken);
});

test('expired refresh token clears secure session; cold restore returns to login', async () => {
  jest.mocked(Keychain.getGenericPassword).mockResolvedValueOnce({
    username: 'dentra-dentist',
    password: 'expired',
    service: 'test',
    storage: 'test',
  } as never);
  publicHttp.defaults.adapter = config => reject(config, 401);
  await expect(session.restore()).resolves.toBeUndefined();
  expect(session.isSignedIn()).toBe(false);
  expect(Keychain.resetGenericPassword).toHaveBeenCalled();
});

test('offline cold restore keeps saved token for a successful retry', async () => {
  jest.mocked(Keychain.getGenericPassword).mockResolvedValue({
    username: 'dentra-dentist',
    password: tokens.refreshToken,
    service: 'test',
    storage: 'test',
  } as never);
  publicHttp.defaults.adapter = async () => {
    throw new AxiosError('Offline', 'ERR_NETWORK');
  };
  await expect(session.restore()).rejects.toThrow('Offline');
  expect(Keychain.resetGenericPassword).not.toHaveBeenCalled();
  publicHttp.defaults.adapter = async config => response(config, rotated);
  await session.restore();
  expect(session.isSignedIn()).toBe(true);
  jest.mocked(Keychain.getGenericPassword).mockResolvedValue(false);
});

test('logout during rotation cannot restore tokens or deliver protected data', async () => {
  await session.signIn(tokens);
  const started = deferred<void>();
  const release = deferred<void>();
  publicHttp.defaults.adapter = async config => {
    started.resolve();
    await release.promise;
    return response(config, rotated);
  };
  const pending = session.refresh();
  const result = pending.catch(error => error);
  await started.promise;
  await session.clear();
  release.resolve();
  expect(axios.isCancel(await result)).toBe(true);
  expect(session.isSignedIn()).toBe(false);
  expect(Keychain.setGenericPassword).toHaveBeenCalledTimes(1);
});

test('a protected response from the previous login is discarded', async () => {
  await session.signIn(tokens);
  const started = deferred<void>();
  const release = deferred<void>();
  api.defaults.adapter = async config => {
    started.resolve();
    await release.promise;
    return response(config, { id: 'old-patient' });
  };
  const pending = appointmentsApi.get('appointment-one').catch(error => error);
  await started.promise;
  await session.clear();
  await session.signIn(rotated);
  release.resolve();
  expect(axios.isCancel(await pending)).toBe(true);
});

test('only a missing dentist profile becomes onboarding; forbidden and network errors stay errors', async () => {
  await session.signIn(tokens);
  api.defaults.adapter = config => reject(config, 404);
  await expect(dentistsApi.getMe()).resolves.toBeNull();
  api.defaults.adapter = config => reject(config, 403);
  await expect(dentistsApi.getMe()).rejects.toMatchObject({
    response: { status: 403 },
  });
  api.defaults.adapter = async () => {
    throw new AxiosError('Offline', 'ERR_NETWORK');
  };
  await expect(dentistsApi.getMe()).rejects.toThrow('Offline');
});

test('appointment filters and protected multipart onboarding use the shared client', async () => {
  await session.signIn(tokens);
  const calls: InternalAxiosRequestConfig[] = [];
  api.defaults.adapter = async config => {
    calls.push(config);
    return response(config, { id: 'document-one' });
  };
  await appointmentsApi.list('2026-10-20', 2);
  await dentistsApi.uploadDocument('dentist-one', 'degree', {
    uri: 'file:///private/degree.pdf',
    name: 'degree.pdf',
    type: 'application/pdf',
    size: 120,
  });
  expect(calls[0].params).toEqual({ date: '2026-10-20', page: 2 });
  expect(calls[1].url).toBe('/dentists/applications/dentist-one/documents');
  expect(calls[1].headers.get('Authorization')).toBe(
    `Bearer ${tokens.accessToken}`,
  );
  expect(
    calls[1].data
      .getParts()
      .map((part: { fieldName: string }) => part.fieldName),
  ).toEqual(['docType', 'file']);
  expect(calls[1].data.getParts()[1]).toMatchObject({
    uri: 'file:///private/degree.pdf',
    name: 'degree.pdf',
    type: 'application/pdf',
  });
});

test('access token stays in memory and only the refresh token is persisted', async () => {
  await session.signIn(tokens);
  expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
    'dentra-dentist',
    tokens.refreshToken,
    expect.objectContaining({ accessible: 'WhenUnlockedThisDeviceOnly' }),
  );
  expect(
    JSON.stringify(jest.mocked(Keychain.setGenericPassword).mock.calls),
  ).not.toContain(tokens.accessToken);
  await tokenStorage.clear();
});
