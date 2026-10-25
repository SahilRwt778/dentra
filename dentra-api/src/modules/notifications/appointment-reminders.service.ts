import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Pool } from 'pg';
import { PG_POOL } from '@database/database.module';
import { NotificationsService } from './notifications.service';

@Injectable()
export class AppointmentRemindersService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(AppointmentRemindersService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<number>;

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    // Tests run the same job explicitly with a controlled clock.
    if (this.config.get('nodeEnv') === 'test') return;
    const tick = () => {
      if (this.running) return;
      this.running = this.runOnce();
      void this.running
        .catch(() => this.logger.error('Could not create appointment reminders; retrying next minute.'))
        .finally(() => {
          this.running = undefined;
        });
    };
    this.timer = setInterval(tick, 60_000);
    this.timer.unref();
    tick();
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.running?.catch(() => undefined);
  }

  /** Restart-safe and safe across API instances: rows are locked, and events are unique per schedule revision. */
  async runOnce(now = new Date()) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<{ id: string; event_key: string }>(
        `select a.id, a.id::text || ':' || extract(epoch from coalesce(a.rescheduled_at, a.booked_at))::text as event_key
         from appointments a
         join transactions t on t.appointment_id = a.id
         join users u on u.id = a.patient_id and u.status = 'active'
         join dentists d on d.user_id = a.dentist_id and d.status = 'verified'
         join users du on du.id = a.dentist_id and du.status = 'active'
         where a.status = 'booked' and t.status in ('paid', 'due_at_clinic')
           and (a.scheduled_date + a.scheduled_time) at time zone 'Asia/Kolkata' > $1::timestamptz
           and (a.scheduled_date + a.scheduled_time) at time zone 'Asia/Kolkata' <= $1::timestamptz + interval '1 hour'
           and not exists (select 1 from notifications n where n.user_id = a.patient_id
             and n.template_key = 'appointment_reminder'
             and n.payload->>'eventKey' = a.id::text || ':' || extract(epoch from coalesce(a.rescheduled_at, a.booked_at))::text)
         order by a.scheduled_date, a.scheduled_time, a.id limit 100 for update of a skip locked`,
        [now.toISOString()],
      );
      for (const row of rows) {
        await this.notifications.patientAppointmentEvent(client, 'appointment_reminder', row.id, {
          eventKey: row.event_key,
        });
      }
      await client.query('COMMIT');
      return rows.length;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
