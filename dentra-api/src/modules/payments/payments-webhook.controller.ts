import { BadRequestException, Controller, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { RazorpayGatewayService } from './razorpay-gateway.service';
import { PaymentsWebhookService } from './payments-webhook.service';

/** Maps to the Payments tag in ../../../openapi.yaml. */
@ApiTags('Payments')
@Controller('payments')
export class PaymentsWebhookController {
  constructor(
    private readonly gateway: RazorpayGatewayService,
    private readonly webhookService: PaymentsWebhookService,
  ) {}

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature?: string,
  ): Promise<{ received: true }> {
    if (!req.rawBody || !this.gateway.verifyWebhookSignature(req.rawBody, signature)) {
      throw new BadRequestException('Bad signature.');
    }
    await this.webhookService.handle(req.body);
    return { received: true };
  }
}
