import { dentraApi } from './generated-api';
const api = dentraApi.enhanceEndpoints({
  endpoints: {
    getDentistWallet: { keepUnusedDataFor: 0 },
    listDentistWithdrawals: { keepUnusedDataFor: 0 },
    getDentistWithdrawal: { keepUnusedDataFor: 0 },
  },
});
export const {
  useGetDentistWalletQuery,
  useListDentistWithdrawalsQuery,
  useGetDentistWithdrawalQuery,
  useRequestDentistWithdrawalMutation,
} = api;
