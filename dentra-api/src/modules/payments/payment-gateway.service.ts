import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@config/configuration';
import { RazorpayGatewayService } from './razorpay-gateway.service';
import { PayuGatewayService } from './payu-gateway.service';

export type PaymentProvider = 'payu' | 'razorpay';

/** New bookings use the configured provider; saved payments always use their original provider. */
@Injectable()
export class PaymentGatewayService {
  constructor(
    private readonly config: ConfigService<AppConfig>,
    private readonly payu: PayuGatewayService,
    private readonly razorpay: RazorpayGatewayService,
  ) {}

  get provider(): PaymentProvider {
    return this.config.get('payments', { infer: true })!.provider;
  }

  publicKey(provider: PaymentProvider): string {
    return provider === 'payu' ? this.payu.key : this.razorpay.keyId;
  }

  async createOrder(amountPaise: number, receipt: string) {
    const provider = this.provider;
    const order = await this.adapter(provider).createOrder(
      amountPaise,
      receipt,
    );
    return { ...order, provider };
  }

  fetchOrderPayments(provider: PaymentProvider, orderId: string) {
    return this.adapter(provider).fetchOrderPayments(orderId);
  }

  refund(
    provider: PaymentProvider,
    paymentId: string,
    amountPaise: number,
    requestId: string,
  ) {
    return this.adapter(provider).refund(paymentId, amountPaise, requestId);
  }

  fetchRefund(provider: PaymentProvider, refundId: string) {
    return this.adapter(provider).fetchRefund(refundId);
  }

  private adapter(provider: PaymentProvider) {
    return provider === 'payu' ? this.payu : this.razorpay;
  }
}
