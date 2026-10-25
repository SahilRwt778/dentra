import { Text } from 'react-native';
import type { Appointment } from '@/api/types';
import { Detail } from '@/components/ui';
import { ui } from '@/theme';

const METHODS = { cash: 'Cash', upi: 'UPI', card: 'Card' };
export function ClinicPaymentDetails({
  appointment,
}: {
  appointment: Appointment;
}) {
  const receipt = appointment.payment?.collection;
  if (!receipt) return null;
  const collectedAt = new Date(receipt.collectedAt).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
  return (
    <>
      <Detail label="Paid at clinic by" value={METHODS[receipt.method]} />
      <Detail label="Collected on" value={`${collectedAt} IST`} />
      <Detail label="Receipt" value={receipt.id} />
      {appointment.status === 'cancelled' && (
        <Text style={ui.muted}>
          For any refund, contact the clinic directly.
        </Text>
      )}
    </>
  );
}
