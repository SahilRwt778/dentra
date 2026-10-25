import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { PG_POOL } from '@database/database.module';
import type { AuthenticatedUser } from '@common/decorators/current-user.decorator';

export type PatientNotificationType =
  | 'booking_confirmed'
  | 'appointment_cancelled'
  | 'appointment_rescheduled'
  | 'appointment_reminder'
  | 'visit_summary_ready';

interface PatientNotificationPayload {
  appointmentId: string;
  dentistName: string;
  date: string;
  time: string;
  appointmentType: 'clinic' | 'video';
  paymentRequired: boolean;
  previousDate?: string;
  previousTime?: string;
  eventKey: string;
}

export type WithdrawalNotificationStatus =
  | 'approved'
  | 'rejected'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'cancelled';

interface WithdrawalNotificationPayload {
  withdrawalId: string;
  amountPaise: number;
  status: WithdrawalNotificationStatus;
  reason: string | null;
}

type NotificationRow = {
  id: string;
  read_at: Date | null;
  created_at: Date;
} & (
  | {
      template_key: 'appointment_booked';
      payload: {
        appointmentId: string;
        patientName: string;
        date: string;
        time: string;
        appointmentType: 'clinic' | 'video';
      };
    }
  | {
      template_key: PatientNotificationType;
      payload: PatientNotificationPayload;
    }
  | {
      template_key: 'dentist_onboarding_submitted';
      payload: {
        dentistId: string;
        dentistName: string;
        qualification: string;
        specialization: string;
      };
    }
  | {
      template_key: 'wallet_withdrawal_requested';
      payload: {
        withdrawalId: string;
        dentistId: string;
        dentistName: string;
        amountPaise: number;
      };
    }
  | {
      template_key: 'wallet_withdrawal_updated';
      payload: WithdrawalNotificationPayload;
    }
);

