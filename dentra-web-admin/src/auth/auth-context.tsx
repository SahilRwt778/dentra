import { useEffect, useState } from 'react';
import { usePostAuthAdminLoginMutation, usePostAuthLogoutMutation } from '@/api/generated-api';
import { baseApi } from '@/api/base-api';
import { refreshSession } from '@/auth/session-refresh';
import { getDeviceId } from '@/auth/device-id';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectIsAuthenticated, selectIsRestoring, setAccessToken } from '@/store/auth-slice';
import { getRefreshToken, setRefreshToken, clearRefreshToken } from '@/auth/refresh-token-storage';

/**
 * Runs once at the app root: if a refresh token survived a page reload,
 * spend it on one silent refresh before rendering any protected route,
 * so reopening the tab doesn't force a re-login every time.
 */
export function useSessionRestore() {
  const dispatch = useAppDispatch();
  const isRestoring = useAppSelector(selectIsRestoring);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isRestoring) return;
    let cancelled = false;
    void refreshSession(dispatch).then((result) => {
      if (cancelled) return;
      if (result.status === 'temporary') {
        setError('Could not restore your session. Check your connection and try again.');
      } else if (result.status === 'superseded') {
        // Another login/tab changed the stored session while this request was in flight.
        setAttempt((value) => value + 1);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch, isRestoring, attempt]);

  return {
    isRestoring,
    error: isRestoring ? error : null,
    retry: () => {
      setError(null);
      setAttempt((value) => value + 1);
    },
  };
}

export function useAuth() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isLoading = useAppSelector(selectIsRestoring);
  const [loginMutation] = usePostAuthAdminLoginMutation();
  const [logoutMutation] = usePostAuthLogoutMutation();

  async function login(email: string, password: string): Promise<{ error?: string }> {
    try {
      const data = await loginMutation({
        body: { email: email.trim(), password, deviceId: getDeviceId() },
      }).unwrap();
      if (!data.accessToken || !data.refreshToken) {
        return { error: 'Invalid email or password.' };
      }
      dispatch(baseApi.util.resetApiState());
      setRefreshToken(data.refreshToken);
      dispatch(setAccessToken(data.accessToken));
      return {};
    } catch (err) {
      const failure = err as { status?: number | string; data?: { message?: string } } | undefined;
      if (failure?.status === 'FETCH_ERROR' || failure?.status === 'TIMEOUT_ERROR') {
        return { error: 'Cannot connect to the Dentra server. Please try again shortly.' };
      }
      if (typeof failure?.status === 'number' && failure.status >= 500) {
        return { error: 'The server could not complete sign-in. Please try again.' };
      }
      const message = failure?.data?.message;
      return { error: message ?? 'Invalid email or password.' };
    }
  }

  function logout() {
    const refreshToken = getRefreshToken();
    if (refreshToken) void logoutMutation({ body: { refreshToken } });
    clearRefreshToken();
    dispatch(setAccessToken(null));
    dispatch(baseApi.util.resetApiState());
  }

  return { isAuthenticated, isLoading, login, logout };
}
