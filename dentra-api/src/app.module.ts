import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import configuration from '@config/configuration';
import type { AppConfig } from '@config/configuration';
import { DatabaseModule } from '@database/database.module';
import { HealthModule } from './health/health.module';
import { IdentityModule } from '@modules/identity/identity.module';
import { CareModule } from '@modules/care/care.module';
import { AdminModule } from '@modules/admin/admin.module';
import { PaymentsModule } from '@modules/payments/payments.module';
import { PayoutsModule } from '@modules/payouts/payouts.module';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { DentistAccessGuard } from '@common/guards/dentist-access.guard';
import { StorageModule } from '@common/storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig>) => ({
        secret: config.get('jwt.accessSecret', { infer: true }),
        signOptions: { expiresIn: config.get('jwt.accessExpiresIn', { infer: true }) },
      }),
    }),
    DatabaseModule,
    StorageModule,
    HealthModule,
    IdentityModule,
    CareModule,
    AdminModule,
    PaymentsModule,
    PayoutsModule,
  ],
  providers: [
    // Authenticate first, then check role and live dentist approval state.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: DentistAccessGuard },
  ],
})
export class AppModule {}
