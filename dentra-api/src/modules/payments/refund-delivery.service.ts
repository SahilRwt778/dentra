import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { PG_POOL } from '@database/database.module';
import { RazorpayGatewayService } from './razorpay-gateway.service';
import { RefundsService } from './refunds.service';

@Injectable()
export class RefundDeliveryService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(RefundDeliveryService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<number>;

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly gateway: RazorpayGatewayService,
    private readonly refunds: RefundsService,
    private readonly config: ConfigService
  ) {}

  onApplicationBootstrap() {
    if (this.config.get('nodeEnv') === 'test') return;
    const tick = () => {
      if (this.running) return;
      this.running = this.runOnce();
      void this.running
        .catch(() => this.logger.error('Refund delivery could not run; retrying shortly.'))
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
    // Claim one job at a time: the lease comfortably exceeds the bounded HTTP timeout.
    // Every retry uses the persisted job UUID and exact same amount/body.
    let count = 0;
    for (; count < 20; count++) {
      const lease = randomUUID();
      const { rows } = await this.pool.query<{
        id: string;
        transaction_id: string;
        payment_ref: string;
        amount_paise: number;
        gateway_ref: string | null;
        attempts: number;
      }>(
        `with due as (
           select id from payment_refunds where status = 'pending' and next_attempt_at <= now()
             and (lease_until is null or lease_until < now())
           order by next_attempt_at, id limit 1 for update skip locked
         ) update payment_refunds r set lease_token = $1, lease_until = now() + interval '1 minute',
           attempts = attempts + 1 from due where r.id = due.id returning r.*`,
        [lease]
      );
      const job = rows[0];
      if (!job) break;
      try {
        const refund = job.gateway_ref
          ? await this.gateway.fetchRefund(job.gateway_ref)
          : await this.gateway.refund(job.payment_ref, job.amount_paise, job.id);
        if (
          refund.paymentId !== job.payment_ref ||
          (job.gateway_ref !== null && refund.refundId !== job.gateway_ref) ||
          refund.amountPaise !== job.amount_paise ||
          refund.currency !== 'INR'
        ) {
          throw new Error('Refund response does not match the saved request.');
        }
        await this.refunds.apply(refund);
      } catch (error) {
        const httpStatus = (error as { statusCode?: number })?.statusCode;
        const code = Number.isInteger(httpStatus) ? `gateway-http-${httpStatus}` : 'gateway-request-error';
        // Once a refund exists, keep reconciling it: normal refunds may take days.
        // Submission failures remain visible for support after eight attempts.
        const exhausted = !job.gateway_ref && job.attempts >= 8;
        const client = await this.pool.connect();
        try {
          await client.query('BEGIN');
          await client.query('select id from transactions where id = $1 for update', [job.transaction_id]);
          const result = await client.query(
            `update payment_refunds set status = $3, lease_until = null, last_error_code = $4,
             next_attempt_at = now() + make_interval(secs => $5), updated_at = now()
             where id = $1 and lease_token = $2 and status = 'pending' returning id`,
            [
              job.id,
              lease,
              exhausted ? 'failed' : 'pending',
              code,
              Math.min(3600, 30 * 2 ** Math.min(job.attempts - 1, 7)),
            ]
          );
          if (exhausted && result.rowCount) {
            await client.query(
              `update transactions set status = 'refund_failed', updated_at = now()
               where id = $1 and status = 'refund_pending'`,
              [job.transaction_id]
            );
          }
          await client.query('COMMIT');
        } catch (dbError) {
          await client.query('ROLLBACK');
          throw dbError;
        } finally {
          client.release();
        }
      }
    }
    return count;
  }
}
