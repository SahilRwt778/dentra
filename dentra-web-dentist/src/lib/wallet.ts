export const WITHDRAWAL_STATUSES = {
  requested: 'Awaiting approval',
  approved: 'Approved',
  processing: 'Processing',
  paid: 'Paid',
  rejected: 'Declined',
  failed: 'Failed',
  cancelled: 'Cancelled',
};
export function withdrawalPaise(value: string) {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ''] = value.trim().split('.');
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return paise > 0 && paise <= 2147483647 ? paise : null;
}
export function uncertainWithdrawal(error: unknown) {
  const status = (error as { status?: number | string })?.status;
  return typeof status !== 'number' || status >= 500;
}
