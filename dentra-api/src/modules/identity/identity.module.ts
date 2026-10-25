import { Module } from '@nestjs/common';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { OtpService } from './auth/otp.service';
import { TokensService } from './auth/tokens.service';
import { UsersService } from './users/users.service';
import { PatientsController } from './patients/patients.controller';
import { PatientsService } from './patients/patients.service';
import { DentistsController } from './dentists/dentists.controller';
import { ApplicationsController } from './dentists/applications.controller';
import { DentistsService } from './dentists/dentists.service';
import { AvailabilityService } from './dentists/availability.service';
import { AvailabilityController } from './dentists/availability.controller';
import { NotificationsModule } from '@modules/notifications/notifications.module';

/**
 * Auth, patients, dentists (profile + onboarding + clinics) — everything
 * about who a user is, one subfolder per identity (auth/, users/,
 * patients/, dentists/) rather than a flat pile of controllers and
 * services. Auth, Patients and Dentists (search, self-serve application,
 * profile, clinics, document upload) are fully wired, including
 * admin/login (email + password, a separate mechanism from mobile OTP).
 * Admin-side dentist review (approve/reject/disable/enable) lives in
 * AdminModule, which is why DentistsService and UsersService are
 * exported here.
 */
@Module({
  imports: [NotificationsModule],
  controllers: [AuthController, PatientsController, AvailabilityController, DentistsController, ApplicationsController],
  providers: [AuthService, OtpService, UsersService, TokensService, PatientsService, DentistsService, AvailabilityService],
  exports: [UsersService, DentistsService, OtpService, AvailabilityService],
})
export class IdentityModule {}
