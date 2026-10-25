import { Module } from '@nestjs/common';
import { AuditModule } from '@modules/admin/audit/audit.module';
import { DentistPayoutsController } from './dentist-payouts.controller';
import { AdminPayoutsController } from './admin-payouts.controller';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { WalletSettingsService } from './wallet-settings.service';
import { WalletBalanceService } from './wallet-balance.service';
import { WithdrawalsService } from './withdrawals.service';
import {
  AdminWalletController,
  DentistWalletController,
} from './wallet.controller';
import { PayoutsService } from './payouts.service';
import { PayoutBatchesService } from './payout-batches.service';
import {
  AdminPayoutBatchesController,
  DentistPayoutBatchesController,
} from './payout-batches.controller';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [
    DentistPayoutsController,
    AdminPayoutsController,
    AdminPayoutBatchesController,
    DentistPayoutBatchesController,
    AdminWalletController,
    DentistWalletController,
  ],
  providers: [
    PayoutsService,
    PayoutBatchesService,
    WalletSettingsService,
    WalletBalanceService,
    WithdrawalsService,
  ],
})
export class PayoutsModule {}
