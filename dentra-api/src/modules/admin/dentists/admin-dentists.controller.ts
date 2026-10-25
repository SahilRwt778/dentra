import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { AdminDentistsService } from './admin-dentists.service';
import { AdminCreateDentistDto } from './dto/admin-create-dentist.dto';
import { ApproveDentistDto } from './dto/approve-dentist.dto';
import { RejectDentistDto } from './dto/reject-dentist.dto';

/** Maps to the Admin tag's /admin/dentists endpoints in ../../../openapi.yaml. */
@ApiTags('Admin')
@Controller('admin/dentists')
@Roles('admin')
export class AdminDentistsController {
  constructor(private readonly admin: AdminDentistsService) {}

  @Get()
  list(@Query('status') status?: string, @Query('page') page?: string) {
    return this.admin.list(status, page ? parseInt(page, 10) : 1);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: AdminCreateDentistDto) {
    return this.admin.create(user.userId, dto);
  }

  @Get(':dentistId')
  get(@Param('dentistId', ParseUUIDPipe) dentistId: string) {
    return this.admin.findOne(dentistId);
  }

  @Post(':dentistId/approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('dentistId') dentistId: string,
    @Body() dto: ApproveDentistDto,
  ) {
    return this.admin.approve(user.userId, dentistId, dto.force ?? false);
  }

  @Post(':dentistId/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('dentistId') dentistId: string,
    @Body() dto: RejectDentistDto,
  ) {
    return this.admin.reject(user.userId, dentistId, dto.reason);
  }

  @Post(':dentistId/disable')
  @HttpCode(HttpStatus.OK)
  disable(@CurrentUser() user: AuthenticatedUser, @Param('dentistId') dentistId: string) {
    return this.admin.disable(user.userId, dentistId);
  }

  @Post(':dentistId/enable')
  @HttpCode(HttpStatus.OK)
  enable(@CurrentUser() user: AuthenticatedUser, @Param('dentistId') dentistId: string) {
    return this.admin.enable(user.userId, dentistId);
  }

  @Post(':dentistId/reconsider')
  @HttpCode(HttpStatus.OK)
  reconsider(@CurrentUser() user: AuthenticatedUser, @Param('dentistId') dentistId: string) {
    return this.admin.reconsider(user.userId, dentistId);
  }
}
