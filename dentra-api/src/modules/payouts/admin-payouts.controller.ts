import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '@common/decorators/current-user.decorator';
import { PayoutsService } from './payouts.service';
import { RejectPayoutDto } from './dto/submit-payout.dto';
import { ListPayoutRequestsDto } from './dto/list-payout-requests.dto';

@ApiTags('Admin Payouts')
@Controller('admin')
@Roles('admin')
export class AdminPayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Get('dentists/:dentistId/payout-details')
  @Header('Cache-Control', 'no-store')
  profile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('dentistId', ParseUUIDPipe) dentistId: string,
  ) {
    return this.payouts.adminProfile(user.userId, dentistId);
  }

  @Get('payout-requests')
  @Header('Cache-Control', 'no-store')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filters: ListPayoutRequestsDto,
  ) {
    return this.payouts.list(user.userId, filters);
  }

  @Post('payout-requests/:requestId/approve')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ) {
    return this.payouts.review(user.userId, requestId, 'approved');
  }

  @Post('payout-requests/:requestId/reject')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() input: RejectPayoutDto,
  ) {
    return this.payouts.review(
      user.userId,
      requestId,
      'rejected',
      input.reason,
    );
  }
}
