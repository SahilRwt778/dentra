import { Base64 } from 'js-base64';
import type {
  BaseQueryApi,
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from '@reduxjs/toolkit/query';
import type { RootState } from '@/store/store';
import { cachePrivateFile } from '@/lib/private-files';
import type { PatientFile } from './types';

type Request = (
  args: FetchArgs,
) => ReturnType<BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>>;

export function signedInSession(state: unknown) {
  try {
    const token = (state as RootState).auth.accessToken;
    if (!token) return null;
    const claims = JSON.parse(Base64.decode(token.split('.')[1])) as {
      sub: string;
      sid: string;
    };
    return claims.sub && claims.sid ? `${claims.sub}:${claims.sid}` : null;
  } catch {
    return null;
  }
}

/** Binary content stays out of Redux; only a path in the app's private cache is returned. */
export async function downloadPrivateFile(
  url: string,
  file: Pick<PatientFile, 'name' | 'mimeType'>,
  api: BaseQueryApi,
  request: Request,
): Promise<{ data: string } | { error: FetchBaseQueryError }> {
  const scope = signedInSession(api.getState());
  if (!scope)
    return {
      error: { status: 401, data: { message: 'Please sign in again.' } },
    };
  const result = await request({
    url,
    timeout: 60000,
    responseHandler: async response =>
      response.ok
        ? Base64.fromUint8Array(new Uint8Array(await response.arrayBuffer()))
        : response.json(),
  });
  if (result.error) return { error: result.error };
  try {
    return {
      data: await cachePrivateFile(
        result.data as string,
        file,
        () => signedInSession(api.getState()) === scope,
      ),
    };
  } catch {
    return {
      error: {
        status: 'CUSTOM_ERROR',
        error: 'Could not save the file. Please sign in and try again.',
      },
    };
  }
}
