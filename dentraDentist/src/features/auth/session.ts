import axios from 'axios';
import { publicHttp } from '../../api/http';
import { tokenStorage } from '../../common/services/secure-storage';
import { clearPrivateFiles } from '../../common/services/private-files';
import type { AuthTokens } from '../../common/types/api';

let accessToken: string | null = null;
let refreshToken: string | null = null;
let version = 0;
let refreshPromise: Promise<void> | null = null;
let storageQueue: Promise<unknown> = Promise.resolve();
const listeners = new Set<() => void>();

// Serialize secure writes so a slow refresh cannot restore a logged-out session.
function writeStorage(work: () => Promise<void>): Promise<void> {
  const next = storageQueue.then(work, work);
  storageQueue = next.catch(() => {});
  return next;
}
function emit() {
  listeners.forEach(listener => listener());
}
function validTokens(tokens: AuthTokens) {
  if (!tokens.accessToken || !tokens.refreshToken)
    throw new Error('The server returned an incomplete session.');
}
export const session = {
  getAccessToken: () => accessToken,
  getVersion: () => version,
  isSignedIn: () => !!accessToken,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  async signIn(tokens: AuthTokens) {
    validTokens(tokens);
    const started = ++version;
    await writeStorage(() => tokenStorage.write(tokens.refreshToken));
    if (started !== version) return;
    accessToken = tokens.accessToken;
    refreshToken = tokens.refreshToken;
    emit();
  },
  async restore() {
    const started = version;
    const saved = await tokenStorage.read();
    if (started !== version || !saved) return;
    refreshToken = saved;
    try {
      await session.refresh();
    } catch (error) {
      if (
        axios.isAxiosError(error) &&
        [401, 403].includes(error.response?.status ?? 0)
      )
        return;
      throw error;
    }
  },
  async refresh(): Promise<void> {
    if (refreshPromise) return refreshPromise;
    if (!refreshToken) throw new Error('Please sign in again.');
    const started = version;
    const presented = refreshToken;
    const pending = (async () => {
      try {
        const { data } = await publicHttp.post<AuthTokens>('/auth/refresh', {
          refreshToken: presented,
        });
        validTokens(data);
        if (started !== version)
          throw new axios.CanceledError('Session changed.');
        await writeStorage(() => tokenStorage.write(data.refreshToken));
        if (started !== version)
          throw new axios.CanceledError('Session changed.');
        accessToken = data.accessToken;
        refreshToken = data.refreshToken;
        emit();
      } catch (error) {
        if (
          started === version &&
          axios.isAxiosError(error) &&
          [401, 403].includes(error.response?.status ?? 0)
        ) {
          await session.clear();
        }
        // A network failure keeps the saved session available for a retry.
        throw error;
      }
    })();
    refreshPromise = pending;
    try {
      await pending;
    } finally {
      if (refreshPromise === pending) refreshPromise = null;
    }
  },
  async clear() {
    version++;
    accessToken = null;
    refreshToken = null;
    refreshPromise = null;
    emit();
    await Promise.all([
      writeStorage(() => tokenStorage.clear()),
      clearPrivateFiles(),
    ]);
  },
  async signOut() {
    const token = refreshToken;
    await session.clear();
    if (token) {
      // Local logout is immediate even when the phone is offline.
      await publicHttp
        .post('/auth/logout', { refreshToken: token })
        .catch(() => {});
    }
  },
};
