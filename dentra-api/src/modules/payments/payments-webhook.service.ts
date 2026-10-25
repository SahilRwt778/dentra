import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '@database/database.module';
import { RefundsService } from './refunds.service';

type Entity = Record<string, unknown>;
function object(value: unknown): Entity {
  return value !== null && typeof value === 'object' ? (value as Entity) : {};
}
function requiredString(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 200)
    throw new BadRequestException('Invalid payment event.');
  return value;
}
function amount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0)
    throw new BadRequestException('Invalid payment amount.');
  return value;
}

@Injectable()
export class PaymentsWebhookService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool, private readonly refunds: RefundsService) {}

  async handle(body: unknown): Promise<void> {
    const event = object(body);
    const payload = object(event.payload);
    if (event.event === 'payment.captured' || event.event === 'payment.failed') {
      const payment = object(object(payload.payment).entity);
      const orderId = requiredString(payment.order_id);
      const paymentId = requiredString(payment.id);
      const paidAmount = amount(payment.amount);
      if (payment.currency !== 'INR') throw new BadRequestException('Invalid payment currency.');
      await this.payment(orderId, paymentId, paidAmount, event.event === 'payment.captured');
    } else if (['refund.created', 'refund.processed', 'refund.failed'].includes(String(event.event))) {
      const refund = object(object(payload.refund).entity);
      await this.refunds.apply({
        refundId: requiredString(refund.id),
        paymentId: requiredString(refund.payment_id),
        amountPaise: amount(refund.amount),
        currency: requiredString(refund.currency),
        status:
          event.event === 'refund.processed'
            ? 'processed'
            : event.event === 'refund.failed'
            ? 'failed'
            : 'pending',
      });
    }
  }

  private async payment(orderId: string, paymentId: string, paidAmount: number, captured: boolean) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: matches } = await client.query<{ appointment_id: string }>(
        'select appointment_id from transactions where gateway_ref = $1',
        [orderId]
      );
      const appointmentId = matches[0]?.appointment_id;
      if (!appointmentId) {
        await client.query('COMMIT');
        return;
      }
      // Cancellation, expiry and webhooks all lock the appointment before its transaction.
      const { rows: appointments } = await client.query<{ status: string }>(
        'select status from appointments where id = $1 for update',
        [appointmentId]
      );
      const { rows } = await client.query<{
        id: string;
        status: string;
        amount_paise: number;
        gateway_payment_ref: string | null;
      }>(
        'select id, status, amount_paise, gateway_payment_ref from transactions where gateway_ref = $1 for update',
        [orderId]
      );
      const txn = rows[0];
      if (txn.amount_paise !== paidAmount)
        throw new BadRequestException('Payment amount does not match the booking.');
      if (captured) {
        // Duplicate/older events cannot overwrite an accepted payment or undo its refund.
        if (!txn.gateway_payment_ref && ['pending', 'failed', 'cancelled'].includes(txn.status)) {
          await client.query(
            "update transactions set status = 'paid', gateway_payment_ref = $2, updated_at = now() where id = $1",
            [txn.id, paymentId]
          );
          // A slot may already have been released and booked by someone else. Never reopen it.
          if (appointments[0].status === 'cancelled') await this.refunds.enqueue(client, txn.id);
        }
      } else if (txn.status === 'pending') {
        // This is one failed payment attempt, not a failed order. Checkout can retry the same order.
        await client.query("update transactions set status = 'failed', updated_at = now() where id = $1", [
          txn.id,
        ]);
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
