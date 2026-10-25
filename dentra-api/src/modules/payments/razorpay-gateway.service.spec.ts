import { ConfigService } from '@nestjs/config';
import { RazorpayGatewayService } from './razorpay-gateway.service';

const fixture = {
  id: 'rfnd_fixture',
  payment_id: 'pay_fixture',
  amount: 40050,
  currency: 'INR',
  status: 'pending',
};
const service = () =>
  new RazorpayGatewayService(
    new ConfigService({
      razorpay: {
        keyId: 'rzp_test_fixture',
        keySecret: 'fixture-secret',
        webhookSecret: 'fixture-webhook',
      },
    })
  );
afterEach(() => jest.restoreAllMocks());

test('refund retries send the exact same idempotency header and payload through HTTP', async () => {
  const send = jest
    .spyOn(global, 'fetch')
    .mockResolvedValue({ ok: true, json: async () => fixture } as Response);
  const gateway = service();
  for (let i = 0; i < 2; i++) await gateway.refund('pay_fixture', 40050, 'saved-request-uuid');
  expect(send).toHaveBeenCalledTimes(2);
  for (const [url, options] of send.mock.calls) {
    expect(url).toBe('https://api.razorpay.com/v1/payments/pay_fixture/refund');
    expect(options).toMatchObject({
      method: 'POST',
      redirect: 'error',
      headers: { 'X-Refund-Idempotency': 'saved-request-uuid', 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 40050, speed: 'normal', receipt: 'saved-request-uuid' }),
    });
    expect(options?.signal).toBeDefined();
  }
});
test('reconciliation reads the existing refund and never creates another', async () => {
  const send = jest
    .spyOn(global, 'fetch')
    .mockResolvedValue({ ok: true, json: async () => ({ ...fixture, status: 'processed' }) } as Response);
  expect(await service().fetchRefund('rfnd_fixture')).toMatchObject({
    status: 'processed',
    refundId: 'rfnd_fixture',
    amountPaise: 40050,
  });
  expect(send).toHaveBeenCalledWith(
    'https://api.razorpay.com/v1/refunds/rfnd_fixture',
    expect.objectContaining({ method: 'GET' })
  );
});
test('gateway failures expose only a safe status code', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 503 } as Response);
  await expect(service().refund('pay_fixture', 40050, 'saved-request-uuid')).rejects.toMatchObject({
    statusCode: 503,
  });
});
