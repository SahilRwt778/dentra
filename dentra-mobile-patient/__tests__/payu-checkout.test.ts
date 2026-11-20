import { DeviceEventEmitter } from 'react-native';
import PayU from 'payu-non-seam-less-react';
import { openPayuCheckout } from '../src/lib/payu-checkout';
import { preparePayuCheckout } from '../src/api/payment-checkout';
import { openCheckout } from '../src/lib/checkout';
import Razorpay from 'react-native-razorpay';

jest.mock('../src/auth/session', () => ({
  refreshSession: jest.fn(async () => null),
}));
jest.mock('../src/api/payment-checkout', () => ({
  preparePayuCheckout: jest.fn(),
}));
jest.mock('../src/store/store', () => ({
  store: {
    getState: () => ({ auth: { accessToken: 'synthetic-access-token' } }),
  },
}));
const parameters = {
  key: 'test-key',
  transactionId: 'synthetic-transaction',
  amount: '400.50',
};
const sdk = PayU!;
const tick = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
beforeEach(() => {
  jest.clearAllMocks();
  (preparePayuCheckout as jest.Mock).mockResolvedValue({
    provider: 'payu',
    payUPaymentParams: parameters,
  });
});

test('opens with backend parameters, signs through native networking, and never uses Razorpay for PayU', async () => {
  const payment = openCheckout({
    id: 'appointment',
    status: 'booked',
    payment: {
      provider: 'payu',
      status: 'pending',
      gatewayKeyId: 'test-key',
      gatewayOrderId: 'saved-transaction',
      amountPaise: 40050,
    },
  });
  await tick();
  expect(preparePayuCheckout).toHaveBeenCalledWith('appointment');
  expect(sdk.openCheckoutScreen).toHaveBeenCalledWith(
    expect.objectContaining({ payUPaymentParams: parameters }),
  );
  expect(Razorpay.open).not.toHaveBeenCalled();
  (sdk.makeHttpRequest as jest.Mock).mockResolvedValue(
    JSON.stringify({ hash: 'a'.repeat(128) }),
  );
  const request = { hashName: 'payment', hashString: 'server-owned-fields' };
  DeviceEventEmitter.emit('generateHash', request);
  await tick();
  expect(sdk.makeHttpRequest).toHaveBeenCalledWith(
    expect.stringContaining('/payments/appointments/appointment/hash'),
    'POST',
    JSON.stringify(request),
    expect.objectContaining({ Authorization: 'Bearer synthetic-access-token' }),
  );
  expect(sdk.hashGenerated).toHaveBeenCalledWith({ payment: 'a'.repeat(128) });
  DeviceEventEmitter.emit('onPaymentSuccess', {});
  await expect(payment).resolves.toBeUndefined();
  expect(DeviceEventEmitter.listenerCount('generateHash')).toBe(0);
});
test('handles cancellation and removes event subscriptions before another checkout', async () => {
  const payment = openPayuCheckout('appointment');
  const rejection = payment.catch(error => error);
  await tick();
  DeviceEventEmitter.emit('onPaymentCancel', { isTxnInitiated: false });
  expect(await rejection).toMatchObject({ code: 'PAYMENT_CANCELLED' });
  expect(DeviceEventEmitter.listenerCount('onPaymentSuccess')).toBe(0);
  const next = openPayuCheckout('appointment');
  await tick();
  DeviceEventEmitter.emit('onPaymentSuccess', {});
  await expect(next).resolves.toBeUndefined();
});
test('rejects provider failures and errors without treating them as successful checkout', async () => {
  for (const event of ['onPaymentFailure', 'onError']) {
    const payment = openPayuCheckout('appointment');
    const rejection = payment.catch(error => error);
    await tick();
    DeviceEventEmitter.emit(event, {});
    expect(await rejection).toBeInstanceOf(Error);
  }
});
test('keeps the PayU initialization error and code instead of replacing them with a generic message', async () => {
  const payment = openPayuCheckout('appointment');
  const rejection = payment.catch(error => error);
  await tick();
  DeviceEventEmitter.emit('onError', {
    errorCode: '47',
    errorMsg: 'Synthetic checkout initialization error',
  });
  expect((await rejection).message).toBe(
    'Synthetic checkout initialization error (PayU 47)',
  );
});
test('a rejected hash unblocks the SDK without exposing an error payload or leaving stale listeners', async () => {
  const payment = openPayuCheckout('appointment');
  const rejection = payment.catch(error => error);
  await tick();
  (sdk.makeHttpRequest as jest.Mock).mockRejectedValue(
    new Error('unavailable'),
  );
  DeviceEventEmitter.emit('generateHash', {
    hashName: 'payment',
    hashString: 'test',
  });
  await tick();
  expect(sdk.hashGenerated).toHaveBeenCalledWith({ payment: '' });
  DeviceEventEmitter.emit('onError', {});
  expect(await rejection).toBeInstanceOf(Error);
});

