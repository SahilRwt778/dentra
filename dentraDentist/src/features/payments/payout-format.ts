import type { PayoutBatchStatus } from '../../common/types/payout-batch';
export const PAYOUT_STATUSES: Record<PayoutBatchStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  paid: 'Paid',
  failed: 'Failed',
  cancelled: 'Cancelled',
};
