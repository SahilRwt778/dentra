import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { PG_POOL } from '@database/database.module';
import type { AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { slotHasPassed } from '@common/utils/slots.util';
import { resolveHours } from '@common/utils/dentist-availability.util';
import { RazorpayGatewayService } from '@modules/payments/razorpay-gateway.service';
import { RefundsService } from '@modules/payments/refunds.service';
import { NotificationsService } from '@modules/notifications/notifications.service';
import type { BookAppointmentDto } from './dto/book-appointment.dto';
import type { RescheduleDto } from './dto/reschedule.dto';
import { PatientFilesService } from '../files/patient-files.service';
import { AvailabilityService } from '@modules/identity/dentists/availability.service';
import { CLINIC_PAYMENT_COLUMNS, clinicPaymentReceipt, type ClinicPaymentReceipt, type ClinicPaymentColumns } from '@common/utils/clinic-payment.util';

const FEE_FIELD = { video: 'fee_video_paise', clinic: 'fee_clinic_paise' } as const;

// payment lives on the separate transactions table — always read appointments
// through this join so the response's payment block is never silently empty.
// Patient/dentist name (+ patient age/gender) are joined in too: the
// caller is always either the patient or the dentist on the row, so
// showing them the OTHER party's name is never a privacy concern, and
// without it Dentist Web's queue/schedule would have nothing but a UUID
// to show per row.
const APPOINTMENT_WITH_PAYMENT = `
  select a.*, t.method as payment_method, t.amount_paise as payment_amount, t.status as payment_status,
         t.gateway_ref as payment_gateway_ref, t.gateway_payment_ref,
         t.payment_expires_at,
         p.full_name as patient_name, p.gender as patient_gender,
         extract(year from age(p.date_of_birth))::int as patient_age,
         d.full_name as dentist_name, dc.name as clinic_name, ${CLINIC_PAYMENT_COLUMNS}
  from appointments a
  left join transactions t on t.appointment_id = a.id
  left join clinic_payment_collections cp on cp.transaction_id = t.id
  join patients p on p.user_id = a.patient_id
  join dentists d on d.user_id = a.dentist_id
  left join dentist_clinics dc on dc.id = a.clinic_id
`;

export interface AppointmentResponse {
  id: string;
  patientId: string;
  patientName: string;
  patientAge: number | null;
  patientGender: string | null;
  dentistId: string;
  dentistName: string;
  clinicId: string | null;
  clinicName: string | null;
  type: 'video' | 'clinic';
  date: string;
  time: string;
  status: string;
  concern: string;
  concerns: string[];
  symptomArea: string | null;
  symptomSince: string | null;
  painScore: number | null;
  swelling: boolean;
  note: string | null;
  photoUrls: string[];
  payment: {
    method: string;
    amountPaise: number;
    status: string;
    gatewayOrderId: string | null;
    gatewayKeyId: string | null;
    expiresAt: string | null;
    collection: ClinicPaymentReceipt | null;
  } | null;
  bookedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  rescheduledAt: string | null;
}

@Injectable()
export class AppointmentsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly gateway: RazorpayGatewayService,
    private readonly notifications: NotificationsService,
    private readonly refunds: RefundsService,
    private readonly files: PatientFilesService,
    private readonly availability: AvailabilityService,
  ) {}

  async book(patientId: string, dto: BookAppointmentDto): Promise<AppointmentResponse> {
    if (slotHasPassed(dto.date, dto.time)) {
      throw new BadRequestException('That time has already passed.');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Idempotency: a retried request (same key) after a timeout returns
      // the original booking instead of erroring or double-booking.
      const { rows: existingTxn } = await client.query(
        'select appointment_id from transactions where idempotency_key = $1',
        [dto.idempotencyKey],
      );
      if (existingTxn[0]) {
        const existing = await this.fetchById(client, existingTxn[0].appointment_id);
        if (existing?.patient_id !== patientId) throw new ConflictException('That booking key is already in use.');
        await client.query('COMMIT');
        return this.toResponse(existing!);
      }

      const { rows: dentistRows } = await client.query(
        "select * from dentists where user_id = $1 and status = 'verified' for update",
        [dto.dentistId],
      );
      const dentist = dentistRows[0];
      if (!dentist) throw new NotFoundException('No such dentist.');

      const { rows: clinicRows } = await client.query(
        'select * from dentist_clinics where dentist_id = $1 and is_active',
        [dto.dentistId],
      );
      const hours = resolveHours(dentist, clinicRows, dto.type, dto.clinicId);

      if (!(await this.availability.slots(client, dto.dentistId, dto.date, hours)).includes(dto.time)) {
        throw new BadRequestException('This dentist is not available at that time. Choose another slot.');
      }

      const feePaise = dentist[FEE_FIELD[dto.type]] as number;

      let appointmentId: string;
      try {
        const { rows } = await client.query(
          `insert into appointments (
             patient_id, dentist_id, clinic_id, type, scheduled_date, scheduled_time,
             concern_summary, concerns, symptom_area, symptom_since, pain_score, swelling,
             note, photo_urls
           ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           returning id`,
          [
            patientId,
            dto.dentistId,
            hours.clinicId,
            dto.type,
            dto.date,
            dto.time,
            dto.concern,
            dto.concerns ?? [],
            dto.symptomArea ?? null,
            dto.symptomSince ?? null,
            dto.painScore ?? null,
            dto.swelling ?? false,
            dto.note ?? null,
            dto.photoUrls ?? [],
          ],
        );
        appointmentId = rows[0].id;
      } catch (err: any) {
        // appointments_no_double_booking (schema.sql) — the slot was taken
        // in the gap between the patient loading it and confirming.
        if (err?.code === '23505') {
          throw new ConflictException('That time is no longer available. Pick another time.');
        }
        throw err;
      }

      await this.files.attach(client, patientId, appointmentId, dto.attachmentIds ?? []);

      // pay_at_clinic takes no payment now, matching the prototype's
      // rule. Online methods create a real Razorpay order; the
      // transaction sits at 'pending' until the payment.captured
      // webhook confirms it — never marked 'paid' synchronously here.
      let paymentStatus: string;
      let gatewayRef: string | null = null;
      const {rows:[walletPolicy]} = await client.query('select fee_bps from wallet_settings where singleton for share');
      if (dto.paymentMethod === 'pay_at_clinic') {
        paymentStatus = 'due_at_clinic';
      } else {
        paymentStatus = 'pending';
        const order = await this.gateway.createOrder(feePaise, appointmentId);
        gatewayRef = order.orderId;
      }
      await client.query(
        `insert into transactions (appointment_id, idempotency_key, amount_paise, method, status, gateway_ref, payment_expires_at, next_payment_check_at, platform_fee_bps)
         values ($1,$2,$3,$4::payment_method,$5,$6,
           case when $4::payment_method = 'pay_at_clinic' then null else now() + interval '15 minutes' end,
           case when $4::payment_method = 'pay_at_clinic' then null else now() + interval '30 seconds' end, $7)`,
        [appointmentId, dto.idempotencyKey, feePaise, dto.paymentMethod, paymentStatus, gatewayRef,
          dto.paymentMethod === 'pay_at_clinic' ? null : walletPolicy?.fee_bps ?? null],
      );

      const created = await this.fetchById(client, appointmentId);
      await this.notifications.appointmentBooked(client, {
        id: created!.id,
        dentist_id: created!.dentist_id,
        patient_name: created!.patient_name,
        scheduled_date: created!.scheduled_date,
        scheduled_time: created!.scheduled_time,
        type: created!.type,
      });
      await this.notifications.patientAppointmentEvent(client, 'booking_confirmed', appointmentId);
      await client.query('COMMIT');
      return this.toResponse(created!);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async list(user: AuthenticatedUser, filters: { status?: string; date?: string }, page = 1) {
    const pageSize = 20;
    const ownerCol = user.role === 'dentist' ? 'a.dentist_id' : 'a.patient_id';
    const conditions = [`${ownerCol} = $1`];
    const params: unknown[] = [user.userId];

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`a.status = $${params.length}`);
    }
    if (filters.date) {
      params.push(filters.date);
      conditions.push(`a.scheduled_date = $${params.length}`);
    }
    params.push(pageSize, (page - 1) * pageSize);

    const { rows } = await this.pool.query(
      `${APPOINTMENT_WITH_PAYMENT} where ${conditions.join(' and ')}
       order by a.scheduled_date desc, a.scheduled_time desc limit $${params.length - 1} offset $${params.length}`,
      params,
    );
    const items = rows.map((r) => this.toResponse(r));
    return { items, nextPage: items.length === pageSize ? page + 1 : null };
  }

  async get(user: AuthenticatedUser, appointmentId: string): Promise<AppointmentResponse> {
    await this.assertOwned(user, appointmentId);
    const row = await this.fetchById(this.pool, appointmentId);
    return this.toResponse(row!);
  }

  async cancel(user: AuthenticatedUser, appointmentId: string): Promise<AppointmentResponse> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const owned = await this.assertOwned(user, appointmentId, client, true);
      // A lost response can be retried without refunding or notifying twice.
      if (owned.status === 'cancelled') {
        const row = await this.fetchById(client, appointmentId);
        await client.query('COMMIT');
        return this.toResponse(row!);
      }
      if (!['booked', 'waiting', 'in_consult'].includes(owned.status)) {
        throw new ConflictException('Already completed or cancelled.');
      }
      const { rows: txnRows } = await client.query(
        'select id, status, method, gateway_payment_ref from transactions where appointment_id = $1 for update',
        [appointmentId],
      );
      const txn = txnRows[0];
      if (txn) {
        if (txn.status === 'paid' && (txn.gateway_payment_ref || txn.method !== 'pay_at_clinic')) {
          if (!txn.gateway_payment_ref) throw new ConflictException('Payment reference is missing. Please contact support.');
          await this.refunds.enqueue(client, txn.id);
        } else if (!['paid', 'refund_pending', 'refund_failed', 'refunded'].includes(txn.status)) {
          await client.query("update transactions set status = 'cancelled', updated_at = now() where id = $1", [txn.id]);
        }
      }
      await client.query(
        `update appointments set status = 'cancelled', cancelled_at = now(), updated_at = now() where id = $1`,
        [appointmentId],
      );
      await this.notifications.dismissAppointmentReminders(client, appointmentId);
      await this.notifications.patientAppointmentEvent(client, 'appointment_cancelled', appointmentId);
      const row = await this.fetchById(client, appointmentId);
      await client.query('COMMIT');
      return this.toResponse(row!);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async reschedule(user: AuthenticatedUser, appointmentId: string, dto: RescheduleDto): Promise<AppointmentResponse> {
    if (slotHasPassed(dto.date, dto.time)) throw new BadRequestException('That time has already passed.');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const owned = await this.assertOwned(user, appointmentId, client, true);
      if (owned.status !== 'booked')
        throw new ConflictException('Not in booked status, or the new slot was just taken.');
      if (owned.scheduled_date === dto.date && owned.scheduled_time === dto.time) {
        const row = await this.fetchById(client, appointmentId);
        await client.query('COMMIT');
        return this.toResponse(row!);
      }
      if (
        dto.expectedDate !== undefined &&
        (owned.scheduled_date !== dto.expectedDate || owned.scheduled_time !== dto.expectedTime)
      ) {
        throw new ConflictException('This appointment was moved on another device. Refresh and choose a new time.');
      }
      const { rows: dentists } = await client.query(
        `select * from dentists where user_id = $1 and status = 'verified' for update`,
        [owned.dentist_id],
      );
      if (!dentists[0]) throw new NotFoundException('No such dentist.');
      const { rows: clinics } = await client.query(
        'select * from dentist_clinics where dentist_id = $1 and is_active',
        [owned.dentist_id],
      );
      const hours = resolveHours(dentists[0], clinics, owned.type, owned.clinic_id ?? undefined);
      if (!(await this.availability.slots(client, owned.dentist_id, dto.date, hours)).includes(dto.time)) {
        throw new BadRequestException('This dentist is not available at that time. Choose another slot.');
      }
      await client.query(
        `update appointments set scheduled_date = $1, scheduled_time = $2, rescheduled_at = now(), updated_at = now()
         where id = $3`,
        [dto.date, dto.time, appointmentId],
      );
      await this.notifications.dismissAppointmentReminders(client, appointmentId);
      await this.notifications.patientAppointmentEvent(client, 'appointment_rescheduled', appointmentId, {
        eventKey: randomUUID(),
        previousDate: owned.scheduled_date,
        previousTime: owned.scheduled_time,
      });
      const row = await this.fetchById(client, appointmentId);
      await client.query('COMMIT');
      return this.toResponse(row!);
    } catch (error) {
      await client.query('ROLLBACK');
      if ((error as { code?: string })?.code === '23505') {
        throw new ConflictException('Not in booked status, or the new slot was just taken.');
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async checkIn(user: AuthenticatedUser, appointmentId: string): Promise<AppointmentResponse> {
    if (user.role !== 'dentist') throw new ForbiddenException('Only the dentist can check a patient in.');
    const owned = await this.assertOwned(user, appointmentId);
    if (owned.type !== 'clinic' || owned.status !== 'booked') {
      throw new ConflictException('Only a booked, in-clinic appointment can be checked in.');
    }
    if (owned.scheduled_date !== todayIso()) {
      throw new ConflictException('A patient can be marked as arrived only on the appointment date.');
    }
    const result = await this.pool.query(
      `update appointments set status = 'waiting', updated_at = now()
       where id = $1 and status = 'booked' and type = 'clinic' and scheduled_date = $2`,
      [appointmentId, owned.scheduled_date],
    );
    if (!result.rowCount) throw new ConflictException('This appointment is no longer booked.');
    const row = await this.fetchById(this.pool, appointmentId);
    return this.toResponse(row!);
  }

  async start(user: AuthenticatedUser, appointmentId: string): Promise<AppointmentResponse> {
    if (user.role !== 'dentist') throw new ForbiddenException('Only the dentist can start a consultation.');
    const owned = await this.assertOwned(user, appointmentId);
    if (!['booked', 'waiting'].includes(owned.status)) {
      throw new ConflictException('Not ready to start.');
    }
    if (owned.scheduled_date > todayIso()) {
      throw new ConflictException(`You can start this consultation on ${owned.scheduled_date}.`);
    }
    const result = await this.pool.query(
      `update appointments set status = 'in_consult', updated_at = now() where id = $1 and status in ('booked', 'waiting')`,
      [appointmentId],
    );
    if (!result.rowCount) throw new ConflictException('This appointment is no longer ready to start.');
    const row = await this.fetchById(this.pool, appointmentId);
    return this.toResponse(row!);
  }

  /** 404s unless the caller is the patient or dentist this appointment belongs to. Returns the bare appointments row (no payment join — callers needing payment re-fetch via fetchById). */
  async assertOwned(
    user: AuthenticatedUser,
    appointmentId: string,
    client: Pool | PoolClient = this.pool,
    lock = false,
  ): Promise<Record<string, any>> {
    const { rows } = await client.query(`select * from appointments where id = $1${lock ? ' for update' : ''}`, [
      appointmentId,
    ]);
    const row = rows[0];
    const ownerCol = user.role === 'dentist' ? 'dentist_id' : 'patient_id';
    if (!row || row[ownerCol] !== user.userId) {
      throw new NotFoundException('No such appointment.');
    }
    return row;
  }

  private async fetchById(client: Pool | PoolClient, appointmentId: string): Promise<Record<string, any> | null> {
    const { rows } = await client.query(`${APPOINTMENT_WITH_PAYMENT} where a.id = $1`, [appointmentId]);
    return rows[0] ?? null;
  }

  private toResponse(row: Record<string, any>): AppointmentResponse {
    return {
      id: row.id,
      patientId: row.patient_id,
      patientName: row.patient_name,
      patientAge: row.patient_age ?? null,
      patientGender: row.patient_gender ?? null,
      dentistId: row.dentist_id,
      dentistName: row.dentist_name,
      clinicId: row.clinic_id,
      clinicName: row.clinic_name ?? null,
      type: row.type,
      date: row.scheduled_date,
      time: row.scheduled_time,
      status: row.status,
      concern: row.concern_summary,
      concerns: row.concerns,
      symptomArea: row.symptom_area,
      symptomSince: row.symptom_since,
      painScore: row.pain_score,
      swelling: row.swelling,
      note: row.note,
      photoUrls: row.photo_urls,
      payment: row.payment_method
        ? {
            method: row.payment_method,
            amountPaise: row.payment_amount,
            status: row.payment_status,
            gatewayOrderId: row.payment_gateway_ref ?? null,
            // Publish only the checkout key id. The signing secret stays on the API.
            gatewayKeyId: row.payment_gateway_ref ? this.gateway.keyId : null,
            expiresAt: row.payment_expires_at ?? null,
            collection: clinicPaymentReceipt(row as ClinicPaymentColumns),
          }
        : null,
      bookedAt: row.booked_at,
      completedAt: row.completed_at,
      cancelledAt: row.cancelled_at,
      rescheduledAt: row.rescheduled_at,
    };
  }
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
