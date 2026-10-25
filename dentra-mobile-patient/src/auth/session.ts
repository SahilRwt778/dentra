import { API_BASE_URL } from '@/config';
import { getRefreshToken, setRefreshToken } from './refresh-token-storage';

let pending: Promise<string | null> | null = null;
let revision = 0;
export function invalidatePendingSession() {
  revision += 1;
  pending = null;
}
export function refreshSession(): Promise<string | null> {
  if (pending) return pending;
  const currentRevision = revision;
  const operation = (async () => {
    try {
      const token = await getRefreshToken();
      if (!token || currentRevision !== revision) return null;
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: token }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) return null;
      const body = (await response.json()) as {
        accessToken?: string;
        refreshToken?: string;
      };
      if (
        !body.accessToken ||
        !body.refreshToken ||
        currentRevision !== revision
      )
        return null;
      await setRefreshToken(body.refreshToken);
      return currentRevision === revision ? body.accessToken : null;
    } catch {
      return null;
    }
  })();
  pending = operation;
  void operation.finally(() => {
    if (pending === operation) pending = null;
  });
  return operation;
}
