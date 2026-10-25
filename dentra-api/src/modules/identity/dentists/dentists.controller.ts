import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { AllowUnverifiedDentist } from '@common/decorators/allow-unverified-dentist.decorator';
import { CurrentUser, type AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { DentistsService } from './dentists.service';
import { DentistSelfUpdateDto } from './dto/dentist-self-update.dto';
import { ClinicInputDto } from './dto/clinic-input.dto';
import { SlotsQueryDto } from './dto/slots-query.dto';

/** Maps to the Dentists tag in ../../../openapi.yaml. */
@ApiTags('Dentists')
@Controller('dentists')
export class DentistsController {
  constructor(private readonly dentists: DentistsService) {}

  @Public()
  @Get()
  search(
    @Query('specialization') specialization?: string,
    @Query('type') type?: 'video' | 'clinic',
    @Query('q') q?: string,
    @Query('page') page?: string,
  ) {
    return this.dentists.searchPublic({ specialization, type, q }, page ? parseInt(page, 10) : 1);
  }

  // Declared before @Get(':dentistId') below — Nest matches controller
  // routes in declaration order, so the literal "me" routes have to come
  // first or they'd be swallowed by the :dentistId param route.
  @Roles('dentist')
  @AllowUnverifiedDentist()
  @Get('me')
  findMe(@CurrentUser() user: AuthenticatedUser) {
    return this.dentists.findMe(user.userId);
  }

  @Roles('dentist')
  @Patch('me')
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: DentistSelfUpdateDto) {
    return this.dentists.updateMe(user.userId, dto);
  }

  @Roles('dentist')
  @Get('me/clinics')
  listClinics(@CurrentUser() user: AuthenticatedUser) {
    return this.dentists.listClinics(user.userId);
  }

  @Roles('dentist')
  @Post('me/clinics')
  addClinic(@CurrentUser() user: AuthenticatedUser, @Body() dto: ClinicInputDto) {
    return this.dentists.addClinic(user.userId, dto);
  }

  @Roles('dentist')
  @Patch('me/clinics/:clinicId')
  updateClinic(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clinicId') clinicId: string,
    @Body() dto: ClinicInputDto,
  ) {
    return this.dentists.updateClinic(user.userId, clinicId, dto);
  }

  @Roles('dentist')
  @Delete('me/clinics/:clinicId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeClinic(@CurrentUser() user: AuthenticatedUser, @Param('clinicId') clinicId: string) {
    return this.dentists.removeClinic(user.userId, clinicId);
  }

  @Public()
  @Get(':dentistId/slots')
  getSlots(
    @Param('dentistId') dentistId: string,
    @Query() query: SlotsQueryDto,
  ) {
    return this.dentists.getSlots(dentistId, query.date, query.type, query.clinicId);
  }

  @Public()
  @Get(':dentistId')
  findPublicById(@Param('dentistId') dentistId: string) {
    return this.dentists.findPublicById(dentistId);
  }
}
