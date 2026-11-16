import { useRef, useState } from 'react';
import uuid from 'react-native-uuid';
import { useBookAppointmentMutation } from '@/api/appointments';
import type { BookAppointment, Patient } from '@/api/types';
import { useCheckout } from './use-checkout';

export function useBookAppointment() {
  const [book] = useBookAppointmentMutation();
  const checkout = useCheckout();
  const [isBooking, setIsBooking] = useState(false);
  const submitting = useRef(false);
  const attempt = useRef<{ payload: string; key: string } | null>(null);

  async function submit(
    booking: Omit<BookAppointment, 'idempotencyKey'>,
    patient?: Patient,
  ) {
    if (submitting.current) return;
    submitting.current = true;
    setIsBooking(true);

    // Retrying the same details must reuse the same booking attempt.
    const payload = JSON.stringify(booking);
    if (attempt.current?.payload !== payload) {
      attempt.current = { payload, key: String(uuid.v4()) };
    }

    try {
      let appointment = await book({
        ...booking,
        idempotencyKey: attempt.current.key,
      });
      if (!appointment.id) throw new Error('Missing appointment reference.');
      const appointmentId = appointment.id;

      let paymentCancelled = false;
      let paymentSubmitted = false;
      if (
        booking.paymentMethod !== 'pay_at_clinic' &&
        appointment.payment?.status === 'pending'
      ) {
        try {
          appointment = await checkout(appointment, patient);
          paymentSubmitted = true;
        } catch {
          paymentCancelled = true;
        }
      }
      return {
        appointment: { ...appointment, id: appointmentId },
        paymentCancelled,
        paymentSubmitted,
      };
    } finally {
      submitting.current = false;
      setIsBooking(false);
    }
  }

  return { submit, isBooking };
}
