import { dentraApi, type PatientFile } from './generated-api';
import { downloadPrivateFile } from './private-download';

// Fetch through the shared client so expired access tokens refresh normally.
// Only a short-lived object URL, never a Blob, enters the Redux state.
const filesApi = dentraApi.injectEndpoints({
  endpoints: (build) => ({
    downloadPatientAttachment: build.mutation<string, PatientFile>({
      queryFn(file, api, _options, request) {
        return downloadPrivateFile(
          `/patient-files/${file.id}/content`,
          api,
          request
        );
      },
    }),
  }),
});

export const { useDownloadPatientAttachmentMutation } = filesApi;
