import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { PG_POOL } from '@database/database.module';
import {
  availableSlots,
  type ResolvedHours,
} from '@common/utils/dentist-availability.util';
import { SLOT_MINUTES } from '@common/utils/slots.util';
import type { CreateTimeOffDto, TimeOffDto } from './dto/time-off.dto';

type TimeOffRow = {
  id: string;
  dentist_id: string;
  start_date: string;
  end_date: string;
  start_minute: number;
  end_minute: number;
  all_day: boolean;
  reason: string | null;
};
const minutes = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const hhmm = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(
    value % 60,
  ).padStart(2, '0')}`;

@Injectable()
export class AvailabilityService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async slots(
    client: Pool | PoolClient,
    dentistId: string,
    date: string,
    hours: ResolvedHours,
  ) {
    const { rows } = await client.query<{
      start_minute: number;
      end_minute: number;
    }>(
      `select start_minute, end_minute from dentist_time_off
       where dentist_id = $1 and start_date <= $2 and end_date >= $2`,
      [dentistId, date],
    );
    return availableSlots(hours, date, rows);
  }

  async list(dentistId: string) {
    const { rows } = await this.pool.query<TimeOffRow>(
      `select * from dentist_time_off where dentist_id = $1
       and end_date >= (now() at time zone 'Asia/Kolkata')::date order by start_date, start_minute, id`,
      [dentistId],
    );
    return rows.map((row) => this.response(row));
  }

  async preview(
    dentistId: string,
    dto: TimeOffDto,
    client: Pool | PoolClient = this.pool,
  ) {
    const window = this.validate(dto);
    const { rows } = await client.query<{
      id: string;
      patient_name: string;
      date: string;
      time: string;
      type: 'clinic' | 'video';
      clinic_name: string | null;
      total: number;
    }>(
      `select a.id, p.full_name as patient_name, to_char(a.scheduled_date, 'YYYY-MM-DD') as date,
         to_char(a.scheduled_time, 'HH24:MI') as time, a.type, c.name as clinic_name,
         count(*) over()::int as total
       from appointments a join patients p on p.user_id = a.patient_id
       left join dentist_clinics c on c.id = a.clinic_id
       where a.dentist_id = $1 and a.status in ('booked', 'waiting', 'in_consult')
         and a.scheduled_date between $2 and $3
         and extract(epoch from a.scheduled_time) / 60 < $5
         and extract(epoch from a.scheduled_time) / 60 + $6 > $4
       order by a.scheduled_date, a.scheduled_time, a.id limit 20`,
      [
        dentistId,
        dto.startDate,
        dto.endDate,
        window.start,
        window.end,
        SLOT_MINUTES,
      ],
    );
    return {
      total: rows[0]?.total ?? 0,
      appointments: rows.map((row) => ({
        id: row.id,
        patientName: row.patient_name,
        date: row.date,
        time: row.time,
        type: row.type,
        clinicName: row.clinic_name,
      })),
    };
  }

  async create(dentistId: string, dto: CreateTimeOffDto) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Booking and rescheduling take the same lock before reading availability.
      // A booking arriving after preview is therefore checked again atomically.
      await client.query(
        'select user_id from dentists where user_id = $1 for update',
        [dentistId],
      );
      const { rows: existing } = await client.query<TimeOffRow>(
        'select * from dentist_time_off where id = $1',
        [dto.requestId],
      );
      if (existing[0]) {
        if (existing[0].dentist_id !== dentistId)
          throw new ConflictException('This request ID is already in use.');
        await client.query('COMMIT');
        return this.response(existing[0]);
      }
      const window = this.validate(dto);
      const affected = await this.preview(dentistId, dto, client);
      if (affected.total)
        throw new ConflictException(
          'There are appointments in this period. Move or cancel them, then check again.',
        );
      const { rows } = await client.query<TimeOffRow>(
        `insert into dentist_time_off (id, dentist_id, start_date, end_date, all_day, start_minute, end_minute, reason)
         values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
        [
          dto.requestId,
          dentistId,
          dto.startDate,
          dto.endDate,
          dto.allDay,
          window.start,
          window.end,
          dto.reason?.trim() || null,
        ],
      );
      await client.query('COMMIT');
      return this.response(rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async remove(dentistId: string, id: string) {
    const result = await this.pool.query(
      'delete from dentist_time_off where id = $1 and dentist_id = $2',
      [id, dentistId],
    );
    if (!result.rowCount)
      throw new NotFoundException(
        'This time off was already removed or is unavailable.',
      );
  }

  private validate(dto: TimeOffDto) {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    if (dto.startDate < today || dto.endDate < dto.startDate) {
      throw new BadRequestException(
        'Choose today or a future date, with the end date on or after the start date.',
      );
    }
    const duration =
      (Date.parse(dto.endDate) - Date.parse(dto.startDate)) / 86400000;
    if (duration > 365)
      throw new BadRequestException(
        'Time off can cover up to 366 days at a time.',
      );
    const start = dto.allDay ? 0 : minutes(dto.fromTime!);
    const end = dto.allDay ? 1440 : minutes(dto.toTime!);
    if (start >= end)
      throw new BadRequestException(
        'The end time must be after the start time.',
      );
    return { start, end };
  }

  private response(row: TimeOffRow) {
    return {
      id: row.id,
      startDate: row.start_date,
      endDate: row.end_date,
      allDay: row.all_day,
      fromTime: row.all_day ? null : hhmm(row.start_minute),
      toTime: row.all_day ? null : hhmm(row.end_minute),
      reason: row.reason,
    };
  }
}
