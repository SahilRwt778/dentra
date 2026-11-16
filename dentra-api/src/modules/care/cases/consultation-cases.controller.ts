import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  DefaultValuePipe,
  BadRequestException,
} from '@nestjs/common';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { ConsultationCasesService } from './consultation-cases.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { FollowUpBookingDto } from './consultation-cases.dto';

@Controller('consultation-cases')
@Roles('patient', 'dentist')
export class ConsultationCasesController {
  constructor(
    private readonly cases: ConsultationCasesService,
    private readonly appointments: AppointmentsService,
  ) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ) {
    if (page < 1 || page > 100000)
      throw new BadRequestException('Invalid page.');
    return this.cases.list(user, page);
  }
  @Get(':caseId')
  @Header('Cache-Control', 'private, no-store')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('caseId', ParseUUIDPipe) id: string,
  ) {
    return this.cases.get(user, id);
  }
  @Post(':caseId/follow-ups')
  @Header('Cache-Control', 'private, no-store')
  @Roles('patient')
  book(
    @CurrentUser() user: AuthenticatedUser,
    @Param('caseId', ParseUUIDPipe) id: string,
    @Body() dto: FollowUpBookingDto,
  ) {
    return this.appointments.bookFollowUp(user.userId, id, dto);
  }
}
