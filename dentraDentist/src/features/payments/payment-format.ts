import type {
  DentistPayment,
  DentistPaymentSummary,
  PaymentStatus,
} from '../../common/types/payments';

export const PAYMENT_STATUSES: Record<PaymentStatus, string> = {
  paid: 'Paid',
  pending: 'Awaiting payment',
  due_at_clinic: 'Due at clinic',
  refund_pending: 'Refund processing',
  refund_failed: 'Refund needs attention',
  refunded: 'Refunded',
  cancelled: 'Cancelled',
  failed: 'Payment attempt failed',
};
export const SUMMARY_FIELDS: {
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
export function paymentMethod(payment: DentistPayment) {
  return payment.collection
    ? `At clinic · ${METHODS[payment.collection.method]}`
    : payment.source === 'clinic'
    ? 'At clinic'
    : `Online · ${METHODS[payment.method]}`;
}
export function paymentTimestamp(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}
