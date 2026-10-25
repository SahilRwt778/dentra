import { createApi, fetchBaseQuery, type BaseQueryFn } from '@reduxjs/toolkit/query/react';
import type { FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import { refreshSession } from '@/auth/session-refresh';
import type { AppDispatch } from '@/store/store';
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

/**
 * One silent retry on a 401: the access token may have just expired
 * mid-session (15-minute TTL) — refresh once and replay the original
 * request rather than bouncing the admin to the login screen. Concurrent
 * 401s share one in-flight refresh instead of each rotating the refresh
 * token and invalidating the others' out from under them.
 */
const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  const attemptedToken = (api.getState() as RootState).auth.accessToken;
  const result = await rawBaseQuery(args, api, extraOptions);
  const url = typeof args === 'string' ? args : args.url;
  if (result.error?.status !== 401 || /^\/?auth\//.test(url)) return result;

  // A slow request may fail after another request already refreshed the access token.
  const currentToken = (api.getState() as RootState).auth.accessToken;
  if (currentToken && currentToken !== attemptedToken) return rawBaseQuery(args, api, extraOptions);
  const refresh = await refreshSession(api.dispatch as AppDispatch);
  if (refresh.status === 'success') return rawBaseQuery(args, api, extraOptions);
  if (refresh.status === 'temporary') {
    return {
      error: {
        status: 'CUSTOM_ERROR',
        error: 'Could not refresh your session. Please try again when the server is reachable.',
      },
    };
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
