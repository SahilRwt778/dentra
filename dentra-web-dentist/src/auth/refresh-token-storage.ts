// The refresh token deliberately lives outside Redux state: it has to
// survive a page reload before the store has rehydrated anything, and
// it has no reason to show up in the Redux DevTools action history.
// The access token, by contrast, lives in the authSlice — see
// src/store/auth-slice.ts.

const REFRESH_TOKEN_KEY = 'dentra_dentist_refresh_token';

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function clearRefreshToken(): void {
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}
