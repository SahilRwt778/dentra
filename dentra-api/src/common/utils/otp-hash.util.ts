import { createHmac, randomInt, timingSafeEqual } from 'crypto';

/** Four digits, including leading zeros; always carried and compared as a string. */
export function generateOtpCode(): string {
  return randomInt(0, 10_000).toString().padStart(4, '0');
}

export function hashOtpCode(code: string, secret: string): string {
  return createHmac('sha256', secret).update(code).digest('hex');
}

export function otpCodeMatches(code: string, hash: string, secret: string): boolean {
  const candidate = Buffer.from(hashOtpCode(code, secret), 'hex');
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
