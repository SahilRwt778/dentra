import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { PG_POOL } from '@database/database.module';
import type { GatewayRefund } from './razorpay-gateway.service';

@Injectable()
export class RefundsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** Called while the appointment and transaction are locked, in the caller's transaction. */
  async enqueue(client: PoolClient, transactionId: string) {
    await client.query(
      `insert into payment_refunds (transaction_id, payment_ref, amount_paise)
       select id, gateway_payment_ref, amount_paise from transactions
       where id = $1 and gateway_payment_ref is not null and amount_paise > 0
       on conflict (transaction_id) do nothing`,
      [transactionId]
    );
    await client.query(
      `update transactions set status = 'refund_pending', updated_at = now()
       where id = $1 and status not in ('refunded', 'refund_failed', 'refund_pending')`,
      [transactionId]
    );
  }

  /** Both signed webhooks and authenticated provider reads use these same monotonic transitions. */
  async apply(refund: GatewayRefund) {
    if (!refund.refundId || !refund.paymentId || refund.currency !== 'INR' || refund.amountPaise <= 0) return;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<{ id: string; status: string; amount_paise: number }>(
        `select id, status, amount_paise from transactions where gateway_payment_ref = $1 for update`,
        [refund.paymentId]
      );
      const transaction = rows[0];
      // A partial refund must never be reported as a full refund.
      if (!transaction || transaction.amount_paise !== refund.amountPaise) {
        await client.query('COMMIT');
        return;
      }
      const { rows: jobs } = await client.query<{ gateway_ref: string | null }>(
        'select gateway_ref from payment_refunds where transaction_id = $1 for update',
        [transaction.id]
      );
      if (jobs[0]?.gateway_ref && jobs[0].gateway_ref !== refund.refundId) {
        await client.query('COMMIT');
        return;
      }
      // Adopt a full refund started through the provider dashboard as well. Its known ID is
      // reconciled by reads; the worker must never submit another refund for that payment.
      if (!jobs[0] && transaction.status !== 'refunded') {
        await client.query(
          `insert into payment_refunds (transaction_id, payment_ref, amount_paise, gateway_ref)
           values ($1, $2, $3, $4)`,
          [transaction.id, refund.paymentId, refund.amountPaise, refund.refundId],
        );
      }
      if (transaction.status !== 'refunded') {
        const status =
          refund.status === 'processed'
            ? 'refunded'
            : refund.status === 'failed'
            ? 'refund_failed'
            : 'refund_pending';
        // Late pending/created events cannot undo a known failure; processed can resolve it.
        if (status !== 'refund_pending' || transaction.status !== 'refund_failed') {
          await client.query('update transactions set status = $2, updated_at = now() where id = $1', [
            transaction.id,
            status,
          ]);
          await client.query(
            `update payment_refunds set gateway_ref = $2, status = $3, lease_until = null,
             last_error_code = $4, next_attempt_at = now() + interval '1 minute', updated_at = now()
             where transaction_id = $1`,
            [
              transaction.id,
              refund.refundId,
              refund.status,
              refund.status === 'failed' ? 'provider-refund-failed' : null,
            ]
          );
        }
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
