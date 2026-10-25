import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { PrivacyService } from './privacy.service';
import { FilePrivacyRequestDto } from './dto/file-privacy-request.dto';

/** Maps to the Privacy tag in ../../../openapi.yaml. */
@ApiTags('Privacy')
@Controller('privacy-requests')
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Get()
  @Roles('admin')
  list(@Query('status') status?: string) {
    return this.privacy.list(status);
  }

  @Post()
  @Roles('patient')
  file(@CurrentUser() user: AuthenticatedUser, @Body() dto: FilePrivacyRequestDto) {
    return this.privacy.file(user.userId, dto.type);
  }

  @Post(':requestId/resolve')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  resolve(@CurrentUser() user: AuthenticatedUser, @Param('requestId') requestId: string) {
    return this.privacy.resolve(user.userId, requestId);
  }
}
