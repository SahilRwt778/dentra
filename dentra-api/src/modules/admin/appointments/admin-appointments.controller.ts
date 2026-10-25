import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { AdminAppointmentsService } from './admin-appointments.service';
import { ListAdminAppointmentsDto } from './dto/list-admin-appointments.dto';

/** Maps to the Admin tag's GET /admin/appointments in ../../../openapi.yaml. */
@ApiTags('Admin')
@Controller('admin/appointments')
@Roles('admin')
export class AdminAppointmentsController {
  constructor(private readonly admin: AdminAppointmentsService) {}

  @Get()
  list(@Query() filters: ListAdminAppointmentsDto) {
    return this.admin.list(filters);
  }
}