@Injectable()
export class NotificationsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** Use the booking's transaction: no notification survives a failed booking. */
  async appointmentBooked(
    client: PoolClient,
    appointment: {
      id: string;
      dentist_id: string;
      patient_name: string;
      scheduled_date: string;
      scheduled_time: string;
      type: 'clinic' | 'video';
    },
  ) {
    await client.query(
      `insert into notifications (user_id, channel, template_key, payload)
       values ($1, 'in_app', 'appointment_booked', $2::jsonb) on conflict do nothing`,
      [
        appointment.dentist_id,
        JSON.stringify({
          appointmentId: appointment.id,
          patientName: appointment.patient_name,
          date: appointment.scheduled_date,
          time: appointment.scheduled_time,
          appointmentType: appointment.type,
        }),
      ],
    );
  }

  /** Fan out to active admins inside the application's submission transaction. */
  async dentistOnboardingSubmitted(
    client: PoolClient,
    dentist: {
      user_id: string;
      full_name: string;
      qualification: string;
      specialization: string;
    },
  ) {
    await client.query(
      `insert into notifications (user_id, channel, template_key, payload)
       select id, 'in_app', 'dentist_onboarding_submitted', $1::jsonb from users
       where role = 'admin' and status = 'active' on conflict do nothing`,
      [
        JSON.stringify({
          dentistId: dentist.user_id,
          dentistName: dentist.full_name,
          qualification: dentist.qualification,
          specialization: dentist.specialization,
        }),
      ],
    );
  }

  /** Saved in the caller's transaction so appointment changes and updates agree. */
  async patientAppointmentEvent(
    client: PoolClient,
    type: PatientNotificationType,
    appointmentId: string,
    options: {
      eventKey?: string;
      previousDate?: string;
      previousTime?: string;
    } = {},
  ) {
    await client.query(
      `with inserted as (insert into notifications (user_id, channel, template_key, payload)
       select a.patient_id, 'in_app', $2, jsonb_build_object(
         'appointmentId', a.id, 'dentistName', d.full_name,
         'date', a.scheduled_date::text, 'time', to_char(a.scheduled_time, 'HH24:MI'),
         'appointmentType', a.type, 'paymentRequired', coalesce(t.status in ('pending', 'failed'), false),
         'eventKey', $3::text, 'previousDate', $4::text, 'previousTime', $5::text)
       from appointments a join dentists d on d.user_id = a.dentist_id
       left join transactions t on t.appointment_id = a.id where a.id = $1
       on conflict do nothing returning id, user_id)
       insert into push_deliveries (notification_id, device_id, binding_id)
       select n.id, pd.id, pd.binding_id from inserted n join push_devices pd on pd.user_id = n.user_id and pd.enabled
       where exists (select 1 from refresh_tokens rt where rt.user_id = pd.user_id
         and rt.device_id = pd.installation_id and rt.session_id = pd.session_id
         and rt.revoked_at is null and rt.expires_at > now()) on conflict do nothing`,
      [
        appointmentId,
        type,
        options.eventKey ?? appointmentId,
        options.previousDate ?? null,
        options.previousTime ?? null,
      ],
    );
  }

  async dismissAppointmentReminders(client: PoolClient, appointmentId: string) {
    await client.query(
      `update notifications set read_at = coalesce(read_at, now())
       where template_key = 'appointment_reminder' and payload->>'appointmentId' = $1 and read_at is null`,
      [appointmentId],
    );
  }

  async walletWithdrawalRequested(
    client: PoolClient,
    withdrawal: {
      id: string;
      dentistId: string;
      dentistName: string;
      amountPaise: number;
    },
  ) {
    await client.query(
      `insert into notifications (user_id,channel,template_key,payload)
      select id,'in_app','wallet_withdrawal_requested',$1::jsonb from users where role='admin' and status='active'`,
      [
        JSON.stringify({
          withdrawalId: withdrawal.id,
          dentistId: withdrawal.dentistId,
          dentistName: withdrawal.dentistName,
          amountPaise: withdrawal.amountPaise,
        }),
      ],
    );
  }

  /** The decision, audit event and dentist notification commit together. */
  async withdrawalUpdated(
    client: PoolClient,
    withdrawal: { id: string; dentistId: string; amountPaise: number },
    status: WithdrawalNotificationStatus,
    note?: string,
  ) {
    const payload: WithdrawalNotificationPayload = {
      withdrawalId: withdrawal.id,
      amountPaise: withdrawal.amountPaise,
      status,
      reason: ['rejected', 'failed', 'cancelled'].includes(status)
        ? note ?? null
        : null,
    };
    await client.query(
      `insert into notifications (user_id, channel, template_key, payload)
       values ($1, 'in_app', 'wallet_withdrawal_updated', $2::jsonb)`,
      [withdrawal.dentistId, JSON.stringify(payload)],
    );
  }

  private templates(user: AuthenticatedUser) {
    if (user.role === 'admin')
      return ['dentist_onboarding_submitted', 'wallet_withdrawal_requested'];
    if (user.role === 'dentist')
      return ['appointment_booked', 'wallet_withdrawal_updated'];
    return [
      'booking_confirmed',
      'appointment_cancelled',
      'appointment_rescheduled',
      'appointment_reminder',
      'visit_summary_ready',
    ];
  }

  async list(user: AuthenticatedUser, cursor?: string) {
    if (cursor) await this.owned(user, cursor);
    const { rows } = await this.pool.query<NotificationRow>(
      `select id, template_key, payload, read_at, created_at from notifications
       where user_id = $1 and channel = 'in_app' and template_key = any($3::text[])
         and ($2::uuid is null or (created_at, id) < (
           select created_at, id from notifications where id = $2 and user_id = $1
         ))
       order by created_at desc, id desc limit 21`,
      [user.userId, cursor ?? null, this.templates(user)],
    );
    const unread = await this.pool.query<{ count: number }>(
      `select count(*)::int as count from notifications
       where user_id = $1 and channel = 'in_app' and template_key = any($2::text[]) and read_at is null`,
      [user.userId, this.templates(user)],
    );
    const items = rows.slice(0, 20);
    return {
      items: items.map((row) => this.toResponse(row)),
      unreadCount: unread.rows[0].count,
      nextCursor: rows.length > 20 ? items[items.length - 1].id : null,
    };
  }

  async get(user: AuthenticatedUser, notificationId: string) {
    await this.owned(user, notificationId);
    const { rows } = await this.pool.query<NotificationRow>(
      'select id, template_key, payload, read_at, created_at from notifications where id = $1 and user_id = $2',
      [notificationId, user.userId],
    );
    if (!rows[0]) throw new NotFoundException('No such notification.');
    return this.toResponse(rows[0]);
  }

  async markRead(user: AuthenticatedUser, notificationId: string) {
    const { rows } = await this.pool.query<NotificationRow>(
      `update notifications set read_at = coalesce(read_at, now())
       where id = $1 and user_id = $2 and channel = 'in_app' and template_key = any($3::text[])
       returning id, template_key, payload, read_at, created_at`,
      [notificationId, user.userId, this.templates(user)],
    );
    if (!rows[0]) throw new NotFoundException('No such notification.');
    return this.toResponse(rows[0]);
  }

  async markAllRead(user: AuthenticatedUser, through: string) {
    await this.owned(user, through);
    // An event arriving after the displayed snapshot must stay unread.
    const result = await this.pool.query(
      `update notifications set read_at = now()
       where user_id = $1 and channel = 'in_app' and template_key = any($3::text[]) and read_at is null
         and (created_at, id) <= (select created_at, id from notifications where id = $2 and user_id = $1)`,
      [user.userId, through, this.templates(user)],
    );
    return { markedRead: result.rowCount ?? 0 };
  }

  private async owned(user: AuthenticatedUser, notificationId: string) {
    const { rows } = await this.pool.query(
      `select id from notifications where id = $1 and user_id = $2
       and channel = 'in_app' and template_key = any($3::text[])`,
      [notificationId, user.userId, this.templates(user)],
    );
    if (!rows[0]) throw new NotFoundException('No such notification.');
  }

  private toResponse(row: NotificationRow) {
    if (row.template_key === 'wallet_withdrawal_updated') {
      return {
        id: row.id,
        type: row.template_key,
        ...row.payload,
        readAt: row.read_at,
        createdAt: row.created_at,
      };
    }
    if (row.template_key === 'wallet_withdrawal_requested') {
      return {
        id: row.id,
        type: row.template_key,
        withdrawalId: row.payload.withdrawalId,
        dentistId: row.payload.dentistId,
        dentistName: row.payload.dentistName,
        amountPaise: row.payload.amountPaise,
        readAt: row.read_at,
        createdAt: row.created_at,
      };
    }

    if (row.template_key === 'dentist_onboarding_submitted') {
      return {
        id: row.id,
        type: row.template_key,
        dentistId: row.payload.dentistId,
        dentistName: row.payload.dentistName,
        qualification: row.payload.qualification,
        specialization: row.payload.specialization,
        readAt: row.read_at,
        createdAt: row.created_at,
      };
    }
    if (row.template_key !== 'appointment_booked') {
      return {
        id: row.id,
        type: row.template_key,
        appointmentId: row.payload.appointmentId,
        dentistName: row.payload.dentistName,
        date: row.payload.date,
        time: row.payload.time,
        appointmentType: row.payload.appointmentType,
        paymentRequired: row.payload.paymentRequired,
        previousDate: row.payload.previousDate ?? null,
        previousTime: row.payload.previousTime ?? null,
        readAt: row.read_at,
        createdAt: row.created_at,
      };
    }
    return {
      id: row.id,
      type: 'appointment_booked' as const,
      appointmentId: row.payload.appointmentId,
      patientName: row.payload.patientName,
      date: row.payload.date,
      time: row.payload.time,
      appointmentType: row.payload.appointmentType,
      readAt: row.read_at,
      createdAt: row.created_at,
    };
  }
}
