import { Module } from '@nestjs/common';
import { IdentityModule } from '@modules/identity/identity.module';
import { AdminDentistsController } from './dentists/admin-dentists.controller';
import { AdminDentistsService } from './dentists/admin-dentists.service';
import { AdminAppointmentsController } from './appointments/admin-appointments.controller';
import { AdminAppointmentsService } from './appointments/admin-appointments.service';
import { AuditLogController } from './audit/audit-log.controller';
import { AuditModule } from './audit/audit.module';
import { PrivacyController } from './privacy/privacy.controller';
import { PrivacyService } from './privacy/privacy.service';
import { AdminPaymentsController } from './payments/admin-payments.controller';
import { AdminPaymentsService } from './payments/admin-payments.service';
import { AdminSettingsController } from './settings/admin-settings.controller';
import { AdminSettingsService } from './settings/admin-settings.service';

/**
 * Dentist review (approve/reject/disable/enable), platform-wide
 * appointment visibility, the audit log, and privacy-request
 * resolution — the Admin and Privacy tags in openapi.yaml. Every write
 * here should log to audit_log (schema.sql); that's the one rule this
 * module exists to enforce.
 */
@Module({
  imports: [IdentityModule, AuditModule],
  controllers: [AdminDentistsController, AdminAppointmentsController, AdminPaymentsController, AdminSettingsController, AuditLogController, PrivacyController],
  providers: [AdminDentistsService, AdminAppointmentsService, AdminPaymentsService, AdminSettingsService, PrivacyService],
})
export class AdminModule {}
