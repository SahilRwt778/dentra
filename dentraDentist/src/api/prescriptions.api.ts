import { api } from './client';
import type { Consultation } from '../common/types/consultation';
import type { OtpChallenge } from '../common/types/api';
import type {
  MedicineForm,
  PrescriptionSignature,
} from '../common/types/prescription';

export const prescriptionsApi = {
  async save(
    appointmentId: string,
    items: MedicineForm[],
    signal?: AbortSignal,
  ) {
    const { data } = await api.put<Consultation>(
      `/appointments/${appointmentId}/consultation`,
      { prescriptionItems: items },
      { signal },
    );
    return data;
  },
  async requestCode(appointmentId: string, signal?: AbortSignal) {
    const { data } = await api.post<OtpChallenge>(
      `/appointments/${appointmentId}/prescription/otp`,
      undefined,
      { signal },
    );
    return data;
  },
  async sign(
    appointmentId: string,
    signature: PrescriptionSignature,
    signal?: AbortSignal,
  ) {
    const { data } = await api.post<Consultation>(
      `/appointments/${appointmentId}/prescription/sign`,
      signature,
      { signal },
    );
    return data;
  },
};
