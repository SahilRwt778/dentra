import { api } from './client';
import type {
  DentistPayment,
  DentistPayments,
  PaymentsQuery,
} from '../common/types/payments';

export const paymentsApi = {
  async list(params: PaymentsQuery, signal?: AbortSignal) {
    const { data } = await api.get<DentistPayments>('/dentists/me/payments', {
      params,
      signal,
    });
    return data;
  },
  async get(transactionId: string, signal?: AbortSignal) {
    const { data } = await api.get<DentistPayment>(
      `/dentists/me/payments/${transactionId}`,
      { signal },
    );
    return data;
  },
};
