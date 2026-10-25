import { VideoWebhookController } from './video/video-webhook.controller';
import { VideoChatController } from './video/chat/video-chat.controller';
import { VideoChatService } from './video/chat/video-chat.service';
import { Module } from '@nestjs/common';
import { PaymentsModule } from '@modules/payments/payments.module';
import { IdentityModule } from '@modules/identity/identity.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { AppointmentsController } from './appointments/appointments.controller';
import { AppointmentsService } from './appointments/appointments.service';
import { ConsultationsController } from './consultations/consultations.controller';
import { ConsultationsService } from './consultations/consultations.service';
import { DentistPatientsController } from './patients/dentist-patients.controller';
import { DentistPatientsService } from './patients/dentist-patients.service';
import { VideoController } from './video/video.controller';
import { VideoService } from './video/video.service';
import { VideoProviderService } from './video/video-provider.service';
import { PatientFilesController } from './files/patient-files.controller';
import { PatientFilesService } from './files/patient-files.service';
import { PatientFilesStorage } from './files/patient-files.storage';
import { PatientFilesCleanupService } from './files/patient-files-cleanup.service';
import { CareDocumentsController } from './documents/care-documents.controller';
import { CareDocumentsService } from './documents/care-documents.service';
import { CarePdfRenderer } from './documents/care-pdf.renderer';
import { AuditModule } from '@modules/admin/audit/audit.module';
import { ClinicPaymentsController } from './payments/clinic-payments.controller';
import { ClinicPaymentsService } from './payments/clinic-payments.service';
import { DentistPaymentsController } from './payments/dentist-payments.controller';
import { DentistPaymentsService } from './payments/dentist-payments.service';

/**
 * Appointments, consultations, prescriptions, and a dentist's own view
 * of their patients — the booking → consult → prescribe pipeline
 * (Appointments and Consultations tags in openapi.yaml). The slot-lock
 * transaction lives in appointments/appointments.service.ts, guarded by
 * schema.sql's appointments_no_double_booking index; ConsultationsService
 * depends on AppointmentsService for the shared "does this appointment
 * belong to the caller" ownership check rather than re-querying it
 * separately. DentistPatientsService lives here rather than under
 * identity/patients because its access control is entirely about the
 * appointment relationship, which is this module's domain. PaymentsModule
 * is imported so AppointmentsService can create Razorpay orders and
 * queue full refunds atomically with appointment cancellations.
 */
@Module({
  imports: [PaymentsModule, IdentityModule, NotificationsModule, AuditModule],
  controllers: [
    DentistPaymentsController,
    ClinicPaymentsController,
    AppointmentsController,
    ConsultationsController,
    DentistPatientsController,
    VideoController,
    VideoWebhookController,
    VideoChatController,
    PatientFilesController,
    CareDocumentsController,
  ],
  providers: [
    AppointmentsService,
    ConsultationsService,
    DentistPatientsService,
    VideoService,
    VideoChatService,
    VideoProviderService,
    PatientFilesService,
    PatientFilesStorage,
    PatientFilesCleanupService,
    CareDocumentsService,
    CarePdfRenderer,
    ClinicPaymentsService,
    DentistPaymentsService,
  ],
})
export class CareModule {}
