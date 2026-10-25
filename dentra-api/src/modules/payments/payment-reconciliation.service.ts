import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Pool } from 'pg';
import { PG_POOL } from '@database/database.module';
import { RazorpayGatewayService } from './razorpay-gateway.service';
import { PaymentsWebhookService } from './payments-webhook.service';

@Injectable()
export class PaymentReconciliationService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(PaymentReconciliationService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<number>;

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly gateway: RazorpayGatewayService,
    private readonly payments: PaymentsWebhookService,
    private readonly config: ConfigService
  ) {}

  onApplicationBootstrap() {
    if (this.config.get('nodeEnv') === 'test') return;
    const tick = () => {
      if (this.running) return;
      this.running = this.runOnce();
      void this.running
        .catch(() => this.logger.error('Payment reconciliation could not run; retrying shortly.'))
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

  async runOnce() {
    const { rows } = await this.pool.query<{ gateway_ref: string }>(
      `with due as (
         select id from transactions where next_payment_check_at <= now()
           and status in ('pending', 'failed', 'cancelled') and gateway_ref is not null
           and gateway_payment_ref is null and created_at > now() - interval '7 days'
         order by next_payment_check_at, id limit 20 for update skip locked
       ) update transactions t set next_payment_check_at = now() + interval '1 minute'
         from due where t.id = due.id returning t.gateway_ref`
    );
    for (const row of rows) {
      try {
        const payments = await this.gateway.fetchOrderPayments(row.gateway_ref);
        for (const payment of payments) {
          if (payment.order_id !== row.gateway_ref || payment.status !== 'captured') continue;
          // Same amount/currency checks and locked transitions as a signed captured webhook.
          await this.payments.handle({
            event: 'payment.captured',
            payload: { payment: { entity: payment } },
          });
        }
      } catch {
        this.logger.warn('Could not reconcile a payment order; retrying later.');
      }
    }
    return rows.length;
  }
}
