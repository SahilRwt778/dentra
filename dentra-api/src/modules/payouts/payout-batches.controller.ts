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
import {
  CurrentUser,
  type AuthenticatedUser,
} from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { PayoutBatchesService } from './payout-batches.service';
import {
  AdminPayoutBatchesDto,
  CreatePayoutBatchDto,
  EligiblePayoutsDto,
  ListPayoutBatchesDto,
  PayoutDentistsDto,
  UpdatePayoutBatchDto,
} from './dto/payout-batch.dto';

@ApiTags('Payout Batches')
@Controller('admin/payout-batches')
@Roles('admin')
export class AdminPayoutBatchesController {
  constructor(private readonly batches: PayoutBatchesService) {}
  @Get('dentists')
  @Header('Cache-Control', 'no-store')
  dentists(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PayoutDentistsDto,
  ) {
    return this.batches.dentists(user.userId, query);
  }
  @Get('eligible')
  @Header('Cache-Control', 'no-store')
  eligible(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: EligiblePayoutsDto,
  ) {
    return this.batches.eligible(user.userId, query);
  }
  @Get()
  @Header('Cache-Control', 'no-store')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AdminPayoutBatchesDto,
  ) {
    return this.batches.adminList(user.userId, query);
  }
  @Get(':batchId')
  @Header('Cache-Control', 'no-store')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('batchId', ParseUUIDPipe) id: string,
  ) {
    return this.batches.adminGet(user.userId, id);
  }
  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreatePayoutBatchDto,
  ) {
    return this.batches.create(user.userId, input);
  }
  @Post(':batchId/actions')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('batchId', ParseUUIDPipe) id: string,
    @Body() input: UpdatePayoutBatchDto,
  ) {
    return this.batches.update(user.userId, id, input);
  }
}

@ApiTags('Payout Batches')
@Controller('dentists/me/payout-batches')
@Roles('dentist')
export class DentistPayoutBatchesController {
  constructor(private readonly batches: PayoutBatchesService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPayoutBatchesDto,
  ) {
    return this.batches.list(query, user.userId);
  }
  @Get(':batchId')
  @Header('Cache-Control', 'no-store')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('batchId', ParseUUIDPipe) id: string,
  ) {
    return this.batches.get(id, user.userId);
  }
}
