import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '@database/database.module';
import { DentistsService } from '@modules/identity/dentists/dentists.service';
import { UsersService } from '@modules/identity/users/users.service';
import { AuditService } from '../audit/audit.service';
import type { AdminCreateDentistDto } from './dto/admin-create-dentist.dto';
import { REQUIRED_KYC_DOC_TYPES } from '@modules/identity/dentists/dto/kyc-doc-type';

const DENTIST_STATUSES = ['draft', 'pending_review', 'verified', 'rejected', 'disabled'];

@Injectable()
export class AdminDentistsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly dentists: DentistsService,
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  async findOne(dentistId: string) {
    return this.dentists.toResponse(await this.getRowOrThrow(dentistId));
  }

  async list(status?: string, page = 1) {
    if (status && !DENTIST_STATUSES.includes(status)) {
      throw new BadRequestException(`status must be one of ${DENTIST_STATUSES.join(', ')}`);
    }
    const pageSize = 20;
    const params: unknown[] = [];
    let where = '';
    if (status) {
      params.push(status);
      where = `where status = $${params.length}`;
    }
    params.push(pageSize, (page - 1) * pageSize);
    const { rows } = await this.pool.query(
      `select * from dentists ${where} order by submitted_at desc limit $${params.length - 1} offset $${params.length}`,
      params,
    );
    const items = await Promise.all(rows.map((r) => this.dentists.toResponse(r)));
    return { items, nextPage: items.length === pageSize ? page + 1 : null };
  }

  async create(adminId: string, dto: AdminCreateDentistDto) {
    if (dto.overrideVerify && !dto.overrideReason?.trim()) {
      throw new UnprocessableEntityException('overrideReason is required when overrideVerify is true.');
    }

    const existing = await this.users.findByMobileAndRole(dto.mobile, 'dentist');
    if (existing && (await this.users.hasProfile(existing.id, 'dentist'))) {
      throw new ConflictException('A dentist application already exists for this mobile number.');
    }
    const userId = existing ? existing.id : (await this.users.findOrCreateByMobileAndRole(dto.mobile, 'dentist')).id;

    const status = dto.overrideVerify ? 'verified' : 'pending_review';
    const offersVideo = dto.offersVideo ?? false;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `insert into dentists (
           user_id, full_name, email, qualification, specialization, council_reg_no,
           offers_video, video_hours_from, video_hours_to, fee_video_paise, fee_clinic_paise,
           status, submitted_by, submitted_at, reviewed_by, reviewed_at
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'admin', now(), $13, $14)
         returning *`,
        [
          userId,
          dto.fullName,
          dto.email ?? null,
          // Qualification, specialization and councilRegNo are left blank
          // when the admin doesn't have them yet — the invited dentist
          // fills them in via PATCH /dentists/me before review, per
          // DENTRA_ARCHITECTURE.md's admin-created onboarding flow.
          dto.qualification ?? '',
          dto.specialization ?? '',
          dto.councilRegNo ?? '',
          offersVideo,
          offersVideo ? '10:00' : null,
          offersVideo ? '18:30' : null,
          dto.feeVideoPaise ?? 0,
          dto.feeClinicPaise ?? 0,
          status,
          dto.overrideVerify ? adminId : null,
          dto.overrideVerify ? new Date() : null,
        ],
      );
      await client.query(
        `insert into dentist_clinics (dentist_id, name, hours_from, hours_to) values ($1, $2, '10:00', '18:30')`,
        [userId, dto.primaryClinicName],
      );
      await client.query('COMMIT');

      await this.audit.log({
        actorUserId: adminId,
        action: dto.overrideVerify ? 'created_with_override_verify' : 'created',
        entityType: 'dentist',
        entityId: userId,
        detail: dto.overrideVerify ? dto.overrideReason : null,
      });

      return this.dentists.toResponse(rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async approve(adminId: string, dentistId: string, force: boolean) {
    const row = await this.getRowOrThrow(dentistId);
    if (row.status !== 'pending_review') {
      throw new ConflictException('Only applications pending review can be approved.');
    }

    if (!force) {
      const { rows: docs } = await this.pool.query('select doc_type from dentist_documents where dentist_id = $1', [
        dentistId,
      ]);
      const have = new Set(docs.map((d) => d.doc_type));
      const missing = REQUIRED_KYC_DOC_TYPES.filter((t) => !have.has(t));
      if (missing.length > 0) {
        throw new UnprocessableEntityException(
          `Missing required documents: ${missing.join(', ')}. Pass force=true to override.`,
        );
      }
    }

    const updated = await this.setStatus(row, 'verified', { reviewedBy: adminId, clearRejection: true });

    await this.audit.log({
      actorUserId: adminId,
      action: force ? 'approved_with_override' : 'approved',
      entityType: 'dentist',
      entityId: dentistId,
      detail: force ? 'Approved despite missing required documents (force=true).' : null,
      beforeState: { status: row.status },
      afterState: { status: 'verified' },
    });

    return this.dentists.toResponse(updated);
  }

  async reject(adminId: string, dentistId: string, reason: string) {
    const row = await this.getRowOrThrow(dentistId);
    if (row.status !== 'pending_review') {
      throw new ConflictException('Only applications pending review can be rejected.');
    }

    const updated = await this.setStatus(row, 'rejected', { reviewedBy: adminId, rejectionReason: reason });

    await this.audit.log({
      actorUserId: adminId,
      action: 'rejected',
      entityType: 'dentist',
      entityId: dentistId,
      detail: reason,
      beforeState: { status: row.status },
      afterState: { status: 'rejected' },
    });

    return this.dentists.toResponse(updated);
  }

  async disable(adminId: string, dentistId: string) {
    const row = await this.getRowOrThrow(dentistId);
    if (row.status !== 'verified') {
      throw new ConflictException('Only verified dentists can be disabled.');
    }

    const updated = await this.setStatus(row, 'disabled', {});

    await this.audit.log({
      actorUserId: adminId,
      action: 'disabled',
      entityType: 'dentist',
      entityId: dentistId,
      beforeState: { status: row.status },
      afterState: { status: 'disabled' },
    });

    return this.dentists.toResponse(updated);
  }

  async enable(adminId: string, dentistId: string) {
    const row = await this.getRowOrThrow(dentistId);
    if (row.status !== 'disabled') {
      throw new ConflictException('Only disabled dentists can be re-enabled.');
    }

    const updated = await this.setStatus(row, 'verified', {});

    await this.audit.log({
      actorUserId: adminId,
      action: 'enabled',
      entityType: 'dentist',
      entityId: dentistId,
      beforeState: { status: row.status },
      afterState: { status: 'verified' },
    });

    return this.dentists.toResponse(updated);
  }

  /** Rejected only — gives the dentist another pass through the review queue after they resubmit. */
  async reconsider(adminId: string, dentistId: string) {
    const row = await this.getRowOrThrow(dentistId);
    if (row.status !== 'rejected') {
      throw new ConflictException('Only rejected applications can be moved back to review.');
    }

    const { rows } = await this.pool.query(
      `update dentists set status = 'pending_review', resubmission_count = resubmission_count + 1, updated_at = now()
       where user_id = $1
       returning *`,
      [dentistId],
    );
    const updated = rows[0];

    await this.audit.log({
      actorUserId: adminId,
      action: 'moved_to_review',
      entityType: 'dentist',
      entityId: dentistId,
      beforeState: { status: row.status },
      afterState: { status: 'pending_review' },
    });

    return this.dentists.toResponse(updated);
  }

  // ---------- internals ----------

  private async getRowOrThrow(dentistId: string) {
    const row = await this.dentists.findRawById(dentistId);
    if (!row) throw new NotFoundException('No such dentist.');
    return row;
  }

  private async setStatus(
    row: Record<string, any>,
    status: string,
    opts: { reviewedBy?: string; rejectionReason?: string; clearRejection?: boolean },
  ) {
    const { rows } = await this.pool.query(
      `update dentists set
         status = $2,
         reviewed_by = coalesce($3, reviewed_by),
         reviewed_at = case when $3 is not null then now() else reviewed_at end,
         rejection_reason = $4,
         updated_at = now()
       where user_id = $1 and status = $5
       returning *`,
      [row.user_id, status, opts.reviewedBy ?? null, opts.rejectionReason ?? (opts.clearRejection ? null : row.rejection_reason), row.status],
    );
    if (!rows[0]) throw new ConflictException('This application has changed. Refresh before reviewing it again.');
    return rows[0];
  }
}
