import { configureStore, type Middleware } from '@reduxjs/toolkit';
import { authReducer, initialAuthState, sessionChanged } from './authSlice';
import { notificationsReducer } from './notificationsSlice';
import { videoReducer } from './videoSlice';
import { dentraApi } from './dentraApi';
import { session } from '../features/auth/session';

const resetSessionCache: Middleware =
  ({ dispatch }) =>
  next =>
  action => {
    const result = next(action);
    if (sessionChanged.match(action)) dispatch(dentraApi.util.resetApiState());
    return result;
  };

export function createAppStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
      notifications: notificationsReducer,
      video: videoReducer,
      [dentraApi.reducerPath]: dentraApi.reducer,
    },
    preloadedState: {
      auth: {
        ...initialAuthState,
        signedIn: session.isSignedIn(),
        sessionVersion: session.getVersion(),
      },
    },
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware().concat(resetSessionCache, dentraApi.middleware),
    // Deliver query updates to call/session listeners even when native animation frames pause.
    enhancers: getDefaultEnhancers =>
      getDefaultEnhancers({ autoBatch: { type: 'tick' } }),
    // Refresh/access tokens and clinical data should not be sent to a debugging extension.
    devTools: false,
  });
}
export const store = createAppStore();
export type AppStore = ReturnType<typeof createAppStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
