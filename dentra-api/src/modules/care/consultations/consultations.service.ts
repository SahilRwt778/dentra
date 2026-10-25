import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { PG_POOL } from '@database/database.module';
import type { AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { allergyConflict } from '@common/utils/allergy-check.util';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { OtpService } from '@modules/identity/auth/otp.service';
import { AppointmentsService } from '../appointments/appointments.service';
import type { ConsultationDraftDto } from './dto/consultation-draft.dto';
import type { SignPrescriptionDto } from './dto/sign-prescription.dto';
import { CareDocumentsService } from '../documents/care-documents.service';

@Injectable()
export class ConsultationsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly appointments: AppointmentsService,
    private readonly otp: OtpService,
    private readonly notifications: NotificationsService,
    private readonly documents: CareDocumentsService,
  ) {}

  async get(user: AuthenticatedUser, appointmentId: string) {
    const appointment = await this.appointments.assertOwned(user, appointmentId);
    if (user.role === 'patient' && appointment.status !== 'completed') {
      throw new ConflictException('Your visit summary is available after the consultation is completed.');
    }
    return this.buildResponse(appointmentId);
  }

  async saveDraft(user: AuthenticatedUser, appointmentId: string, dto: ConsultationDraftDto) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const appointment = await this.lockInProgress(user, appointmentId, client);

      await client.query(
        `insert into consultations (appointment_id, chief_complaint, findings, diagnosis, treatment_done, plan, follow_up_date, plan_items)
         values ($1,$2,$3,$4,$5,$6,$7,coalesce($8::jsonb, '[]'::jsonb))
         on conflict (appointment_id) do update set
           chief_complaint = coalesce($2, consultations.chief_complaint),
           findings = coalesce($3, consultations.findings),
           diagnosis = coalesce($4, consultations.diagnosis),
           treatment_done = coalesce($5, consultations.treatment_done),
           plan = coalesce($6, consultations.plan),
           follow_up_date = case when $9::boolean then $7::date else consultations.follow_up_date end,
           plan_items = coalesce($8::jsonb, consultations.plan_items),
           updated_at = now()`,
        [
          appointmentId,
          dto.chiefComplaint ?? null,
          dto.findings ?? null,
          dto.diagnosis ?? null,
          dto.treatmentDone ?? null,
          dto.plan ?? null,
          dto.followUpDate ?? null,
          dto.planItems === undefined ? null : JSON.stringify(dto.planItems),
          dto.followUpDate !== undefined,
        ],
      );

      if (dto.chart?.length) {
        await this.applyChartChanges(client, appointment.patient_id, appointmentId, user.userId, dto.chart);
      }

      if (dto.prescriptionItems) {
        await this.replacePrescriptionItems(client, appointmentId, dto.prescriptionItems);
      }

      await client.query('COMMIT');
      return this.buildResponse(appointmentId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async complete(user: AuthenticatedUser, appointmentId: string) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await this.lockInProgress(user, appointmentId, client);
      const { rows: consultRows } = await client.query(
        'select diagnosis from consultations where appointment_id = $1',
        [appointmentId],
      );
      if (!consultRows[0]?.diagnosis?.trim()) {
        throw new UnprocessableEntityException('Add a diagnosis to complete the consultation.');
      }

      const { rows: rxRows } = await client.query(
        `select p.signed_at, count(i.id) as item_count
       from prescriptions p left join prescription_items i on i.prescription_id = p.id
       where p.appointment_id = $1 group by p.id, p.signed_at`,
        [appointmentId],
      );
      const rx = rxRows[0];
      if (rx && Number(rx.item_count) > 0 && !rx.signed_at) {
        throw new UnprocessableEntityException('Sign the prescription before completing.');
      }

      await client.query(
        `update appointments set status = 'completed', completed_at = now(), updated_at = now() where id = $1`,
        [appointmentId],
      );
      await this.notifications.dismissAppointmentReminders(client, appointmentId);
      await this.documents.record(client, appointmentId, 'visit-summary');
      await this.notifications.patientAppointmentEvent(client, 'visit_summary_ready', appointmentId);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return this.appointments.get(user, appointmentId);
  }

  async requestSigningCode(user: AuthenticatedUser, appointmentId: string) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await this.lockInProgress(user, appointmentId, client);
      const { prescription, items } = await this.unsignedPrescription(client, appointmentId);
      const mobile = await this.dentistMobile(client, user.userId);
      await this.otp.assertNotRateLimited(mobile);
      const { otpId, code } = await this.otp.create(
        mobile,
        'prescription',
        this.signingContext(appointmentId, prescription.id, items),
      );
      await client.query('COMMIT');
      // Delivery uses the same development SMS stub as login; verification is real.
      // eslint-disable-next-line no-console
      console.log(`[otp:stub] ${mobile} (prescription) code=${code}`);
      return { otpId, expiresInSeconds: 300, resendAfterSeconds: 30 };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async signPrescription(user: AuthenticatedUser, appointmentId: string, dto: SignPrescriptionDto) {
    const client = await this.pool.connect();
    let transactionOpen = false;
    try {
      await client.query('BEGIN');
      transactionOpen = true;
      const appointment = await this.lockInProgress(user, appointmentId, client);
      const { prescription, items } = await this.unsignedPrescription(client, appointmentId);
      const mobile = await this.dentistMobile(client, user.userId);

      const { rows: patientRows } = await client.query('select allergies from patients where user_id = $1 for share', [
        appointment.patient_id,
      ]);
      const allergies = patientRows[0]?.allergies;
      const conflicts = items.map((i) => allergyConflict(allergies, i.medicine_name)).filter((c): c is string => !!c);

      if (conflicts.length > 0 && !dto.allergyOverrideAck) {
        throw new UnprocessableEntityException(
          `Allergy conflict: patient is allergic to ${conflicts.join(
            ', ',
          )}. Confirm allergyOverrideAck to sign anyway.`,
        );
      }

      const verification = await this.otp.verifyInTransaction(client, dto.otpId, dto.confirmationCode, {
        mobile,
        purpose: 'prescription',
        context: this.signingContext(appointmentId, prescription.id, items),
      });
      if (verification instanceof HttpException) {
        await client.query('COMMIT');
        transactionOpen = false;
        throw verification.getStatus() === 401 ? new UnprocessableEntityException(verification.message) : verification;
      }
      // Consume the challenge and sign this exact medicine list in one transaction.
      await client.query(
        `update prescriptions set signed_by_dentist_id = $1, signed_at = now(), signature_ref = $2 where id = $3`,
        [user.userId, `otp:${dto.otpId}`, prescription.id],
      );
      await this.documents.record(client, appointmentId, 'prescription');
      await client.query('COMMIT');
      transactionOpen = false;
    } catch (error) {
      if (transactionOpen) await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return this.buildResponse(appointmentId);
  }

  // ---------- internals ----------

  private async lockInProgress(user: AuthenticatedUser, appointmentId: string, client: PoolClient) {
    if (user.role !== 'dentist') throw new ForbiddenException('Only the treating dentist can do this.');
    const { rows } = await client.query('select * from appointments where id = $1 and dentist_id = $2 for update', [
      appointmentId,
      user.userId,
    ]);
    if (!rows[0]) throw new NotFoundException('No such appointment.');
    if (rows[0].status !== 'in_consult') throw new ConflictException('This appointment is not in consultation.');
    return rows[0];
  }

  private async dentistMobile(client: PoolClient, dentistId: string): Promise<string> {
    const { rows } = await client.query('select mobile from users where id = $1', [dentistId]);
    if (!rows[0]?.mobile) throw new ConflictException('A verified mobile number is required to sign.');
    return rows[0].mobile;
  }

  private async unsignedPrescription(client: PoolClient, appointmentId: string) {
    const { rows } = await client.query('select id, signed_at from prescriptions where appointment_id = $1', [
      appointmentId,
    ]);
    const prescription = rows[0];
    if (prescription?.signed_at) throw new ConflictException('This prescription is already signed.');
    if (!prescription) throw new ConflictException('Add a medicine before signing.');
    const { rows: items } = await client.query(
      `select medicine_name, strength, dose, frequency, duration, instructions
       from prescription_items where prescription_id = $1 order by sort_order`,
      [prescription.id],
    );
    if (!items.length) throw new ConflictException('Add a medicine before signing.');
    return { prescription, items };
  }

  private signingContext(appointmentId: string, prescriptionId: string, items: Record<string, unknown>[]): string {
    return createHash('sha256').update(JSON.stringify({ appointmentId, prescriptionId, items })).digest('hex');
  }

  /** Append-only: writes a new row only for a tooth whose status actually changed. */
  private async applyChartChanges(
    client: PoolClient,
    patientId: string,
    appointmentId: string,
    dentistId: string,
    entries: { toothNumber: string; status: string }[],
  ) {
    const { rows: current } = await client.query(
      'select tooth_number, status from patient_current_chart where patient_id = $1',
      [patientId],
    );
    const currentByTooth = new Map(current.map((r) => [r.tooth_number, r.status]));

    for (const entry of entries) {
      if (currentByTooth.get(entry.toothNumber) === entry.status) continue;
      await client.query(
        `insert into dental_chart_entries (patient_id, tooth_number, status, recorded_by_dentist_id, appointment_id)
         values ($1,$2,$3,$4,$5)`,
        [patientId, entry.toothNumber, entry.status, dentistId, appointmentId],
      );
    }
  }

  /** A draft's prescriptionItems is the full desired list — replaced wholesale. Refused once signed; unsign first. */
  private async replacePrescriptionItems(
    client: PoolClient,
    appointmentId: string,
    items: {
      medicineName: string;
      strength?: string;
      dose: string;
      frequency: string;
      duration: string;
      instructions?: string;
    }[],
  ) {
    const { rows } = await client.query('select id, signed_at from prescriptions where appointment_id = $1', [
      appointmentId,
    ]);
    let prescription = rows[0];

    if (prescription?.signed_at) {
      throw new ConflictException(
        'Prescription is signed — unsign it first (not yet exposed as its own call) or complete as-is.',
      );
    }

    if (!prescription) {
      const inserted = await client.query('insert into prescriptions (appointment_id) values ($1) returning id', [
        appointmentId,
      ]);
      prescription = inserted.rows[0];
    }

    await client.query('delete from prescription_items where prescription_id = $1', [prescription.id]);
    for (const [i, item] of items.entries()) {
      await client.query(
        `insert into prescription_items (prescription_id, medicine_name, strength, dose, frequency, duration, instructions, sort_order)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          prescription.id,
          item.medicineName,
          item.strength ?? null,
          item.dose,
          item.frequency,
          item.duration,
          item.instructions ?? null,
          i,
        ],
      );
    }
  }

  private async buildResponse(appointmentId: string) {
    const { rows: consultRows } = await this.pool.query(
      `select *, to_char(follow_up_date, 'YYYY-MM-DD') as follow_up_date
       from consultations where appointment_id = $1`,
      [appointmentId],
    );
    const c = consultRows[0] ?? {};

    const { rows: rxRows } = await this.pool.query('select * from prescriptions where appointment_id = $1', [
      appointmentId,
    ]);
    const rx = rxRows[0];
    let items: Record<string, any>[] = [];
    if (rx) {
      const { rows } = await this.pool.query(
        'select * from prescription_items where prescription_id = $1 order by sort_order',
        [rx.id],
      );
      items = rows;
    }

    return {
      appointmentId,
      chiefComplaint: c.chief_complaint ?? null,
      findings: c.findings ?? null,
      diagnosis: c.diagnosis ?? null,
      treatmentDone: c.treatment_done ?? null,
      plan: c.plan ?? null,
      planItems: c.plan_items ?? [],
      followUpDate: c.follow_up_date ?? null,
      isEdited: c.is_edited ?? false,
      editedAt: c.edited_at ?? null,
      prescription: rx
        ? {
            id: rx.id,
            signedByDentistId: rx.signed_by_dentist_id,
            signedAt: rx.signed_at,
            items: items.map((i) => ({
              medicineName: i.medicine_name,
              strength: i.strength,
              dose: i.dose,
              frequency: i.frequency,
              duration: i.duration,
              instructions: i.instructions,
            })),
          }
        : null,
    };
  }
}
