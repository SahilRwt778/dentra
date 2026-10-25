import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { IsIn } from 'class-validator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { VideoService } from './video.service';

class JoinVideoDto {
  @IsIn(['android', 'ios', 'web']) platform!: 'android' | 'ios' | 'web';
}
@Controller('appointments')
@Roles('patient', 'dentist')
export class VideoController {
  constructor(private readonly video: VideoService) {}
  @Get(':appointmentId/video')
  @Header('Cache-Control', 'no-store')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('appointmentId', ParseUUIDPipe) id: string
  ) {
    return this.video.get(user, id);
  }
  @Post(':appointmentId/video/token')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  join(
    @CurrentUser() user: AuthenticatedUser,
    @Param('appointmentId', ParseUUIDPipe) id: string,
    @Body() dto: JoinVideoDto
  ) {
    return this.video.join(user, id, dto.platform);
  }
}
