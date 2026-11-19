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
