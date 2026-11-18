import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { ConsultationCasesService } from './consultation-cases.service';
import { AppointmentsService } from '../appointments/appointments.service';
import {
  ConsultationCasesQueryDto,
  FollowUpBookingDto,
} from './consultation-cases.dto';

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
    @Query() query: ConsultationCasesQueryDto,
  ) {
    return this.cases.list(
      user,
      query.page,
      query.filter,
      query.search,
      query.unreadOnly,
    );
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
