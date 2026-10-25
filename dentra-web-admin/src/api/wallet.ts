import { dentraApi } from './generated-api';
const api = dentraApi.enhanceEndpoints({
  endpoints: {
    getWalletSettings: { keepUnusedDataFor: 0 },
    listAdminWithdrawals: { keepUnusedDataFor: 0 },
    getAdminWithdrawal: { keepUnusedDataFor: 0 },
  },
});
export const {
  useGetWalletSettingsQuery,
  useUpdateWalletSettingsMutation,
  useListAdminWithdrawalsQuery,
  useGetAdminWithdrawalQuery,
  useChangeWithdrawalMutation,
} = api;
