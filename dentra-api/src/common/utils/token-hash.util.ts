import { createHmac, randomBytes } from 'crypto';

/** Opaque refresh token — the client sends this back; the DB only ever stores its hash. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token).digest('hex');
}
