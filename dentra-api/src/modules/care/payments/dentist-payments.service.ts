import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '@database/database.module';
import {
  CLINIC_PAYMENT_COLUMNS,
  clinicPaymentReceipt,
  type ClinicPaymentColumns,
} from '@common/utils/clinic-payment.util';
import type { ListDentistPaymentsDto } from './dto/list-dentist-payments.dto';

type PaymentRow = ClinicPaymentColumns & {
  id: string;
  appointment_id: string;
  patient_name: string;
  appointment_date: string;
  appointment_time: string;
  appointment_type: 'clinic' | 'video';
  appointment_status: string;
  clinic_name: string | null;
  amount_paise: number;
  source: 'online' | 'clinic';
  method: string;
  status: string;
  gateway_order_id: string | null;
  gateway_payment_id: string | null;
  gateway_refund_id: string | null;
  created_at: string;
  updated_at: string;
};
type ReportRow = {
  total: string;
  online_paid: string;
  clinic_paid: string;
  due_at_clinic: string;
  pending_online: string;
  refund_pending: string;
  refund_failed: string;
  refunded: string;
  items: PaymentRow[];
};

// Always scope the base relation by the authenticated dentist. Client filters
// never choose an owner, and both list and detail use this exact relation.
const OWN_PAYMENTS = `select t.id, t.appointment_id, t.amount_paise, t.method, t.status,
  t.created_at, t.updated_at, t.gateway_ref as gateway_order_id,
  t.gateway_payment_ref as gateway_payment_id, r.gateway_ref as gateway_refund_id,
  p.full_name as patient_name, to_char(a.scheduled_date, 'YYYY-MM-DD') as appointment_date,
  to_char(a.scheduled_time, 'HH24:MI') as appointment_time, a.type as appointment_type,
  a.status as appointment_status, dc.name as clinic_name, ${CLINIC_PAYMENT_COLUMNS},
  case when cp.id is not null or (t.method = 'pay_at_clinic' and t.gateway_ref is null and t.gateway_payment_ref is null)
    then 'clinic' else 'online' end as source
  from transactions t
  join appointments a on a.id = t.appointment_id
  join patients p on p.user_id = a.patient_id
  left join dentist_clinics dc on dc.id = a.clinic_id
  left join payment_refunds r on r.transaction_id = t.id
  left join clinic_payment_collections cp on cp.transaction_id = t.id
  where a.dentist_id = $1`;

@Injectable()
export class DentistPaymentsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async list(dentistId: string, filters: ListDentistPaymentsDto) {
    if (filters.from && filters.to && filters.from > filters.to) {
      throw new BadRequestException(
        'The start date must be on or before the end date.',
      );
    }
    const params: unknown[] = [dentistId];
    const conditions: string[] = [];
    const bind = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };
    if (filters.status) conditions.push(`status = ${bind(filters.status)}`);
    if (filters.source) conditions.push(`source = ${bind(filters.source)}`);
    if (filters.from)
      conditions.push(
        `created_at >= (${bind(
          filters.from,
        )}::date::timestamp at time zone 'Asia/Kolkata')`,
      );
    if (filters.to)
      conditions.push(
        `created_at < ((${bind(
          filters.to,
        )}::date + 1)::timestamp at time zone 'Asia/Kolkata')`,
      );
    if (filters.q) {
      const query = `%${filters.q.replace(/[\\%_]/g, '\\$&')}%`;
      conditions.push(`concat_ws(' ', patient_name, id::text, appointment_id::text, collection_id::text,
        gateway_order_id, gateway_payment_id, gateway_refund_id) ilike ${bind(
          query,
        )}`);
    }
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;
    const limitParam = bind(limit),
      offsetParam = bind(offset);
    // Totals and the visible page share one snapshot as payment/refund states change.
    const { rows } = await this.pool.query<ReportRow>(
      `with owned as (${OWN_PAYMENTS}),
       filtered as (select * from owned ${
         conditions.length ? `where ${conditions.join(' and ')}` : ''
       })
       select count(*) as total,
         coalesce(sum(amount_paise) filter (where status = 'paid' and source = 'online'), 0) as online_paid,
         coalesce(sum(amount_paise) filter (where status = 'paid' and source = 'clinic'), 0) as clinic_paid,
         coalesce(sum(amount_paise) filter (where status = 'due_at_clinic'), 0) as due_at_clinic,
         coalesce(sum(amount_paise) filter (where status in ('pending', 'failed') and source = 'online'), 0) as pending_online,
         coalesce(sum(amount_paise) filter (where status = 'refund_pending'), 0) as refund_pending,
         coalesce(sum(amount_paise) filter (where status = 'refund_failed'), 0) as refund_failed,
         coalesce(sum(amount_paise) filter (where status = 'refunded'), 0) as refunded,
         coalesce((select jsonb_agg(page_rows order by created_at desc, id desc) from (
           select * from filtered order by created_at desc, id desc limit ${limitParam} offset ${offsetParam}
         ) page_rows), '[]'::jsonb) as items from filtered`,
      params,
    );
    const result = rows[0];
    const total = Number(result.total);
    return {
      summary: {
        totalTransactions: total,
        onlinePaidAmountPaise: Number(result.online_paid),
        clinicCollectedAmountPaise: Number(result.clinic_paid),
        dueAtClinicAmountPaise: Number(result.due_at_clinic),
        pendingOnlineAmountPaise: Number(result.pending_online),
        refundPendingAmountPaise: Number(result.refund_pending),
        refundFailedAmountPaise: Number(result.refund_failed),
        refundedAmountPaise: Number(result.refunded),
      },
      items: result.items.map((row) => this.response(row)),
      page,
      limit,
      nextPage: offset + result.items.length < total ? page + 1 : null,
    };
  }

  async get(dentistId: string, transactionId: string) {
    const { rows } = await this.pool.query<PaymentRow>(
      `${OWN_PAYMENTS} and t.id = $2`,
      [dentistId, transactionId],
    );
    if (!rows[0]) throw new NotFoundException('No such payment.');
    return this.response(rows[0]);
  }

  private response(row: PaymentRow) {
    return {
      id: row.id,
      appointmentId: row.appointment_id,
      patientName: row.patient_name,
      appointmentDate: row.appointment_date,
      appointmentTime: row.appointment_time,
      appointmentType: row.appointment_type,
      appointmentStatus: row.appointment_status,
      clinicName: row.clinic_name,
      amountPaise: row.amount_paise,
      source: row.source,
      method: row.method,
      status: row.status,
      collection: clinicPaymentReceipt(row),
      gatewayOrderId: row.gateway_order_id,
      gatewayPaymentId: row.gateway_payment_id,
      gatewayRefundId: row.gateway_refund_id,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }
}
