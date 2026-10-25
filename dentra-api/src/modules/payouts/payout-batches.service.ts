import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { PG_POOL } from '@database/database.module';
import { AuditService } from '@modules/admin/audit/audit.service';
import {
  APPROVED_ACCOUNT,
  BATCH_COLUMNS,
  ELIGIBLE_PAYMENT,
  UNRESERVED_PAYMENT,
} from './payout-batch.queries';
import type {
  AdminPayoutBatchesDto,
  CreatePayoutBatchDto,
  EligiblePayoutsDto,
  ListPayoutBatchesDto,
  PayoutDentistsDto,
  UpdatePayoutBatchDto,
} from './dto/payout-batch.dto';

type Database = Pool | PoolClient;
type AccountRow = {
  id: string;
  bank_account_holder: string;
  bank_account_no: string;
  bank_ifsc: string;
};
type BatchRow = {
  id: string;
  dentist_id: string;
  status: string;
  version: number;
  account_approval_id: string;
  fee_bps: number;
};

@Injectable()
export class PayoutBatchesService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly audit: AuditService,
  ) {}

  async dentists(adminId: string, filters: PayoutDentistsDto) {
    await this.requireAdmin(this.pool, adminId);
    const { rows } = await this.pool.query(
      `select d.user_id as id, d.full_name as name, count(*)::int as "eligibleCount",
        sum(t.amount_paise)::float8 as "grossPaise"
       from dentists d join users u on u.id = d.user_id join appointments a on a.dentist_id = d.user_id
       join transactions t on t.appointment_id = a.id
       where d.status = 'verified' and u.status = 'active' and ${ELIGIBLE_PAYMENT} and ${UNRESERVED_PAYMENT}
       and ($1::text is null or strpos(lower(d.full_name), lower($1)) > 0)
       group by d.user_id order by d.full_name, d.user_id limit $2 offset $3`,
      [
        filters.q || null,
        filters.limit + 1,
        (filters.page - 1) * filters.limit,
      ],
    );
    return {
      items: rows.slice(0, filters.limit),
      nextPage: rows.length > filters.limit ? filters.page + 1 : null,
    };
  }

  async eligible(adminId: string, filters: EligiblePayoutsDto) {
    await this.requireAdmin(this.pool, adminId);
    const account = await this.account(this.pool, filters.dentistId);
    const { rows } = await this.pool.query(
      `with eligible as (select t.id, a.id as "appointmentId", to_char(a.scheduled_date,'YYYY-MM-DD') as "appointmentDate",
        to_char(a.scheduled_time,'HH24:MI') as "appointmentTime", p.full_name as "patientName", t.amount_paise as "amountPaise"
       from transactions t join appointments a on a.id = t.appointment_id join patients p on p.user_id = a.patient_id
       where a.dentist_id = $1 and ${ELIGIBLE_PAYMENT} and ${UNRESERVED_PAYMENT})
       select count(*)::int as total, coalesce(sum("amountPaise"),0)::float8 as "grossPaise",
       coalesce((select jsonb_agg(x order by "appointmentDate", "appointmentTime", id) from
         (select * from eligible order by "appointmentDate", "appointmentTime", id limit $2 offset $3) x),'[]') as items
       from eligible`,
      [filters.dentistId, filters.limit, (filters.page - 1) * filters.limit],
    );
    const result = rows[0];
    return {
      ...result,
      account: account
        ? {
            approvalId: account.id,
            last4: account.bank_account_no.slice(-4),
            ifsc: account.bank_ifsc,
          }
        : null,
      nextPage:
        filters.page * filters.limit < result.total ? filters.page + 1 : null,
    };
  }

  async list(filters: ListPayoutBatchesDto, dentistId?: string) {
    const { rows } = await this.pool.query(
      `with filtered as (select ${BATCH_COLUMNS} from payout_batches b join dentists d on d.user_id = b.dentist_id
       where ($1::uuid is null or b.dentist_id = $1) and ($2::text is null or b.status = $2))
       select count(*)::int as total,
       coalesce(sum("netPaise") filter (where status in ('pending','processing','failed')),0)::float8 as "reservedPaise",
       coalesce(sum("netPaise") filter (where status = 'paid'),0)::float8 as "paidPaise",
       coalesce((select jsonb_agg(x order by "createdAt" desc, id desc) from
         (select * from filtered order by "createdAt" desc, id desc limit $3 offset $4) x),'[]') as items from filtered`,
      [
        dentistId ?? null,
        filters.status ?? null,
        filters.limit,
        (filters.page - 1) * filters.limit,
      ],
    );
    return {
      ...rows[0],
      nextPage:
        filters.page * filters.limit < rows[0].total ? filters.page + 1 : null,
    };
  }

  async adminList(adminId: string, filters: AdminPayoutBatchesDto) {
    await this.requireAdmin(this.pool, adminId);
    return this.list(filters, filters.dentistId);
  }

  async get(
    id: string,
    dentistId?: string,
    database: Database = this.pool,
    includeBank = false,
  ) {
    const { rows } = await database.query(
      `select ${BATCH_COLUMNS},
        case when $3 then jsonb_build_object('holder',b.bank_account_holder,'accountNo',b.bank_account_no,'ifsc',b.bank_ifsc) else null end as account,
        coalesce((select jsonb_agg(jsonb_build_object('transactionId', t.id, 'appointmentId', a.id,
          'patientName',p.full_name,'amountPaise',bi.amount_paise,'feePaise',bi.fee_paise,
          'paymentStatus',t.status,'appointmentStatus',a.status,'released',bi.released_at is not null)
          order by bi.transaction_id) from payout_batch_items bi join transactions t on t.id = bi.transaction_id
          join appointments a on a.id = t.appointment_id join patients p on p.user_id = a.patient_id where bi.batch_id = b.id),'[]') as items,
        coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'status',e.status,'note',e.note,'createdAt',e.created_at)
          order by e.created_at,e.id) from payout_batch_events e where e.batch_id = b.id),'[]') as events
       from payout_batches b join dentists d on d.user_id = b.dentist_id
       where b.id = $1 and ($2::uuid is null or b.dentist_id = $2)`,
      [id, dentistId ?? null, includeBank],
    );
    if (!rows[0]) throw new NotFoundException('No such payout batch.');
    return rows[0];
  }

  async adminGet(adminId: string, id: string) {
    await this.requireAdmin(this.pool, adminId);
    return this.get(id, undefined, this.pool, true);
  }

  async create(adminId: string, input: CreatePayoutBatchDto) {
    const ids = [...input.transactionIds].sort();
    const request = { ...input, transactionIds: ids };
    return this.write(async (client) => {
      await this.requireAdmin(client, adminId);
      await this.lockDentist(client, input.dentistId, true);
      if (await this.replay(client, input.requestId, input.requestId, request))
        return this.get(input.requestId, undefined, client, true);
      const {rows:[policy]} = await client.query('select fee_bps from wallet_settings where singleton for share');
      if (policy?.fee_bps !== null && policy?.fee_bps !== undefined)
        throw new ConflictException('Wallet withdrawals are enabled. Review dentist withdrawal requests instead of creating manual batches.');
      const account = await this.account(client, input.dentistId);
      if (!account || account.id !== input.accountApprovalId)
        throw new ConflictException(
          'The approved payout account changed or is unavailable. Refresh eligibility.',
        );
      await this.lockPayments(client, ids);
      const { rows } = await client.query<{
        id: string;
        amount_paise: number;
        gateway_payment_ref: string;
      }>(
        `select t.id, t.amount_paise, t.gateway_payment_ref from transactions t join appointments a on a.id = t.appointment_id
         where t.id = any($1::uuid[]) and a.dentist_id = $2 and ${ELIGIBLE_PAYMENT} and ${UNRESERVED_PAYMENT}
         order by t.gateway_payment_ref, t.id`,
        [ids, input.dentistId],
      );
      if (rows.length !== ids.length)
        throw new ConflictException(
          'Some payments are no longer eligible or are already reserved. Refresh eligibility.',
        );
      const items = rows.map((row) => ({
        ...row,
        fee: Math.floor((row.amount_paise * input.feeBps + 5000) / 10000),
      }));
      const gross = items.reduce((sum, row) => sum + row.amount_paise, 0);
      const fee = items.reduce((sum, row) => sum + row.fee, 0);
      if (gross - fee <= 0)
        throw new BadRequestException(
          'The payout must have a positive net amount.',
        );
      await client.query(
        `insert into payout_batches
        (id,dentist_id,account_approval_id,bank_account_holder,bank_account_no,bank_ifsc,fee_bps,gross_paise,fee_paise,net_paise,created_by)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          input.requestId,
          input.dentistId,
          account.id,
          account.bank_account_holder,
          account.bank_account_no,
          account.bank_ifsc,
          input.feeBps,
          gross,
          fee,
          gross - fee,
          adminId,
        ],
      );
      for (const item of items)
        await client.query(
          'insert into payout_batch_items (batch_id,transaction_id,amount_paise,fee_paise,provider_payment_ref) values ($1,$2,$3,$4,$5)',
          [
            input.requestId,
            item.id,
            item.amount_paise,
            item.fee,
            item.gateway_payment_ref,
          ],
        );
      await this.event(
        client,
        adminId,
        input.requestId,
        input.requestId,
        'pending',
        request,
      );
      return this.get(input.requestId, undefined, client, true);
    });
  }

  async update(adminId: string, id: string, input: UpdatePayoutBatchDto) {
    return this.write(async (client) => {
      await this.requireAdmin(client, adminId);
      const found = await client.query<BatchRow>(
        'select * from payout_batches where id = $1',
        [id],
      );
      if (!found.rows[0]) throw new NotFoundException('No such payout batch.');
      await this.lockDentist(
        client,
        found.rows[0].dentist_id,
        input.action === 'processing',
      );
      const {
        rows: [batch],
      } = await client.query<BatchRow>(
        'select * from payout_batches where id = $1 for update',
        [id],
      );
      if (await this.replay(client, input.requestId, id, input))
        return this.get(id, undefined, client, true);
      if (batch.version !== input.version)
        throw new ConflictException(
          'This batch changed. Refresh its details before continuing.',
        );
      const allowed: Record<string, string[]> = {
        pending: ['processing', 'cancelled'],
        processing: ['paid', 'failed'],
        failed: ['processing', 'cancelled'],
      };
      if (!allowed[batch.status]?.includes(input.action))
        throw new ConflictException(
          'This payout status cannot be changed by that action.',
        );
      const itemIds = (
        await client.query<{ transaction_id: string }>(
          'select transaction_id from payout_batch_items where batch_id = $1',
          [id],
        )
      ).rows.map((row) => row.transaction_id);
      await this.lockPayments(client, itemIds);
      const current = await this.get(id, undefined, client, true);
      if (input.action === 'processing') {
        const account = await this.account(client, batch.dentist_id);
        if (!account || account.id !== batch.account_approval_id)
          throw new ConflictException(
            'The approved account changed. Cancel this batch and create a new one.',
          );
        if (current.needsAttention)
          throw new ConflictException(
            'A payment is no longer eligible. Cancel this batch and review its payments.',
          );
      }
      if (['failed', 'cancelled'].includes(input.action) && !input.note)
        throw new BadRequestException('Enter a reason for this action.');
      if (input.action === 'paid') {
        if (!input.reference || !input.paidOn)
          throw new BadRequestException(
            'Enter the bank transfer reference and payment date.',
          );
        const {
          rows: [dates],
        } = await client.query<{ valid: boolean }>(
          `select $1::date between (created_at at time zone 'Asia/Kolkata')::date and (now() at time zone 'Asia/Kolkata')::date as valid from payout_batches where id=$2`,
          [input.paidOn, id],
        );
        if (!dates.valid)
          throw new BadRequestException(
            'The payment date must be between batch creation and today in IST.',
          );
        if (current.needsAttention && !input.acknowledgeChanges)
          throw new ConflictException(
            'A payment changed after processing started. Acknowledge the discrepancy to record the actual transfer.',
          );
        await client.query("insert into payout_transfer_references (reference,kind,entity_id) values ($1,'batch',$2)",[input.reference,id]);
      } else if (input.reference || input.paidOn || input.acknowledgeChanges) {
        throw new BadRequestException(
          'Transfer details are only accepted when recording a paid batch.',
        );
      }
      await client.query(
        `update payout_batches set status=$2, version=version+1, updated_at=now(),bank_reference=$3,paid_on=$4 where id=$1`,
        [
          id,
          input.action,
          input.action === 'paid' ? input.reference : null,
          input.action === 'paid' ? input.paidOn : null,
        ],
      );
      if (input.action === 'cancelled')
        await client.query(
          'update payout_batch_items set released_at=now() where batch_id=$1',
          [id],
        );
      await this.event(
        client,
        adminId,
        input.requestId,
        id,
        input.action,
        input,
        input.note,
      );
      return this.get(id, undefined, client, true);
    });
  }

  private async lockPayments(client: PoolClient, ids: string[]) {
    // Match booking/cancellation/refund lock order: appointment before transaction.
    await client.query(
      'select a.id from appointments a where a.id in (select appointment_id from transactions where id=any($1::uuid[])) order by a.id for update',
      [ids],
    );
    await client.query(
      'select id from transactions where id=any($1::uuid[]) order by id for update',
      [ids],
    );
  }
  private async account(database: Database, dentistId: string) {
    return (
      (await database.query<AccountRow>(APPROVED_ACCOUNT, [dentistId]))
        .rows[0] ?? null
    );
  }
  private async lockDentist(client: PoolClient, id: string, verified: boolean) {
    const {
      rows: [dentist],
    } = await client.query(
      `select d.status, u.status as user_status from dentists d join users u on u.id=d.user_id where d.user_id=$1 for update of d`,
      [id],
    );
    if (!dentist) throw new NotFoundException('No such dentist.');
    if (
      verified &&
      (dentist.status !== 'verified' || dentist.user_status !== 'active')
    )
      throw new ConflictException('The dentist must be active and verified.');
  }
  private async requireAdmin(database: Database, id: string) {
    const { rows } = await database.query(
      "select id from users where id=$1 and role='admin' and status='active'",
      [id],
    );
    if (!rows[0])
      throw new ForbiddenException('This admin account is unavailable.');
  }
  private async replay(
    client: PoolClient,
    requestId: string,
    batchId: string,
    request: object,
  ) {
    const {
      rows: [event],
    } = await client.query(
      'select batch_id, request = $2::jsonb as matches from payout_batch_events where id=$1',
      [requestId, JSON.stringify(request)],
    );
    if (!event) return false;
    if (event.batch_id !== batchId || !event.matches)
      throw new ConflictException(
        'This request ID has already been used with different details.',
      );
    return true;
  }
  private async event(
    client: PoolClient,
    actorId: string,
    requestId: string,
    batchId: string,
    status: string,
    request: object,
    note?: string,
  ) {
    await client.query(
      'insert into payout_batch_events (id,batch_id,actor_id,status,request,note) values ($1,$2,$3,$4,$5,$6)',
      [
        requestId,
        batchId,
        actorId,
        status,
        JSON.stringify(request),
        note ?? null,
      ],
    );
    await this.audit.log(
      {
        actorUserId: actorId,
        action: `payout_batch_${status}`,
        entityType: 'payout_batch',
        entityId: batchId,
        afterState: { batchId, status, requestId },
      },
      client,
    );
  }
  private async write<T>(action: (client: PoolClient) => Promise<T>) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await action(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      if ((error as { code?: string }).code === '23505')
        throw new ConflictException(
          'A payment, request ID or bank reference is already reserved. Refresh before retrying.',
        );
      throw error;
    } finally {
      client.release();
    }
  }
}
