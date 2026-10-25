import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '@database/database.module';
import { AuditService } from '../audit/audit.service';

// DPDP Act, 2023 grievance-redressal window. Treated as a placeholder
// pending legal confirmation of the exact statutory figure — see
// DENTRA_ARCHITECTURE.md's open assumptions.
const SLA_DAYS = 30;

@Injectable()
export class PrivacyService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly audit: AuditService,
  ) {}

  async file(patientId: string, type: 'export' | 'erase') {
    const { rows } = await this.pool.query(
      `insert into privacy_requests (patient_id, type, sla_due_at)
       values ($1, $2, now() + interval '${SLA_DAYS} days')
       returning id`,
      [patientId, type],
    );
    return this.toResponse(await this.loadWithPatientName(rows[0].id));
  }

  async list(status?: string) {
    const params: unknown[] = [];
    let where = '';
    if (status) {
      params.push(status);
      where = `where pr.status = $1`;
    }
    const { rows } = await this.pool.query(
      `select pr.*, p.full_name as patient_name
       from privacy_requests pr
       join patients p on p.user_id = pr.patient_id
       ${where}
       order by pr.created_at desc`,
      params,
    );
    return rows.map((r) => this.toResponse(r));
  }

  async resolve(adminId: string, requestId: string) {
    const { rows } = await this.pool.query('select * from privacy_requests where id = $1', [requestId]);
    const row = rows[0];
    if (!row) throw new NotFoundException('No such privacy request.');
    if (row.status === 'resolved') throw new ConflictException('This request is already resolved.');

    // TODO (pending the export/anonymization job-runner decision):
    // this only flips the status — it doesn't yet trigger the actual
    // data-package generation or PII-anonymization job. Same
    // not-yet-chosen-vendor pattern as documents.storage.ts.
    await this.pool.query(
      `update privacy_requests set status = 'resolved', resolved_at = now(), resolved_by = $2 where id = $1`,
      [requestId, adminId],
    );

    await this.audit.log({
      actorUserId: adminId,
      action: row.type === 'export' ? 'resolved_export' : 'resolved_erase',
      entityType: 'patient',
      entityId: row.patient_id,
      detail: `Privacy request ${requestId} (${row.type}) resolved.`,
    });

    return this.toResponse(await this.loadWithPatientName(requestId));
  }

  private async loadWithPatientName(id: string) {
    const { rows } = await this.pool.query(
      `select pr.*, p.full_name as patient_name
       from privacy_requests pr
       join patients p on p.user_id = pr.patient_id
       where pr.id = $1`,
      [id],
    );
    return rows[0];
  }

  private toResponse(row: Record<string, any>) {
    return {
      id: row.id,
      patientId: row.patient_id,
      patientName: row.patient_name,
      type: row.type,
      status: row.status,
      slaDueAt: row.sla_due_at,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
    };
  }
}
