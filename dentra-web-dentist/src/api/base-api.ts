import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
} from '@reduxjs/toolkit/query/react';
import type {
  FetchArgs,
  FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import { setAccessToken } from '@/store/auth-slice';
import {
  getRefreshToken,
  setRefreshToken,
  clearRefreshToken,
} from '@/auth/refresh-token-storage';
import type { RootState } from '@/store/store';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: BASE_URL,
  prepareHeaders: (headers, { getState }) => {
    // Attaching this unconditionally, even to the /auth/* endpoints
    // (otp/request, admin/login, refresh), is harmless: those routes
    // are @Public() on the API side, which skips token verification
    // entirely rather than rejecting an unexpected one.
    const token = (getState() as RootState).auth.accessToken;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

let refreshPromise: Promise<string | null> | null = null;

/**
 * One silent retry on a 401: the access token may have just expired
 * mid-session (15-minute TTL) — refresh once and replay the original
 * request rather than bouncing the admin to the login screen. Concurrent
 * 401s share one in-flight refresh instead of each rotating the refresh
 * token and invalidating the others' out from under them.
 */
export const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    if (!refreshPromise) {
      refreshPromise = (async () => {
        const refreshToken = getRefreshToken();
        if (!refreshToken) return null;
        try {
          const res = await fetch(`${BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });
          if (!res.ok) return null;
          const body = (await res.json()) as {
            accessToken: string;
            refreshToken: string;
          };
          setRefreshToken(body.refreshToken);
          return body.accessToken;
        } catch {
          return null;
        }
      })();
    }

    const newAccessToken = await refreshPromise;
    refreshPromise = null;

    if (newAccessToken) {
      api.dispatch(setAccessToken(newAccessToken));
      result = await rawBaseQuery(args, api, extraOptions);
    } else {
      clearRefreshToken();
      api.dispatch(setAccessToken(null));
      api.dispatch(baseApi.util.resetApiState());
    }
  }

  return result;
};

/**
 * Empty base — @rtk-query/codegen-openapi injects every endpoint into
 * this from openapi.yaml (see ../../openapi-config.ts and
 * `npm run gen:api`). Nothing here is hand-written per endpoint.
 */
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  endpoints: () => ({}),
});
