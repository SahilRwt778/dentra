export type RefreshResult =
  | { status: 'success'; accessToken: string; refreshToken: string }
  | { status: 'invalid' }
  | { status: 'temporary' }
  | { status: 'superseded' };

type Options = {
  readToken: () => string | null;
  saveToken: (token: string) => void;
  clearToken: () => void;
  request: (token: string) => Promise<Response>;
  withLock?: <T>(operation: () => Promise<T>) => Promise<T>;
};

/** One rotation shared by reload restoration and expired API requests. */
export function createTokenRefresher(options: Options) {
  let pending: Promise<RefreshResult> | null = null;

  async function rotate(): Promise<RefreshResult> {
    // Read inside the browser lock: another tab may have just rotated the stored token.
    const token = options.readToken();
    if (!token) return { status: 'invalid' };
    try {
      const response = await options.request(token);
      // A logout or a new login while the request was in flight wins over its response.
      if (options.readToken() !== token) return { status: 'superseded' };
      if (response.status === 401 || response.status === 403) {
        options.clearToken();
        return { status: 'invalid' };
      }
      if (!response.ok) return { status: 'temporary' };
      const body = (await response.json()) as { accessToken?: unknown; refreshToken?: unknown };
      if (options.readToken() !== token) return { status: 'superseded' };
      if (
        typeof body.accessToken !== 'string' ||
        !body.accessToken ||
        typeof body.refreshToken !== 'string' ||
        !body.refreshToken
      ) {
        return { status: 'temporary' };
      }
      options.saveToken(body.refreshToken);
      return { status: 'success', accessToken: body.accessToken, refreshToken: body.refreshToken };
    } catch {
      return { status: options.readToken() === token ? 'temporary' : 'superseded' };
    }
  }

  function refresh(publish?: (result: RefreshResult) => RefreshResult): Promise<RefreshResult> {
    if (!pending) {
      const attempt = options.withLock ? options.withLock(rotate) : rotate();
      pending = attempt
        .catch((): RefreshResult => ({ status: 'temporary' }))
        // Publish before releasing the shared request, so a delayed 401 sees the new access token.
        .then((result) => (publish ? publish(result) : result))
        .finally(() => {
          pending = null;
        });
    }
    return pending;
  }

  return { refresh };
}
