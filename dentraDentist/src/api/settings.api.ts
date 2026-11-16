import { api } from './client';
import type { Clinic, Dentist } from '../common/types/api';
import type {
  ClinicInput,
  DentistUpdate,
  PayoutProfile,
  PayoutRequest,
  PayoutSubmission,
} from '../common/types/settings';

export const settingsApi = {
  async updateProfile(
    { profilePhoto, ...details }: DentistUpdate,
    signal?: AbortSignal,
  ) {
    let body: typeof details | FormData = details;
    if (profilePhoto) {
      body = new FormData();
      body.append('details', JSON.stringify(details));
      body.append('profilePhoto', {
        uri: profilePhoto.uri,
        name: profilePhoto.name,
        type: profilePhoto.type,
      } as unknown as Blob);
    }
    const { data } = await api.patch<Dentist>('/dentists/me', body, {
      signal,
      ...(profilePhoto
        ? { timeout: 60000, headers: { 'Content-Type': 'multipart/form-data' } }
        : {}),
    });
    return data;
  },
  async listClinics(signal?: AbortSignal) {
    const { data } = await api.get<Clinic[]>('/dentists/me/clinics', {
      signal,
    });
    return data;
  },
  async addClinic(details: ClinicInput, signal?: AbortSignal) {
    const { data } = await api.post<Clinic>('/dentists/me/clinics', details, {
      signal,
    });
    return data;
  },
  async updateClinic(id: string, details: ClinicInput, signal?: AbortSignal) {
    const { data } = await api.patch<Clinic>(
      `/dentists/me/clinics/${id}`,
      details,
      { signal },
    );
    return data;
  },
  async removeClinic(id: string, signal?: AbortSignal) {
    await api.delete(`/dentists/me/clinics/${id}`, { signal });
    return null;
  },
  async getPayoutProfile(signal?: AbortSignal) {
    const { data } = await api.get<PayoutProfile>(
      '/dentists/me/payout-details',
      { signal },
    );
    return data;
  },
  async submitPayout(details: PayoutSubmission, signal?: AbortSignal) {
    const { data } = await api.post<PayoutRequest>(
      '/dentists/me/payout-requests',
      details,
      { signal },
    );
    return data;
  },
};
