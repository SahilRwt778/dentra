import { api } from './client';
import type { Appointment } from '../common/types/api';
import type { CollectClinicPayment } from '../common/types/clinic-payment';

export const clinicPaymentsApi = {
  async collect(
    appointmentId: string,
    details: CollectClinicPayment,
    signal?: AbortSignal,
  ) {
    const { data } = await api.post<Appointment>(
      `/appointments/${appointmentId}/clinic-payment`,
      details,
      { signal },
    );
    return data;
  },
};
