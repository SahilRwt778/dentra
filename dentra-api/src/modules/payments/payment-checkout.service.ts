import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { isEmail } from 'class-validator';
import type { Pool, PoolClient } from 'pg';
import { PG_POOL } from '@database/database.module';
import {
  PayuGatewayService,
  type PayuCheckoutData,
  type PayuHashRequest,
} from './payu-gateway.service';
import { PaymentReconciliationService } from './payment-reconciliation.service';

type CheckoutRow = {
  id: string;
  gateway_provider: 'payu' | 'razorpay';
  gateway_ref: string;
  gateway_checkout_data: PayuCheckoutData | null;
  amount_paise: number;
  status: string;
  payment_expires_at: string | null;
  full_name: string;
  email: string | null;
  mobile: string;
  patient_status: string;
  dentist_status: string;
  dentist_user_status: string;
};

@Injectable()
export class PaymentCheckoutService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly payu: PayuGatewayService,
    private readonly reconciliation: PaymentReconciliationService,
  ) {}

  async prepare(patientId: string, appointmentId: string) {
    const { rows } = await this.pool.query(
      `select t.gateway_ref, t.gateway_provider from transactions t join appointments a on a.id=t.appointment_id
       where a.id=$1 and a.patient_id=$2`,
      [appointmentId, patientId],
    );
    if (!rows[0]) throw new NotFoundException('No such payment.');
    // Always check the gateway before opening another checkout, including after an app restart.
    if (rows[0].gateway_ref) {
      try {
        await this.reconciliation.reconcileOrder(
          rows[0].gateway_ref,
          rows[0].gateway_provider,
        );
      } catch {
        throw new ServiceUnavailableException(
          'Payment status could not be checked. Please try again before making another payment.',
        );
      }
    }
    return this.withCheckout(patientId, appointmentId, async (client, row) => {
      if (row.gateway_provider !== 'payu')
        throw new ConflictException(
          'This payment uses legacy Razorpay checkout.',
        );
      this.payu.assertConfigured();
      const email = String(row.email ?? '').trim();
      if (!isEmail(email))
        throw new BadRequestException(
          'Add a valid email address in your profile before paying with PayU.',
        );
      const phone = String(row.mobile).replace(/^\+91/, '');
      if (!/^\d{10}$/.test(phone))
        throw new BadRequestException(
          'PayU checkout requires a 10-digit Indian mobile number.',
        );
      let data = row.gateway_checkout_data as PayuCheckoutData | null;
      if (!data) {
        data = this.payu.checkoutData({
          orderId: row.gateway_ref,
          amountPaise: row.amount_paise,
          patientId,
          firstName: row.full_name.trim().split(/\s+/)[0],
          email,
          phone,
        });
        await client.query(
          'update transactions set gateway_checkout_data=$2 where id=$1',
          [row.id, JSON.stringify(data)],
        );
      }
      return { provider: 'payu' as const, payUPaymentParams: data };
    });
  }

  async hash(
    patientId: string,
    appointmentId: string,
    request: PayuHashRequest,
  ) {
    return this.withCheckout(patientId, appointmentId, async (_client, row) => {
      if (row.gateway_provider !== 'payu' || !row.gateway_checkout_data)
        throw new ConflictException(
          'Prepare PayU checkout before requesting a hash.',
        );
      return { hash: this.payu.sdkHash(request, row.gateway_checkout_data) };
    });
  }

  private async withCheckout<T>(
    patientId: string,
    appointmentId: string,
    operation: (client: PoolClient, row: CheckoutRow) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: appointments } = await client.query(
        'select status from appointments where id=$1 and patient_id=$2 for update',
        [appointmentId, patientId],
      );
      if (!appointments[0]) throw new NotFoundException('No such appointment.');
      const { rows } = await client.query<CheckoutRow>(
        `select t.*, p.full_name, p.email, u.mobile, u.status as patient_status, d.status as dentist_status,
           du.status as dentist_user_status
         from transactions t join appointments a on a.id=t.appointment_id
         join patients p on p.user_id=a.patient_id join users u on u.id=p.user_id
         join dentists d on d.user_id=a.dentist_id join users du on du.id=d.user_id
         where t.appointment_id=$1 for update of t`,
        [appointmentId],
      );
      const row = rows[0];
      if (
        !row ||
        !['booked', 'waiting', 'in_consult'].includes(appointments[0].status) ||
        !['pending', 'failed'].includes(row.status) ||
        !row.gateway_ref ||
        !row.payment_expires_at ||
        new Date(row.payment_expires_at).getTime() <= Date.now() ||
        row.patient_status !== 'active' ||
        row.dentist_user_status !== 'active' ||
        row.dentist_status !== 'verified'
      )
        throw new ConflictException(
          'This appointment is no longer awaiting payment. Please refresh its status.',
        );
      const result = await operation(client, row);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
