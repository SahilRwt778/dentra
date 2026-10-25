import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '@database/database.module';
import { isMinor } from '@common/utils/age.util';
import { UsersService } from '../users/users.service';
import type { PatientRegistrationDto } from './dto/patient-registration.dto';
import type { PatientUpdateDto } from './dto/patient-update.dto';

export interface PatientResponse {
  id: string;
  fullName: string;
  mobile: string;
  dateOfBirth: string;
  gender: string | null;
  email: string | null;
  city: string | null;
  preferredLanguage: string;
  allergies: string;
  conditions: string;
  medications: string;
  emergencyContact: string | null;
  guardian: {
    name: string;
    relationship: string;
    mobile: string;
    consentAt: string;
  } | null;
  createdAt: string;
}

@Injectable()
export class PatientsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool, private readonly users: UsersService) {}

  async register(userId: string, dto: PatientRegistrationDto): Promise<PatientResponse> {
    if (await this.users.hasProfile(userId, 'patient')) {
      throw new ConflictException('This account is already registered.');
    }
    if (!dto.termsConsent || !dto.telemedicineConsent) {
      throw new BadRequestException('Both consent checkboxes are required to continue.');
    }

    const minor = isMinor(dto.dateOfBirth);
    if (minor) {
      if (!dto.guardianName || !dto.guardianRelationship || !dto.guardianMobile || !dto.guardianConsent) {
        throw new UnprocessableEntityException(
          "Patient is under 18 — a guardian's name, relationship, mobile number, and consent are all required.",
        );
      }
    }

    const { rows } = await this.pool.query(
      `insert into patients (
         user_id, full_name, date_of_birth, gender, email, city, preferred_lang,
         guardian_name, guardian_relationship, guardian_mobile, guardian_consent_at
       ) values ($1, $2, $3, $4, $5, $6, coalesce($7, 'English'), $8, $9, $10, $11)
       returning *`,
      [
        userId,
        dto.fullName,
        dto.dateOfBirth,
        dto.gender ?? null,
        dto.email ?? null,
        dto.city ?? null,
        dto.preferredLanguage ?? null,
        minor ? dto.guardianName : null,
        minor ? dto.guardianRelationship : null,
        minor ? dto.guardianMobile : null,
        minor ? new Date() : null,
      ],
    );

    return this.toResponse(rows[0], await this.mobileFor(userId));
  }

  async findMe(userId: string): Promise<PatientResponse> {
    const { rows } = await this.pool.query('select * from patients where user_id = $1', [userId]);
    if (!rows[0]) {
      throw new NotFoundException('Not registered yet — call POST /patients/register first.');
    }
    return this.toResponse(rows[0], await this.mobileFor(userId));
  }

  async update(userId: string, dto: PatientUpdateDto): Promise<PatientResponse> {
    const fields: Record<string, unknown> = {
      full_name: dto.fullName,
      email: dto.email,
      city: dto.city,
      preferred_lang: dto.preferredLanguage,
      allergies: dto.allergies,
      conditions: dto.conditions,
      medications: dto.medications,
      emergency_contact: dto.emergencyContact,
    };
    const set = Object.entries(fields).filter(([, v]) => v !== undefined);
    if (set.length === 0) return this.findMe(userId);

    const assignments = set.map(([col], i) => `${col} = $${i + 2}`).join(', ');
    const values = set.map(([, v]) => v);
    const { rows } = await this.pool.query(
      `update patients set ${assignments}, updated_at = now() where user_id = $1 returning *`,
      [userId, ...values],
    );
    if (!rows[0]) throw new NotFoundException('Not registered yet — call POST /patients/register first.');
    return this.toResponse(rows[0], await this.mobileFor(userId));
  }

  async getChart(userId: string) {
    const { rows } = await this.pool.query(
      `select distinct on (e.tooth_number)
         e.tooth_number, e.status, e.recorded_by_dentist_id, e.recorded_at
       from dental_chart_entries e
       left join appointments a on a.id = e.appointment_id
       where e.patient_id = $1 and (e.appointment_id is null or a.status = 'completed')
       order by e.tooth_number, e.recorded_at desc`,
      [userId],
    );
    return rows.map((r) => ({
      toothNumber: r.tooth_number,
      status: r.status,
      recordedByDentistId: r.recorded_by_dentist_id,
      recordedAt: r.recorded_at,
    }));
  }

  private async mobileFor(userId: string): Promise<string> {
    const { rows } = await this.pool.query('select mobile from users where id = $1', [userId]);
    return rows[0]?.mobile ?? '';
  }

  private toResponse(row: Record<string, any>, mobile: string): PatientResponse {
    return {
      id: row.user_id,
      fullName: row.full_name,
      mobile,
      dateOfBirth: row.date_of_birth,
      gender: row.gender,
      email: row.email,
      city: row.city,
      preferredLanguage: row.preferred_lang,
      allergies: row.allergies,
      conditions: row.conditions,
      medications: row.medications,
      emergencyContact: row.emergency_contact,
      guardian: row.guardian_name
        ? {
            name: row.guardian_name,
            relationship: row.guardian_relationship,
            mobile: row.guardian_mobile,
            consentAt: row.guardian_consent_at,
          }
        : null,
      createdAt: row.created_at,
    };
  }
}
