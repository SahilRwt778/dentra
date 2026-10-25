import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type AuthState = {
  signedIn: boolean;
  sessionVersion: number;
  restoring: boolean;
  restoreError: string | null;
  restoreAttempt: number;
};
export const initialAuthState: AuthState = {
  signedIn: false,
  sessionVersion: 0,
  restoring: true,
  restoreError: null,
  restoreAttempt: 0,
};

const authSlice = createSlice({
  name: 'auth',
  initialState: initialAuthState,
  reducers: {
    sessionChanged(
      state,
      action: PayloadAction<{ signedIn: boolean; sessionVersion: number }>,
    ) {
      state.signedIn = action.payload.signedIn;
      state.sessionVersion = action.payload.sessionVersion;
    },
    restoreStarted(state) {
      state.restoring = true;
      state.restoreError = null;
    },
    restoreFinished(state, action: PayloadAction<string | null>) {
      state.restoring = false;
      state.restoreError = action.payload;
    },
    restoreRetried(state) {
      state.restoreAttempt++;
    },
    restoreErrorCleared(state) {
      state.restoreError = null;
    },
  },
});
export const {
  sessionChanged,
  restoreStarted,
  restoreFinished,
  restoreRetried,
  restoreErrorCleared,
} = authSlice.actions;
export const authReducer = authSlice.reducer;
