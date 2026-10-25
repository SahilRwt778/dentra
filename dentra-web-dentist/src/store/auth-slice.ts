import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { getRefreshToken } from '@/auth/refresh-token-storage';

interface AuthState {
  accessToken: string | null;
  /** True only while the initial silent-refresh-on-load is in flight. */
  isRestoring: boolean;
}

const initialState: AuthState = {
  accessToken: null,
  // If there's a refresh token on disk, we owe it one silent refresh
  // attempt before deciding the admin is logged out.
  isRestoring: !!getRefreshToken(),
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
