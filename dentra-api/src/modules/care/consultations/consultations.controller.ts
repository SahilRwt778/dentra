import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { ConsultationsService } from './consultations.service';
import { ConsultationDraftDto } from './dto/consultation-draft.dto';
import { SignPrescriptionDto } from './dto/sign-prescription.dto';

/** Maps to the Consultations tag in ../../../openapi.yaml. Shares the /appointments base path with AppointmentsController. */
@ApiTags('Consultations')
@Controller('appointments')
@Roles('patient', 'dentist')
export class ConsultationsController {
  constructor(private readonly consultations: ConsultationsService) {}

  @Get(':appointmentId/consultation')
  get(@CurrentUser() user: AuthenticatedUser, @Param('appointmentId') appointmentId: string) {
    return this.consultations.get(user, appointmentId);
  }

  @Roles('dentist')
  @Put(':appointmentId/consultation')
  saveDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('appointmentId') appointmentId: string,
    @Body() dto: ConsultationDraftDto,
  ) {
    return this.consultations.saveDraft(user, appointmentId, dto);
  }

  @Roles('dentist')
  @Post(':appointmentId/consultation/complete')
  @HttpCode(HttpStatus.OK)
  complete(@CurrentUser() user: AuthenticatedUser, @Param('appointmentId') appointmentId: string) {
    return this.consultations.complete(user, appointmentId);
  }

  @Roles('dentist')
  @Post(':appointmentId/prescription/otp')
  @HttpCode(HttpStatus.OK)
  requestSigningCode(@CurrentUser() user: AuthenticatedUser, @Param('appointmentId') appointmentId: string) {
    return this.consultations.requestSigningCode(user, appointmentId);
  }

  @Roles('dentist')
  @Post(':appointmentId/prescription/sign')
  @HttpCode(HttpStatus.OK)
  signPrescription(
    @CurrentUser() user: AuthenticatedUser,
    @Param('appointmentId') appointmentId: string,
    @Body() dto: SignPrescriptionDto,
  ) {
    return this.consultations.signPrescription(user, appointmentId, dto);
  }
}
