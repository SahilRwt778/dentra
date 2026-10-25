import { Body, Controller, Get, Header, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '@common/decorators/current-user.decorator';
import { PayoutsService } from './payouts.service';
import { SubmitPayoutDto } from './dto/submit-payout.dto';

@ApiTags('Dentist Payouts')
@Controller('dentists/me')
@Roles('dentist')
export class DentistPayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Get('payout-details')
  @Header('Cache-Control', 'no-store')
  profile(@CurrentUser() user: AuthenticatedUser) {
    return this.payouts.profile(user.userId);
  }

  @Post('payout-requests')
  @Header('Cache-Control', 'no-store')
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: SubmitPayoutDto,
  ) {
    return this.payouts.submit(user.userId, input);
  }
}
