import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Pool } from 'pg';
import { PG_POOL } from '@database/database.module';
import { NotificationsService } from '@modules/notifications/notifications.service';

/** Release unpaid online bookings after a 15-minute checkout window. */
@Injectable()
export class PaymentExpiryService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(PaymentExpiryService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<number>;

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService
  ) {}

  onApplicationBootstrap() {
    if (this.config.get('nodeEnv') === 'test') return;
    const tick = () => {
      if (this.running) return;
      this.running = this.runOnce();
      void this.running
        .catch(() => this.logger.error('Payment expiry could not run; retrying shortly.'))
        .finally(() => {
          this.running = undefined;
        });
    };
    this.timer = setInterval(tick, 30_000);
    this.timer.unref();
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.running?.catch(() => undefined);
  }

  async runOnce(now = new Date()) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<{ id: string }>(
        `select a.id from appointments a join transactions t on t.appointment_id = a.id
         where a.status = 'booked' and t.status in ('pending', 'failed')
           and t.method <> 'pay_at_clinic' and t.payment_expires_at <= $1::timestamptz
         order by t.payment_expires_at, a.id limit 100 for update of a skip locked`,
        [now.toISOString()]
      );
      let count = 0;
      for (const row of rows) {
        const result = await client.query(
          `update transactions set status = 'cancelled', updated_at = now()
           where appointment_id = $1 and status in ('pending', 'failed') returning id`,
          [row.id]
        );
        if (!result.rowCount) continue;
        await client.query(
          "update appointments set status = 'cancelled', cancelled_at = now(), updated_at = now() where id = $1",
          [row.id]
        );
        await this.notifications.dismissAppointmentReminders(client, row.id);
        await this.notifications.patientAppointmentEvent(client, 'appointment_cancelled', row.id);
        count++;
      }
      await client.query('COMMIT');
      return count;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
