import RazorpayCheckout from 'react-native-razorpay';
import { openCheckout } from '../src/lib/checkout';
import type { Appointment } from '../src/api/types';

jest.mock('react-native-razorpay', () => ({ open: jest.fn() }));
const appointment: Appointment = {
  id: 'appointment',
  status: 'booked',
  dentistName: 'Test dentist',
  payment: {
    status: 'pending',
    amountPaise: 40050,
    gatewayOrderId: 'order_test',
    gatewayKeyId: 'rzp_test_fixture',
  },
};
beforeEach(() => jest.clearAllMocks());

test('failed payment attempts retry the same gateway order, without marking the booking paid', async () => {
  const result = { razorpay_payment_id: 'pay_test', razorpay_order_id: 'order_test' };
  (RazorpayCheckout.open as jest.Mock).mockResolvedValue(result);
  const failed = { ...appointment, payment: { ...appointment.payment, status: 'failed' as const } };
  await expect(openCheckout(failed)).resolves.toEqual(result);
  expect(RazorpayCheckout.open).toHaveBeenCalledWith(
    expect.objectContaining({ order_id: 'order_test', amount: 40050 }),
  );
  expect(failed.payment.status).toBe('failed');
});
test.each(['paid', 'refund_pending', 'refund_failed', 'refunded', 'cancelled'])(
  'does not open checkout for %s payments',
  async status => {
    await expect(
      openCheckout({ ...appointment, payment: { ...appointment.payment, status } } as Appointment),
    ).rejects.toThrow(/no longer awaiting/);
    expect(RazorpayCheckout.open).not.toHaveBeenCalled();
  },
);
test('does not charge a cancelled appointment or an expired checkout hold', async () => {
  await expect(openCheckout({ ...appointment, status: 'cancelled' })).rejects.toThrow(/no longer awaiting/);
  await expect(
    openCheckout({ ...appointment, payment: { ...appointment.payment, expiresAt: '2000-01-01T00:00:00Z' } }),
  ).rejects.toThrow(/expired/);
  expect(RazorpayCheckout.open).not.toHaveBeenCalled();
});
