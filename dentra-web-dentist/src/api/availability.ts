import { dentraApi } from './generated-api';

// Preview is read-only despite using POST for its date/time body.
const availabilityApi = dentraApi.enhanceEndpoints({
  endpoints: {
    postDentistsMeTimeOffPreview: { invalidatesTags: [] },
  },
});
export const {
  useGetDentistsMeTimeOffQuery,
  usePostDentistsMeTimeOffMutation,
  usePostDentistsMeTimeOffPreviewMutation,
  useDeleteDentistsMeTimeOffByIdMutation,
} = availabilityApi;
