export type ClinicCollectionMethod = 'cash' | 'upi' | 'card';
export type ClinicPaymentReceipt = {
  id: string;
  amountPaise: number;
  method: ClinicCollectionMethod;
  collectedAt: string;
};
export type CollectClinicPayment = {
  requestId: string;
  amountPaise: number;
  method: ClinicCollectionMethod;
};
