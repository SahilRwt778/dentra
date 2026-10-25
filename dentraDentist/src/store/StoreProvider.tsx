import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { session } from '../features/auth/session';
import { sessionChanged } from './authSlice';
import { useAppStore } from './hooks';
import { store, type AppStore } from './store';

function SessionSync() {
  const appStore = useAppStore();
  useEffect(() => {
    function sync() {
      const next = {
        signedIn: session.isSignedIn(),
        sessionVersion: session.getVersion(),
      };
      const current = appStore.getState().auth;
      // Access-token rotation does not change the account or reset an active call.
      if (
        current.signedIn !== next.signedIn ||
        current.sessionVersion !== next.sessionVersion
      )
        appStore.dispatch(sessionChanged(next));
    }
    const unsubscribe = session.subscribe(sync);
    sync();
    return unsubscribe;
  }, [appStore]);
  return null;
}

export function StoreProvider({
  children,
  appStore = store,
}: {
  children: React.ReactNode;
  appStore?: AppStore;
}) {
  return (
    <Provider store={appStore}>
      <SessionSync />
      {children}
    </Provider>
  );
}
