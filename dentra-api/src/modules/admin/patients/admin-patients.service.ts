import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '@database/database.module';
import { ProfilePhotosService } from '@modules/identity/profile-photos/profile-photos.service';
import { ListAdminPatientsDto } from './dto/list-admin-patients.dto';

type PatientRow = {
  user_id: string;
  full_name: string;
  profile_photo_url: string | null;
  mobile: string;
  email: string | null;
  birth_date: string;
  age: number;
  gender: string | null;
  city: string | null;
  status: string;
  registered_at: string | Date;
  appointment_count: number;
  completed_count: number;
  last_visit_date: string | null;
};
type PatientDetailsRow = PatientRow & {
  preferred_lang: string;
  emergency_contact: string | null;
  guardian_name: string | null;
  guardian_relationship: string | null;
  guardian_mobile: string | null;
};

const PROFILE_COLUMNS = `p.user_id, p.full_name, p.profile_photo_url, u.mobile, p.email,
  to_char(p.date_of_birth, 'YYYY-MM-DD') as birth_date,
  extract(year from age((now() at time zone 'Asia/Kolkata')::date, p.date_of_birth))::int as age,
  p.gender, p.city, u.status, p.created_at as registered_at`;
const VISIT_COUNTS = `left join lateral (
  select count(*)::int as appointment_count,
    (count(*) filter (where a.status = 'completed'))::int as completed_count,
    to_char(max(a.scheduled_date) filter (where a.status = 'completed'), 'YYYY-MM-DD') as last_visit_date
  from appointments a where a.patient_id = p.user_id
) visits on true`;

/** Operational patient records for admins; clinical notes stay in the care endpoints. */
@Injectable()
export class AdminPatientsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly photos: ProfilePhotosService,
  ) {}

  async list(filters: ListAdminPatientsDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;
    const { rows } = await this.pool.query<{
      total: string;
      items: PatientRow[];
    }>(
      `with filtered as (
        select ${PROFILE_COLUMNS} from patients p join users u on u.id = p.user_id
        where u.role = 'patient'
          and ($1::text = '' or strpos(lower(concat_ws(' ', p.full_name, u.mobile, p.email)), lower($1)) > 0)
          and ($2::text = '' or u.status = $2)
      )
      select count(*) as total,
        coalesce((select json_agg(page_rows) from (
          select p.*, visits.* from (
            select * from filtered order by registered_at desc, user_id desc limit $3 offset $4
          ) p ${VISIT_COUNTS}
          order by p.registered_at desc, p.user_id desc
        ) page_rows), '[]'::json) as items
      from filtered`,
      [filters.search?.trim() ?? '', filters.status ?? '', limit, offset],
    );
    const { total, items } = rows[0];
    return {
      items: items.map((row) => this.summary(row)),
      total: Number(total),
      page,
      limit,
      nextPage: offset + items.length < Number(total) ? page + 1 : null,
    };
  }

  async getOne(patientId: string) {
    const { rows } = await this.pool.query<PatientDetailsRow>(
      `select ${PROFILE_COLUMNS}, p.preferred_lang, p.emergency_contact,
        p.guardian_name, p.guardian_relationship, p.guardian_mobile, visits.*
       from patients p join users u on u.id = p.user_id ${VISIT_COUNTS}
       where p.user_id = $1 and u.role = 'patient'`,
      [patientId],
    );
    const patient = rows[0];
    if (!patient) throw new NotFoundException('No such patient.');
    return {
      ...this.summary(patient),
      preferredLanguage: patient.preferred_lang,
      emergencyContact: patient.emergency_contact,
      guardian: patient.guardian_name
        ? {
            name: patient.guardian_name,
            relationship: patient.guardian_relationship,
            mobile: patient.guardian_mobile,
          }
        : null,
    };
  }

  private summary(row: PatientRow) {
    return {
      id: row.user_id,
      fullName: row.full_name,
      profilePhotoUrl:
        row.status === 'active'
          ? this.photos.url('patient', row.user_id, row.profile_photo_url)
          : null,
      mobile: row.mobile,
      email: row.email,
      dateOfBirth: row.birth_date,
      age: row.age,
      gender: row.gender,
      city: row.city,
      status: row.status,
      registeredAt: row.registered_at,
      appointmentCount: row.appointment_count,
      completedCount: row.completed_count,
      lastVisitDate: row.last_visit_date,
    };
  }
}
