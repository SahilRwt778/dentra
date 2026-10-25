import { dentraApi } from './generated-api';

const api = dentraApi.enhanceEndpoints({
  endpoints: {
    listPayoutDentists: { keepUnusedDataFor: 0 },
    listEligiblePayouts: { keepUnusedDataFor: 0 },
    listAdminPayoutBatches: { keepUnusedDataFor: 0 },
    getAdminPayoutBatch: { keepUnusedDataFor: 0 },
  },
});
export const {
  useListPayoutDentistsQuery,
  useListEligiblePayoutsQuery,
  useListAdminPayoutBatchesQuery,
  useGetAdminPayoutBatchQuery,
  useCreatePayoutBatchMutation,
  useChangePayoutBatchMutation,
} = api;
