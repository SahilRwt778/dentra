import { api } from './client';
import type {
  DentistWallet,
  RequestWithdrawal,
  WithdrawalDetail,
  WithdrawalPage,
  WithdrawalQuery,
} from '../common/types/wallet';
export const walletApi = {
  async get(signal?: AbortSignal) {
    const { data } = await api.get<DentistWallet>('/dentists/me/wallet', {
      signal,
    });
    return data;
  },
  async withdrawals(params: WithdrawalQuery, signal?: AbortSignal) {
    const { data } = await api.get<WithdrawalPage>('/dentists/me/withdrawals', {
      params,
      signal,
    });
    return data;
  },
  async withdrawal(id: string, signal?: AbortSignal) {
    const { data } = await api.get<WithdrawalDetail>(
      `/dentists/me/withdrawals/${id}`,
      { signal },
    );
    return data;
  },
  async request(input: RequestWithdrawal) {
    const { data } = await api.post<WithdrawalDetail>(
      '/dentists/me/withdrawals',
      input,
    );
    return data;
  },
};
