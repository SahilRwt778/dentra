import { Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { AdminPaymentsService } from './admin-payments.service';
import { ListPaymentsDto } from './dto/list-payments.dto';

@ApiTags('Admin')
@Controller('admin/payments')
@Roles('admin')
export class AdminPaymentsController {
  constructor(private readonly payments: AdminPaymentsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Query() filters: ListPaymentsDto) {
    return this.payments.list(filters);
  }

  @Post(':transactionId/refund/retry')
  @HttpCode(202)
  retryRefund(@CurrentUser() user: AuthenticatedUser, @Param('transactionId', ParseUUIDPipe) transactionId: string) {
    return this.payments.retryRefund(user.userId, transactionId);
  }
}
