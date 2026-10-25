import type {
  BaseQueryApi,
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from '@reduxjs/toolkit/query';
import type { RootState } from '@/store/store';

type Request = (
  args: FetchArgs
) => ReturnType<BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>>;
function sessionKey(state: unknown) {
  try {
    const token = (state as RootState).auth.accessToken;
    if (!token) return null;
    const claims = JSON.parse(
      atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
    ) as { sub: string; sid: string };
    return claims.sub && claims.sid ? `${claims.sub}:${claims.sid}` : null;
  } catch {
    return null;
  }
}
export async function downloadPrivateFile(
  url: string,
  api: BaseQueryApi,
  request: Request
): Promise<{ data: string } | { error: FetchBaseQueryError }> {
  const scope = sessionKey(api.getState());
  if (!scope)
    return {
      error: { status: 401, data: { message: 'Please sign in again.' } },
    };
  const result = await request({
    url,
    timeout: 60000,
    responseHandler: (response) =>
      response.ok ? response.blob() : response.json(),
  });
  if (result.error) return { error: result.error };
  if (scope !== sessionKey(api.getState()))
    return { error: { status: 401, data: { message: 'Session ended.' } } };
  return { data: URL.createObjectURL(result.data as Blob) };
}
