import type {
  PaymentSource,
  PaymentStatus,
  PaymentsQuery,
} from '../../common/types/payments';

export type PaymentFilters = {
  search: string;
  source: PaymentSource | '';
  status: PaymentStatus | '';
  from: string | null;
  to: string | null;
};
export const EMPTY_PAYMENT_FILTERS: PaymentFilters = {
  search: '',
  source: '',
  status: '',
  from: null,
  to: null,
};
export function paymentsQuery(
  filters: PaymentFilters,
  page: number,
): PaymentsQuery {
  return {
    page,
    limit: 20,
    q: filters.search.trim() || undefined,
    source: filters.source || undefined,
    status: filters.status || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
  };
}
