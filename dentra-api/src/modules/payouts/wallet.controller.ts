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
import { Roles } from '@common/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '@common/decorators/current-user.decorator';
import { WalletBalanceService } from './wallet-balance.service';
import { WalletSettingsService } from './wallet-settings.service';
import { WithdrawalsService } from './withdrawals.service';
import {
  AdminWithdrawalListDto,
  RequestWithdrawalDto,
  WalletSettingsDto,
  WithdrawalActionDto,
  WithdrawalListDto,
} from './dto/wallet.dto';

@ApiTags('Wallet')
@Roles('dentist')
@Controller('dentists/me')
export class DentistWalletController {
  constructor(
    private readonly balance: WalletBalanceService,
    private readonly withdrawals: WithdrawalsService,
  ) {}
  @Get('wallet')
  @Header('Cache-Control', 'no-store')
  wallet(@CurrentUser() user: AuthenticatedUser) {
    return this.balance.wallet(user.userId);
  }
  @Get('withdrawals')
  @Header('Cache-Control', 'no-store')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filters: WithdrawalListDto,
  ) {
    return this.withdrawals.list(filters, user.userId);
  }
  @Post('withdrawals')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  request(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: RequestWithdrawalDto,
  ) {
    return this.withdrawals.request(user.userId, input);
  }
  @Get('withdrawals/:withdrawalId')
  @Header('Cache-Control', 'no-store')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('withdrawalId', ParseUUIDPipe) id: string,
  ) {
    return this.withdrawals.get(id, user.userId);
  }
}
@ApiTags('Wallet')
@Roles('admin')
@Controller('admin')
export class AdminWalletController {
  constructor(
    private readonly settings: WalletSettingsService,
    private readonly withdrawals: WithdrawalsService,
  ) {}
  @Get('wallet-settings')
  @Header('Cache-Control', 'no-store')
  settingsGet(@CurrentUser() user: AuthenticatedUser) {
    return this.settings.adminGet(user.userId);
  }
  @Patch('wallet-settings')
  @Header('Cache-Control', 'no-store')
  settingsUpdate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: WalletSettingsDto,
  ) {
    return this.settings.update(user.userId, input);
  }
  @Get('withdrawals')
  @Header('Cache-Control', 'no-store')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filters: AdminWithdrawalListDto,
  ) {
    return this.withdrawals.adminList(user.userId, filters);
  }
  @Get('withdrawals/:withdrawalId')
  @Header('Cache-Control', 'no-store')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('withdrawalId', ParseUUIDPipe) id: string,
  ) {
    return this.withdrawals.adminGet(user.userId, id);
  }
  @Post('withdrawals/:withdrawalId/actions')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  action(
    @CurrentUser() user: AuthenticatedUser,
    @Param('withdrawalId', ParseUUIDPipe) id: string,
    @Body() input: WithdrawalActionDto,
  ) {
    return this.withdrawals.action(user.userId, id, input);
  }
}
