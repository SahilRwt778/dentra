import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '@database/database.module';

function hasAllergies(value: string | null) {
  const text = value?.trim();
  return !!text && !/^(none(?: known)?|no known(?: drug)? allergies|nkda|nil|n\/a)$/i.test(text);
}

/**
 * A dentist's own view of "their" patients — scoped entirely by the
 * appointment relationship (schema.sql has no other notion of a
 * dentist-patient link). There's no endpoint for a dentist to look up
 * an arbitrary patient; getOne() 404s for anyone they've never had an
 * appointment with, the same way AppointmentsService.assertOwned()
 * 404s rather than 403s on a mismatched owner — existence isn't
 * revealed either way.
 */
@Injectable()
export class DentistPatientsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async list(dentistId: string) {
    const { rows } = await this.pool.query(
      `select
         p.user_id, p.full_name, p.gender,
         extract(year from age(p.date_of_birth))::int as age,
         u.mobile, p.allergies,
         to_char((select max(a.scheduled_date) from appointments a where a.patient_id = p.user_id and a.dentist_id = $1 and a.status = 'completed'), 'YYYY-MM-DD') as last_visit_date,
         (select count(*) from appointments a where a.patient_id = p.user_id and a.dentist_id = $1 and a.status = 'completed') as visit_count
       from patients p
       join users u on u.id = p.user_id
       where exists (select 1 from appointments a where a.patient_id = p.user_id and a.dentist_id = $1)
       order by p.full_name`,
      [dentistId],
    );

    return rows.map((r) => ({
      id: r.user_id,
      fullName: r.full_name,
      age: r.age,
      gender: r.gender,
      mobile: r.mobile,
      lastVisitDate: r.last_visit_date,
      visitCount: Number(r.visit_count),
      hasAllergies: hasAllergies(r.allergies),
    }));
  }

  async getOne(dentistId: string, patientId: string) {
    const { rows } = await this.pool.query(
      `select p.*, u.mobile, to_char(p.date_of_birth, 'YYYY-MM-DD') as birth_date,
         extract(year from age(p.date_of_birth))::int as age
       from patients p
       join users u on u.id = p.user_id
       where p.user_id = $1
         and exists (select 1 from appointments a where a.patient_id = p.user_id and a.dentist_id = $2)`,
      [patientId, dentistId],
    );
    const patient = rows[0];
    if (!patient) throw new NotFoundException('No such patient.');

    const { rows: chart } = await this.pool.query(
      'select tooth_number, status, recorded_by_dentist_id, recorded_at from patient_current_chart where patient_id = $1',
      [patientId],
    );

    const { rows: history } = await this.pool.query(
      `select a.id, to_char(a.scheduled_date, 'YYYY-MM-DD') as visit_date,
         to_char(a.scheduled_time, 'HH24:MI') as visit_time,
         a.type, dc.name as clinic_name, a.concern_summary, a.status, c.diagnosis
       from appointments a
       left join consultations c on c.appointment_id = a.id
       left join dentist_clinics dc on dc.id = a.clinic_id
       where a.patient_id = $1 and a.dentist_id = $2
       order by a.scheduled_date desc, a.scheduled_time desc, a.id desc`,
      [patientId, dentistId],
    );

    return {
      id: patient.user_id,
      fullName: patient.full_name,
      mobile: patient.mobile,
      dateOfBirth: patient.birth_date,
      age: patient.age,
      gender: patient.gender,
      city: patient.city,
      preferredLanguage: patient.preferred_lang,
      allergies: patient.allergies,
      hasAllergies: hasAllergies(patient.allergies),
      conditions: patient.conditions,
      medications: patient.medications,
      emergencyContact: patient.emergency_contact,
      guardian: patient.guardian_name
        ? {
            name: patient.guardian_name,
            relationship: patient.guardian_relationship,
            mobile: patient.guardian_mobile,
          }
        : null,
      chart: chart.map((c) => ({
        toothNumber: c.tooth_number,
        status: c.status,
        recordedByDentistId: c.recorded_by_dentist_id,
        recordedAt: c.recorded_at,
      })),
      appointments: history.map((a) => ({
        id: a.id,
        date: a.visit_date,
        time: a.visit_time,
        type: a.type,
        clinicName: a.clinic_name,
        concern: a.concern_summary,
        diagnosis: a.diagnosis,
        status: a.status,
      })),
    };
  }
}
