import { useCallback } from 'react';
import type { LocalAttachment } from '@/lib/attachment-picker';
import type { PatientFile, QueryOptions } from './types';
import {
  useDeletePatientsMeFilesByFileIdMutation,
  useGetAppointmentsByAppointmentIdAttachmentsQuery,
  useGetPatientsMeFilesQuery,
} from './generated/patient-api';
import { baseApi } from './base-api';
import { downloadPrivateFile, signedInSession } from './private-download';

// Binary requests use the same authenticated client and refresh retry as JSON.
// Native URI/FormData and the private cache are kept inside this adapter.
const filesApi = baseApi
  .enhanceEndpoints({ addTagTypes: ['Patient Files'] })
  .injectEndpoints({
    endpoints: build => ({
      uploadPatientAttachment: build.mutation<
        PatientFile,
        { file: LocalAttachment; uploadKey: string }
      >({
        async queryFn({ file, uploadKey }, api, _options, request) {
          const scope = signedInSession(api.getState());
          if (!scope)
            return {
              error: {
                status: 401,
                data: { message: 'Please sign in again.' },
              },
            };
          const body = new FormData();
          body.append('uploadKey', uploadKey);
          body.append('file', {
            uri: file.uri,
            name: file.name,
            type: file.type,
          } as unknown as Blob);
          const result = await request({
            url: '/patients/me/files',
            method: 'POST',
            body,
            timeout: 60000,
          });
          if (scope !== signedInSession(api.getState()))
            return {
              error: { status: 401, data: { message: 'Session ended.' } },
            };
          return result.error
            ? { error: result.error }
            : { data: result.data as PatientFile };
        },
        invalidatesTags: ['Patient Files'],
      }),
      downloadPatientAttachment: build.mutation<string, PatientFile>({
        queryFn(file, api, _options, request) {
          return downloadPrivateFile(
            `/patient-files/${file.id}/content`,
            file,
            api,
            request,
          );
        },
      }),
    }),
  });

export function useUploadPatientFile() {
  const [upload] = filesApi.useUploadPatientAttachmentMutation();
  return useCallback(
    (file: LocalAttachment, uploadKey: string) =>
      upload({ file, uploadKey }).unwrap(),
    [upload],
  );
}
export function useDownloadPatientFile() {
  const [download] = filesApi.useDownloadPatientAttachmentMutation();
  return useCallback(
    (file: PatientFile) => download(file).unwrap(),
    [download],
  );
}
export function useRemovePatientFile() {
  const [remove] = useDeletePatientsMeFilesByFileIdMutation();
  return useCallback((fileId: string) => remove({ fileId }).unwrap(), [remove]);
}
export function usePatientFilesQuery(page: number, options?: QueryOptions) {
  return useGetPatientsMeFilesQuery({ page }, options);
}
export function useAppointmentFilesQuery(appointmentId: string) {
  return useGetAppointmentsByAppointmentIdAttachmentsQuery(
    { appointmentId },
    { refetchOnMountOrArgChange: true },
  );
}
