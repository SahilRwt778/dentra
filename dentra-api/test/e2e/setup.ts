import { randomUUID } from 'node:crypto';
import { FirebasePushService } from '../../src/modules/notifications/firebase-push.service';
import { GatewayRefund, RazorpayGatewayService } from '../../src/modules/payments/razorpay-gateway.service';

const refunds = new Map<string, GatewayRefund>();

// Keep real webhook verification and database writes, but never contact a payment provider.
beforeEach(() => {
  refunds.clear();
  jest.spyOn(RazorpayGatewayService.prototype, 'fetchOrderPayments').mockResolvedValue([]);
  jest.spyOn(FirebasePushService.prototype, 'send').mockImplementation(async () => `projects/local-test/messages/${randomUUID()}`);
  jest.spyOn(RazorpayGatewayService.prototype, 'createOrder').mockImplementation(async () => ({
    orderId: `order_e2e_${randomUUID()}`,
  }));
  jest.spyOn(RazorpayGatewayService.prototype, 'refund').mockImplementation(async (paymentId, amountPaise, requestId) => {
    const result: GatewayRefund = { refundId: `rfnd_e2e_${requestId}`, paymentId, amountPaise, currency: 'INR', status: 'pending' };
    refunds.set(result.refundId, result);
    return result;
  });
  jest.spyOn(RazorpayGatewayService.prototype, 'fetchRefund').mockImplementation(async (id) => {
    const result = refunds.get(id);
    if (!result) throw new Error('No synthetic refund with this ID.');
    return result;
  });
});
afterEach(() => jest.restoreAllMocks());
