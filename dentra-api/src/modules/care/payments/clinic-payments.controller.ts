import {
  Body,
  Controller,
  Header,
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
import { ClinicPaymentsService } from './clinic-payments.service';
import { CollectClinicPaymentDto } from './dto/collect-clinic-payment.dto';

@ApiTags('Appointments')
@Roles('dentist')
@Controller('appointments/:appointmentId/clinic-payment')
export class ClinicPaymentsController {
  constructor(private readonly payments: ClinicPaymentsService) {}

  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  collect(
    @CurrentUser() user: AuthenticatedUser,
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @Body() dto: CollectClinicPaymentDto,
  ) {
    return this.payments.collect(user, appointmentId, dto);
  }
}
