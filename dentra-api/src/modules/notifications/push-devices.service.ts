import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { PG_POOL } from '@database/database.module';
import type { AuthenticatedUser } from '@common/decorators/current-user.decorator';
import type { RegisterPushDeviceDto } from './dto/register-push-device.dto';

@Injectable()
export class PushDevicesService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async register(user: AuthenticatedUser, dto: RegisterPushDeviceDto) {
    if (!user.sessionId || !user.deviceId || user.deviceId.length > 200) {
      throw new ConflictException('Sign in again to enable phone notifications.');
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const session = await client.query(
        `select rt.id from refresh_tokens rt join users u on u.id = rt.user_id
         join patients p on p.user_id = u.id
         where rt.user_id = $1 and rt.session_id = $2 and rt.device_id = $3
           and rt.revoked_at is null and rt.expires_at > now() and u.status = 'active' and u.role = 'patient'
         for share of rt`,
        [user.userId, user.sessionId, user.deviceId],
      );
      if (!session.rowCount) throw new ConflictException('Your session has ended. Sign in again.');
      const tokenHash = createHash('sha256').update(dto.token).digest('hex');
      // One FCM registration belongs to one install/account at a time.
      await client.query('delete from push_devices where token_hash = $1 and installation_id <> $2', [
        tokenHash,
        user.deviceId,
      ]);
      const { rows } = await client.query(
        `insert into push_devices (user_id, installation_id, session_id, token, token_hash, platform)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (installation_id) do update set
           binding_id = case when push_devices.user_id = excluded.user_id
             and push_devices.session_id = excluded.session_id and push_devices.token_hash = excluded.token_hash
             and push_devices.enabled then push_devices.binding_id else gen_random_uuid() end,
           user_id = excluded.user_id, session_id = excluded.session_id, token = excluded.token,
           token_hash = excluded.token_hash, platform = excluded.platform, enabled = true,
           updated_at = now(), last_seen_at = now()
         where push_devices.session_id = excluded.session_id
           or coalesce((select min(created_at) from refresh_tokens where session_id = push_devices.session_id), '-infinity'::timestamptz)
             <= (select min(created_at) from refresh_tokens where session_id = excluded.session_id)
         returning id, platform, enabled, last_seen_at`,
        [user.userId, user.deviceId, user.sessionId, dto.token, tokenHash, dto.platform],
      );
      if (!rows[0]) throw new ConflictException('A newer login controls this phone. Sign in again.');
      await client.query('COMMIT');
      return { id: rows[0].id, platform: rows[0].platform, enabled: rows[0].enabled, lastSeenAt: rows[0].last_seen_at };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async unregister(user: AuthenticatedUser) {
    if (!user.sessionId || !user.deviceId) return;
    await this.pool.query(
      `update push_devices set enabled = false, binding_id = gen_random_uuid(), updated_at = now()
       where user_id = $1 and installation_id = $2 and session_id = $3 and enabled`,
      [user.userId, user.deviceId, user.sessionId],
    );
  }
}
