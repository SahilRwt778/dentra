import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { PatientsService } from './patients.service';
import { PatientRegistrationDto } from './dto/patient-registration.dto';
import { PatientUpdateDto } from './dto/patient-update.dto';

/** Maps to the Patients tag in ../../../openapi.yaml. Patient-only — a dentist or admin token gets 403. */
@ApiTags('Patients')
@Controller('patients')
@Roles('patient')
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Post('register')
  register(@CurrentUser() user: AuthenticatedUser, @Body() dto: PatientRegistrationDto) {
    return this.patients.register(user.userId, dto);
  }

  @Get('me')
  findMe(@CurrentUser() user: AuthenticatedUser) {
    return this.patients.findMe(user.userId);
  }

  @Patch('me')
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: PatientUpdateDto) {
    return this.patients.update(user.userId, dto);
  }

  @Get('me/chart')
  @HttpCode(HttpStatus.OK)
  chart(@CurrentUser() user: AuthenticatedUser) {
    return this.patients.getChart(user.userId);
  }
}
