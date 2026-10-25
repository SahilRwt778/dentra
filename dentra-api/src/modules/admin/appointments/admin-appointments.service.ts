import { CLINIC_PAYMENT_COLUMNS, clinicPaymentReceipt, type ClinicPaymentColumns } from '@common/utils/clinic-payment.util';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '@database/database.module';
import { ListAdminAppointmentsDto } from './dto/list-admin-appointments.dto';

type AppointmentRow = ClinicPaymentColumns & {
  id: string;
  patient_name: string;
  dentist_name: string;
  type: string;
  scheduled_date: string;
  scheduled_time: string;
  concern_summary: string;
  status: string;
  payment_method: string | null;
  payment_amount: number | null;
  payment_status: string | null;
};

/** Admin visibility across all dentists, with filtering and pagination in PostgreSQL. */
@Injectable()
export class AdminAppointmentsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async list(filters: ListAdminAppointmentsDto) {
    if (filters.from && filters.to && filters.from > filters.to) {
      throw new BadRequestException(
        'The start date must be on or before the end date.',
      );
    }
    const params: unknown[] = [];
    const conditions: string[] = [];
    const bind = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };
    const today = "(now() at time zone 'Asia/Kolkata')::date";
    if (filters.filter === 'today')
      conditions.push(`a.scheduled_date = ${today}`);
    if (filters.filter === 'upcoming')
      conditions.push(`a.scheduled_date > ${today}`);
    if (filters.filter === 'past')
      conditions.push(`a.scheduled_date < ${today}`);
    if (filters.from)
      conditions.push(`a.scheduled_date >= ${bind(filters.from)}::date`);
    if (filters.to)
      conditions.push(`a.scheduled_date <= ${bind(filters.to)}::date`);
    if (filters.status) conditions.push(`a.status = ${bind(filters.status)}`);
    if (filters.type) conditions.push(`a.type = ${bind(filters.type)}`);

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;
    const limitParam = bind(limit);
    const offsetParam = bind(offset);
    const direction = filters.filter === 'past' ? 'desc' : 'asc';

    // One snapshot keeps totals and the visible page consistent as bookings change.
    // A payment retry must not duplicate an appointment or consume another page row.
    const { rows } = await this.pool.query<{
      total: string;
      not_cancelled: string;
      completed: string;
      cancelled: string;
      paid_amount: string;
      items: AppointmentRow[];
    }>(
      `with filtered as (
         select a.id, a.type, a.scheduled_date, a.scheduled_time, a.concern_summary, a.status,
                p.full_name as patient_name, d.full_name as dentist_name,
                t.method as payment_method, t.amount_paise as payment_amount, t.status as payment_status, ${CLINIC_PAYMENT_COLUMNS}
         from appointments a
         join patients p on p.user_id = a.patient_id
         join dentists d on d.user_id = a.dentist_id
         left join lateral (
           select id, method, amount_paise, status from transactions
           where appointment_id = a.id order by created_at desc, id desc limit 1
         ) t on true
         left join clinic_payment_collections cp on cp.transaction_id = t.id
         ${conditions.length ? `where ${conditions.join(' and ')}` : ''}
       )
       select count(*) as total,
              count(*) filter (where status <> 'cancelled') as not_cancelled,
              count(*) filter (where status = 'completed') as completed,
              count(*) filter (where status = 'cancelled') as cancelled,
              coalesce(sum(payment_amount) filter (where payment_status = 'paid'), 0) as paid_amount,
              coalesce((select json_agg(page_rows) from (
                select * from filtered
                order by scheduled_date ${direction}, scheduled_time ${direction}, id ${direction}
                limit ${limitParam} offset ${offsetParam}
              ) page_rows), '[]'::json) as items
       from filtered`,
      params,
    );
    const result = rows[0];
    const total = Number(result.total);
    return {
      items: result.items.map((row) => ({
        id: row.id,
        patientName: row.patient_name,
        dentistName: row.dentist_name,
        type: row.type,
        date: row.scheduled_date,
        time: row.scheduled_time,
        concern: row.concern_summary,
        status: row.status,
        payment: row.payment_method
          ? {
              method: row.payment_method,
              amountPaise: row.payment_amount,
              status: row.payment_status,
              collection: clinicPaymentReceipt(row),
            }
          : null,
      })),
      total,
      page,
      limit,
      nextPage: offset + result.items.length < total ? page + 1 : null,
      summary: {
        notCancelled: Number(result.not_cancelled),
        completed: Number(result.completed),
        cancelled: Number(result.cancelled),
        paidAmountPaise: Number(result.paid_amount),
      },
    };
  }
}
