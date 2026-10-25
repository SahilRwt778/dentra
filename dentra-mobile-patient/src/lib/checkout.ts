import RazorpayCheckout from 'react-native-razorpay';
import type { Appointment, Patient } from '@/api/types';
import { activeAppointment } from '@/lib/patient';
import { colors } from '@/theme';

export class CheckoutUnavailableError extends Error {}

// The Pay button and checkout must agree, including for an unpaid visit already in consultation.
export function checkoutUnavailableReason(
  appointment: Appointment,
  now = Date.now(),
): string | undefined {
  const payment = appointment.payment;
  if (
    !activeAppointment(appointment) ||
    !['pending', 'failed'].includes(payment?.status ?? '')
  ) {
    return 'This appointment is no longer awaiting payment. Please refresh its status.';
  }
  if (payment?.expiresAt && new Date(payment.expiresAt).getTime() <= now) {
    return 'The checkout window has expired. Please book another appointment.';
  }
  if (!payment?.gatewayOrderId || !payment.gatewayKeyId) {
    return 'Online payment is unavailable for this appointment. Please contact support.';
  }
}

// The API confirms payment with the gateway; checkout's client result never marks a booking paid.
export async function openCheckout(
  appointment: Appointment,
  patient?: Patient,
) {
  const reason = checkoutUnavailableReason(appointment);
  if (reason) throw new CheckoutUnavailableError(reason);
  const payment = appointment.payment!;
  return RazorpayCheckout.open({
    key: payment.gatewayKeyId!,
    order_id: payment.gatewayOrderId!,
    amount: payment.amountPaise,
    currency: 'INR',
    name: 'Dentra',
    description: `Consultation with ${
      appointment.dentistName ?? 'your dentist'
    }`,
    prefill: {
      name: patient?.fullName,
      contact: patient?.mobile,
      email: patient?.email,
    },
    theme: { color: colors.accent },
  });
}
