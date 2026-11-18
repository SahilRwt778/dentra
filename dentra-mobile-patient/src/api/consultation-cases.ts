import {
  useGetConsultationCaseQuery,
  useGetConsultationCasesQuery,
  useBookConsultationFollowUpMutation,
  dentraApi,
} from './generated/patient-api';
import type { ConsultationCaseQuery } from '@dentra/call-core';
import type { QueryOptions } from './types';
import type { AppDispatch } from '@/store/store';

export function useConsultationCasesQuery(
  { page = 1, filter = 'all' }: ConsultationCaseQuery = {},
  options?: QueryOptions,
) {
  // The tab badge and All inbox share the same cache entry.
  return useGetConsultationCasesQuery({ page, filter }, options);
}

export function refreshExpiredConversations(
  query: Required<ConsultationCaseQuery>,
  fetchedAt: number,
) {
  return (dispatch: AppDispatch, getState: () => unknown) => {
    const endpoint = dentraApi.endpoints.getConsultationCases;
    // Injected endpoints use the same base API reducer in the app store.
    const state = getState() as { api: ReturnType<typeof dentraApi.reducer> };
    const cached = endpoint.select(query)(state);
    // Another subscriber may already have refreshed this same page.
    if (cached.fulfilledTimeStamp !== fetchedAt) return;
    dispatch(
      endpoint.initiate(query, { subscribe: false, forceRefetch: true }),
    );
  };
}

export const useConsultationCaseQuery = useGetConsultationCaseQuery;
export const useBookFollowUpMutation = useBookConsultationFollowUpMutation;
