import type { Appointment } from '@/api/types';

export function cancellationPaymentMessage(payment: Appointment['payment']) {
  if (payment?.status !== 'paid') return 'Your slot will be released.';
  return payment.method === 'pay_at_clinic'
    ? 'You paid at the clinic. Contact the clinic directly to arrange any refund.'
    : 'A refund will be requested to your original payment method.';
}
