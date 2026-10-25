import { dentraApi } from './generated-api';
const api = dentraApi.enhanceEndpoints({
  endpoints: {
    listDentistPayoutBatches: { keepUnusedDataFor: 0 },
    getDentistPayoutBatch: { keepUnusedDataFor: 0 },
  },
});
export const {
  useListDentistPayoutBatchesQuery,
  useGetDentistPayoutBatchQuery,
} = api;
