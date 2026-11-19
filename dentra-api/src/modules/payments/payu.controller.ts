import {
  BadRequestException,
  Body,
  Controller,
  Header,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { ApiTags } from '@nestjs/swagger';
import { PG_POOL } from '@database/database.module';
import { Public } from '@common/decorators/public.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '@common/decorators/current-user.decorator';
import { PaymentCheckoutService } from './payment-checkout.service';
import { PayuGatewayService } from './payu-gateway.service';
import { PayuHashDto } from './payu-checkout.dto';
import { PaymentReconciliationService } from './payment-reconciliation.service';
import { RefundsService } from './refunds.service';

@ApiTags('Payments')
@Controller('payments')
export class PayuController {
  constructor(
    private readonly checkout: PaymentCheckoutService,
    private readonly payu: PayuGatewayService,
    private readonly reconciliation: PaymentReconciliationService,
    private readonly refunds: RefundsService,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  @Roles('patient')
  @Post('appointments/:appointmentId/checkout')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  prepare(
    @CurrentUser() user: AuthenticatedUser,
    @Param('appointmentId', ParseUUIDPipe) id: string,
  ) {
    return this.checkout.prepare(user.userId, id);
  }

  @Roles('patient')
  @Post('appointments/:appointmentId/hash')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  hash(
    @CurrentUser() user: AuthenticatedUser,
    @Param('appointmentId', ParseUUIDPipe) id: string,
    @Body() dto: PayuHashDto,
  ) {
    return this.checkout.hash(user.userId, id, dto);
  }

  @Public()
  @Post('payu/webhook')
  @HttpCode(200)
  async webhook(@Body() body: Record<string, unknown>) {
    await this.paymentEvent(body);
    return { received: true };
  }

  @Public()
  @Post(['payu/callback', 'payu/callback/success', 'payu/callback/failure'])
  @HttpCode(200)
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  async callback(@Body() body: Record<string, unknown>) {
    await this.paymentEvent(body);
    return '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dentra payment</title></head><body><h2>Return to Dentra</h2><p>Your payment status has been checked. You can close this page and return to your appointment.</p></body></html>';
  }

  @Public()
  @Post('payu/refund-webhook')
  @HttpCode(200)
  async refundWebhook(@Body() body: Record<string, unknown>) {
    // Refund callbacks are only hints. Never trust a supplied status/amount; read the saved refund from PayU.
    const reference = body.request_id;
    if (typeof reference !== 'string' || !/^\d{1,40}$/.test(reference))
      throw new BadRequestException('Invalid refund reference.');
    const paymentId =
      typeof body.mihpayid === 'string' && body.mihpayid.length <= 200
        ? body.mihpayid.trim()
        : '';
    const { rows } = await this.pool.query<{ gateway_payment_ref: string }>(
      `select t.gateway_payment_ref from transactions t left join payment_refunds r on r.transaction_id=t.id
       where t.gateway_provider='payu' and (r.gateway_ref=$1 or t.gateway_payment_ref=$2)`,
      [reference, paymentId],
    );
    if (rows.length) {
      const refund = await this.payu.fetchRefund(reference);
      // Dashboard refunds must also be confirmed against a payment saved here.
      if (
        refund.refundId === reference &&
        rows.some((row) => row.gateway_payment_ref === refund.paymentId)
      )
        await this.refunds.apply(refund, 'payu');
    }
    return { received: true };
  }

  private async paymentEvent(body: Record<string, unknown>) {
    if (
      !body ||
      !this.payu.verifyResponse(body) ||
      typeof body.txnid !== 'string' ||
      !/^[a-f\d]{24}$/.test(body.txnid)
    )
      throw new BadRequestException('Invalid PayU payment response.');
    const { rows } = await this.pool.query(
      "select id from transactions where gateway_ref=$1 and gateway_provider='payu'",
      [body.txnid],
    );
    if (rows[0]) await this.reconciliation.reconcileOrder(body.txnid, 'payu');
  }
}
