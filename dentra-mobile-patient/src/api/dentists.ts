import {
  useGetDentistsQuery,
  useGetDentistsByDentistIdQuery,
  useGetDentistsByDentistIdSlotsQuery,
} from './generated/patient-api';
import type { QueryOptions } from './types';

export const useDentistsQuery = useGetDentistsQuery;
export const useDentistSlotsQuery = useGetDentistsByDentistIdSlotsQuery;

export function useDentistQuery(dentistId?: string, options?: QueryOptions) {
  return useGetDentistsByDentistIdQuery(
    { dentistId: dentistId ?? '' },
    { ...options, skip: !dentistId || options?.skip },
  );
}
