import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Today: undefined;
  Schedule: undefined;
  Patients: undefined;
  Profile: undefined;
};

export type StackParamList = {
  Home: NavigatorScreenParams<TabParamList> | undefined;
  Appointment: { appointmentId: string };
  RescheduleAppointment: { appointmentId: string };
  PatientRecord: { patientId: string };
  Consultation: { appointmentId: string };
  PrescriptionPreview: { appointmentId: string };
  Notifications: undefined;
  EditProfile: undefined;
  Clinics: undefined;
  EditClinic: { clinicId?: string } | undefined;
  ConsultationSettings: undefined;
  TimeOff: undefined;
  PayoutDetails: undefined;
  Payments: undefined;
  Wallet: undefined;
  RequestWithdrawal: undefined;
  Withdrawal: { withdrawalId: string };
  PaymentReceipt: { transactionId: string };
  PayoutHistory: undefined;
  PayoutBatch: { batchId: string };
};
