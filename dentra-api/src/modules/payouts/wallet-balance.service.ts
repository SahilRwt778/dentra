import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '@database/database.module';
import { ELIGIBLE_PAYMENT, UNRESERVED_PAYMENT } from './payout-batch.queries';
import { WalletSettingsService } from './wallet-settings.service';
import { approvedWalletAccount, type WalletDatabase } from './wallet-access';

@Injectable()
export class WalletBalanceService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly settings: WalletSettingsService,
  ) {}
  async summary(dentistId: string, database: WalletDatabase = this.pool) {
    const {
      rows: [totals],
    } = await database.query(
      `with collections as (
      select t.amount_paise as gross,t.platform_fee_bps,
        floor((t.amount_paise::bigint*t.platform_fee_bps+5000)/10000.0)::bigint as fee,
        (${ELIGIBLE_PAYMENT}) as eligible,
        (a.status in ('booked','waiting','in_consult') and t.status='paid'
          and not exists(select 1 from payment_refunds r where r.transaction_id=t.id)) as pending
      from transactions t join appointments a on a.id=t.appointment_id
      where a.dentist_id=$1 and t.gateway_payment_ref is not null and t.amount_paise>0
        and a.status<>'cancelled' and ${UNRESERVED_PAYMENT}
        and not exists(select 1 from clinic_payment_collections cp where cp.transaction_id=t.id)
        and not exists(select 1 from transactions earlier where earlier.gateway_payment_ref=t.gateway_payment_ref
          and (earlier.created_at,earlier.id)<(t.created_at,t.id))
    ), earnings as (select
      coalesce(sum(gross-fee) filter(where eligible and platform_fee_bps is not null),0) as net,
      coalesce(sum(gross) filter(where eligible and platform_fee_bps is not null),0) as gross,
      coalesce(sum(fee) filter(where eligible and platform_fee_bps is not null),0) as fee,
      coalesce(sum(gross-fee) filter(where pending and platform_fee_bps is not null),0) as pending,
      coalesce(sum(gross) filter(where (eligible or pending) and platform_fee_bps is null),0) as unpriced,
      count(*) filter(where (eligible or pending) and platform_fee_bps is null) as unpriced_count from collections),
    withdrawals as (select coalesce(sum(amount_paise) filter(where status in ('requested','approved','processing','failed')),0) as reserved,
      coalesce(sum(amount_paise) filter(where status='paid'),0) as paid from wallet_withdrawals where dentist_id=$1),
    legacy as (select coalesce(sum(net_paise) filter(where status in ('pending','processing','failed')),0) as reserved,
      coalesce(sum(net_paise) filter(where status='paid'),0) as paid from payout_batches where dentist_id=$1),
    legacy_recovery as (select coalesce(sum(bi.amount_paise-bi.fee_paise),0) as amount from payout_batch_items bi
      join payout_batches b on b.id=bi.batch_id join transactions t on t.id=bi.transaction_id
      join appointments a on a.id=t.appointment_id where b.dentist_id=$1 and b.status='paid'
        and (not (${ELIGIBLE_PAYMENT}) or t.amount_paise<>bi.amount_paise or t.gateway_payment_ref is distinct from bi.provider_payment_ref))
    select greatest(e.net-w.reserved-w.paid-r.amount,0)::float8 as "availablePaise",
      greatest(w.reserved+w.paid+r.amount-e.net,0)::float8 as "shortfallPaise",
      (w.reserved+l.reserved)::float8 as "reservedPaise",(w.paid+l.paid)::float8 as "withdrawnPaise",
      e.pending::float8 as "pendingPaise",e.gross::float8 as "eligibleGrossPaise",e.fee::float8 as "eligibleFeePaise",
      e.unpriced::float8 as "unpricedGrossPaise",e.unpriced_count::int as "unpricedCount"
    from earnings e cross join withdrawals w cross join legacy l cross join legacy_recovery r`,
      [dentistId],
    );
    return totals as {
      availablePaise: number;
      shortfallPaise: number;
      reservedPaise: number;
      withdrawnPaise: number;
      pendingPaise: number;
      eligibleGrossPaise: number;
      eligibleFeePaise: number;
      unpricedGrossPaise: number;
      unpricedCount: number;
    };
  }
  async wallet(dentistId: string) {
    const [totals, settings, account] = await Promise.all([
      this.summary(dentistId),
      this.settings.read(),
      approvedWalletAccount(this.pool, dentistId),
    ]);
    return {
      ...totals,
      ...settings,
      configured:
        settings.feeBps !== null && settings.minimumWithdrawalPaise !== null,
      account: account
        ? {
            approvalId: account.id,
            last4: account.bank_account_no.slice(-4),
            ifsc: account.bank_ifsc,
          }
        : null,
    };
  }
}
