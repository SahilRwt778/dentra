import { ConfigService } from '@nestjs/config';
import { createHash, createHmac } from 'node:crypto';
import {
  PayuGatewayService,
  payuAmount,
  payuPaise,
  payuPaymentHashString,
} from './payu-gateway.service';

const salt = 'synthetic-salt';
const gateway = () =>
  new PayuGatewayService(
    new ConfigService({
      payu: {
        key: 'synthetic-key',
        salt,
        environment: 'test',
        publicApiUrl: 'https://api.dentra.test',
      },
    }),
  );
const checkout = () =>
  gateway().checkoutData({
    orderId: '012345678901234567890123',
    amountPaise: 40050,
    patientId: 'synthetic-patient',
    firstName: 'Test',
    email: 'test@example.com',
    phone: '9876543210',
  });
const response = (value: unknown) =>
  ({ ok: true, json: async () => value }) as Response;
afterEach(() => jest.restoreAllMocks());

test('converts INR exactly and rejects malformed/fractional paise', () => {
  expect(payuAmount(40050)).toBe('400.50');
  expect(payuPaise('400.5')).toBe(40050);
  expect(payuPaise('0.01')).toBe(1);
  for (const amount of ['1.001', '1e4', '-1', '', 'NaN'])
    expect(() => payuPaise(amount)).toThrow();
  expect(() => payuAmount(10.5)).toThrow();
});
test('creates alphanumeric merchant IDs, uses owned profile data and never returns the salt', async () => {
  const service = gateway();
  expect((await service.createOrder(100)).orderId).toMatch(/^[a-f\d]{24}$/);
  expect(JSON.stringify(checkout())).not.toContain(salt);
  expect(checkout().amount).toBe('400.50');
  expect(checkout().android_surl).toBe(
    'https://api.dentra.test/payments/payu/callback/success',
  );
});
test('payment hash is bound to saved amount, transaction, identity and UDFs', () => {
  const data = checkout();
  const source = `synthetic-key|${data.transactionId}|400.50|Dentra consultation|Test|test@example.com|synthetic-patient||||||||||`;
  expect(payuPaymentHashString(data)).toBe(source);
  const request = { hashName: 'payment', hashString: source };
  expect(gateway().sdkHash(request, data)).toBe(
    createHash('sha512')
      .update(source + salt)
      .digest('hex'),
  );
  for (const altered of [
    source.replace('400.50', '1.00'),
    source.replace('synthetic-patient', 'other-patient'),
  ])
    expect(() =>
      gateway().sdkHash({ ...request, hashString: altered }, data),
    ).toThrow('do not match');
});
test('only permits SDK read commands, binds saved cards to the owner, and supports V2 HMAC', () => {
  const data = checkout();
  const request = {
    hashName: 'vas_for_mobile_sdk',
    hashString: 'synthetic-key|vas_for_mobile_sdk|default|',
  };
  expect(gateway().sdkHash({ ...request, hashType: 'V2' }, data)).toBe(
    createHmac('sha256', salt).update(request.hashString).digest('hex'),
  );
  for (const command of [
    'cancel_refund_transaction',
    'verify_payment',
    'delete_user_card',
    'payment',
  ])
    expect(() =>
      gateway().sdkHash(
        { hashName: command, hashString: `synthetic-key|${command}|123|` },
        data,
      ),
    ).toThrow();
  expect(() =>
    gateway().sdkHash(
      {
        hashName: 'payment_related_details_for_mobile_sdk',
        hashString:
          'synthetic-key|payment_related_details_for_mobile_sdk|other-customer|',
      },
      data,
    ),
  ).toThrow('does not match');
  expect(() =>
    gateway().sdkHash({ ...request, postSalt: '12.00' }, data),
  ).toThrow('not enabled');
});
test('validates PayU reverse hashes and rejects tampered or additional-charge callbacks', () => {
  const body = {
    key: 'synthetic-key',
    txnid: checkout().transactionId,
    status: 'success',
    amount: '400.50',
    productinfo: 'Dentra consultation',
    firstname: 'Test',
    email: 'test@example.com',
    udf1: 'synthetic-patient',
    hash: '',
  };
  body.hash = createHash('sha512')
    .update(
      [
        salt,
        body.status,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        body.udf1,
        body.email,
        body.firstname,
        body.productinfo,
        body.amount,
        body.txnid,
        body.key,
      ].join('|'),
    )
    .digest('hex');
  expect(gateway().verifyResponse(body)).toBe(true);
  expect(gateway().verifyResponse({ ...body, amount: '1.00' })).toBe(false);
  expect(gateway().verifyResponse({ ...body, additionalCharges: '2.00' })).toBe(
    false,
  );
  expect(gateway().verifyResponse({ ...body, hash: 'bad' })).toBe(false);
});
test('server verification requires successful capture and signs the provider request', async () => {
  const orderId = checkout().transactionId;
  const send = jest.spyOn(global, 'fetch').mockResolvedValue(
    response({
      status: 1,
      transaction_details: {
        [orderId]: {
          txnid: orderId,
          mihpayid: '123456789',
          amt: '400.50',
          status: 'success',
          unmappedstatus: 'captured',
        },
      },
    }),
  );
  expect(await gateway().fetchOrderPayments(orderId)).toEqual([
    {
      id: '123456789',
      order_id: orderId,
      amount: 40050,
      currency: 'INR',
      status: 'captured',
    },
  ]);
  const form = new URLSearchParams(String(send.mock.calls[0][1]!.body));
  expect(form.get('hash')).toBe(
    createHash('sha512')
      .update(`synthetic-key|verify_payment|${orderId}|${salt}`)
      .digest('hex'),
  );
  expect(send.mock.calls[0][0]).toBe(
    'https://test.payu.in/merchant/postservice.php?form=2',
  );
  send.mockResolvedValue(
    response({
      transaction_details: {
        [orderId]: {
          txnid: orderId,
          mihpayid: '123',
          amt: '400.50',
          status: 'success',
          unmappedstatus: 'auth',
        },
      },
    }),
  );
  expect((await gateway().fetchOrderPayments(orderId))[0].status).toBe(
    'pending',
  );
});
test('refund retries recover an accepted token after a lost response instead of charging another refund', async () => {
  const requestId = 'saved-refund-job';
  const token = createHash('sha256')
    .update(requestId)
    .digest('hex')
    .slice(0, 23);
  const send = jest.spyOn(global, 'fetch').mockResolvedValue(
    response({
      transaction_details: {
        '123': {
          '456': {
            request_id: '456',
            mihpayid: '123',
            action: 'refund',
            token,
            amt: '400.50',
            status: 'queued',
          },
        },
      },
    }),
  );
  expect(await gateway().refund('123', 40050, requestId)).toMatchObject({
    refundId: '456',
    paymentId: '123',
    status: 'pending',
  });
  expect(send).toHaveBeenCalledTimes(1);
  expect(
    new URLSearchParams(String(send.mock.calls[0][1]!.body)).get('command'),
  ).toBe('check_action_status_txnid');
});
test('submits refunds with the same bounded token and only maps verified final success to refunded', async () => {
  const send = jest
    .spyOn(global, 'fetch')
    .mockResolvedValueOnce(response({ status: 0, transaction_details: {} }))
    .mockResolvedValueOnce(
      response({ status: 1, request_id: '456', mihpayid: '123' }),
    )
    .mockResolvedValueOnce(
      response({
        transaction_details: {
          '456': {
            '456': {
              request_id: '456',
              mihpayid: '123',
              action: 'refund',
              amt: '400.50',
              status: 'success',
            },
          },
        },
      }),
    );
  expect(await gateway().refund('123', 40050, 'job')).toMatchObject({
    refundId: '456',
    status: 'pending',
  });
  const form = new URLSearchParams(String(send.mock.calls[1][1]!.body));
  expect(form.get('var3')).toBe('400.50');
  expect(form.get('var2')).toHaveLength(23);
  expect(await gateway().fetchRefund('456')).toMatchObject({
    status: 'processed',
    amountPaise: 40050,
  });
});

test('read-only SDK hashes cannot be repurposed as payment or administrative signatures', () => {
  const service = gateway();
  const data = checkout();
  expect(() =>
    service.sdkHash(
      {
        hashName: 'vas_for_mobile_sdk',
        hashString:
          'synthetic-key|vas_for_mobile_sdk|1.00|forged-payment|Test|test@example.com|||||||||||',
      },
      data,
    ),
  ).toThrow('command argument');
});

test('rejects payment IDs that JSON numbers cannot represent exactly', async () => {
  const orderId = checkout().transactionId;
  jest.spyOn(global, 'fetch').mockResolvedValue(
    response({
      status: 1,
      transaction_details: {
        [orderId]: {
          txnid: orderId,
          mihpayid: Number.MAX_SAFE_INTEGER + 1,
          amt: '400.50',
          status: 'success',
          unmappedstatus: 'captured',
        },
      },
    }),
  );
  await expect(gateway().fetchOrderPayments(orderId)).rejects.toThrow(
    'numeric precision',
  );
});
