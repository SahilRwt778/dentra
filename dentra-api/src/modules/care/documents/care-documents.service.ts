import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { PG_POOL } from '@database/database.module';
import type { AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { CarePdfRenderer } from './care-pdf.renderer';
import type {
  CareDocumentKind,
  CareDocumentSnapshot,
} from './care-document.types';

type Eligibility = {
  status: string;
  dentist_id: string;
  signed_by_dentist_id: string | null;
  signed_at: Date | null;
  has_items: boolean;
};

@Injectable()
export class CareDocumentsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly renderer: CarePdfRenderer
  ) {}

  /** Called inside signing/completion's transaction, so a failed event leaves no document behind. */
  async record(
    client: PoolClient,
    appointmentId: string,
    kind: CareDocumentKind,
    source: CareDocumentSnapshot['source'] = 'event'
  ) {
    const existing = await client.query<{ payload: CareDocumentSnapshot }>(
      'select payload from care_documents where appointment_id = $1 and kind = $2',
      [appointmentId, kind]
    );
    if (existing.rows[0]) return existing.rows[0].payload;
    const { rows } = await client.query<{ payload: CareDocumentSnapshot }>(
      `select jsonb_build_object(
        'schemaVersion', 1, 'kind', $2::text, 'source', $3::text, 'capturedAt', now(),
        'platform', jsonb_build_object('name', coalesce((select name from platform_settings limit 1), 'Dentra'),
          'supportEmail', (select support_email from platform_settings limit 1)),
        'appointment', jsonb_build_object('id', a.id, 'type', a.type, 'date', a.scheduled_date,
          'time', to_char(a.scheduled_time, 'HH24:MI'), 'completedAt', a.completed_at),
        'patient', jsonb_build_object('name', p.full_name, 'dateOfBirth', p.date_of_birth,
          'age', extract(year from age(a.scheduled_date, p.date_of_birth))::int, 'gender', p.gender),
        'dentist', jsonb_build_object('name', d.full_name, 'qualification', d.qualification,
          'councilRegNo', d.council_reg_no, 'specialization', d.specialization),
        'clinic', case when cl.id is null then null else jsonb_build_object('name', cl.name, 'address', cl.address_line, 'phone', cl.phone) end,
        'consultation', jsonb_build_object('chiefComplaint', coalesce(c.chief_complaint, a.concern_summary),
          'findings', c.findings, 'diagnosis', c.diagnosis, 'treatmentDone', c.treatment_done,
          'plan', c.plan, 'planItems', coalesce(c.plan_items, '[]'::jsonb),
          'followUpDate', c.follow_up_date, 'isEdited', coalesce(c.is_edited, false), 'editedAt', c.edited_at),
        'prescription', case when rx.signed_at is null or rx.signed_by_dentist_id is distinct from a.dentist_id
          or not exists(select 1 from prescription_items i where i.prescription_id = rx.id) then null else
          jsonb_build_object('id', rx.id, 'signedAt', rx.signed_at, 'items',
            coalesce((select jsonb_agg(jsonb_build_object('medicineName', i.medicine_name, 'strength', i.strength,
              'dose', i.dose, 'frequency', i.frequency, 'duration', i.duration, 'instructions', i.instructions)
              order by i.sort_order, i.id) from prescription_items i where i.prescription_id = rx.id), '[]'::jsonb)) end,
        'chart', coalesce((select jsonb_agg(jsonb_build_object('tooth', dc.tooth_number, 'status', dc.status) order by dc.tooth_number)
          from (select distinct on (tooth_number) tooth_number, status from dental_chart_entries
            where appointment_id = a.id order by tooth_number, recorded_at desc, id desc) dc), '[]'::jsonb)
      ) as payload
      from appointments a join patients p on p.user_id = a.patient_id join dentists d on d.user_id = a.dentist_id
      left join dentist_clinics cl on cl.id = a.clinic_id left join consultations c on c.appointment_id = a.id
      left join prescriptions rx on rx.appointment_id = a.id where a.id = $1`,
      [appointmentId, kind, source]
    );
    if (!rows[0]) throw new NotFoundException('No such appointment.');
    await client.query(
      'insert into care_documents (appointment_id, kind, payload) values ($1,$2,$3) on conflict do nothing',
      [appointmentId, kind, JSON.stringify(rows[0].payload)]
    );
    const saved = await client.query<{ payload: CareDocumentSnapshot }>(
      'select payload from care_documents where appointment_id = $1 and kind = $2',
      [appointmentId, kind]
    );
    return saved.rows[0].payload;
  }

  async download(
    user: AuthenticatedUser,
    appointmentId: string,
    kind: CareDocumentKind
  ) {
    const client = await this.pool.connect();
    let snapshot: CareDocumentSnapshot;
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<Eligibility>(
        `select a.status, a.dentist_id, rx.signed_at, rx.signed_by_dentist_id,
          exists(select 1 from prescription_items i where i.prescription_id = rx.id) as has_items
         from appointments a join users u on u.id = $2 and u.status = 'active'
         left join prescriptions rx on rx.appointment_id = a.id
         where a.id = $1 and a.${
           user.role === 'dentist' ? 'dentist_id' : 'patient_id'
         } = $2 for update of a`,
        [appointmentId, user.userId]
      );
      const appointment = rows[0];
      if (!appointment) throw new NotFoundException('No such appointment.');
      if (
        (kind === 'visit-summary' || user.role === 'patient') &&
        appointment.status !== 'completed'
      ) {
        throw new ConflictException(
          'This document is available after the consultation is completed.'
        );
      }
      if (
        kind === 'prescription' &&
        (!appointment.signed_at ||
          !appointment.has_items ||
          appointment.signed_by_dentist_id !== appointment.dentist_id ||
          appointment.status === 'cancelled')
      ) {
        throw new ConflictException(
          'A signed prescription is required before downloading its PDF.'
        );
      }
      // Existing records are captured on first export. All later exports use the same snapshot.
      snapshot = await this.record(
        client,
        appointmentId,
        kind,
        'legacy-export'
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return this.renderer.render(snapshot);
  }
}
