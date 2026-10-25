import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '@database/database.module';
import { AuditService } from '@modules/admin/audit/audit.service';
import type { WalletSettingsDto } from './dto/wallet.dto';
import { requireWalletAdmin, type WalletDatabase } from './wallet-access';

@Injectable()
export class WalletSettingsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly audit: AuditService,
  ) {}
  async read(database: WalletDatabase = this.pool, lock = false) {
    const {
      rows: [settings],
    } = await database.query<{
      feeBps: number | null;
      minimumWithdrawalPaise: number | null;
      version: number;
    }>(
      `select fee_bps as "feeBps",minimum_withdrawal_paise as "minimumWithdrawalPaise",version from wallet_settings where singleton ${
        lock ? 'for share' : ''
      }`,
    );
    if (!settings)
      throw new ConflictException(
        'Wallet settings are unavailable. Apply the wallet migration.',
      );
    return settings;
  }
  async adminGet(adminId: string) {
    await requireWalletAdmin(this.pool, adminId);
    const settings = await this.read();
    const {
      rows: [unpriced],
    } = await this.pool.query(
      `select count(*)::int as count from transactions where platform_fee_bps is null and (method<>'pay_at_clinic' or gateway_ref is not null or gateway_payment_ref is not null)`,
    );
    return { ...settings, unpricedBookings: unpriced.count as number };
  }
  async update(adminId: string, input: WalletSettingsDto) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await requireWalletAdmin(client, adminId);
      const {
        rows: [before],
      } = await client.query(
        'select * from wallet_settings where singleton for update',
      );
      if (before.version !== input.version)
        throw new ConflictException(
          'Wallet settings changed. Reopen the form to load the latest values.',
        );
      let priced = 0;
      if (input.applyToUnpriced)
        priced =
          (
            await client.query(
              `update transactions set platform_fee_bps=$1 where platform_fee_bps is null and (method<>'pay_at_clinic' or gateway_ref is not null or gateway_payment_ref is not null)`,
              [input.feeBps],
            )
          ).rowCount ?? 0;
      if (
        before.fee_bps !== input.feeBps ||
        before.minimum_withdrawal_paise !== input.minimumWithdrawalPaise ||
        priced
      ) {
        await client.query(
          'update wallet_settings set fee_bps=$1,minimum_withdrawal_paise=$2,version=version+1,updated_at=now() where singleton',
          [input.feeBps, input.minimumWithdrawalPaise],
        );
        await this.audit.log(
          {
            actorUserId: adminId,
            action: 'wallet_settings_updated',
            entityType: 'admin',
            entityId: adminId,
            beforeState: {
              feeBps: before.fee_bps,
              minimumWithdrawalPaise: before.minimum_withdrawal_paise,
              version: before.version,
            },
            afterState: {
              feeBps: input.feeBps,
              minimumWithdrawalPaise: input.minimumWithdrawalPaise,
              pricedBookings: priced,
            },
          },
          client,
        );
      }
      const result = await this.read(client);
      await client.query('COMMIT');
      return { ...result, pricedBookings: priced };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
