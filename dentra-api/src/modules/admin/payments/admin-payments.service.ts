import { CLINIC_PAYMENT_COLUMNS, clinicPaymentReceipt, type ClinicPaymentColumns } from '@common/utils/clinic-payment.util';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Pool } from 'pg';
import type { AppConfig } from '@config/configuration';
import { PG_POOL } from '@database/database.module';
import { ListPaymentsDto } from './dto/list-payments.dto';

const PAGE_SIZE = 20;

type PaymentRow = ClinicPaymentColumns & {
  id: string;
  appointment_id: string;
  patient_name: string;
  dentist_name: string;
  scheduled_date: string;
  scheduled_time: string;
  amount_paise: number;
  method: string;
  status: string;
  gateway_ref: string | null;
  gateway_payment_ref: string | null;
  created_at: string;
  updated_at: string;
  refund_id: string | null;
};

@Injectable()
export class AdminPaymentsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(ConfigService) private readonly config: ConfigService<AppConfig>,
  ) {}

  async list(filters: ListPaymentsDto) {
    if (filters.from && filters.to && filters.from > filters.to) {
      throw new BadRequestException('The start date must be on or before the end date.');
    }

    const params: unknown[] = [];
    const conditions: string[] = [];
    const bind = (value: unknown) => { params.push(value); return `$${params.length}`; };
    if (filters.status) conditions.push(`t.status = ${bind(filters.status)}`);
    if (filters.method) conditions.push(`t.method = ${bind(filters.method)}`);
    if (filters.from) conditions.push(`t.created_at >= (${bind(filters.from)}::date::timestamp at time zone 'Asia/Kolkata')`);
    if (filters.to) conditions.push(`t.created_at < ((${bind(filters.to)}::date + 1)::timestamp at time zone 'Asia/Kolkata')`);
    if (filters.q) {
      const search = `%${filters.q.replace(/[\\%_]/g, '\\$&')}%`;
      conditions.push(`concat_ws(' ', p.full_name, d.full_name, t.id::text, a.id::text, t.gateway_ref, t.gateway_payment_ref, r.gateway_ref) ilike ${bind(search)}`);
    }
    const page = filters.page ?? 1;
    const offset = (page - 1) * PAGE_SIZE;
    const limitParam = bind(PAGE_SIZE);
    const offsetParam = bind(offset);

    // One snapshot keeps the visible page and its totals consistent while webhooks update payments.
    const { rows } = await this.pool.query<{
      total: string; paid: string; refunded: string; refund_pending: string; refund_failed: string;
      pending: string; due_at_clinic: string; items: PaymentRow[];
    }>(
      `with filtered as (
         select t.id, t.appointment_id, t.amount_paise, t.method, t.status,
                t.gateway_ref, t.gateway_payment_ref, t.created_at, t.updated_at,
                p.full_name as patient_name, d.full_name as dentist_name,
                a.scheduled_date, a.scheduled_time, r.gateway_ref as refund_id, ${CLINIC_PAYMENT_COLUMNS}
         from transactions t
         join appointments a on a.id = t.appointment_id
         join patients p on p.user_id = a.patient_id
         join dentists d on d.user_id = a.dentist_id
         left join payment_refunds r on r.transaction_id = t.id
         left join clinic_payment_collections cp on cp.transaction_id = t.id
         ${conditions.length ? `where ${conditions.join(' and ')}` : ''}
       )
       select count(*) as total,
              coalesce(sum(amount_paise) filter (where status = 'paid'), 0) as paid,
              coalesce(sum(amount_paise) filter (where status = 'refunded'), 0) as refunded,
              coalesce(sum(amount_paise) filter (where status = 'refund_pending'), 0) as refund_pending,
              coalesce(sum(amount_paise) filter (where status = 'refund_failed'), 0) as refund_failed,
              coalesce(sum(amount_paise) filter (where status = 'pending'), 0) as pending,
              coalesce(sum(amount_paise) filter (where status = 'due_at_clinic'), 0) as due_at_clinic,
              coalesce((select jsonb_agg(page_rows order by created_at desc, id desc) from (
                select * from filtered order by created_at desc, id desc limit ${limitParam} offset ${offsetParam}
              ) page_rows), '[]'::jsonb) as items
       from filtered`,
      params,
    );
    const result = rows[0];
    const total = Number(result.total);
    const gateway = this.config.get('razorpay', { infer: true })!;
    const mode = gateway.keyId.startsWith('rzp_test_') ? 'test'
      : gateway.keyId.startsWith('rzp_live_') ? 'live' : 'unconfigured';

    return {
      gateway: {
        provider: 'razorpay',
        mode,
        checkoutConfigured: mode !== 'unconfigured' && !!gateway.keySecret,
        webhookConfigured: !!gateway.webhookSecret,
      },
      summary: {
        totalTransactions: total,
        paidAmountPaise: Number(result.paid),
        refundedAmountPaise: Number(result.refunded),
        refundPendingAmountPaise: Number(result.refund_pending),
        refundFailedAmountPaise: Number(result.refund_failed),
        pendingAmountPaise: Number(result.pending),
        dueAtClinicAmountPaise: Number(result.due_at_clinic),
      },
      items: result.items.map(row => ({
        id: row.id,
        appointmentId: row.appointment_id,
        patientName: row.patient_name,
        dentistName: row.dentist_name,
        appointmentDate: row.scheduled_date,
        appointmentTime: row.scheduled_time.slice(0, 5),
        amountPaise: row.amount_paise,
        method: row.method,
        collection: clinicPaymentReceipt(row),
        status: row.status,
        gatewayOrderId: row.gateway_ref,
        gatewayPaymentId: row.gateway_payment_ref,
        gatewayRefundId: row.refund_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      page,
      pageSize: PAGE_SIZE,
      nextPage: offset + result.items.length < total ? page + 1 : null,
    };
  }

  async retryRefund(adminId: string, transactionId: string) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: transactions } = await client.query<{ status: string; appointment_id: string }>(
        'select status, appointment_id from transactions where id = $1 for update', [transactionId],
      );
      const transaction = transactions[0];
      if (!transaction) throw new NotFoundException('No such transaction.');
      const { rows: jobs } = await client.query<{ id: string; status: string }>(
        'select id, status from payment_refunds where transaction_id = $1 for update', [transactionId],
      );
      if (!jobs[0] || !['refund_pending', 'refund_failed'].includes(transaction.status)) {
        throw new ConflictException('This transaction has no unresolved refund request.');
      }
      // A repeated click cannot reset a worker's lease or create another request.
      if (transaction.status === 'refund_failed' && jobs[0].status === 'failed') {
        await client.query(
          `update payment_refunds set status = 'pending', attempts = 0, next_attempt_at = now(),
           lease_token = null, lease_until = null, last_error_code = null, updated_at = now() where id = $1`, [jobs[0].id],
        );
        await client.query("update transactions set status = 'refund_pending', updated_at = now() where id = $1", [transactionId]);
        await client.query(
          `insert into audit_log (actor_user_id, actor_label, action, entity_type, entity_id, detail)
           select id, coalesce(email::text, 'admin'), 'refund_retry_requested', 'appointment', $2, $3
           from users where id = $1`,
          [adminId, transaction.appointment_id, `Recheck saved refund request for transaction ${transactionId}`],
        );
      }
      await client.query('COMMIT');
      return { queued: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
}
