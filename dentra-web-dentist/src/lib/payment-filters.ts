import type { PaymentStatus } from '@/api/generated-api';

export type PaymentFilters = {
  q: string;
  source: '' | 'clinic' | 'online';
  status: PaymentStatus | '';
  from: string;
  to: string;
};
export const EMPTY_PAYMENT_FILTERS: PaymentFilters = {
  q: '',
  source: '',
  status: '',
  from: '',
  to: '',
};
