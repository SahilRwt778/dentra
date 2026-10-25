export type DentistUpdate = {
  qualification?: string;
  specialization?: string;
  councilRegNo?: string;
  languages?: string[];
  email?: string;
  offersVideo?: boolean;
  feeVideoPaise?: number;
  feeClinicPaise?: number;
  videoHoursFrom?: string;
  videoHoursTo?: string;
  videoWorkingDays?: number[];
};

export type ClinicInput = {
  name: string;
  addressLine?: string;
  pincode?: string;
  phone?: string;
  hoursFrom: string;
  hoursTo: string;
  workingDays?: number[];
};

export type PayoutDetails = {
  bankAccountHolder: string | null;
  bankAccountNo: string | null;
  bankIfsc: string | null;
  pan: string | null;
  gstin: string | null;
};
export type PayoutRequest = PayoutDetails & {
  id: string;
  dentistId: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
};
export type PayoutProfile = {
  approved: PayoutDetails | null;
  request: PayoutRequest | null;
};
export type PayoutSubmission = {
  bankAccountHolder: string;
  bankAccountNo: string;
  confirmAccountNo: string;
  bankIfsc: string;
  pan: string;
  gstin: string | null;
  previousRequestId: string | null;
};
