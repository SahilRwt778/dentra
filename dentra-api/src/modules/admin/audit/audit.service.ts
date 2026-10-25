import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { PG_POOL } from '@database/database.module';

export interface AuditEntry {
  actorUserId: string;
  action: string;
  entityType: 'dentist' | 'patient' | 'appointment' | 'admin' | 'platform_settings' | 'payout_batch' | 'withdrawal';
  entityId: string;
  detail?: string | null;
  beforeState?: unknown;
  afterState?: unknown;
}

/**
 * The one rule AdminModule exists to enforce: every approval, rejection,
 * override, disable/enable, settings edit and privacy-request resolution lands a row
 * here (schema.sql's audit_log), queryable at GET /admin/audit-log.
 */
@Injectable()
export class AuditService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async log(entry: AuditEntry, database: Pool | PoolClient = this.pool): Promise<void> {
    const actorLabel = await this.labelFor(entry.actorUserId, database);
    await database.query(
      `insert into audit_log (actor_user_id, actor_label, action, entity_type, entity_id, detail, before_state, after_state)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        entry.actorUserId,
        actorLabel,
        entry.action,
        entry.entityType,
        entry.entityId,
        entry.detail ?? null,
        entry.beforeState ? JSON.stringify(entry.beforeState) : null,
        entry.afterState ? JSON.stringify(entry.afterState) : null,
      ],
    );
  }

  async list(filters: { entityType?: string; entityId?: string }, page = 1) {
    const pageSize = 20;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.entityType) {
      params.push(filters.entityType);
      conditions.push(`entity_type = $${params.length}`);
    }
    if (filters.entityId) {
      params.push(filters.entityId);
      conditions.push(`entity_id = $${params.length}`);
    }

    const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
    params.push(pageSize, (page - 1) * pageSize);
    const { rows } = await this.pool.query(
      `select * from audit_log ${where} order by created_at desc limit $${params.length - 1} offset $${params.length}`,
      params,
    );

    const items = rows.map((r) => ({
      id: r.id,
      actorLabel: r.actor_label,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      detail: r.detail,
      createdAt: r.created_at,
    }));
    return { items, nextPage: items.length === pageSize ? page + 1 : null };
  }

  private async labelFor(userId: string, database: Pool | PoolClient): Promise<string> {
    const { rows } = await database.query<{ label: string }>(
      'select coalesce(email::text, mobile, role::text) as label from users where id = $1',
      [userId],
    );
    return rows[0]?.label ?? 'Unknown user';
  }
}
