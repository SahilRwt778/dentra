import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { AdminPatientsService } from './admin-patients.service';
import { ListAdminPatientsDto } from './dto/list-admin-patients.dto';

@ApiTags('Admin')
@Controller('admin/patients')
@Roles('admin')
export class AdminPatientsController {
  constructor(private readonly patients: AdminPatientsService) {}

  @Get()
  list(@Query() filters: ListAdminPatientsDto) {
    return this.patients.list(filters);
  }

  @Get(':patientId')
  get(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.patients.getOne(patientId);
  }
}
