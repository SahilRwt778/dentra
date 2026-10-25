import * as Keychain from 'react-native-keychain';
import { API_BASE_URL } from '@/config';

const SERVICE = 'dentra_patient_pending_logouts';
let tail: Promise<unknown> = Promise.resolve();
function serial<T>(operation: () => Promise<T>): Promise<T> {
  const result = tail.then(operation, operation);
  tail = result.catch(() => undefined);
  return result;
}
async function read(): Promise<string[]> {
  const value = await Keychain.getGenericPassword({ service: SERVICE });
  if (!value) return [];
  const parsed: unknown = JSON.parse(value.password);
  return Array.isArray(parsed)
    ? parsed.filter((token): token is string => typeof token === 'string')
    : [];
}
async function save(tokens: string[]) {
  if (tokens.length)
    await Keychain.setGenericPassword(
      'pending-logouts',
      JSON.stringify(tokens),
      { service: SERVICE },
    );
  else await Keychain.resetGenericPassword({ service: SERVICE });
}
export function queueLogout(refreshToken: string) {
  return serial(async () =>
    save([...new Set([...(await read()), refreshToken])]),
  );
}
export function flushPendingLogouts(): Promise<boolean> {
  return serial(async () => {
    const tokens = await read();
    const remaining: string[] = [];
    for (const token of tokens) {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: token }),
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) remaining.push(token);
      } catch {
        remaining.push(token);
      }
    }
    await save(remaining);
    return remaining.length === 0;
  });
}
