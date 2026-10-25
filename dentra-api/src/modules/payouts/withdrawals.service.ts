import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { PG_POOL } from '@database/database.module';
import { AuditService } from '@modules/admin/audit/audit.service';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { WalletBalanceService } from './wallet-balance.service';
import { WalletSettingsService } from './wallet-settings.service';
import {
  approvedWalletAccount,
  lockWalletOwner,
  requireWalletAdmin,
  type WalletDatabase,
} from './wallet-access';
import type {
  AdminWithdrawalListDto,
  RequestWithdrawalDto,
  WithdrawalActionDto,
  WithdrawalListDto,
} from './dto/wallet.dto';

const COLUMNS = `w.id,w.dentist_id as "dentistId",d.full_name as "dentistName",w.amount_paise as "amountPaise",
  w.minimum_paise as "minimumPaise",w.status,w.version,right(w.bank_account_no,4) as "accountLast4",w.bank_ifsc as "bankIfsc",
  w.bank_reference as "bankReference",to_char(w.paid_on,'YYYY-MM-DD') as "paidOn",w.created_at as "createdAt",w.updated_at as "updatedAt"`;
type Row = {
  id: string;
  dentist_id: string;
  account_approval_id: string;
  status: string;
  version: number;
  request: object;
};

@Injectable()
export class WithdrawalsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly balance: WalletBalanceService,
    private readonly settings: WalletSettingsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(filters: WithdrawalListDto, dentistId?: string, q?: string) {
    const {
      rows: [page],
    } = await this.pool.query(
      `with filtered as (select ${COLUMNS} from wallet_withdrawals w join dentists d on d.user_id=w.dentist_id
      where ($1::uuid is null or w.dentist_id=$1) and ($2::text is null or w.status=$2)
        and ($3::text is null or strpos(lower(d.full_name),lower($3))>0 or strpos(w.id::text,lower($3))>0))
      select count(*)::int as total,coalesce((select jsonb_agg(x order by "createdAt" desc,id desc) from
        (select * from filtered order by "createdAt" desc,id desc limit $4 offset $5)x),'[]') as items from filtered`,
      [
        dentistId ?? null,
        filters.status ?? null,
        q || null,
        filters.limit,
        (filters.page - 1) * filters.limit,
      ],
    );
    return {
      ...page,
      nextPage:
        filters.page * filters.limit < page.total ? filters.page + 1 : null,
    };
  }
  async adminList(adminId: string, filters: AdminWithdrawalListDto) {
    await requireWalletAdmin(this.pool, adminId);
    return this.list(filters, undefined, filters.q);
  }
  async get(
    id: string,
    dentistId?: string,
    database: WalletDatabase = this.pool,
    includeBank = false,
  ) {
    const {
      rows: [withdrawal],
    } = await database.query(
      `select ${COLUMNS},w.account_approval_id as "approvalId",
      case when $3 then jsonb_build_object('holder',w.bank_account_holder,'accountNo',w.bank_account_no,'ifsc',w.bank_ifsc) else null end as account,
      coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'status',e.status,'note',e.note,'createdAt',e.created_at)
        order by e.created_at,e.id) from wallet_withdrawal_events e where e.withdrawal_id=w.id),'[]') as events
      from wallet_withdrawals w join dentists d on d.user_id=w.dentist_id where w.id=$1 and ($2::uuid is null or w.dentist_id=$2)`,
      [id, dentistId ?? null, includeBank],
    );
    if (!withdrawal) throw new NotFoundException('No such withdrawal.');
    const wallet = await this.balance.summary(withdrawal.dentistId, database);
    const account = await approvedWalletAccount(database, withdrawal.dentistId);
    return {
      ...withdrawal,
      wallet,
      accountChanged: account?.id !== withdrawal.approvalId,
    };
  }
  async adminGet(adminId: string, id: string) {
    await requireWalletAdmin(this.pool, adminId);
    return this.get(id, undefined, this.pool, true);
  }

  async request(dentistId: string, input: RequestWithdrawalDto) {
    return this.write(async (client) => {
      const dentist = await lockWalletOwner(client, dentistId);
      const {
        rows: [existing],
      } = await client.query<Row & { matches: boolean }>(
        'select *,request=$2::jsonb as matches from wallet_withdrawals where id=$1',
        [input.requestId, JSON.stringify(input)],
      );
      if (existing) {
        if (existing.dentist_id !== dentistId || !existing.matches)
          throw new ConflictException(
            'This request ID was used with different details.',
          );
        return this.get(existing.id, dentistId, client);
      }
      const settings = await this.settings.read(client, true);
      if (settings.feeBps === null || settings.minimumWithdrawalPaise === null)
        throw new ConflictException(
          'Admin must configure the platform fee and minimum withdrawal first.',
        );
      if (input.amountPaise < settings.minimumWithdrawalPaise)
        throw new BadRequestException(
          'The requested amount is below the minimum withdrawal.',
        );
      const account = await approvedWalletAccount(client, dentistId);
      if (!account || account.id !== input.accountApprovalId)
        throw new ConflictException(
          'The approved payout account changed or is unavailable. Refresh your wallet.',
        );
      const wallet = await this.balance.summary(dentistId, client);
      if (input.amountPaise > wallet.availablePaise)
        throw new ConflictException(
          'The requested amount exceeds your available balance. Refresh your wallet.',
        );
      await client.query(
        `insert into wallet_withdrawals
        (id,dentist_id,amount_paise,minimum_paise,account_approval_id,bank_account_holder,bank_account_no,bank_ifsc,request)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          input.requestId,
          dentistId,
          input.amountPaise,
          settings.minimumWithdrawalPaise,
          account.id,
          account.bank_account_holder,
          account.bank_account_no,
          account.bank_ifsc,
          JSON.stringify(input),
        ],
      );
      await this.event(
        client,
        dentistId,
        input.requestId,
        input.requestId,
        'requested',
        input,
      );
      await this.notifications.walletWithdrawalRequested(client, {
        id: input.requestId,
        dentistId,
        dentistName: dentist.full_name,
        amountPaise: input.amountPaise,
      });
      return this.get(input.requestId, dentistId, client);
    });
  }

  async action(adminId: string, id: string, input: WithdrawalActionDto) {
    return this.write(async (client) => {
      await requireWalletAdmin(client, adminId);
      const {
        rows: [found],
      } = await client.query<Row>(
        'select * from wallet_withdrawals where id=$1',
        [id],
      );
      if (!found) throw new NotFoundException('No such withdrawal.');
      await lockWalletOwner(
        client,
        found.dentist_id,
        ['approved', 'processing'].includes(input.action),
      );
      const {
        rows: [withdrawal],
      } = await client.query<Row>(
        'select * from wallet_withdrawals where id=$1 for update',
        [id],
      );
      const {
        rows: [previous],
      } = await client.query(
        'select withdrawal_id,request=$2::jsonb as matches from wallet_withdrawal_events where id=$1',
        [input.requestId, JSON.stringify(input)],
      );
      if (previous) {
        if (previous.withdrawal_id !== id || !previous.matches)
          throw new ConflictException(
            'This request ID was used with different details.',
          );
        return this.get(id, undefined, client, true);
      }
      if (withdrawal.version !== input.version)
        throw new ConflictException(
          'This withdrawal changed. Refresh before continuing.',
        );
      const transitions: Record<string, string[]> = {
        requested: ['approved', 'rejected'],
        approved: ['processing', 'cancelled'],
        processing: ['paid', 'failed'],
        failed: ['processing', 'cancelled'],
      };
      if (!transitions[withdrawal.status]?.includes(input.action))
        throw new ConflictException(
          'This action is not available for the current withdrawal status.',
        );
      const current = await this.get(id, undefined, client, true);
      if (['approved', 'processing'].includes(input.action)) {
        if (current.accountChanged)
          throw new ConflictException(
            'The approved bank account changed. Decline or cancel this request so the dentist can submit a new one.',
          );
        if (current.wallet.shortfallPaise > 0)
          throw new ConflictException(
            'The wallet has a refund adjustment or insufficient eligible earnings. Review or release outstanding requests first.',
          );
      }
      if (
        ['rejected', 'cancelled', 'failed'].includes(input.action) &&
        !input.note
      )
        throw new BadRequestException('Enter a reason for this decision.');
      if (input.action === 'paid') {
        if (!input.reference || !input.paidOn)
          throw new BadRequestException(
            'Enter the bank reference and transfer date.',
          );
        const {
          rows: [dates],
        } = await client.query(
          `select $1::date between (created_at at time zone 'Asia/Kolkata')::date and (now() at time zone 'Asia/Kolkata')::date as valid from wallet_withdrawals where id=$2`,
          [input.paidOn, id],
        );
        if (!dates.valid)
          throw new BadRequestException(
            'The transfer date must be between the request date and today in IST.',
          );
        if (current.wallet.shortfallPaise > 0 && !input.acknowledgeChanges)
          throw new ConflictException(
            'A wallet adjustment occurred. Acknowledge it before recording a transfer that actually happened.',
          );
        await client.query(
          "insert into payout_transfer_references (reference,kind,entity_id) values ($1,'withdrawal',$2)",
          [input.reference, id],
        );
      } else if (input.reference || input.paidOn || input.acknowledgeChanges)
        throw new BadRequestException(
          'Bank evidence is only accepted when recording Paid.',
        );
      await client.query(
        'update wallet_withdrawals set status=$2,version=version+1,bank_reference=$3,paid_on=$4,updated_at=now() where id=$1',
        [
          id,
          input.action,
          input.action === 'paid' ? input.reference : null,
          input.action === 'paid' ? input.paidOn : null,
        ],
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
      await this.notifications.withdrawalUpdated(
        client,
        {
          id,
          dentistId: found.dentist_id,
          amountPaise: current.amountPaise,
        },
        input.action,
        input.note,
      );
      return this.get(id, undefined, client, true);
    });
  }
  private async event(
    client: PoolClient,
    actorId: string,
    requestId: string,
    id: string,
    status: string,
    request: object,
    note?: string,
  ) {
    await client.query(
      'insert into wallet_withdrawal_events (id,withdrawal_id,actor_id,status,request,note) values ($1,$2,$3,$4,$5,$6)',
      [requestId, id, actorId, status, JSON.stringify(request), note ?? null],
    );
    await this.audit.log(
      {
        actorUserId: actorId,
        action: `withdrawal_${status}`,
        entityType: 'withdrawal',
        entityId: id,
        afterState: { withdrawalId: id, status, requestId },
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
          'The request ID or bank reference was already used. Refresh before retrying.',
        );
      throw error;
    } finally {
      client.release();
    }
  }
}
