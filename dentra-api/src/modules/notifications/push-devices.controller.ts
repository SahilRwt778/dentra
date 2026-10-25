import { Body, Controller, Delete, Get, HttpCode, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { RegisterPushDeviceDto } from './dto/register-push-device.dto';
import { FirebasePushService } from './firebase-push.service';
import { PushDevicesService } from './push-devices.service';

@ApiTags('Notifications')
@Controller('notifications/push-device')
@Roles('patient')
export class PushDevicesController {
  constructor(
    private readonly devices: PushDevicesService,
    private readonly firebase: FirebasePushService,
  ) {}

  @Get()
  availability() {
    return { available: this.firebase.isEnabled() };
  }

  @Put()
  register(@CurrentUser() user: AuthenticatedUser, @Body() body: RegisterPushDeviceDto) {
    return this.devices.register(user, body);
  }

  @Delete()
  @HttpCode(204)
  unregister(@CurrentUser() user: AuthenticatedUser) {
    return this.devices.unregister(user);
  }
}
