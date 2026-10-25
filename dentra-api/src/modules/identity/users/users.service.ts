import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '@database/database.module';

export type IdentityRole = 'patient' | 'dentist';

export interface UserRow {
  id: string;
  role: 'patient' | 'dentist' | 'admin';
}

export interface AdminCredentials {
  id: string;
  passwordHash: string | null;
  status: string;
}

/**
 * Identity-only lookups against the users table, plus the "does a real
 * profile exist yet" check both OTP flows (patient and dentist
 * self-serve) need symmetrically. Profile data itself (name, DOB,
 * credentials, clinics, ...) belongs to PatientsService/DentistsService
 * — this service never writes to the patients/dentists tables beyond
 * the bare users row OTP verify creates.
 */
@Injectable()
export class UsersService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findByMobileAndRole(mobile: string, role: IdentityRole): Promise<UserRow | null> {
    const { rows } = await this.pool.query<UserRow>(
      'select id, role from users where mobile = $1 and role = $2',
      [mobile, role],
    );
    return rows[0] ?? null;
  }

  /** Atomically reuse or create one role-scoped identity; never change an existing account's role. */
  async findOrCreateByMobileAndRole(mobile: string, role: IdentityRole): Promise<UserRow> {
    const { rows } = await this.pool.query<UserRow>(
      `insert into users (role, mobile) values ($2, $1)
       on conflict (mobile, role) where mobile is not null
       do update set mobile = excluded.mobile
       returning id, role`,
      [mobile, role],
    );
    return rows[0];
  }

  /**
   * True once registration/application has actually run. A users row
   * alone isn't enough — someone who verified an OTP and then abandoned
   * the next step has a users row but no profile, and must be sent back
   * through it on their next login, not treated as returning.
   */
  async hasProfile(userId: string, role: IdentityRole): Promise<boolean> {
    const table = role === 'patient' ? 'patients' : 'dentists';
    const { rows } = await this.pool.query(`select 1 from ${table} where user_id = $1`, [userId]);
    return rows.length > 0;
  }

  /** Admin accounts are seeded directly by ops (see scripts/create-admin.ts) — there's no self-serve signup. */
  async findAdminByEmail(email: string): Promise<AdminCredentials | null> {
    const { rows } = await this.pool.query(
      `select id, password_hash, status from users where email = $1 and role = 'admin'`,
      [email],
    );
    const row = rows[0];
    if (!row) return null;
    return { id: row.id, passwordHash: row.password_hash, status: row.status };
  }
}
