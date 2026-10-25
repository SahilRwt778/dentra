import type { Appointment } from '../../../common/types/api';
import type { ClinicCollectionMethod } from '../../../common/types/clinic-payment';

export const COLLECTION_METHODS: {
  value: ClinicCollectionMethod;
  label: string;
}[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
];
export function collectionMethodLabel(method: ClinicCollectionMethod) {
  return COLLECTION_METHODS.find(item => item.value === method)!.label;
}
export function canCollectClinicPayment(appointment: Appointment) {
  return (
    appointment.type === 'clinic' &&
    appointment.status !== 'cancelled' &&
    appointment.payment?.method === 'pay_at_clinic' &&
    appointment.payment.status === 'due_at_clinic' &&
    !appointment.payment.collection
  );
}
export function collectionTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}
