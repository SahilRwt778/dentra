import { useCallback } from 'react';
import { useRefreshAppointmentPayment } from '@/api/appointments';
import type { Appointment, Patient } from '@/api/types';
import { openCheckout } from '@/lib/checkout';

export function useCheckout() {
  const refreshPayment = useRefreshAppointmentPayment();

  return useCallback(
    async (appointment: Appointment, patient?: Patient) => {
      if (!appointment.id) throw new Error('Missing appointment reference.');
      try {
        await openCheckout(appointment, patient);
      } catch (error) {
        // A failure/cancel callback can race a successful provider capture.
        if (appointment.payment?.provider === 'payu') {
          const current = await refreshPayment(appointment.id).catch(
            () => null,
          );
          if (current?.payment?.status === 'paid') return current;
        }
        throw error;
      }

      try {
        return await refreshPayment(appointment.id);
      } catch {
        // Checkout succeeded. Keep checking through webhooks/polling instead of asking for another charge.
        return appointment;
      }
    },
    [refreshPayment],
  );
}