test('answers all concurrent initialization hashes even when one request fails', async () => {
  const payment = openPayuCheckout('appointment');
  const rejection = payment.catch(error => error);
  await tick();
  let resolveCheckoutDetails!: (response: string) => void;
  (sdk.makeHttpRequest as jest.Mock)
    .mockReturnValueOnce(
      new Promise<string>(resolve => {
        resolveCheckoutDetails = resolve;
      }),
    )
    .mockResolvedValueOnce(
      JSON.stringify({
        code: 'BAD_REQUEST',
        message: 'Synthetic checkout verification failure',
      }),
    );
  DeviceEventEmitter.emit('generateHash', {
    hashName: 'get_checkout_details',
    hashString: 'synthetic SDK request',
  });
  DeviceEventEmitter.emit('generateHash', {
    hashName: 'quickPayEvent',
    hashString: 'synthetic SDK signature',
  });
  await tick();
  DeviceEventEmitter.emit('onError', {
    errorMsg: 'quickPayEvent Hash cannot be null or empty',
    errorCode: 'null',
  });
  expect(DeviceEventEmitter.listenerCount('generateHash')).toBeGreaterThan(0);
  resolveCheckoutDetails(JSON.stringify({ hash: 'b'.repeat(128) }));
  expect((await rejection).message).toBe(
    'Synthetic checkout verification failure',
  );
  expect(sdk.hashGenerated).toHaveBeenCalledWith({
    get_checkout_details: 'b'.repeat(128),
  });
  expect(DeviceEventEmitter.listenerCount('generateHash')).toBe(0);
});

test('serves the four Android initialization hashes and waits for an actual payment result', async () => {
  const payment = openPayuCheckout('appointment');
  await tick();
  (sdk.makeHttpRequest as jest.Mock).mockResolvedValue(
    JSON.stringify({ hash: 'c'.repeat(128) }),
  );
  const names = [
    'get_checkout_details',
    'get_sdk_configuration',
    'get_all_offer_details',
    'quickPayEvent',
  ];
  names.forEach(hashName =>
    DeviceEventEmitter.emit('generateHash', {
      hashName,
      hashString: 'synthetic SDK initialization request',
    }),
  );
  await tick();
  names.forEach(name =>
    expect(sdk.hashGenerated).toHaveBeenCalledWith({ [name]: 'c'.repeat(128) }),
  );
  expect(DeviceEventEmitter.listenerCount('onPaymentSuccess')).toBeGreaterThan(
    0,
  );
  DeviceEventEmitter.emit('onPaymentSuccess', {});
  await expect(payment).resolves.toBeUndefined();
});
test('prevents concurrent checkouts and resets after a preparation failure', async () => {
  const first = openPayuCheckout('appointment');
  await tick();
  await expect(openPayuCheckout('appointment')).rejects.toThrow('already open');
  DeviceEventEmitter.emit('onPaymentSuccess', {});
  await first;
  (preparePayuCheckout as jest.Mock).mockRejectedValueOnce(
    new Error('Add your email'),
  );
  await expect(openPayuCheckout('appointment')).rejects.toThrow(
    'Add your email',
  );
  const second = openPayuCheckout('appointment');
  await tick();
  DeviceEventEmitter.emit('onPaymentSuccess', {});
  await second;
});
