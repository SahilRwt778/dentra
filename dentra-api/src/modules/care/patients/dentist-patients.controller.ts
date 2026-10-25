import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { DentistPatientsService } from './dentist-patients.service';

/** Maps to the Dentists tag's /dentists/me/patients endpoints in ../../../openapi.yaml. */
@ApiTags('Dentists')
@Controller('dentists/me/patients')
@Roles('dentist')
export class DentistPatientsController {
  constructor(private readonly patients: DentistPatientsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.patients.list(user.userId);
  }

  @Get(':patientId')
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.patients.getOne(user.userId, patientId);
  }
}
