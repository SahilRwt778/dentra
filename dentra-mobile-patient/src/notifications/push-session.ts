import { Base64 } from 'js-base64';
import type { Notification } from '@/api/types';
import { API_BASE_URL } from '@/config';
import { refreshSession } from '@/auth/session';
import { flushPendingLogouts } from '@/auth/pending-logouts';
import { setAccessToken } from '@/store/auth-slice';
import { store } from '@/store/store';

export type PushSession = {
  userId: string;
  sessionId: string;
  deviceId: string;
  key: string;
};
export function sessionFromToken(token: string | null): PushSession | null {
  try {
    if (!token) return null;
    const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const value = JSON.parse(Base64.decode(encoded)) as {
      sub?: string;
      sid?: string;
      did?: string;
      role?: string;
    };
    if (value.role !== 'patient' || !value.sub || !value.sid || !value.did)
      return null;
    return {
      userId: value.sub,
      sessionId: value.sid,
      deviceId: value.did,
      key: `${value.sub}:${value.sid}`,
    };
  } catch {
    return null;
  }
}

export function currentPushSession() {
  return sessionFromToken(store.getState().auth.accessToken);
}

export async function pushRequest<T>(
  scope: PushSession,
  path: string,
  method: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const perform = async (token: string) => {
    const request = new AbortController();
    const abort = () => request.abort();
    signal?.addEventListener('abort', abort);
    const timer = setTimeout(abort, 15000);
    try {
      if (signal?.aborted) request.abort();
      return await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: request.signal,
      });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  };
  const token = store.getState().auth.accessToken;
  if (!token || currentPushSession()?.key !== scope.key || signal?.aborted)
    throw new Error('Session ended.');
  let response = await perform(token);
  if (
    response.status === 401 &&
    currentPushSession()?.key === scope.key &&
    !signal?.aborted
  ) {
    const refreshed = await refreshSession();
    if (
      !refreshed ||
      sessionFromToken(refreshed)?.key !== scope.key ||
      currentPushSession()?.key !== scope.key ||
      signal?.aborted
    )
      throw new Error('Session ended.');
    store.dispatch(setAccessToken(refreshed));
    response = await perform(refreshed);
  }
  if (currentPushSession()?.key !== scope.key || signal?.aborted)
    throw new Error('Session ended.');
  if (!response.ok) throw new Error('Could not update phone notifications.');
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>);
}

export function pushDeliveryAvailable(scope: PushSession, signal: AbortSignal) {
  return pushRequest<{ available: boolean }>(
    scope,
    '/notifications/push-device',
    'GET',
    undefined,
    signal,
  );
}

export async function registerPushToken(
  scope: PushSession,
  token: string,
  platform: 'android' | 'ios',
  signal: AbortSignal,
) {
  if (!(await flushPendingLogouts()))
    throw new Error('Waiting for an earlier logout to finish.');
  await pushRequest(
    scope,
    '/notifications/push-device',
    'PUT',
    { token, platform },
    signal,
  );
}
export function unregisterPushDevice(scope: PushSession, signal?: AbortSignal) {
  return pushRequest(
    scope,
    '/notifications/push-device',
    'DELETE',
    undefined,
    signal,
  );
}
export async function resolvePushNotification(
  scope: PushSession,
  id: string,
  signal: AbortSignal,
) {
  const item = await pushRequest<Notification>(
    scope,
    `/notifications/${id}`,
    'GET',
    undefined,
    signal,
  );
  return 'appointmentId' in item && item.type !== 'appointment_booked'
    ? item
    : null;
}
