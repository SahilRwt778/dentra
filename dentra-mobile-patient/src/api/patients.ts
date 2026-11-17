import type { ProfilePhoto } from '@/components/profile-photo-field';
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
    (patient: PatientRegistration, photo?: ProfilePhoto | null) => {
      if (!photo) return send({ patientRegistration: patient }).unwrap();
      const body = new FormData();
      body.append('details', JSON.stringify(patient));
      body.append('profilePhoto', {
        uri: photo.uri,
        name: photo.name,
        type: photo.type,
      } as unknown as Blob);
      // Native multipart descriptors differ from OpenAPI's JSON registration type.
      return send({
        patientRegistration: body as unknown as PatientRegistration,
      }).unwrap();
    },
    [send],
  );
  return [register, state] as const;
}

export function useUpdatePatientMutation() {
  const [send, state] = usePatchPatientsMeMutation();
  const update = useCallback(
    (patient: PatientUpdate, photo?: ProfilePhoto | null) => {
      if (!photo) return send({ patientUpdate: patient }).unwrap();
      const body = new FormData();
      body.append('details', JSON.stringify(patient));
      body.append('profilePhoto', {
        uri: photo.uri,
        name: photo.name,
        type: photo.type,
      } as unknown as Blob);
      // The endpoint accepts JSON details or multipart details plus a native file.
      return send({
        patientUpdate: body as unknown as PatientUpdate,
      }).unwrap();
    },
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
