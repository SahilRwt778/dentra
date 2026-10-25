export const PAYOUT_STATUSES = {
  pending: 'Pending',
  processing: 'Processing',
  paid: 'Paid',
  failed: 'Failed',
  cancelled: 'Cancelled',
};
export const payoutMoney = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
    paise / 100,
  );
export const payoutTime = (value: string) =>
  new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
export function payoutError(error: unknown) {
  const message = (error as { data?: { message?: string | string[] } })?.data
    ?.message;
  return Array.isArray(message)
    ? message.join('. ')
    : message ?? 'The request could not be confirmed. Try again.';
}
export function feeBasisPoints(percent: string): number | null {
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(percent.trim())) return null;
  const [whole, fraction = ''] = percent.trim().split('.');
  const value = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return value <= 10000 ? value : null;
}
export const payoutItemFee = (amount: number, bps: number) =>
  Math.floor((amount * bps + 5000) / 10000);
export function uncertainPayoutError(error: unknown) {
  const status = (error as { status?: number | string })?.status;
  return typeof status !== 'number' || status >= 500;
}
