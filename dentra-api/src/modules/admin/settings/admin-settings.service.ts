import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { PG_POOL } from '@database/database.module';
import { verifyPassword } from '@common/utils/password.util';
import { AuditService } from '../audit/audit.service';
import { UpdateAdminProfileDto, UpdatePlatformSettingsDto } from './dto/admin-settings.dto';

type Database = Pool | PoolClient;
type AdminProfile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  version: number;
  updatedAt: Date;
};
type PlatformSettings = {
  id: string;
  name: string;
  region: string;
  supportEmail: string;
  version: number;
  updatedAt: Date;
};

@Injectable()
export class AdminSettingsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool, private readonly audit: AuditService) {}

  profile(adminId: string) {
    return this.readProfile(this.pool, adminId);
  }

  async platform(adminId: string) {
    await this.readProfile(this.pool, adminId);
    return this.readPlatform(this.pool);
  }

  async updateProfile(adminId: string, dto: UpdateAdminProfileDto) {
    if (dto.name === undefined && dto.email === undefined && dto.phone === undefined) {
      throw new BadRequestException('Provide at least one profile field to update.');
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const admin = await this.lockAdmin(client, adminId);
      const before = await this.readProfile(client, adminId);
      this.assertVersion(dto.version, before.version);
      const next = {
        name: dto.name ?? before.name,
        email: dto.email ?? before.email,
        phone: dto.phone === undefined ? before.phone : dto.phone,
      };
      if (next.email.toLowerCase() !== before.email.toLowerCase()) {
        if (!dto.currentPassword)
          throw new BadRequestException('Enter your current password to change your login email.');
        if (!(await verifyPassword(dto.currentPassword, admin.password_hash))) {
          throw new ForbiddenException('The current password is incorrect.');
        }
      }
      if (next.name === before.name && next.email === before.email && next.phone === before.phone) {
        await client.query('COMMIT');
        return before;
      }
      await client.query('update users set email = $2, mobile = $3, updated_at = now() where id = $1', [
        adminId,
        next.email,
        next.phone,
      ]);
      await client.query(
        `insert into admin_profiles (user_id, full_name, version) values ($1, $2, 1)
         on conflict (user_id) do update set full_name = excluded.full_name,
           version = admin_profiles.version + 1, updated_at = now()`,
        [adminId, next.name],
      );
      const after = await this.readProfile(client, adminId);
      await this.audit.log(
        {
          actorUserId: adminId,
          action: 'admin_profile_updated',
          entityType: 'admin',
          entityId: adminId,
          detail: 'Updated own admin profile',
          beforeState: before,
          afterState: after,
        },
        client,
      );
      await client.query('COMMIT');
      return after;
    } catch (error) {
      await client.query('ROLLBACK');
      if ((error as { code?: string })?.code === '23505') {
        throw new ConflictException('That email or mobile number is already in use.');
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async updatePlatform(adminId: string, dto: UpdatePlatformSettingsDto) {
    if (dto.name === undefined && dto.region === undefined && dto.supportEmail === undefined) {
      throw new BadRequestException('Provide at least one platform field to update.');
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await this.lockAdmin(client, adminId);
      const before = await this.readPlatform(client, true);
      this.assertVersion(dto.version, before.version);
      const next = {
        name: dto.name ?? before.name,
        region: dto.region ?? before.region,
        supportEmail: dto.supportEmail ?? before.supportEmail,
      };
      if (
        next.name === before.name &&
        next.region === before.region &&
        next.supportEmail === before.supportEmail
      ) {
        await client.query('COMMIT');
        return before;
      }
      await client.query(
        `update platform_settings set name = $1, region = $2, support_email = $3,
         version = version + 1, updated_at = now() where singleton`,
        [next.name, next.region, next.supportEmail],
      );
      const after = await this.readPlatform(client);
      await this.audit.log(
        {
          actorUserId: adminId,
          action: 'platform_settings_updated',
          entityType: 'platform_settings',
          entityId: before.id,
          detail: 'Updated platform details',
          beforeState: before,
          afterState: after,
        },
        client,
      );
      await client.query('COMMIT');
      return after;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async readProfile(database: Database, adminId: string): Promise<AdminProfile> {
    const { rows } = await database.query<AdminProfile>(
      `select u.id, coalesce(p.full_name, 'Dentra admin') as name, u.email::text as email,
         u.mobile as phone, coalesce(p.version, 0) as version,
         greatest(u.updated_at, p.updated_at) as "updatedAt"
       from users u left join admin_profiles p on p.user_id = u.id
       where u.id = $1 and u.role = 'admin' and u.status = 'active'`,
      [adminId],
    );
    if (!rows[0]) throw new ForbiddenException('This admin account is unavailable.');
    return rows[0];
  }

  private async readPlatform(database: Database, lock = false): Promise<PlatformSettings> {
    const { rows } = await database.query<PlatformSettings>(
      `select id, name, region, support_email as "supportEmail", version, updated_at as "updatedAt"
       from platform_settings where singleton ${lock ? 'for update' : ''}`,
    );
    if (!rows[0])
      throw new ConflictException('Platform settings are unavailable. Apply the admin settings migration.');
    return rows[0];
  }

  private async lockAdmin(client: PoolClient, adminId: string) {
    const { rows } = await client.query<{ password_hash: string }>(
      "select password_hash from users where id = $1 and role = 'admin' and status = 'active' for update",
      [adminId],
    );
    if (!rows[0]) throw new ForbiddenException('This admin account is unavailable.');
    return rows[0];
  }

  private assertVersion(expected: number, actual: number) {
    if (expected !== actual)
      throw new ConflictException(
        'These details changed in another session. Cancel editing and reopen the form to load the latest version.',
      );
  }
}
