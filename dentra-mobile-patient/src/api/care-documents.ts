import { useCallback } from 'react';
import { baseApi } from './base-api';
import { downloadPrivateFile } from './private-download';

export type CareDocumentKind = 'prescription' | 'visit-summary';
const documentsApi = baseApi.injectEndpoints({
  endpoints: build => ({
    downloadCareDocument: build.mutation<
      string,
      { appointmentId: string; kind: CareDocumentKind }
    >({
      queryFn({ appointmentId, kind }, api, _options, request) {
        return downloadPrivateFile(
          `/appointments/${appointmentId}/${kind}/pdf`,
          {
            name: `dentra-${kind}-${appointmentId}.pdf`,
            mimeType: 'application/pdf',
          },
          api,
          request,
        );
      },
    }),
  }),
});

export function useDownloadCareDocument() {
  const [download] = documentsApi.useDownloadCareDocumentMutation();
  return useCallback(
    (appointmentId: string, kind: CareDocumentKind) =>
      download({ appointmentId, kind }).unwrap(),
    [download],
  );
}
