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
import { clearRefreshToken } from '@/auth/refresh-token-storage';
import { refreshSession } from '@/auth/session';
import { API_BASE_URL } from '@/config';
import type { RootState } from '@/store/store';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  timeout: 20000,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

// Retry a protected request once after refreshing an expired access token.
// refreshSession() shares one refresh across concurrent requests.
export const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const sentToken = (api.getState() as RootState).auth.accessToken;
  const result = await rawBaseQuery(args, api, extraOptions);
  const url = typeof args === 'string' ? args : args.url;
  if (result.error?.status !== 401 || url.startsWith('/auth/')) return result;

  const currentToken = (api.getState() as RootState).auth.accessToken;
  const newAccessToken =
    currentToken && currentToken !== sentToken
      ? currentToken
      : await refreshSession();

  if (newAccessToken) {
    api.dispatch(setAccessToken(newAccessToken));
    return rawBaseQuery(args, api, extraOptions);
  }

  if ((api.getState() as RootState).auth.accessToken === sentToken) {
    await clearRefreshToken().catch(() => undefined);
    api.dispatch(setAccessToken(null));
    api.dispatch(baseApi.util.resetApiState());
  }

  return result;
};

// Generated endpoints and all feature modules share this client and cache.
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  endpoints: () => ({}),
});
