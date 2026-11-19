import { dentraApi } from './generated/patient-api';
import { store } from '@/store/store';

// Use the shared API client so preparation has the normal authentication/refresh behaviour.
export async function preparePayuCheckout(appointmentId: string) {
  const request = store.dispatch(
    dentraApi.endpoints.postPaymentsAppointmentsByAppointmentIdCheckout.initiate(
      { appointmentId },
    ),
  );
  try {
    return await request.unwrap();
  } finally {
    request.reset();
  }
}
