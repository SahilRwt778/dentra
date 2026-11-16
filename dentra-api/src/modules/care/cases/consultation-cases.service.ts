import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { PG_POOL } from '@database/database.module';
import type { AuthenticatedUser } from '@common/decorators/current-user.decorator';

const CASE_COLUMNS = `c.*, a.concern_summary, a.concerns, a.scheduled_date, a.scheduled_time,
  a.status as original_status, t.status as payment_status, t.amount_paise,
  p.full_name as patient_name, d.full_name as dentist_name,
  (pu.status='active' and du.status='active' and d.status='verified') as participants_active,
  clock_timestamp() as server_now`;
const CASE_JOINS = `from consultation_cases c join appointments a on a.id=c.original_appointment_id
  join patients p on p.user_id=c.patient_id join dentists d on d.user_id=c.dentist_id
  join users pu on pu.id=c.patient_id join users du on du.id=c.dentist_id
  left join transactions t on t.appointment_id=a.id`;

const CASE_SELECT = `select ${CASE_COLUMNS} ${CASE_JOINS}`;
type ConsultationCaseRow = {
  id: string;
  original_appointment_id: string;
  patient_id: string;
  dentist_id: string;
  patient_name: string;
  dentist_name: string;
  concern_summary: string;
  concerns: string[];
  activated_at: Date | null;
  expires_at: Date | null;
  server_now: Date;
  payment_status: string | null;
  amount_paise: number | null;
  original_status: string;
  participants_active: boolean;
  unread_count?: number;
  total_unread?: number;
  latest_message_at?: Date | null;
};

export type ConsultationCaseResponse = {
  id: string;
  originalAppointmentId: string;
  patientId: string;
  dentistId: string;
  patientName: string;
  dentistName: string;
  concern: string;
  activatedAt: string | null;
  expiresAt: string | null;
  serverNow: string;
  status: 'pending' | 'active' | 'expired' | 'revoked';
  canMessage: boolean;
  canBookFollowUp: boolean;
  unreadCount: number;
  latestMessageAt: string | null;
};

@Injectable()
export class ConsultationCasesService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async owned(
    user: Pick<AuthenticatedUser, 'userId' | 'role'>,
    id: string,
    db: Pool | PoolClient = this.pool,
    lock = false,
  ) {
    const { rows } = await db.query<ConsultationCaseRow>(
      `${CASE_SELECT} where c.id=$1 and c.${
        user.role === 'dentist' ? 'dentist_id' : 'patient_id'
      }=$2
      ${lock ? 'for share of a' : ''}`,
      [id, user.userId],
    );
    if (!rows[0]) throw new NotFoundException('No such consultation.');
    return rows[0];
  }

  async get(user: AuthenticatedUser, id: string) {
    return this.response(await this.owned(user, id), user.role);
  }

  async list(user: AuthenticatedUser, page = 1) {
    const { rows } = await this.pool.query<ConsultationCaseRow>(
      `select ${CASE_COLUMNS}, unread.count::int as unread_count,
      latest.created_at as latest_message_at, sum(unread.count) over()::int as total_unread
      ${CASE_JOINS}
      left join consultation_chat_reads seen on seen.case_id=c.id and seen.user_id=$1
      left join lateral(select count(*) as count from video_chat_messages m where m.appointment_id=c.original_appointment_id
        and m.sender_id<>$1 and m.sequence>coalesce(seen.last_sequence,0)) unread on true
      left join lateral(select created_at from video_chat_messages m where m.appointment_id=c.original_appointment_id
        order by sequence desc limit 1) latest on true
      where c.${user.role === 'dentist' ? 'dentist_id' : 'patient_id'}=$1
        and (c.activated_at is not null or latest.created_at is not null)
      order by coalesce(latest.created_at,c.activated_at,a.booked_at) desc,c.id desc limit 21 offset $2`,
      [user.userId, (page - 1) * 20],
    );
    return {
      items: rows.slice(0, 20).map((row) => this.response(row, user.role)),
      unreadCount: rows[0]?.total_unread ?? 0,
      nextPage: rows.length > 20 ? page + 1 : null,
    };
  }

  async assertBookable(
    client: PoolClient,
    patientId: string,
    caseId: string,
    date: string,
    time: string,
  ) {
    const row = await this.owned(
      { userId: patientId, role: 'patient' },
      caseId,
      client,
      true,
    );
    // Take the same payment lock as refunds, after the original appointment lock.
    const paid = await client.query(
      'select status from transactions where appointment_id=$1 for share',
      [row.original_appointment_id],
    );
    row.payment_status = paid.rows[0]?.status;
    if (this.response(row, 'patient').status !== 'active')
      throw new ConflictException(
        'This consultation no longer has an active free follow-up pass.',
      );
    const { rows } = await client.query(
      `select (($1::date+$2::time) at time zone 'Asia/Kolkata'>=$3::timestamptz
      and ($1::date+$2::time) at time zone 'Asia/Kolkata'<$4::timestamptz
      and clock_timestamp()<$4::timestamptz) as allowed`,
      [date, time, row.activated_at, row.expires_at],
    );
    if (!rows[0]?.allowed)
      throw new ConflictException(
        'Choose a follow-up time before your 72-hour pass expires.',
      );
    return row;
  }

  response(row: ConsultationCaseRow, role: string): ConsultationCaseResponse {
    const funded =
      row.payment_status === 'paid' &&
      (row.amount_paise ?? 0) > 0 &&
      row.original_status === 'completed' &&
      row.participants_active;
    const status = !row.activated_at
      ? 'pending'
      : !funded
      ? 'revoked'
      : row.expires_at!.getTime() <= row.server_now.getTime()
      ? 'expired'
      : 'active';
    return {
      id: row.id,
      originalAppointmentId: row.original_appointment_id,
      patientId: row.patient_id,
      dentistId: row.dentist_id,
      patientName: row.patient_name,
      dentistName: row.dentist_name,
      concern: row.concern_summary,
      activatedAt: row.activated_at?.toISOString() ?? null,
      expiresAt: row.expires_at?.toISOString() ?? null,
      serverNow: row.server_now.toISOString(),
      status,
      canMessage: status === 'active',
      canBookFollowUp: role === 'patient' && status === 'active',
      unreadCount: row.unread_count ?? 0,
      latestMessageAt: row.latest_message_at?.toISOString() ?? null,
    };
  }
}
