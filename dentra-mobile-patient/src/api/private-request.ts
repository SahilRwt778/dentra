import type { FetchArgs } from '@reduxjs/toolkit/query/react';
import { store } from '@/store/store';
import { baseQueryWithReauth } from './base-api';

/** Use the existing authenticated client without putting media credentials in Redux. */
export async function requestPrivate<T>(
  args: FetchArgs,
  signal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const result = await baseQueryWithReauth(
    args,
    {
      signal: signal ?? controller.signal,
      abort: () => controller.abort(),
      dispatch: store.dispatch,
      getState: store.getState,
      extra: undefined,
      endpoint: 'privateVideoSession',
      type: 'mutation',
    },
    {},
  );
  if (result.error) throw result.error;
  return result.data as T;
}
