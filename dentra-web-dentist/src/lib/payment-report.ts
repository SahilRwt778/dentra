import type {
  DentistPayment,
  DentistPaymentSummary,
  PaymentStatus,
} from '@/api/generated-api';

export const PAYMENT_STATUSES: Record<
  PaymentStatus,
  { label: string; color: string }
> = {
  paid: { label: 'Paid', color: 'green' },
  pending: { label: 'Awaiting payment', color: 'amber' },
  due_at_clinic: { label: 'Due at clinic', color: 'amber' },
  refund_pending: { label: 'Refund processing', color: 'amber' },
  refund_failed: { label: 'Refund needs attention', color: 'red' },
  refunded: { label: 'Refunded', color: 'blue' },
  cancelled: { label: 'Cancelled', color: '' },
  failed: { label: 'Payment attempt failed', color: 'red' },
};
export const PAYMENT_SUMMARY_FIELDS: {
  key: Exclude<keyof DentistPaymentSummary, 'totalTransactions'>;
  label: string;
}[] = [
  { key: 'onlinePaidAmountPaise', label: 'Online · Paid' },
  { key: 'clinicCollectedAmountPaise', label: 'Clinic · Collected' },
  { key: 'dueAtClinicAmountPaise', label: 'Due at clinic' },
  { key: 'pendingOnlineAmountPaise', label: 'Awaiting online payment' },
  { key: 'refundPendingAmountPaise', label: 'Refund processing' },
  { key: 'refundFailedAmountPaise', label: 'Refund needs attention' },
  { key: 'refundedAmountPaise', label: 'Refunded' },
];
const METHODS = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  netbanking: 'Netbanking',
  pay_at_clinic: 'Pay at clinic',
};
export function reportPaymentMethod(payment: DentistPayment) {
  return payment.collection
    ? `At clinic · ${METHODS[payment.collection.method]}`
    : payment.source === 'clinic'
    ? 'At clinic'
    : `Online · ${METHODS[payment.method]}`;
}
