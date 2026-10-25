import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '@common/decorators/current-user.decorator';
import { AvailabilityService } from './availability.service';
import { CreateTimeOffDto, TimeOffDto } from './dto/time-off.dto';

@ApiTags('Dentists')
@Roles('dentist')
@Controller('dentists/me/time-off')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.availability.list(user.userId);
  }

  @Post('preview')
  @HttpCode(200)
  preview(@CurrentUser() user: AuthenticatedUser, @Body() dto: TimeOffDto) {
    return this.availability.preview(user.userId, dto);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTimeOffDto,
  ) {
    return this.availability.create(user.userId, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.availability.remove(user.userId, id);
  }
}
