import type { ProfilePhoto } from '../common/types/profile-photo';
import axios from 'axios';
import { api } from './client';
import type {
  Dentist,
  DentistApplication,
  DentistDocument,
  DocumentType,
  LocalDocument,
} from '../common/types/api';

export const dentistsApi = {
  async getMe(signal?: AbortSignal): Promise<Dentist | null> {
    try {
      const { data } = await api.get<Dentist>('/dentists/me', { signal });
      return data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404)
        return null;
      throw error;
    }
  },
  async saveApplication(
    details: DentistApplication,
    exists: boolean,
    photo?: ProfilePhoto | null,
  ) {
    let body: DentistApplication | FormData = details;
    if (photo) {
      body = new FormData();
      body.append('details', JSON.stringify(details));
      body.append('profilePhoto', {
        uri: photo.uri,
        name: photo.name,
        type: photo.type,
      } as unknown as Blob);
    }
    const options = photo
      ? { timeout: 60000, headers: { 'Content-Type': 'multipart/form-data' } }
      : undefined;
    const { data } = exists
      ? await api.patch<Dentist>('/dentists/applications/me', body, options)
      : await api.post<Dentist>('/dentists/applications', body, options);
    return data;
  },
  async uploadDocument(
    dentistId: string,
    docType: DocumentType,
    file: LocalDocument,
  ) {
    const body = new FormData();
    body.append('docType', docType);
    // React Native's FormData accepts a URI descriptor; DOM TypeScript describes only Blob.
    body.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as unknown as Blob);
    const { data } = await api.post<DentistDocument>(
      `/dentists/applications/${dentistId}/documents`,
      body,
      {
        timeout: 60000,
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    );
    return data;
  },
  async submitApplication() {
    const { data } = await api.post<Dentist>(
      '/dentists/applications/me/submit',
    );
    return data;
  },
};
