export type WithdrawalStatus =
  | 'requested'
  | 'approved'
  | 'processing'
  | 'paid'
  | 'rejected'
  | 'failed'
  | 'cancelled';
export type WalletBalance = {
  availablePaise: number;
  shortfallPaise: number;
  reservedPaise: number;
  withdrawnPaise: number;
  pendingPaise: number;
  eligibleGrossPaise: number;
  eligibleFeePaise: number;
  unpricedGrossPaise: number;
  unpricedCount: number;
};
export type DentistWallet = WalletBalance & {
  feeBps: number | null;
  minimumWithdrawalPaise: number | null;
  version: number;
  configured: boolean;
  account: { approvalId: string; last4: string; ifsc: string } | null;
};
export type Withdrawal = {
  id: string;
  dentistId: string;
  dentistName: string;
  amountPaise: number;
  minimumPaise: number;
  status: WithdrawalStatus;
  version: number;
  accountLast4: string;
  bankIfsc: string;
  bankReference: string | null;
  paidOn: string | null;
  createdAt: string;
  updatedAt: string;
};
export type WithdrawalDetail = Withdrawal & {
  wallet: WalletBalance;
  account: null;
  accountChanged: boolean;
  approvalId: string;
  events: {
    id: string;
    status: WithdrawalStatus;
    note: string | null;
    createdAt: string;
  }[];
};
export type WithdrawalPage = {
  items: Withdrawal[];
  total: number;
  nextPage: number | null;
};
export type WithdrawalQuery = {
  page: number;
  limit?: number;
  status?: WithdrawalStatus;
};
export type RequestWithdrawal = {
  requestId: string;
  accountApprovalId: string;
  amountPaise: number;
};
