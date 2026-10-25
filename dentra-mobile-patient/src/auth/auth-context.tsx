import { useEffect } from 'react';
import { useRequestOtpMutation, useVerifyOtpMutation } from '@/api/auth';
import { baseApi } from '@/api/base-api';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  selectIsAuthenticated,
  selectIsRestoring,
  setAccessToken,
  restoreFinished,
} from '@/store/auth-slice';
import {
  getRefreshToken,
  setRefreshToken,
  clearRefreshToken,
} from '@/auth/refresh-token-storage';
import { getDeviceId } from '@/auth/device-id';
import { invalidatePendingSession, refreshSession } from './session';
import { queueLogout, flushPendingLogouts } from './pending-logouts';
import { stopPatientPush } from '@/notifications/push-manager';
import { errorMessage } from '@/api/errors';
import { clearPrivateFiles } from '@/lib/private-files';

/**
 * Runs once at the app root: if a refresh token survived the app being
 * closed, spend it on one silent refresh before rendering any
 * protected screen, so reopening the app doesn't force a re-login
 * every time.
 */
export function useSessionRestore() {
  const dispatch = useAppDispatch();
  const isRestoring = useAppSelector(selectIsRestoring);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) clearPrivateFiles().catch(() => undefined);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isRestoring) return;
    (async () => {
      try {
        await flushPendingLogouts().catch(() => false);
        const token = await refreshSession();
        if (!token) throw new Error('No saved session.');
        dispatch(setAccessToken(token));
      } catch {
        await clearRefreshToken().catch(() => undefined);
        dispatch(restoreFinished());
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function useAuth() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isLoading = useAppSelector(selectIsRestoring);
  const [requestOtpMutation] = useRequestOtpMutation();
  const [verifyOtpMutation] = useVerifyOtpMutation();

  async function requestOtp(
    mobile: string,
  ): Promise<
    { otpId: string; resendAfterSeconds: number } | { error: string }
  > {
    try {
      const data = await requestOtpMutation(mobile);
      if (!data.otpId) return { error: 'Could not send a code. Try again.' };
      return {
        otpId: data.otpId,
        resendAfterSeconds: data.resendAfterSeconds ?? 30,
      };
    } catch (err) {
      return { error: errorMessage(err, 'Could not send a code. Try again.') };
    }
  }

  async function verifyOtp(
    otpId: string,
    code: string,
  ): Promise<{ error?: string }> {
    try {
      const deviceId = await getDeviceId();
      const data = await verifyOtpMutation(otpId, code, deviceId);
      if (!data.accessToken || !data.refreshToken) {
        return { error: 'That code is incorrect.' };
      }
      await setRefreshToken(data.refreshToken);
      dispatch(setAccessToken(data.accessToken));
      return {};
    } catch (err) {
      return {
        error: errorMessage(
          err,
          __DEV__ && err instanceof Error
            ? err.message
            : 'Could not finish signing in. Please try again.',
        ),
      };
    }
  }

  async function logout() {
    invalidatePendingSession();
    clearPrivateFiles().catch(() => undefined);
    // Stop callbacks synchronously; token deletion is serialized before the next registration.
    stopPatientPush(true).catch(() => undefined);
    const refreshToken = await getRefreshToken().catch(() => null);
    if (refreshToken) await queueLogout(refreshToken).catch(() => undefined);
    await clearRefreshToken().catch(() => undefined);
    dispatch(setAccessToken(null));
    dispatch(baseApi.util.resetApiState());
    // Opaque revocation credentials stay encrypted until an offline logout reaches the API.
    flushPendingLogouts().catch(() => undefined);
  }

  return { isAuthenticated, isLoading, requestOtp, verifyOtp, logout };
}
