import { useEffect } from 'react';
import {
  usePostAuthOtpRequestMutation,
  usePostAuthOtpVerifyMutation,
  usePostAuthRefreshMutation,
  usePostAuthLogoutMutation,
  type AuthTokens,
} from '@/api/generated-api';
import { baseApi } from '@/api/base-api';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectIsAuthenticated, selectIsRestoring, setAccessToken, restoreFinished } from '@/store/auth-slice';
import { getRefreshToken, setRefreshToken, clearRefreshToken } from '@/auth/refresh-token-storage';
import { getDeviceId } from '@/auth/device-id';

let restorePromise: Promise<AuthTokens> | null = null;

/**
 * Runs once at the app root: if a refresh token survived a page reload,
 * spend it on one silent refresh before rendering any protected route,
 * so reopening the tab doesn't force a re-login every time.
 */
export function useSessionRestore() {
  const dispatch = useAppDispatch();
  const isRestoring = useAppSelector(selectIsRestoring);
  const [refresh] = usePostAuthRefreshMutation();

  useEffect(() => {
    if (!isRestoring) return;
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      dispatch(restoreFinished());
      return;
    }
    let cancelled = false;
    // React StrictMode mounts this effect twice; both must share one token rotation.
    if (!restorePromise) {
      restorePromise = refresh({ body: { refreshToken } }).unwrap().finally(() => { restorePromise = null; });
    }
    restorePromise
      .then((data) => {
        if (cancelled) return;
        if (!data.accessToken || !data.refreshToken) throw new Error('Malformed refresh response.');
        setRefreshToken(data.refreshToken);
        dispatch(setAccessToken(data.accessToken));
      })
      .catch(() => {
        if (cancelled) return;
        clearRefreshToken();
        dispatch(restoreFinished());
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function useAuth() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isLoading = useAppSelector(selectIsRestoring);
  const [requestOtpMutation] = usePostAuthOtpRequestMutation();
  const [verifyOtpMutation] = usePostAuthOtpVerifyMutation();
  const [logoutMutation] = usePostAuthLogoutMutation();

  async function requestOtp(mobile: string): Promise<{ otpId: string } | { error: string }> {
    try {
      const data = await requestOtpMutation({ body: { mobile, purpose: 'dentist' } }).unwrap();
      if (!data.otpId) return { error: 'Could not send a code. Try again.' };
      return { otpId: data.otpId };
    } catch (err) {
      const message = (err as { data?: { message?: string } } | undefined)?.data?.message;
      return { error: message ?? 'Could not send a code. Try again.' };
    }
  }

  async function verifyOtp(otpId: string, code: string): Promise<{ error?: string }> {
    try {
      const data = await verifyOtpMutation({ body: { otpId, code, deviceId: getDeviceId() } }).unwrap();
      if (!data.accessToken || !data.refreshToken) {
        return { error: 'That code is incorrect.' };
      }
      setRefreshToken(data.refreshToken);
      dispatch(baseApi.util.resetApiState());
      dispatch(setAccessToken(data.accessToken));
      return {};
    } catch (err) {
      const message = (err as { data?: { message?: string } } | undefined)?.data?.message;
      return { error: message ?? 'That code is incorrect.' };
    }
  }

  function logout() {
    const refreshToken = getRefreshToken();
    if (refreshToken) void logoutMutation({ body: { refreshToken } });
    clearRefreshToken();
    dispatch(setAccessToken(null));
    dispatch(baseApi.util.resetApiState());
  }

  return { isAuthenticated, isLoading, requestOtp, verifyOtp, logout };
}
