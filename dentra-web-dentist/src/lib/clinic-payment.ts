import type { Appointment, ClinicCollectionMethod } from '@/api/generated-api';

export const CLINIC_METHODS: Record<ClinicCollectionMethod, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
};
export function canCollectClinicPayment(appointment: Appointment) {
  return (
    appointment.type === 'clinic' &&
    appointment.status !== 'cancelled' &&
    appointment.payment?.method === 'pay_at_clinic' &&
    appointment.payment.status === 'due_at_clinic' &&
    !appointment.payment.collection
  );
}
export function collectedTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}
