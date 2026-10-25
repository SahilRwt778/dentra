import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '@database/database.module';
import { generateSlots, slotHasPassed, SLOT_MINUTES } from '@common/utils/slots.util';
import {
  resolveHours,
  type AvailabilityClinicRow,
  type AvailabilityDentistRow,
} from '@common/utils/dentist-availability.util';
import { UsersService } from '../users/users.service';
import type { DentistApplicationDto } from './dto/dentist-application.dto';
import type { DentistSelfUpdateDto } from './dto/dentist-self-update.dto';
import type { ClinicInputDto } from './dto/clinic-input.dto';
import { DentistDocumentsStorage } from './documents.storage';
import type { KycDocType } from './dto/kyc-doc-type';
import { REQUIRED_KYC_DOC_TYPES } from './dto/kyc-doc-type';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { AvailabilityService } from './availability.service';

export interface ClinicResponse {
  id: string;
  name: string;
  addressLine: string | null;
  pincode: string | null;
  phone: string | null;
  hoursFrom: string;
  hoursTo: string;
  workingDays: number[];
}

@Injectable()
export class DentistsService {
  private readonly logger = new Logger(DentistsService.name);
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly users: UsersService,
    private readonly notifications: NotificationsService,
    private readonly availability: AvailabilityService,
    private readonly documents: DentistDocumentsStorage,
  ) {}

  // ---------- public, patient-facing ----------

  async searchPublic(filters: { specialization?: string; type?: 'video' | 'clinic'; q?: string }, page = 1) {
    const pageSize = 20;
    const conditions = [`d.status = 'verified'`];
    const params: unknown[] = [];

    if (filters.specialization) {
      params.push(filters.specialization);
      conditions.push(`d.specialization = $${params.length}`);
    }
    if (filters.type === 'video') {
      conditions.push('d.offers_video = true');
    }
    if (filters.q) {
      params.push(`%${filters.q}%`);
      const p = `$${params.length}`;
      conditions.push(
        `(d.full_name ilike ${p} or d.specialization ilike ${p} or d.languages::text ilike ${p}
          or exists (select 1 from dentist_clinics c where c.dentist_id = d.user_id and c.is_active and c.name ilike ${p}))`,
      );
    }

    params.push(pageSize, (page - 1) * pageSize);
    const { rows } = await this.pool.query(
      `select d.* from dentists d where ${conditions.join(' and ')}
       order by d.created_at desc limit $${params.length - 1} offset $${params.length}`,
      params,
    );

    const items = await Promise.all(rows.map((r) => this.toPublic(r)));
    return { items, nextPage: items.length === pageSize ? page + 1 : null };
  }

  async findPublicById(dentistId: string) {
    const row = await this.loadDentistRow(dentistId);
    if (!row || row.status !== 'verified') {
      throw new NotFoundException('No such dentist.');
    }
    return this.toPublic(row);
  }

  async getSlots(dentistId: string, date: string, type: 'video' | 'clinic', clinicId?: string) {
    const row = await this.loadDentistRow(dentistId);
    if (!row || row.status !== 'verified') throw new NotFoundException('No such dentist.');

    const clinicRows = type === 'clinic' ? await this.activeClinicRowsFor(dentistId) : [];
    const hours = resolveHours(
      row as unknown as AvailabilityDentistRow,
      clinicRows as unknown as AvailabilityClinicRow[],
      type,
      clinicId,
    );

    const allSlots = await this.availability.slots(this.pool, dentistId, date, hours);
    const { rows: taken } = await this.pool.query<{ scheduled_time: string }>(
      `select scheduled_time::text from appointments
       where dentist_id = $1 and scheduled_date = $2 and status <> 'cancelled'`,
      [dentistId, date],
    );
    const takenSet = new Set(taken.map((t) => t.scheduled_time.slice(0, 5)));

    const slots = allSlots.filter((t) => !takenSet.has(t) && !slotHasPassed(date, t));
    return { date, slots };
  }

  // ---------- self-serve onboarding ----------

  async createApplication(userId: string, dto: DentistApplicationDto) {
    if (await this.users.hasProfile(userId, 'dentist')) {
      throw new ConflictException('This account already has a dentist application or profile.');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const offersVideo = dto.offersVideo ?? false;
      const { rows } = await client.query(
        `insert into dentists (
           user_id, full_name, email, qualification, specialization, council_reg_no,
           years_experience, languages, offers_video, video_hours_from, video_hours_to,
           fee_video_paise, fee_clinic_paise, status, submitted_by, submitted_at
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'draft','self', now())
         returning *`,
        [
          userId,
          dto.fullName,
          dto.email ?? null,
          dto.qualification,
          dto.specialization,
          dto.councilRegNo,
          dto.yearsExperience ?? 0,
          dto.languages ?? [],
          offersVideo,
          // dentists_video_hours CHECK requires both set whenever offers_video
          // is true — default to a sane window now, same as the primary
          // clinic's hours below; refined later via PATCH /dentists/me.
          offersVideo ? '10:00' : null,
          offersVideo ? '18:30' : null,
          dto.feeVideoPaise ?? 0,
          dto.feeClinicPaise ?? 0,
        ],
      );
      await client.query(
        `insert into dentist_clinics (dentist_id, name, hours_from, hours_to) values ($1, $2, '10:00', '18:30')`,
        [userId, dto.primaryClinicName],
      );
      await client.query('COMMIT');
      return this.toFull(rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async updateApplication(userId: string, dto: DentistApplicationDto) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: existing } = await client.query('select * from dentists where user_id = $1 for update', [userId]);
      if (!existing[0]) throw new NotFoundException('No application on file.');
      if (existing[0].status !== 'draft' || existing[0].submitted_by !== 'self') {
        throw new ConflictException('Only your draft application can be edited.');
      }
      const offersVideo = dto.offersVideo ?? false;
      const { rows } = await client.query(
        `update dentists set full_name = $2, email = $3, qualification = $4, specialization = $5,
         council_reg_no = $6, years_experience = $7, languages = $8, offers_video = $9,
         video_hours_from = $10, video_hours_to = $11, fee_video_paise = $12,
         fee_clinic_paise = $13, updated_at = now() where user_id = $1 returning *`,
        [userId, dto.fullName, dto.email ?? null, dto.qualification, dto.specialization, dto.councilRegNo,
          dto.yearsExperience ?? 0, dto.languages ?? [], offersVideo,
          offersVideo ? '10:00' : null, offersVideo ? '18:30' : null,
          dto.feeVideoPaise ?? 0, dto.feeClinicPaise ?? 0],
      );
      await client.query('update dentist_clinics set name = $2, updated_at = now() where dentist_id = $1', [userId, dto.primaryClinicName]);
      await client.query('COMMIT');
      return this.toFull(rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async submitApplication(userId: string) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query('select * from dentists where user_id = $1 for update', [userId]);
      const row = rows[0];
      if (!row) throw new NotFoundException('No application on file.');
      // A retry after a lost response must not create a second request or audit entry.
      if (row.status === 'pending_review') {
        await client.query('COMMIT');
        return this.toFull(row);
      }
      if (row.status !== 'draft' || row.submitted_by !== 'self') {
        throw new ConflictException('Only a draft application can be submitted.');
      }
      const { rows: docs } = await client.query('select doc_type from dentist_documents where dentist_id = $1', [userId]);
      const have = new Set(docs.map((doc) => doc.doc_type));
      const missing = REQUIRED_KYC_DOC_TYPES.filter((type) => !have.has(type));
      if (missing.length) throw new UnprocessableEntityException(`Missing required documents: ${missing.join(', ')}.`);

      const { rows: submitted } = await client.query(
        `update dentists set status = 'pending_review', submitted_at = now(), updated_at = now()
         where user_id = $1 returning *`, [userId],
      );
      await client.query(
        `insert into audit_log (actor_user_id, actor_label, action, entity_type, entity_id, before_state, after_state)
         values ($1, $2, 'onboarding_submitted', 'dentist', $1, $3, $4)`,
        [userId, row.full_name, JSON.stringify({ status: 'draft' }), JSON.stringify({ status: 'pending_review' })],
      );
      await this.notifications.dentistOnboardingSubmitted(client, submitted[0]);
      await client.query('COMMIT');
      return this.toFull(submitted[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async uploadDocument(dentistId: string, docType: KycDocType, file: { buffer: Buffer; originalname: string }) {
    const client = await this.pool.connect();
    let stored: string | undefined;
    let committing = false;
    try {
      await client.query('BEGIN');
      const { rows: dentists } = await client.query('select status, submitted_by from dentists where user_id = $1 for update', [dentistId]);
      const dentist = dentists[0];
      if (!dentist) throw new NotFoundException('No application on file.');
      if (dentist.status !== 'draft' && !(dentist.status === 'pending_review' && dentist.submitted_by === 'admin'))
        throw new ConflictException('Documents cannot be changed after your application has been submitted.');
      const { rows: previous } = await client.query(
        'select file_url from dentist_documents where dentist_id=$1 and doc_type=$2', [dentistId, docType]
      );
      stored = await this.documents.save(dentistId, docType, file.buffer);
      const { rows } = await client.query(
        `insert into dentist_documents (dentist_id, doc_type, file_url)
         values ($1, $2, $3)
         on conflict (dentist_id, doc_type)
         do update set file_url = excluded.file_url, uploaded_at = now(), verified_by = null, verified_at = null
         returning id, doc_type, file_url, uploaded_at, verified_at`,
        [dentistId, docType, stored]
      );
      committing = true;
      await client.query('COMMIT');
      if (previous[0]?.file_url && previous[0].file_url !== stored)
        await this.removeUnusedDocument(dentistId, previous[0].file_url);
      const r = rows[0];
      return {
        id: r.id, docType: r.doc_type, fileUrl: this.downloadUrlFor(dentistId, r.id),
        uploadedAt: r.uploaded_at, verifiedAt: r.verified_at,
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      // A lost COMMIT response is ambiguous: keep the new object rather than deleting a possibly saved document.
      if (stored && !committing) await this.removeUnusedDocument(dentistId, stored);
      throw error;
    } finally { client.release(); }
  }

  private async removeUnusedDocument(dentistId: string, reference: string) {
    try { await this.documents.remove(dentistId, reference); }
    catch { this.logger.warn('An unused dentist document could not be removed.'); }
  }

  async getDocumentFile(dentistId: string, documentId: string) {
    const { rows } = await this.pool.query(
      'select file_url from dentist_documents where id = $1 and dentist_id = $2',
      [documentId, dentistId]
    );
    if (!rows[0]?.file_url) return null;
    return this.documents.read(dentistId, rows[0].file_url);
  }

  // ---------- self-service ----------

  async findMe(userId: string) {
    const row = await this.loadDentistRow(userId);
    if (!row) throw new NotFoundException('No application on file — call POST /dentists/applications first.');
    return this.toFull(row);
  }

  async updateMe(userId: string, dto: DentistSelfUpdateDto) {
    let videoHoursFrom = dto.videoHoursFrom;
    let videoHoursTo = dto.videoHoursTo;

    if (dto.offersVideo || videoHoursFrom || videoHoursTo) {
      const current = await this.loadDentistRow(userId);
      if (!current) throw new NotFoundException('No application on file.');
      const offersVideo = dto.offersVideo ?? current.offers_video;
      const from = videoHoursFrom ?? current.video_hours_from;
      const to = videoHoursTo ?? current.video_hours_to;

      if (offersVideo) {
        if (!from || !to) {
          throw new UnprocessableEntityException(
            'Turning on video consults requires videoHoursFrom and videoHoursTo.',
          );
        }
        if (generateSlots(from, to).length === 0) {
          throw new UnprocessableEntityException(`Those hours leave no ${SLOT_MINUTES}-minute slots. Pick a longer window.`);
        }
        // Defaulting here (not just validating) so the single CHECK
        // constraint (dentists_video_hours) that enforces "both set
        // whenever offers_video is true" is satisfied even when the
        // caller only sent offersVideo: true and relied on hours
        // already on file.
        videoHoursFrom = from;
        videoHoursTo = to;
      }
    }

    const fields: Record<string, unknown> = {
      qualification: dto.qualification,
      council_reg_no: dto.councilRegNo,
      specialization: dto.specialization,
      languages: dto.languages,
      email: dto.email,
      offers_video: dto.offersVideo,
      video_hours_from: videoHoursFrom,
      video_hours_to: videoHoursTo,
      video_working_days: dto.videoWorkingDays,
      fee_video_paise: dto.feeVideoPaise,
      fee_clinic_paise: dto.feeClinicPaise,
    };
    const set = Object.entries(fields).filter(([, v]) => v !== undefined);
    if (set.length === 0) return this.findMe(userId);

    const assignments = set.map(([col], i) => `${col} = $${i + 2}`).join(', ');
    const values = set.map(([, v]) => v);
    const { rows } = await this.pool.query(
      `update dentists set ${assignments}, updated_at = now() where user_id = $1 returning *`,
      [userId, ...values],
    );
    if (!rows[0]) throw new NotFoundException('No application on file.');
    return this.toFull(rows[0]);
  }

  async listClinics(userId: string) {
    return this.activeClinicsFor(userId);
  }

  async addClinic(userId: string, dto: ClinicInputDto) {
    this.assertSlotsExist(dto.hoursFrom, dto.hoursTo);
    const { rows } = await this.pool.query(
      `insert into dentist_clinics (dentist_id, name, address_line, pincode, phone, hours_from, hours_to, working_days)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
      [userId, dto.name, dto.addressLine ?? null, dto.pincode ?? null, dto.phone ?? null, dto.hoursFrom, dto.hoursTo, dto.workingDays ?? [0,1,2,3,4,5,6]],
    );
    return this.toClinic(rows[0]);
  }

  async updateClinic(userId: string, clinicId: string, dto: ClinicInputDto) {
    this.assertSlotsExist(dto.hoursFrom, dto.hoursTo);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('select user_id from dentists where user_id = $1 for update', [userId]);
      const { rows } = await client.query(
        `update dentist_clinics set name=$3, address_line=$4, pincode=$5, phone=$6, hours_from=$7, hours_to=$8,
         working_days=coalesce($9::smallint[], working_days), updated_at=now()
         where id = $1 and dentist_id = $2 and is_active returning *`,
        [clinicId, userId, dto.name, dto.addressLine ?? null, dto.pincode ?? null, dto.phone ?? null,
         dto.hoursFrom, dto.hoursTo, dto.workingDays ?? null],
      );
      if (!rows[0]) throw new NotFoundException('No such clinic.');
      await client.query('COMMIT');
      return this.toClinic(rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async removeClinic(userId: string, clinicId: string) {
    const clinics = await this.activeClinicsFor(userId);
    const target = clinics.find((c) => c.id === clinicId);
    if (!target) throw new NotFoundException('No such clinic.');

    const dentist = await this.loadDentistRow(userId);
    if (clinics.length === 1 && !dentist?.offers_video) {
      throw new ConflictException('This is the only location and video consults are not offered.');
    }

    const { rows: future } = await this.pool.query(
      `select 1 from appointments
       where clinic_id = $1 and scheduled_date >= current_date and status not in ('cancelled', 'completed')`,
      [clinicId],
    );
    if (future.length > 0) {
      throw new UnprocessableEntityException('This location has future bookings — move or cancel them first.');
    }

    await this.pool.query('update dentist_clinics set is_active = false, updated_at = now() where id = $1', [
      clinicId,
    ]);
  }

  // ---------- used by AdminModule (admin review doesn't belong here, but the row/response mapping does) ----------

  async findRawById(userId: string): Promise<Record<string, any> | null> {
    return this.loadDentistRow(userId);
  }

  async toResponse(row: Record<string, any>) {
    return this.toFull(row);
  }

  // ---------- shared mapping ----------

  private assertSlotsExist(from: string, to: string) {
    if (from >= to || generateSlots(from, to).length === 0) {
      throw new UnprocessableEntityException(`Those hours leave no ${SLOT_MINUTES}-minute slots. Pick a longer window.`);
    }
  }

  private async loadDentistRow(userId: string): Promise<Record<string, any> | null> {
    const { rows } = await this.pool.query('select * from dentists where user_id = $1', [userId]);
    return rows[0] ?? null;
  }

  private async activeClinicsFor(dentistId: string): Promise<ClinicResponse[]> {
    const rows = await this.activeClinicRowsFor(dentistId);
    return rows.map((r) => this.toClinic(r));
  }

  /** Raw rows (hours_from/hours_to, not camelCased) — what resolveHours() needs. */
  private async activeClinicRowsFor(dentistId: string): Promise<Record<string, any>[]> {
    const { rows } = await this.pool.query(
      'select * from dentist_clinics where dentist_id = $1 and is_active order by created_at',
      [dentistId],
    );
    return rows;
  }

  private toClinic(row: Record<string, any>): ClinicResponse {
    return {
      id: row.id,
      name: row.name,
      addressLine: row.address_line,
      pincode: row.pincode,
      phone: row.phone,
      hoursFrom: row.hours_from,
      hoursTo: row.hours_to,
      workingDays: row.working_days,
    };
  }

  private async toPublic(row: Record<string, any>) {
    return {
      id: row.user_id,
      fullName: row.full_name,
      qualification: row.qualification,
      specialization: row.specialization,
      yearsExperience: row.years_experience,
      languages: row.languages,
      offersVideo: row.offers_video,
      feeVideoPaise: row.fee_video_paise,
      feeClinicPaise: row.fee_clinic_paise,
      videoHoursFrom: row.video_hours_from,
      videoHoursTo: row.video_hours_to,
      videoWorkingDays: row.video_working_days,
      clinics: await this.activeClinicsFor(row.user_id),
      councilRegNo: row.council_reg_no,
    };
  }

  private async toFull(row: Record<string, any>) {
    const base = await this.toPublic(row);
    const mobile = await this.mobileFor(row.user_id);
    const { rows: docs } = await this.pool.query(
      'select id, doc_type, file_url, uploaded_at, verified_at from dentist_documents where dentist_id = $1',
      [row.user_id],
    );
    return {
      ...base,
      mobile,
      email: row.email,
      status: row.status,
      submittedBy: row.submitted_by,
      submittedAt: row.submitted_at,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      rejectionReason: row.rejection_reason,
      resubmissionCount: row.resubmission_count,
      councilRegValidTill: row.council_reg_valid_till,
      pan: row.pan,
      bankAccountHolder: row.bank_account_holder,
      bankAccountNo: row.bank_account_no,
      bankIfsc: row.bank_ifsc,
      gstin: row.gstin,
      documents: docs.map((d) => ({
        id: d.id,
        docType: d.doc_type,
        fileUrl: this.downloadUrlFor(row.user_id, d.id),
        uploadedAt: d.uploaded_at,
        verifiedAt: d.verified_at,
      })),
    };
  }

  /** The route that actually serves a document's bytes — never the raw disk path dentist_documents.file_url stores internally. */
  private downloadUrlFor(dentistId: string, documentId: string): string {
    return `/dentists/applications/${dentistId}/documents/${documentId}`;
  }

  private async mobileFor(userId: string): Promise<string> {
    const { rows } = await this.pool.query('select mobile from users where id = $1', [userId]);
    return rows[0]?.mobile ?? '';
  }
}
