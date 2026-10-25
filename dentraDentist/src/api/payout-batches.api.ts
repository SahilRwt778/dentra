import { api } from './client';
import type {
  PayoutBatchDetail,
  PayoutBatchPage,
  PayoutBatchQuery,
} from '../common/types/payout-batch';

export const payoutBatchesApi = {
  async list(params: PayoutBatchQuery, signal?: AbortSignal) {
    const { data } = await api.get<PayoutBatchPage>(
      '/dentists/me/payout-batches',
      { params, signal },
    );
    return data;
  },
  async get(id: string, signal?: AbortSignal) {
    const { data } = await api.get<PayoutBatchDetail>(
      `/dentists/me/payout-batches/${id}`,
      { signal },
    );
    return data;
  },
};
