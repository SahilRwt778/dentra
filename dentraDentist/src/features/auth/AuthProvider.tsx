import React, { useCallback, useEffect } from 'react';
import { clearPrivateFiles } from '../../common/services/private-files';
import { session } from './session';
import { errorMessage } from '../../common/utils/api-error';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  restoreStarted,
  restoreFinished,
  restoreRetried,
  restoreErrorCleared,
} from '../../store/authSlice';

let restorePromise: Promise<void> | null = null;
// Effect replay shares one secure-token rotation.
function restoreOnce() {
  if (!restorePromise) {
    const pending = clearPrivateFiles().then(() => session.restore());
    restorePromise = pending;
    pending
      .finally(() => {
        if (restorePromise === pending) restorePromise = null;
      })
      .catch(() => {});
  }
  return restorePromise;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const attempt = useAppSelector(state => state.auth.restoreAttempt);
  useEffect(() => {
    let active = true;
    const version = session.getVersion();
    dispatch(restoreStarted());
    restoreOnce().then(
      () => {
        if (active) dispatch(restoreFinished(null));
      },
      error => {
        if (active)
          dispatch(
            restoreFinished(
              version === session.getVersion() ? errorMessage(error) : null,
            ),
          );
      },
    );
    return () => {
      active = false;
    };
  }, [dispatch, attempt]);
  return <>{children}</>;
}

export function useAuth() {
  const auth = useAppSelector(state => state.auth);
  const dispatch = useAppDispatch();
  const retryRestore = useCallback(() => {
    dispatch(restoreRetried());
  }, [dispatch]);
  const signOut = useCallback(async () => {
    dispatch(restoreErrorCleared());
    await session.signOut();
  }, [dispatch]);
  return { ...auth, retryRestore, signOut };
}
