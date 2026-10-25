import type {
  DentistNotification,
  WalletWithdrawalNotification,
} from '../../common/types/api';
import { formatDate, formatTime, money } from '../../common/utils/date';

const withdrawalTitles: Record<WalletWithdrawalNotification['status'], string> =
  {
    approved: 'Withdrawal approved',
    rejected: 'Withdrawal declined',
    processing: 'Withdrawal processing',
    paid: 'Withdrawal paid',
    failed: 'Withdrawal transfer failed',
    cancelled: 'Withdrawal cancelled',
  };

export function notificationContent(item: DentistNotification) {
  if (item.type === 'appointment_booked') {
    return {
      title: 'New appointment booking',
      description: `${item.patientName} booked ${
        item.appointmentType === 'video'
          ? 'a video consultation'
          : 'an in-clinic visit'
      }.`,
      detail: `${formatDate(item.date)} · ${formatTime(item.time)}`,
      action: 'View appointment',
      accessibilityLabel: `${item.patientName} booked ${formatDate(
        item.date,
      )} at ${formatTime(item.time)}. View appointment.`,
    };
  }
  const title = withdrawalTitles[item.status];
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
    title,
    description: `${money(item.amountPaise)} · ${descriptions[item.status]}`,
    detail: item.reason,
    action: 'View withdrawal',
    accessibilityLabel: `${title}. ${money(item.amountPaise)}. ${
      item.reason ?? ''
    } View withdrawal.`,
  };
}
