import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { AuditService } from './audit.service';

/** Maps to the Admin tag's GET /admin/audit-log in ../../../openapi.yaml. */
@ApiTags('Admin')
@Controller('admin/audit-log')
@Roles('admin')
export class AuditLogController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('page') page?: string,
  ) {
    return this.audit.list({ entityType, entityId }, page ? parseInt(page, 10) : 1);
  }
}
