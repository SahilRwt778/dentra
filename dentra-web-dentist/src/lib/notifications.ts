import type {
  BookingNotification,
  Notification,
  WalletWithdrawalNotification,
} from '@/api/generated-api';
import { formatDate, formatTime, rupees } from './date';

export type DentistNotification =
  | BookingNotification
  | WalletWithdrawalNotification;

export function isDentistNotification(
  item: Notification,
): item is DentistNotification {
  return (
    item.type === 'appointment_booked' ||
    item.type === 'wallet_withdrawal_updated'
  );
}

export function notificationContent(item: DentistNotification) {
  if (item.type === 'appointment_booked') {
    return {
      title: 'New appointment',
      description: `${item.patientName} booked ${
        item.appointmentType === 'video'
          ? 'a video visit'
          : 'an in-clinic visit'
      } for ${formatDate(item.date)} at ${formatTime(item.time)}.`,
      path: `/consult/${item.appointmentId}`,
      action: 'View appointment',
    };
  }
  const titles: Record<WalletWithdrawalNotification['status'], string> = {
    approved: 'Withdrawal approved',
    rejected: 'Withdrawal declined',
    processing: 'Withdrawal processing',
    paid: 'Withdrawal paid',
    failed: 'Withdrawal transfer failed',
    cancelled: 'Withdrawal cancelled',
  };
  const descriptions: Record<WalletWithdrawalNotification['status'], string> = {
    approved:
      'Admin approved your request. The amount remains reserved until transfer.',
    rejected: 'Admin declined your request. The reservation was released.',
    processing:
      'Admin is processing your transfer. The amount remains reserved.',
    paid: 'Admin recorded the bank transfer. Open the request for its reference and confirm credit through your bank.',
    failed:
      'The transfer failed. The amount stays reserved while admin reviews it.',
    cancelled: 'Admin cancelled your request. The reservation was released.',
  };
  return {
    title: titles[item.status],
    description: `${rupees(item.amountPaise)} · ${descriptions[item.status]}${
      item.reason ? ` Reason: ${item.reason}` : ''
    }`,
    path: `/wallet/withdrawals/${item.withdrawalId}`,
    action: 'View withdrawal',
  };
}
