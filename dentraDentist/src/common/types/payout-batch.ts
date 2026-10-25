export type PayoutBatchStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'cancelled';
export type PayoutBatch = {
  id: string;
  dentistId: string;
  dentistName: string;
  status: PayoutBatchStatus;
  version: number;
  feeBps: number;
  grossPaise: number;
  feePaise: number;
  netPaise: number;
  accountLast4: string;
  bankIfsc: string;
  createdAt: string;
  updatedAt: string;
  bankReference: string | null;
  paidOn: string | null;
  needsAttention: boolean;
};
export type PayoutBatchDetail = PayoutBatch & {
  account: null;
  items: {
    transactionId: string;
    appointmentId: string;
    patientName: string;
    amountPaise: number;
    feePaise: number;
    paymentStatus: string;
    appointmentStatus: string;
    released: boolean;
  }[];
  events: {
    id: string;
    status: PayoutBatchStatus;
    note: string | null;
    createdAt: string;
  }[];
};
export type PayoutBatchPage = {
  items: PayoutBatch[];
  total: number;
  reservedPaise: number;
  paidPaise: number;
  nextPage: number | null;
};
export type PayoutBatchQuery = {
  page: number;
  limit?: number;
  status?: PayoutBatchStatus;
};
