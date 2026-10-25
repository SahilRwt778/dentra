import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { AppointmentsService } from './appointments.service';
import { BookAppointmentDto } from './dto/book-appointment.dto';
import { RescheduleDto } from './dto/reschedule.dto';

/** Maps to the Appointments tag in ../../../openapi.yaml. */
@ApiTags('Appointments')
@Controller('appointments')
@Roles('patient', 'dentist')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('date') date?: string,
    @Query('page') page?: string,
  ) {
    return this.appointments.list(user, { status, date }, page ? parseInt(page, 10) : 1);
  }

  @Roles('patient')
  @Post()
  book(@CurrentUser() user: AuthenticatedUser, @Body() dto: BookAppointmentDto) {
    return this.appointments.book(user.userId, dto);
  }

  @Get(':appointmentId')
  get(@CurrentUser() user: AuthenticatedUser, @Param('appointmentId') appointmentId: string) {
    return this.appointments.get(user, appointmentId);
  }

  @Post(':appointmentId/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('appointmentId') appointmentId: string) {
    return this.appointments.cancel(user, appointmentId);
  }

  @Post(':appointmentId/reschedule')
  @HttpCode(HttpStatus.OK)
  reschedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('appointmentId') appointmentId: string,
    @Body() dto: RescheduleDto,
  ) {
    return this.appointments.reschedule(user, appointmentId, dto);
  }

  @Roles('dentist')
  @Post(':appointmentId/check-in')
  @HttpCode(HttpStatus.OK)
  checkIn(@CurrentUser() user: AuthenticatedUser, @Param('appointmentId') appointmentId: string) {
    return this.appointments.checkIn(user, appointmentId);
  }

  @Roles('dentist')
  @Post(':appointmentId/start')
  @HttpCode(HttpStatus.OK)
  start(@CurrentUser() user: AuthenticatedUser, @Param('appointmentId') appointmentId: string) {
    return this.appointments.start(user, appointmentId);
  }
}
