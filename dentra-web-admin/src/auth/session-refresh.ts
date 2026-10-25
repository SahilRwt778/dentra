import { createTokenRefresher } from './token-refresher';
import { getRefreshToken, setRefreshToken, clearRefreshToken } from './refresh-token-storage';
import { setAccessToken } from '@/store/auth-slice';
import type { AppDispatch } from '@/store/store';

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const refresher = createTokenRefresher({
  readToken: getRefreshToken,
  saveToken: setRefreshToken,
  clearToken: clearRefreshToken,
  request: (refreshToken) =>
    fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: AbortSignal.timeout(15_000),
    }),
  withLock: (operation) =>
    navigator.locks ? navigator.locks.request('dentra-admin-token-refresh', operation) : operation(),
});

export function refreshSession(dispatch: AppDispatch) {
  return refresher.refresh((result) => {
    if (result.status === 'success') {
      if (getRefreshToken() !== result.refreshToken) return { status: 'superseded' };
      dispatch(setAccessToken(result.accessToken));
    } else if (result.status === 'invalid') {
      if (getRefreshToken()) return { status: 'superseded' };
      dispatch(setAccessToken(null));
    }
    return result;
  });
}
