import type {
  ConsultationCase,
  ConsultationCasePage,
  ConsultationCaseQuery,
} from '@dentra/call-core';
import { api } from './client';

export const consultationCasesApi = {
  async list(query: ConsultationCaseQuery, signal?: AbortSignal) {
    const { data } = await api.get<ConsultationCasePage>(
      '/consultation-cases',
      { params: query, signal },
    );
    return data;
  },
  async get(caseId: string, signal?: AbortSignal) {
    const { data } = await api.get<ConsultationCase>(
      `/consultation-cases/${caseId}`,
      { signal },
    );
    return data;
  },
};
