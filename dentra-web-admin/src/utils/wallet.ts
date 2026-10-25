export const WITHDRAWAL_STATUSES = {
  requested: 'Awaiting approval',
  approved: 'Approved',
  processing: 'Processing',
  paid: 'Paid',
  rejected: 'Declined',
  failed: 'Failed',
  cancelled: 'Cancelled',
};
export function positivePaise(value: string) {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ''] = value.trim().split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return amount > 0 && amount <= 2147483647 ? amount : null;
}
