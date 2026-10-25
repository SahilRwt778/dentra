import { useCallback } from 'react';
import {
  useGetPatientsMeQuery,
  useGetPatientsMeChartQuery,
  usePostPatientsRegisterMutation,
  usePatchPatientsMeMutation,
  usePostPrivacyRequestsMutation,
} from './generated/patient-api';
import type {
  PatientRegistration,
  PatientUpdate,
  PrivacyRequestType,
  QueryOptions,
} from './types';

export const usePatientQuery = useGetPatientsMeQuery;

export function useDentalChartQuery(options?: QueryOptions) {
  return useGetPatientsMeChartQuery(undefined, options);
}

export function useRegisterPatientMutation() {
  const [send, state] = usePostPatientsRegisterMutation();
  const register = useCallback(
    (patient: PatientRegistration) =>
      send({ patientRegistration: patient }).unwrap(),
    [send],
  );
  return [register, state] as const;
}

export function useUpdatePatientMutation() {
  const [send, state] = usePatchPatientsMeMutation();
  const update = useCallback(
    (patient: PatientUpdate) => send({ patientUpdate: patient }).unwrap(),
    [send],
  );
  return [update, state] as const;
}

export function usePrivacyRequestMutation() {
  const [send, state] = usePostPrivacyRequestsMutation();
  const request = useCallback(
    (type: PrivacyRequestType) => send({ body: { type } }).unwrap(),
    [send],
  );
  return [request, state] as const;
}
