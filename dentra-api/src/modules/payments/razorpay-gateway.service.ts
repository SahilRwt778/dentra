import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// razorpay is a CJS `export =` module; without esModuleInterop (not set
// project-wide), a default import compiles to `.default`, which is
// undefined on this module and fails with "is not a constructor".
import Razorpay = require('razorpay');
import type { AppConfig } from '@config/configuration';

export type GatewayRefund = {
  refundId: string;
  paymentId: string;
  amountPaise: number;
  currency: string;
  status: 'pending' | 'processed' | 'failed';
};
export type GatewayPayment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
};

/**
 * The one file that should change if the gateway vendor ever changes
 * (see payments.module.ts) — nothing else in the app talks to Razorpay
 * directly. Test mode vs. live mode is purely a property of which key
 * pair is in .env (`rzp_test_...` vs `rzp_live_...`); nothing here
 * branches on it.
 */
@Injectable()
export class RazorpayGatewayService {
  private readonly client: Razorpay;
  readonly keyId: string;
  private readonly webhookSecret: string;
  private readonly authorization: string;

  constructor(@Inject(ConfigService) config: ConfigService<AppConfig>) {
    const razorpay = config.get('razorpay', { infer: true })!;
    this.client = new Razorpay({ key_id: razorpay.keyId, key_secret: razorpay.keySecret });
    this.keyId = razorpay.keyId;
    this.webhookSecret = razorpay.webhookSecret;
    this.authorization = `Basic ${Buffer.from(`${razorpay.keyId}:${razorpay.keySecret}`).toString('base64')}`;
  }

  /** amountPaise matches schema.sql's transactions.amount_paise — Razorpay's `amount` is paise too, not rupees. */
  async createOrder(amountPaise: number, receipt: string): Promise<{ orderId: string }> {
    const order = await this.client.orders.create({ amount: amountPaise, currency: 'INR', receipt });
    return { orderId: order.id };
  }

  /** The installed SDK drops X-Refund-Idempotency, so use the documented HTTP API here. */
  async refund(paymentId: string, amountPaise: number, requestId: string): Promise<GatewayRefund> {
    return this.refundRequest(`/payments/${encodeURIComponent(paymentId)}/refund`, {
      method: 'POST',
      headers: { 'X-Refund-Idempotency': requestId },
      // This body and key must stay identical on every retry.
      body: JSON.stringify({ amount: amountPaise, speed: 'normal', receipt: requestId }),
    });
  }

  async fetchRefund(refundId: string): Promise<GatewayRefund> {
    return this.refundRequest(`/refunds/${encodeURIComponent(refundId)}`, { method: 'GET' });
  }

  async fetchOrderPayments(orderId: string): Promise<GatewayPayment[]> {
    const collection = await this.request<{ items: GatewayPayment[] }>(
      `/orders/${encodeURIComponent(orderId)}/payments`,
      { method: 'GET' }
    );
    if (!Array.isArray(collection.items)) throw new Error('Invalid gateway payments response.');
    return collection.items;
  }

  private async refundRequest(path: string, options: RequestInit): Promise<GatewayRefund> {
    const refund = await this.request<{
      id: string;
      payment_id: string;
      amount: number;
      currency: string;
      status: GatewayRefund['status'];
    }>(path, options);
    if (
      typeof refund.id !== 'string' || !refund.id ||
      typeof refund.payment_id !== 'string' || !refund.payment_id ||
      !Number.isSafeInteger(refund.amount) ||
      !['pending', 'processed', 'failed'].includes(refund.status)
    ) {
      throw new Error('Invalid refund gateway response.');
    }
    return {
      refundId: refund.id,
      paymentId: refund.payment_id,
      amountPaise: refund.amount,
      currency: refund.currency,
      status: refund.status,
    };
  }

  private async request<T>(path: string, options: RequestInit): Promise<T> {
    const response = await fetch(`https://api.razorpay.com/v1${path}`, {
      ...options,
      headers: { Authorization: this.authorization, 'Content-Type': 'application/json', ...options.headers },
      signal: AbortSignal.timeout(15_000),
      redirect: 'error',
    });
    if (!response.ok) {
      // Do not expose gateway responses, credentials or account details in logs.
      throw Object.assign(new Error('Payment gateway request failed.'), { statusCode: response.status });
    }
    return (await response.json()) as T;
  }

  /**
   * Must run against the untouched raw request body bytes, not a
   * re-serialized JSON.parse() of them (whitespace/key-order
   * differences would break the HMAC Razorpay signed) — which is why
   * main.ts enables Nest's rawBody option and the controller reads
   * req.rawBody instead of the parsed req.body.
   */
  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
    if (!signature) return false;
    return Razorpay.validateWebhookSignature(rawBody.toString('utf8'), signature, this.webhookSecret);
  }
}
