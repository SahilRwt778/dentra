import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { DentistPaymentsService } from './dentist-payments.service';
import { ListDentistPaymentsDto } from './dto/list-dentist-payments.dto';

@ApiTags('Appointments')
@Roles('dentist')
@Controller('dentists/me/payments')
export class DentistPaymentsController {
  constructor(private readonly payments: DentistPaymentsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filters: ListDentistPaymentsDto,
  ) {
    return this.payments.list(user.userId, filters);
  }

  @Get(':transactionId')
  @Header('Cache-Control', 'no-store')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
  ) {
    return this.payments.get(user.userId, transactionId);
  }
}
