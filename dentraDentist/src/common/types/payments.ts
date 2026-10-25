import type { AppointmentStatus } from './api';
import type { ClinicPaymentReceipt } from './clinic-payment';

export type PaymentStatus =
  | 'pending'
  | 'paid'
  | 'due_at_clinic'
  | 'refund_pending'
  | 'refund_failed'
  | 'refunded'
  | 'cancelled'
  | 'failed';
export type PaymentSource = 'online' | 'clinic';
export type DentistPayment = {
  id: string;
  appointmentId: string;
  patientName: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: 'clinic' | 'video';
  appointmentStatus: AppointmentStatus;
  clinicName: string | null;
  amountPaise: number;
  source: PaymentSource;
  method: 'upi' | 'card' | 'netbanking' | 'pay_at_clinic';
  status: PaymentStatus;
  collection: ClinicPaymentReceipt | null;
  gatewayOrderId: string | null;
  gatewayPaymentId: string | null;
  gatewayRefundId: string | null;
  createdAt: string;
  updatedAt: string;
};
export type DentistPaymentSummary = {
  totalTransactions: number;
  onlinePaidAmountPaise: number;
  clinicCollectedAmountPaise: number;
  dueAtClinicAmountPaise: number;
  pendingOnlineAmountPaise: number;
  refundPendingAmountPaise: number;
  refundFailedAmountPaise: number;
  refundedAmountPaise: number;
};
export type DentistPayments = {
  summary: DentistPaymentSummary;
  items: DentistPayment[];
  page: number;
  limit: number;
  nextPage: number | null;
};
export type PaymentsQuery = {
  page: number;
  limit?: number;
  q?: string;
  status?: PaymentStatus;
  source?: PaymentSource;
  from?: string;
  to?: string;
};
