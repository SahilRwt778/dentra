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
  async saveApplication(details: DentistApplication, exists: boolean) {
    const { data } = exists
      ? await api.patch<Dentist>('/dentists/applications/me', details)
      : await api.post<Dentist>('/dentists/applications', details);
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
