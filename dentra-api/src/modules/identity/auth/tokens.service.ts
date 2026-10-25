import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Pool, PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { PG_POOL } from '@database/database.module';
import type { AppConfig } from '@config/configuration';
import { generateOpaqueToken, hashToken } from '@common/utils/token-hash.util';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  isNewAccount: boolean;
}

/**
 * Issues the access+refresh pair every login flow ends with, and
 * rotates/revokes refresh tokens per device — so one lost phone can be
 * revoked from Admin Web without touching the user's other sessions.
 */
@Injectable()
export class TokensService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig>,
  ) {}

  async issue(
    userId: string,
    role: 'patient' | 'dentist' | 'admin',
    deviceId: string,
    isNewAccount = false,
  ): Promise<AuthTokens> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `update refresh_tokens set revoked_at = now() where user_id = $1 and device_id = $2 and revoked_at is null`,
        [userId, deviceId],
      );
      await client.query(
        `update push_devices set enabled = false, binding_id = gen_random_uuid(), updated_at = now()
         where user_id = $1 and installation_id = $2 and enabled`,
        [userId, deviceId],
      );
      const result = await this.createPair(client, userId, role, deviceId, randomUUID(), isNewAccount);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /** Rotate once, preserving the session family that owns this device's push registration. */
  async rotate(presentedToken: string): Promise<AuthTokens> {
    const hash = hashToken(presentedToken, this.config.get('jwt.accessSecret', { infer: true })!);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<{
        id: string;
        user_id: string;
        device_id: string;
        session_id: string;
        expires_at: Date;
      }>(
        `select id, user_id, device_id, session_id, expires_at from refresh_tokens
          where token_hash = $1 and revoked_at is null for update`,
        [hash],
      );
      const row = rows[0];
      if (!row || row.expires_at.getTime() <= Date.now()) {
        throw new UnauthorizedException('Refresh token invalid, expired, or revoked.');
      }
      const { rows: users } = await client.query<{ role: 'patient' | 'dentist' | 'admin' }>(
        `select role from users where id = $1 and status = 'active'`,
        [row.user_id],
      );
      if (!users[0]) throw new UnauthorizedException('Account no longer active.');
      await client.query('update refresh_tokens set revoked_at = now() where id = $1', [row.id]);
      const result = await this.createPair(client, row.user_id, users[0].role, row.device_id, row.session_id);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /** The opaque token can revoke its own family even after access-token expiry or rotation. */
  async revoke(presentedToken: string): Promise<void> {
    const hash = hashToken(presentedToken, this.config.get('jwt.accessSecret', { infer: true })!);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<{ user_id: string; session_id: string }>(
        'select user_id, session_id from refresh_tokens where token_hash = $1 for update',
        [hash],
      );
      if (rows[0]) {
        await client.query(
          'update refresh_tokens set revoked_at = coalesce(revoked_at, now()) where user_id = $1 and session_id = $2',
          [rows[0].user_id, rows[0].session_id],
        );
        await client.query(
          `update push_devices set enabled = false, binding_id = gen_random_uuid(), updated_at = now()
           where user_id = $1 and session_id = $2 and enabled`,
          [rows[0].user_id, rows[0].session_id],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async createPair(
    client: PoolClient,
    userId: string,
    role: 'patient' | 'dentist' | 'admin',
    deviceId: string,
    sessionId: string,
    isNewAccount = false,
  ): Promise<AuthTokens> {
    const accessToken = await this.jwt.signAsync({ sub: userId, role, sid: sessionId, did: deviceId });
    const refreshToken = generateOpaqueToken();
    const hash = hashToken(refreshToken, this.config.get('jwt.accessSecret', { infer: true })!);
    await client.query(
      `insert into refresh_tokens (user_id, device_id, session_id, token_hash, expires_at)
       values ($1, $2, $3, $4, now() + make_interval(days => $5))`,
      [userId, deviceId, sessionId, hash, this.refreshTtlDays()],
    );
    return { accessToken, refreshToken, expiresInSeconds: this.accessTtlSeconds(), isNewAccount };
  }

  private accessTtlSeconds(): number {
    const raw = this.config.get('jwt.accessExpiresIn', { infer: true })!;
    const match = /^(\d+)m$/.exec(raw);
    return match ? parseInt(match[1], 10) * 60 : 900;
  }

  private refreshTtlDays(): number {
    const raw = this.config.get('jwt.refreshExpiresIn', { infer: true })!;
    const match = /^(\d+)d$/.exec(raw);
    return match ? parseInt(match[1], 10) : 30;
  }
}
