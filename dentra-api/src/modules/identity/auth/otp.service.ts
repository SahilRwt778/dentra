import { GoneException, HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Pool, PoolClient } from 'pg';
import { PG_POOL } from '@database/database.module';
import type { AppConfig } from '@config/configuration';
import { generateOtpCode, hashOtpCode, otpCodeMatches } from '@common/utils/otp-hash.util';
import type { IdentityRole } from '../users/users.service';

type OtpPurpose = IdentityRole | 'prescription';
type OtpBinding = { mobile: string; purpose: 'prescription'; context: string };
type OtpVerification = HttpException | { mobile: string; purpose: OtpPurpose };

/** 429 — distinct from NestJS's built-in ThrottlerException so callers don't need that package just for this. */
class TooManyRequestsException extends HttpException {
  constructor(message: string) {
    super({ message }, HttpStatus.TOO_MANY_REQUESTS);
  }
}

/** 423 — locked, per openapi.yaml's otp/verify response. Not in Nest's HttpStatus enum, hence the literal. */
class LockedException extends HttpException {
  constructor(message: string) {
    super({ message }, 423);
  }
}

/**
 * Everything schema.sql's otp_codes table needs to do its job: rate
 * limiting, hashed-at-rest codes, expiry, and the 5-attempt lockout —
 * all enforced here so no caller can accidentally skip a check.
 */
@Injectable()
export class OtpService {
  private readonly otp: AppConfig['otp'];

  constructor(@Inject(PG_POOL) private readonly pool: Pool, config: ConfigService<AppConfig>) {
    this.otp = config.get('otp', { infer: true })!;
  }

  async assertNotRateLimited(mobile: string): Promise<void> {
    const { rows: recent } = await this.pool.query<{ created_at: Date; attempts: number }>(
      `select created_at, attempts from otp_codes
       where mobile = $1 and created_at > now() - interval '1 hour'
       order by created_at desc`,
      [mobile],
    );

    if (recent.length >= this.otp.maxRequestsPerHour) {
      throw new TooManyRequestsException('Too many requests for this number. Try again later.');
    }

    const mostRecent = recent[0];
    if (mostRecent) {
      const secondsSinceLast = (Date.now() - mostRecent.created_at.getTime()) / 1000;
      if (secondsSinceLast < this.otp.resendCooldownSeconds) {
        throw new TooManyRequestsException(
          `Wait ${Math.ceil(this.otp.resendCooldownSeconds - secondsSinceLast)}s before requesting another code.`,
        );
      }
      const lockedOutUntil = this.otp.lockoutMinutes * 60;
      if (mostRecent.attempts >= this.otp.maxVerifyAttempts && secondsSinceLast < lockedOutUntil) {
        throw new LockedException(
          `Too many incorrect attempts. Try again in ${Math.ceil((lockedOutUntil - secondsSinceLast) / 60)} minutes.`,
        );
      }
    }
  }

  /** Returns the plaintext code too — the caller (AuthService) is the one that "sends" it. */
  async create(mobile: string, purpose: OtpPurpose, context?: string): Promise<{ otpId: string; code: string }> {
    const code = generateOtpCode();
    const codeHash = hashOtpCode(code, this.otp.hashSecret);
    const { rows } = await this.pool.query<{ id: string }>(
      `insert into otp_codes (mobile, purpose, context, code_hash, expires_at)
       values ($1, $2, $3, $4, now() + interval '${this.otp.ttlSeconds} seconds')
       returning id`,
      [mobile, purpose, context ?? null, codeHash],
    );
    return { otpId: rows[0].id, code };
  }

  /** Throws on any failure; returns the row's mobile/purpose on success so the caller can issue tokens. */
  async verifyAndConsume(otpId: string, code: string): Promise<{ mobile: string; purpose: IdentityRole }> {
    const client = await this.pool.connect();
    let result: OtpVerification;
    try {
      await client.query('BEGIN');
      result = await this.verifyInTransaction(client, otpId, code);
      // Failed attempts must persist too; throw the validation error only after committing.
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    if (result instanceof HttpException) throw result;
    // Login verification never accepts a prescription challenge.
    return { mobile: result.mobile, purpose: result.purpose as IdentityRole };
  }

  /** Caller owns BEGIN/COMMIT; commit validation failures to preserve the attempt counter. */
  async verifyInTransaction(
    client: PoolClient,
    otpId: string,
    code: string,
    binding?: OtpBinding,
  ): Promise<OtpVerification> {
    const { rows } = await client.query<{
      mobile: string;
      purpose: OtpPurpose;
      context: string | null;
      code_hash: string;
      expires_at: Date;
      attempts: number;
      consumed_at: Date | null;
    }>(
      `select mobile, purpose, context, code_hash, expires_at, attempts, consumed_at
        from otp_codes where id = $1 for update`,
      [otpId],
    );
    const row = rows[0];
    const matchesPurpose =
      row &&
      (binding
        ? row.mobile === binding.mobile && row.purpose === binding.purpose && row.context === binding.context
        : (row.purpose === 'patient' || row.purpose === 'dentist') && row.context === null);
    if (!row || row.consumed_at || !matchesPurpose) {
      return new UnauthorizedException('That code is incorrect or belongs to a different request.');
    }
    if (row.expires_at.getTime() <= Date.now()) {
      return new GoneException('That code has expired. Request a new one.');
    }
    if (row.attempts >= this.otp.maxVerifyAttempts) {
      return new LockedException('Too many incorrect attempts. Request a new code after the lockout.');
    }
    if (!otpCodeMatches(code, row.code_hash, this.otp.hashSecret)) {
      const attempts = row.attempts + 1;
      await client.query('update otp_codes set attempts = $1 where id = $2', [attempts, otpId]);
      return attempts >= this.otp.maxVerifyAttempts
        ? new LockedException('Too many incorrect attempts. Try again in 15 minutes.')
        : new UnauthorizedException('That code is incorrect.');
    }
    await client.query('update otp_codes set consumed_at = now() where id = $1', [otpId]);
    return { mobile: row.mobile, purpose: row.purpose };
  }
}
