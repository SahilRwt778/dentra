import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
  accessToken: string | null;
  // Keychain access is async, unlike the web apps' synchronous
  // localStorage read, so this always starts true: useSessionRestore
  // (auth-context.tsx) flips it false once it's actually checked
  // whether a refresh token exists on disk.
  isRestoring: boolean;
}

const initialState: AuthState = {
  accessToken: null,
  isRestoring: true,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAccessToken(state, action: PayloadAction<string | null>) {
      state.accessToken = action.payload;
      state.isRestoring = false;
    },
    restoreFinished(state) {
      state.isRestoring = false;
    },
  },
});

export const { setAccessToken, restoreFinished } = authSlice.actions;
export default authSlice.reducer;

export function selectAccessToken(state: { auth: AuthState }): string | null {
  return state.auth.accessToken;
}

export function selectIsAuthenticated(state: { auth: AuthState }): boolean {
  return !!state.auth.accessToken;
}

export function selectIsRestoring(state: { auth: AuthState }): boolean {
  return state.auth.isRestoring;
}
