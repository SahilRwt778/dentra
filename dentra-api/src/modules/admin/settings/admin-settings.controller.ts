import { Body, Controller, Get, Header, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { AdminSettingsService } from './admin-settings.service';
import { UpdateAdminProfileDto, UpdatePlatformSettingsDto } from './dto/admin-settings.dto';

@ApiTags('Admin')
@Roles('admin')
@Controller('admin')
export class AdminSettingsController {
  constructor(private readonly settings: AdminSettingsService) {}

  @Get('me')
  @Header('Cache-Control', 'no-store')
  profile(@CurrentUser() user: AuthenticatedUser) {
    return this.settings.profile(user.userId);
  }

  @Patch('me')
  @Header('Cache-Control', 'no-store')
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateAdminProfileDto) {
    return this.settings.updateProfile(user.userId, dto);
  }

  @Get('settings')
  @Header('Cache-Control', 'no-store')
  platform(@CurrentUser() user: AuthenticatedUser) {
    return this.settings.platform(user.userId);
  }

  @Patch('settings')
  @Header('Cache-Control', 'no-store')
  updatePlatform(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdatePlatformSettingsDto) {
    return this.settings.updatePlatform(user.userId, dto);
  }
}
