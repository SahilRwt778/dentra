import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import {
  ListNotificationsDto,
  ReadAllNotificationsDto,
} from './dto/notifications.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@Controller('notifications')
@Roles('dentist', 'admin', 'patient')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListNotificationsDto,
  ) {
    return this.notifications.list(user, query.cursor);
  }

  @Get(':notificationId')
  @Header('Cache-Control', 'private, no-store')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
  ) {
    return this.notifications.get(user, notificationId);
  }

  @Patch(':notificationId/read')
  @Header('Cache-Control', 'private, no-store')
  read(
    @CurrentUser() user: AuthenticatedUser,
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
  ) {
    return this.notifications.markRead(user, notificationId);
  }

  @Post('read-all')
  @Header('Cache-Control', 'private, no-store')
  @HttpCode(200)
  readAll(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ReadAllNotificationsDto,
  ) {
    return this.notifications.markAllRead(user, body.through);
  }
}
