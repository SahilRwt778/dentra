import type { ClinicPaymentReceipt } from './clinic-payment';
// Types for the endpoints used by this app. The contract lives in ../dentra-api/openapi.yaml.
export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
};
export type OtpChallenge = {
  otpId: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
};
export type DentistStatus =
  | 'draft'
  | 'pending_review'
  | 'verified'
  | 'rejected'
  | 'disabled';
export type DocumentType =
  | 'degree'
  | 'council'
  | 'id_proof'
  | 'selfie'
  | 'clinic_proof'
  | 'insurance';
export type DentistDocument = {
  id: string;
  docType: DocumentType;
  fileUrl: string;
};
export type Clinic = {
  id: string;
  name: string;
  addressLine?: string | null;
  pincode?: string | null;
  phone?: string | null;
  hoursFrom: string;
  hoursTo: string;
  workingDays?: number[];
};
export type Dentist = {
  id: string;
  fullName: string;
  mobile: string;
  email?: string | null;
  status: DentistStatus;
  qualification: string;
  specialization: string;
  councilRegNo: string;
  yearsExperience: number;
  languages: string[];
  offersVideo: boolean;
  videoHoursFrom?: string | null;
  videoHoursTo?: string | null;
  videoWorkingDays?: number[];
  feeVideoPaise: number;
  feeClinicPaise: number;
  rejectionReason?: string | null;
  submittedAt?: string;
  clinics: Clinic[];
  documents: DentistDocument[];
};
export type DentistApplication = {
  fullName: string;
  email?: string;
  qualification: string;
  specialization: string;
  councilRegNo: string;
  yearsExperience: number;
  languages: string[];
  primaryClinicName: string;
  offersVideo: boolean;
  feeVideoPaise: number;
  feeClinicPaise: number;
  termsConsent: true;
  telemedicineConsent: true;
};
export type LocalDocument = {
  uri: string;
  name: string;
  type: string;
  size: number | null;
};
export type AppointmentStatus =
  | 'booked'
  | 'waiting'
  | 'in_consult'
  | 'completed'
  | 'cancelled';
export type Appointment = {
  id: string;
  patientId: string;
  patientName: string;
  patientAge: number | null;
  patientGender: string | null;
  dentistId?: string;
  clinicId?: string | null;
  clinicName?: string | null;
  type: 'video' | 'clinic';
  date: string;
  time: string;
  status: AppointmentStatus;
  concern: string;
  symptomArea?: string;
  symptomSince?: string;
  painScore: number | null;
  swelling: boolean;
  note?: string;
  payment?: {
    amountPaise: number;
    status: string;
    method: string;
    collection?: ClinicPaymentReceipt | null;
  };
};
export type Page<T> = { items: T[]; nextPage: number | null };

export type BookingNotification = {
  id: string;
  type: 'appointment_booked';
  appointmentId: string;
  patientName: string;
  date: string;
  time: string;
  appointmentType: 'clinic' | 'video';
  createdAt: string;
  readAt: string | null;
};
export type NotificationPage = {
  items: DentistNotification[];
  unreadCount: number;
  nextCursor: string | null;
};
export type WalletWithdrawalNotification = {
  id: string;
  type: 'wallet_withdrawal_updated';
  withdrawalId: string;
  amountPaise: number;
  status:
    | 'approved'
    | 'rejected'
    | 'processing'
    | 'paid'
    | 'failed'
    | 'cancelled';
  reason: string | null;
  createdAt: string;
  readAt: string | null;
};
export type DentistNotification =
  | BookingNotification
  | WalletWithdrawalNotification;
export type PatientFile = {
  id: string;
  appointmentId: string | null;
  name: string;
  mimeType: 'image/jpeg' | 'image/png' | 'application/pdf';
  sizeBytes: number;
  createdAt: string;
};

export type VideoStatus = {
  available: boolean;
  canJoin: boolean;
  reason:
    | 'ready'
    | 'unavailable'
    | 'not_video'
    | 'closed'
    | 'too_early'
    | 'payment_required'
    | 'dentist_unavailable'
    | 'session_ended';
  opensAt: string;
  closesAt: string;
  serverNow: string;
  roomName: string | null;
};
export type VideoSession = import('@dentra/video').VideoCredentials & {
  roomName: string;
  role: 'dentist';
  closesAt: string;
  issuedAt: string;
};
