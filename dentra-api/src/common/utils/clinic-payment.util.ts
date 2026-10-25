export interface ClinicPaymentReceipt {
  id: string;
  amountPaise: number;
  method: 'cash' | 'upi' | 'card';
  collectedAt: string;
}

export interface ClinicPaymentColumns {
  collection_id: string | null;
  collection_amount: number | null;
  collection_method: ClinicPaymentReceipt['method'] | null;
  collected_at: string | Date | null;
}

export const CLINIC_PAYMENT_COLUMNS = `cp.id as collection_id, cp.amount_paise as collection_amount,
  cp.method as collection_method, cp.collected_at`;

export function clinicPaymentReceipt(
  row: ClinicPaymentColumns,
): ClinicPaymentReceipt | null {
  if (!row.collection_id) return null;
  return {
    id: row.collection_id,
    amountPaise: row.collection_amount!,
    method: row.collection_method!,
    collectedAt: new Date(row.collected_at!).toISOString(),
  };
}
