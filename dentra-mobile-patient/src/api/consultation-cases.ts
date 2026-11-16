import {
  useGetConsultationCaseQuery,
  useGetConsultationCasesQuery,
  useBookConsultationFollowUpMutation,
} from './generated/patient-api';

export const useConsultationCasesQuery = useGetConsultationCasesQuery;
export const useConsultationCaseQuery = useGetConsultationCaseQuery;
export const useBookFollowUpMutation = useBookConsultationFollowUpMutation;
