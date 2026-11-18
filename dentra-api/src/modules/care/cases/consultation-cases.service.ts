import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { PG_POOL } from '@database/database.module';
import type { AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { ProfilePhotosService } from '@modules/identity/profile-photos/profile-photos.service';
import type { ConversationFilter } from './consultation-cases.dto';
import { VideoProviderService } from '../video/video-provider.service';

const CASE_COLUMNS = `c.*, a.concern_summary, a.concerns, a.scheduled_date, a.scheduled_time,
  a.status as original_status, t.status as payment_status, t.amount_paise,
  p.full_name as patient_name, d.full_name as dentist_name,
  p.profile_photo_url as patient_photo, d.profile_photo_url as dentist_photo,
  (pu.status='active' and du.status='active' and d.status='verified') as participants_active,
  clock_timestamp() as server_now`;
const CASE_JOINS = `from consultation_cases c join appointments a on a.id=c.original_appointment_id
  join patients p on p.user_id=c.patient_id join dentists d on d.user_id=c.dentist_id
  join users pu on pu.id=c.patient_id join users du on du.id=c.dentist_id
  left join transactions t on t.appointment_id=a.id`;

const CASE_STATUS = `case when c.activated_at is null then 'pending'
  when not coalesce(t.status='paid' and t.amount_paise>0 and a.status='completed'
    and pu.status='active' and du.status='active' and d.status='verified',false) then 'revoked'
  when c.expires_at<=statement_timestamp() then 'expired' else 'active' end`;

// The inbox and chat send endpoint use the same permission: a valid pass, or
// an eligible video consultation joined by this session before pass activation.
function canMessageSql(role: string) {
  const roomSession =
    role === 'dentist' ? 'dentist_session_id' : 'patient_session_id';
  return `coalesce(
    pu.status='active' and du.status='active' and d.status='verified'
    and exists(select 1 from refresh_tokens rt where rt.user_id=$1 and rt.session_id=$3 and rt.device_id=$4
      and rt.revoked_at is null and rt.expires_at>statement_timestamp())
    and ((${CASE_STATUS})='active' or (
      c.activated_at is null and $5::boolean and a.type='video'
      and a.status in ('booked','waiting','in_consult') and t.status='paid'
      and statement_timestamp()>=((a.scheduled_date+a.scheduled_time) at time zone 'Asia/Kolkata')-interval '10 minutes'
      and statement_timestamp()<((a.scheduled_date+a.scheduled_time) at time zone 'Asia/Kolkata')+interval '2 hours'
      and exists(select 1 from video_rooms r where r.appointment_id=a.id and r.provider='livekit'
        and r.closed_at is null and r.expires_at>statement_timestamp() and r.provider_room_id is not null
        and r.${roomSession}=$3)
    )),false)`;
}
type ConsultationCaseRow = {
  id: string;
  original_appointment_id: string;
  patient_id: string;
  dentist_id: string;
  patient_name: string;
  dentist_name: string;
  patient_photo: string | null;
  dentist_photo: string | null;
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
  case_status?: ConsultationCaseResponse['status'];
  can_message: boolean;
};

export type ConsultationCaseResponse = {
  id: string;
  originalAppointmentId: string;
  patientId: string;
  dentistId: string;
  patientName: string;
  dentistName: string;
  patientProfilePhotoUrl: string | null;
  dentistProfilePhotoUrl: string | null;
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
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly photos: ProfilePhotosService,
    private readonly video: VideoProviderService,
  ) {}

  async owned(
    user: AuthenticatedUser,
    id: string,
    db: Pool | PoolClient = this.pool,
    lock = false,
  ) {
    const { rows } = await db.query<ConsultationCaseRow>(
      `select ${CASE_COLUMNS}, ${CASE_STATUS} as case_status,
      ${canMessageSql(user.role)} as can_message ${CASE_JOINS}
      where c.id=$2 and c.${
        user.role === 'dentist' ? 'dentist_id' : 'patient_id'
      }=$1
      ${lock ? 'for share of a' : ''}`,
      [
        user.userId,
        id,
        user.sessionId ?? null,
        user.deviceId ?? null,
        this.video.isEnabled(),
      ],
    );
    if (!rows[0]) throw new NotFoundException('No such consultation.');
    return rows[0];
  }

  async get(user: AuthenticatedUser, id: string) {
    return this.response(await this.owned(user, id), user.role);
  }

  async list(
    user: AuthenticatedUser,
    page = 1,
    filter: ConversationFilter = 'all',
    search = '',
    unreadOnly = false,
  ) {
    const { rows } = await this.pool.query<ConsultationCaseRow>(
      `with conversations as (
      select ${CASE_COLUMNS}, ${CASE_STATUS} as case_status,
      ${canMessageSql(user.role)} as can_message, a.booked_at,
      unread.count::int as unread_count, latest.created_at as latest_message_at
      ${CASE_JOINS}
      left join consultation_chat_reads seen on seen.case_id=c.id and seen.user_id=$1
      left join lateral(select count(*) as count from video_chat_messages m where m.appointment_id=c.original_appointment_id
        and m.sender_id<>$1 and m.sequence>coalesce(seen.last_sequence,0)) unread on true
      left join lateral(select created_at from video_chat_messages m where m.appointment_id=c.original_appointment_id
        order by sequence desc limit 1) latest on true
      where c.${user.role === 'dentist' ? 'dentist_id' : 'patient_id'}=$1
        and (c.activated_at is not null or latest.created_at is not null)
      ) select *, sum(unread_count) over()::int as total_unread from conversations
      where ($6='all' or ($6='open' and can_message) or ($6='closed' and not can_message))
        and ($7='' or strpos(lower(${user.role === 'dentist' ? 'patient_name' : 'dentist_name'} || ' ' || coalesce(concern_summary,'')),lower($7))>0)
        and (not $8::boolean or unread_count>0)
      order by coalesce(latest_message_at,activated_at,booked_at) desc,id desc limit 21 offset $2`,
      [
        user.userId,
        (page - 1) * 20,
        user.sessionId ?? null,
        user.deviceId ?? null,
        this.video.isEnabled(),
        filter,
        search.trim(),
        unreadOnly,
      ],
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
    if (
      row.payment_status !== 'paid' ||
      this.response(row, 'patient').status !== 'active'
    )
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
    const status =
      row.case_status ??
      (!row.activated_at
        ? 'pending'
        : !funded
          ? 'revoked'
          : row.expires_at!.getTime() <= row.server_now.getTime()
            ? 'expired'
            : 'active');
    return {
      id: row.id,
      originalAppointmentId: row.original_appointment_id,
      patientId: row.patient_id,
      dentistId: row.dentist_id,
      patientName: row.patient_name,
      dentistName: row.dentist_name,
      patientProfilePhotoUrl: this.photos.url(
        'patient',
        row.patient_id,
        row.patient_photo,
      ),
      dentistProfilePhotoUrl: this.photos.url(
        'dentist',
        row.dentist_id,
        row.dentist_photo,
      ),
      concern: row.concern_summary,
      activatedAt: row.activated_at?.toISOString() ?? null,
      expiresAt: row.expires_at?.toISOString() ?? null,
      serverNow: row.server_now.toISOString(),
      status,
      canMessage: row.can_message,
      canBookFollowUp: role === 'patient' && status === 'active',
      unreadCount: row.unread_count ?? 0,
      latestMessageAt: row.latest_message_at?.toISOString() ?? null,
    };
  }
}
