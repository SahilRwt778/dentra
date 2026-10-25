import {
  ConflictException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  OnModuleDestroy,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { PG_POOL } from '@database/database.module';
import type { AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { videoClientUrl } from './video-url';
import {
  VideoProviderService,
  type VideoEvent,
} from './video-provider.service';

type VideoAppointment = {
  id: string;
  patient_id: string;
  dentist_id: string;
  type: string;
  status: string;
  scheduled_date: string;
  scheduled_time: string;
  payment_paid: boolean;
  patient_active: boolean;
  dentist_active: boolean;
  verified: boolean;
  session_active: boolean;
};
export type VideoStatus = {
  available: boolean;
  canJoin: boolean;
  reason:
    | 'ready'
    | 'unavailable'
    | 'not_video'
    | 'closed'
    | 'too_early'
    | 'payment_required'
    | 'dentist_unavailable'
    | 'session_ended';
  opensAt: string;
  closesAt: string;
  serverNow: string;
  roomName?: string | null;
};

@Injectable()
export class VideoService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(VideoService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly provider: VideoProviderService,
    private readonly config: ConfigService
  ) {}

  private async appointment(
    user: AuthenticatedUser,
    id: string,
    db: Pool | PoolClient = this.pool,
    lock = false
  ) {
    const { rows } = await db.query<VideoAppointment>(
      `select a.*,
      exists(select 1 from transactions t where t.appointment_id = a.id and t.status = 'paid') as payment_paid,
      pu.status = 'active' as patient_active, du.status = 'active' as dentist_active, d.status = 'verified' as verified,
      exists(select 1 from refresh_tokens rt where rt.user_id = $2 and rt.session_id = $3 and rt.device_id = $4
        and rt.revoked_at is null and rt.expires_at > now()) as session_active
      from appointments a join users pu on pu.id = a.patient_id join users du on du.id = a.dentist_id
      join dentists d on d.user_id = a.dentist_id
      where a.id = $1 and ${
        user.role === 'dentist' ? 'a.dentist_id' : 'a.patient_id'
      } = $2 ${lock ? 'for update of a' : ''}`,
      [id, user.userId, user.sessionId ?? null, user.deviceId ?? null]
    );
    if (!rows[0]) throw new NotFoundException('No such appointment.');
    return rows[0];
  }

  private status(row: VideoAppointment, now = new Date()): VideoStatus {
    const scheduled = new Date(
      `${row.scheduled_date}T${row.scheduled_time}+05:30`
    ).getTime();
    const opens = scheduled - 10 * 60_000,
      closes = scheduled + 2 * 60 * 60_000;
    const reason: VideoStatus['reason'] =
      row.type !== 'video'
        ? 'not_video'
        : !this.provider.isEnabled()
        ? 'unavailable'
        : !row.session_active || !row.patient_active
        ? 'session_ended'
        : !row.dentist_active || !row.verified
        ? 'dentist_unavailable'
        : !['booked', 'waiting', 'in_consult'].includes(row.status) ||
          now.getTime() >= closes
        ? 'closed'
        : !row.payment_paid
        ? 'payment_required'
        : now.getTime() < opens
        ? 'too_early'
        : 'ready';
    return {
      available: this.provider.isEnabled(),
      canJoin: reason === 'ready',
      reason,
      opensAt: new Date(opens).toISOString(),
      closesAt: new Date(closes).toISOString(),
      serverNow: now.toISOString(),
    };
  }

  async assertCanJoin(
    user: AuthenticatedUser,
    id: string,
    db: Pool | PoolClient = this.pool,
    lock = false
  ) {
    const row = await this.appointment(user, id, db, lock);
    const status = this.status(row);
    if (!status.canJoin)
      throw new ConflictException(this.reasonMessage(status.reason));
    return row;
  }

  async get(user: AuthenticatedUser, id: string) {
    const appointment = await this.appointment(user, id);
    const { rows } = await this.pool.query<{ room_name: string }>(
      `select room_name from video_rooms where appointment_id = $1
      and provider = 'livekit' and closed_at is null and scheduled_date = $2 and scheduled_time = $3 and expires_at > now()`,
      [id, appointment.scheduled_date, appointment.scheduled_time]
    );
    return {
      ...this.status(appointment),
      roomName: rows[0]?.room_name ?? null,
    };
  }

  async join(user: AuthenticatedUser, id: string, platform: string) {
    if (!['android', 'ios', 'web'].includes(platform))
      throw new BadRequestException('Unsupported video platform.');
    const client = await this.pool.connect();
    let issued: Awaited<ReturnType<VideoProviderService['issue']>> | undefined;
    let roomName: string | undefined;
    try {
      await client.query('BEGIN');
      const row = await this.appointment(user, id, client, true);
      const status = this.status(row);
      if (!status.canJoin)
        throw new ConflictException({
          message: this.reasonMessage(status.reason),
          reason: status.reason,
        });
      await client.query(
        `update video_rooms set closed_at = coalesce(closed_at, now()) where appointment_id = $1
        and closed_at is null and (provider <> 'livekit' or scheduled_date <> $2 or scheduled_time <> $3)`,
        [id, row.scheduled_date, row.scheduled_time]
      );
      const sessionColumn =
        user.role === 'patient' ? 'patient_session_id' : 'dentist_session_id';
      const { rows } = await client.query<{
        room_name: string;
        provider_room_id: string | null;
        patient_identity: string | null;
        dentist_identity: string | null;
      }>(
        `insert into video_rooms
        (appointment_id, room_name, scheduled_date, scheduled_time, expires_at, ${sessionColumn}, provider) values ($1,$2,$3,$4,$5,$6,'livekit')
        on conflict (appointment_id) where closed_at is null do update set ${sessionColumn} = $6 returning room_name, provider_room_id, patient_identity, dentist_identity`,
        [
          id,
          `dentra-${randomUUID()}`,
          row.scheduled_date,
          row.scheduled_time,
          status.closesAt,
          user.sessionId,
        ]
      );
      const room = rows[0];
      roomName = room.room_name;
      issued = await this.provider.issue(
        room.room_name,
        user.role as 'patient' | 'dentist',
        room.provider_room_id,
        user.role === 'patient' ? room.patient_identity : room.dentist_identity
      );
      const identityColumn =
        user.role === 'patient' ? 'patient_identity' : 'dentist_identity';
      const peerIdentity =
        user.role === 'patient' ? 'dentist_identity' : 'patient_identity';
      const peerSession =
        user.role === 'patient' ? 'dentist_session_id' : 'patient_session_id';
      await client.query(
        `update video_rooms set provider_room_id = $2, ${identityColumn} = $3,
        ${peerIdentity} = case when provider_room_id is distinct from $2 then null else ${peerIdentity} end,
        ${peerSession} = case when provider_room_id is distinct from $2 then null else ${peerSession} end
        where room_name = $1`,
        [room.room_name, issued.roomId, issued.identity]
      );
      await client.query('COMMIT');
      return {
        provider: issued.provider,
        serverUrl: videoClientUrl(issued.serverUrl, platform),
        token: issued.token,
        identity: issued.identity,
        roomName: rows[0].room_name,
        role: user.role,
        closesAt: status.closesAt,
        issuedAt: new Date().toISOString(),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      if (issued) {
        if (issued.created)
          await this.provider.close(roomName!).catch(() => undefined);
        else
          await this.provider
            .removeParticipant(roomName!, issued.identity!)
            .catch(() => undefined);
      }
      if ((error as Error).name === 'NotFoundException' && roomName) {
        await this.pool.query(
          'update video_rooms set closed_at = now(), cleaned_at = now() where room_name = $1',
          [roomName]
        );
      }
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException(
        'Could not open the video meeting. Please try joining again.'
      );
    } finally {
      client.release();
    }
  }

  private reasonMessage(reason: VideoStatus['reason']) {
    return {
      too_early: 'Joining opens 10 minutes before your appointment.',
      payment_required:
        'Complete payment before joining the video consultation.',
      session_ended: 'Sign in again to join your consultation.',
      dentist_unavailable:
        'This dentist is unavailable. Please contact support.',
      unavailable: 'Video consultations are temporarily unavailable.',
      not_video: 'This appointment is an in-clinic visit.',
      closed: 'This video consultation is no longer available.',
      ready: 'Ready to join.',
    }[reason];
  }

  async handleEvent(event: VideoEvent) {
    if (!event.roomId || !event.roomName) return;
    if (event.event === 'room_finished') {
      await this.pool.query(
        'update video_rooms set closed_at = coalesce(closed_at, now()), cleaned_at = now() where provider_room_id = $1',
        [event.roomId]
      );
      return;
    }
    if (event.event !== 'participant_joined' || !event.identity) return;
    const { rows } = await this.pool.query(
      `select v.*, a.status, a.type, a.patient_id, a.dentist_id,
      pu.status = 'active' and du.status = 'active' and d.status = 'verified' as accounts_active,
      exists(select 1 from transactions t where t.appointment_id = a.id and t.status = 'paid') as paid,
      a.scheduled_date = v.scheduled_date and a.scheduled_time = v.scheduled_time as same_schedule
      from video_rooms v join appointments a on a.id = v.appointment_id
      join users pu on pu.id = a.patient_id join users du on du.id = a.dentist_id join dentists d on d.user_id = du.id
      where v.room_name = $1 and v.provider = 'livekit'`,
      [event.roomName]
    );
    const room = rows[0];
    if (!room) return;
    const identity = event.identity;
    if (room.provider_room_id !== event.roomId) {
      // A cached token can recreate a deleted room. Never admit it as a new API join.
      // Removing its opaque identity is safe even for a delayed event: joins never reuse identities.
      if (room.closed_at !== null) await this.provider.close(room.room_name);
      else await this.provider.removeParticipant(room.room_name, identity);
      return;
    }
    const role =
      identity === room.patient_identity
        ? 'patient'
        : identity === room.dentist_identity
        ? 'dentist'
        : null;
    if (!role) {
      await this.provider.removeParticipant(room.room_name, identity);
      return;
    }
    const { rows: sessions } = await this.pool.query(
      `select exists(select 1 from refresh_tokens rt where rt.session_id = $1 and rt.user_id = $2
      and rt.revoked_at is null and rt.expires_at > now()) as active`,
      [
        room[`${role}_session_id`],
        role === 'patient' ? room.patient_id : room.dentist_id,
      ]
    );
    const active =
      room.closed_at === null &&
      room.same_schedule &&
      room.type === 'video' &&
      room.accounts_active &&
      room.paid &&
      sessions[0].active &&
      ['booked', 'waiting', 'in_consult'].includes(room.status) &&
      new Date(room.expires_at).getTime() > Date.now();
    if (!active) {
      await this.pool.query(
        'update video_rooms set closed_at = coalesce(closed_at, now()), cleaned_at = null where id = $1',
        [room.id]
      );
      await this.cleanup();
      return;
    }
    if (role === 'patient')
      await this.pool.query(
        `update appointments set status = 'waiting', updated_at = now() where id = $1 and status = 'booked'
      and type = 'video' and scheduled_date = $2 and scheduled_time = $3`,
        [room.appointment_id, room.scheduled_date, room.scheduled_time]
      );
  }

  async cleanup() {
    if (!this.provider.isConfigured()) return;
    await this.pool.query(
      `update video_rooms v set closed_at = coalesce(v.closed_at, now()) from appointments a
      where a.id = v.appointment_id and v.closed_at is null and (not $1 or v.provider <> 'livekit' or a.status not in ('booked','waiting','in_consult')
        or a.scheduled_date <> v.scheduled_date or a.scheduled_time <> v.scheduled_time or v.expires_at <= now()
        or not exists(select 1 from transactions t where t.appointment_id = a.id and t.status = 'paid')
        or not exists(select 1 from users u join dentists d on d.user_id = u.id where u.id = a.dentist_id and u.status = 'active' and d.status = 'verified')
        or not exists(select 1 from users u where u.id = a.patient_id and u.status = 'active')
        or (v.patient_session_id is not null and not exists(select 1 from refresh_tokens rt where rt.user_id = a.patient_id
          and rt.session_id = v.patient_session_id and rt.revoked_at is null and rt.expires_at > now()))
        or (v.dentist_session_id is not null and not exists(select 1 from refresh_tokens rt where rt.user_id = a.dentist_id
          and rt.session_id = v.dentist_session_id and rt.revoked_at is null and rt.expires_at > now())))`,
      [this.provider.isEnabled()]
    );
    const { rows } = await this.pool.query<{
      id: string;
      room_name: string;
    }>(
      "select id, room_name from video_rooms where provider = 'livekit' and closed_at is not null and cleaned_at is null order by closed_at limit 20"
    );
    for (const room of rows) {
      try {
        await this.provider.close(room.room_name);
        await this.pool.query(
          'update video_rooms set cleaned_at = now() where id = $1',
          [room.id]
        );
      } catch {
        this.logger.warn(
          'A closed video room could not be removed; retrying shortly.'
        );
      }
    }
  }

  onApplicationBootstrap() {
    if (this.config.get('nodeEnv') === 'test' || !this.provider.isConfigured())
      return;
    const tick = () => {
      if (this.running) return;
      this.running = this.cleanup();
      void this.running
        .catch(() => this.logger.warn('Video room cleanup will retry.'))
        .finally(() => {
          this.running = undefined;
        });
    };
    this.timer = setInterval(tick, 10_000);
    this.timer.unref();
    tick();
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.running?.catch(() => undefined);
  }
}
