import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { PG_POOL } from '@database/database.module';
import { FirebasePushService } from './firebase-push.service';

@Injectable()
export class PushDeliveryService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(PushDeliveryService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<number>;

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly firebase: FirebasePushService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get('nodeEnv') === 'test' || !this.firebase.isEnabled()) return;
    const tick = () => {
      if (this.running) return;
      this.running = this.runOnce();
      void this.running
        .catch(() => this.logger.error('Push delivery could not run; retrying shortly.'))
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

  async runOnce() {
    if (!this.firebase.isEnabled()) return 0;
    const lease = randomUUID();
    const { rows: jobs } = await this.pool.query<{ id: string; attempts: number }>(
      `with due as (
         select id from push_deliveries where (status = 'pending' and next_attempt_at <= now())
           or (status = 'sending' and lease_until < now())
         order by created_at limit 20 for update skip locked
       ) update push_deliveries d set status = 'sending', attempts = attempts + 1,
         lease_token = $1, lease_until = now() + interval '5 minutes'
       from due where d.id = due.id returning d.id, d.attempts`,
      [lease],
    );
    for (const job of jobs) {
      const ownership = await this.pool.query(
        `update push_deliveries set lease_until = now() + interval '5 minutes' where id = $1 and lease_token = $2 and status = 'sending' returning id`,
        [job.id, lease],
      );
      if (!ownership.rowCount) continue;
      if (job.attempts > 8) {
        await this.finish(job.id, lease, 'failed', 'attempts-exhausted');
        continue;
      }
      const { rows } = await this.pool.query<{
        device_id: string;
        binding_id: string;
        token: string;
        notification_id: string;
        ttl: number;
      }>(
        `select pd.id as device_id, pd.binding_id, pd.token, n.id as notification_id,
          case when n.template_key = 'appointment_reminder' then least(3600,
            extract(epoch from ((a.scheduled_date + a.scheduled_time) at time zone 'Asia/Kolkata' - now()))::int)
            else least(86400, extract(epoch from (n.created_at + interval '24 hours' - now()))::int) end as ttl
         from push_deliveries j join push_devices pd on pd.id = j.device_id and pd.binding_id = j.binding_id and pd.enabled
         join notifications n on n.id = j.notification_id and n.user_id = pd.user_id
         join users u on u.id = pd.user_id and u.role = 'patient' and u.status = 'active'
         left join appointments a on a.id::text = n.payload->>'appointmentId'
         where j.id = $1 and j.lease_token = $2 and j.status = 'sending'
           and n.channel = 'in_app' and n.read_at is null and n.created_at > now() - interval '24 hours'
           and exists (select 1 from refresh_tokens rt where rt.user_id = pd.user_id
             and rt.session_id = pd.session_id and rt.device_id = pd.installation_id
             and rt.revoked_at is null and rt.expires_at > now())
           and (n.template_key <> 'appointment_reminder' or (a.status = 'booked'
             and a.scheduled_date::text = n.payload->>'date' and to_char(a.scheduled_time, 'HH24:MI') = n.payload->>'time'
             and (a.scheduled_date + a.scheduled_time) at time zone 'Asia/Kolkata' > now()))`,
        [job.id, lease],
      );
      const recipient = rows[0];
      if (!recipient) {
        await this.finish(job.id, lease, 'skipped', 'recipient-or-notification-inactive');
        continue;
      }
      try {
        const messageId = await this.firebase.send(
          recipient.token,
          recipient.notification_id,
          Math.max(1, recipient.ttl),
        );
        await this.pool.query(
          `update push_deliveries set status = 'sent', sent_at = now(), provider_message_id = $3,
           lease_until = null, last_error_code = null where id = $1 and lease_token = $2`,
          [job.id, lease, messageId],
        );
      } catch (error) {
        const rawCode = (error as { code?: unknown })?.code;
        const code =
          typeof rawCode === 'string' && /^[a-zA-Z0-9/_-]{1,100}$/.test(rawCode) ? rawCode : 'delivery-error';
        if (['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(code)) {
          await this.pool.query(
            `update push_devices set enabled = false, binding_id = gen_random_uuid(), updated_at = now()
             where id = $1 and binding_id = $2`,
            [recipient.device_id, recipient.binding_id],
          );
          await this.finish(job.id, lease, 'skipped', code);
        } else {
          await this.pool.query(
            `update push_deliveries set status = $3, next_attempt_at = now() + make_interval(secs => $4),
             lease_until = null, last_error_code = $5 where id = $1 and lease_token = $2`,
            [
              job.id,
              lease,
              job.attempts >= 8 ? 'failed' : 'pending',
              Math.min(3600, 60 * 2 ** (job.attempts - 1)),
              code,
            ],
          );
        }
      }
    }
    return jobs.length;
  }

  private async finish(id: string, lease: string, status: 'skipped' | 'failed', code: string) {
    await this.pool.query(
      `update push_deliveries set status = $3, last_error_code = $4, lease_until = null
       where id = $1 and lease_token = $2`,
      [id, lease, status, code],
    );
  }
}
